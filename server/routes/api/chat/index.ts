import type { Express } from "express";
import { storage } from "../../../storage";
import { chatWithGemini, chatWithGeminiFunctionsStreaming, chatWithGeminiFunctionsIterative } from "../../../gemini";

export function registerChatRoutes(app: Express) {
  // POST /api/chat - Basic chat
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, contextObjectIds = [] } = req.body;
      
      // Fetch context objects if provided
      const contextObjects = [];
      for (const objId of contextObjectIds) {
        const obj = await storage.getObject(objId);
        if (obj) contextObjects.push(obj);
      }
      
      const response = await chatWithGemini({
        messages,
        contextObjects: contextObjects
      });
      
      res.json({ response });
    } catch (error) {
      console.error('Chat error:', error);
      res.status(500).json({ error: "Failed to process chat request" });
    }
  });

  // POST /api/chat/functions - Enhanced chat with function calling
  app.post("/api/chat/functions", async (req, res) => {
    try {
      const { messages, contextObjectIds = [], conversationId } = req.body;
      
      // Import retrieval service
      const { retrievalService } = await import('../../../retrieval-service');
      
      // Parse explicit mentions and get their objects
      const lastUserMessage = messages[messages.length - 1];
      const userText = lastUserMessage?.content || '';
      
      const mentions = await storage.parseMentions(userText);
      const mentionIds = await storage.resolveMentionObjects(mentions);
      
      // Fetch actual mention objects
      const mentionObjects = [];
      for (const objId of mentionIds) {
        const obj = await storage.getObject(objId);
        if (obj) mentionObjects.push(obj);
      }
      
      // Fetch explicit context objects
      const explicitContextObjects = [];
      for (const objId of contextObjectIds) {
        const obj = await storage.getObject(objId);
        if (obj) explicitContextObjects.push(obj);
      }
      
      // Auto-retrieve relevant context using RAG
      const autoContext = await retrievalService.buildAutoContext({
        conversationId,
        userText,
        explicitContextIds: contextObjectIds,
        mentions: mentionIds
      });
      
      // For the first endpoint, we don't implement first-reference logic yet
      // Just combine all context objects as before
      const allContextObjects = [
        ...explicitContextObjects,
        ...mentionObjects
      ];
      
      // Add full objects for auto-retrieved context
      for (const contextDoc of autoContext.usedDocs) {
        const fullDoc = await storage.getObject(contextDoc.id);
        if (fullDoc && !allContextObjects.find(d => d.id === fullDoc.id)) {
          allContextObjects.push(fullDoc);
        }
      }
      
      const contextObjects = allContextObjects;
      const referencedObjects: Array<{
        id: string;
        name: string;
        type: string;
        aliases: string[];
        date?: string | null;
        isReferenced: boolean;
      }> = []; // Empty for now
      
      // Add retrieved context to system instruction (immutable)
      const enrichedMessages = [...messages];
      if (autoContext.contextText && enrichedMessages.length > 0) {
        // Prepend auto-retrieved context to the first message
        enrichedMessages[0] = {
          ...enrichedMessages[0],
          content: `${autoContext.contextText}\n\n---\n\n${enrichedMessages[0].content}`
        };
      }
      
      console.log('Function calling chat request:', { 
        messageCount: messages?.length, 
        contextObjectIds: contextObjectIds.length,
        autoRetrievedDocs: autoContext.usedDocs.length,
      });
      
      const response = await chatWithGeminiFunctionsStreaming({
        messages: enrichedMessages,
        contextObjects: contextObjects,
        referencedObjects: referencedObjects
      });
      
      res.json({ 
        response,
        contextUsed: autoContext.usedDocs,
        retrievalMetadata: autoContext.retrievalMetadata,
        citations: autoContext.citations
      });
    } catch (error) {
      console.error('Function calling chat error:', error);
      res.status(500).json({ error: "Failed to process function calling chat request" });
    }
  });

  // POST /api/chat/stream - Streaming chat with function calling
  app.post("/api/chat/stream", async (req, res) => {
    try {
      const { messages, contextObjectIds = [], conversationId, autoRetrievalEnabled = true } = req.body;
      
      // Import retrieval service
      const { retrievalService } = await import('../../../retrieval-service');
      
      // Parse explicit mentions and get their objects
      const lastUserMessage = messages[messages.length - 1];
      const userText = lastUserMessage?.content || '';
      
      const mentions = await storage.parseMentions(userText);
      const mentionIds = await storage.resolveMentionObjects(mentions);
      
      // Also check for mention_context_object in the database for this conversation
      const conversationMessages = await storage.getMessagesByConversation(conversationId);
      const mentionContextMessage = conversationMessages.find((msg: any) => 
        msg.type === 'mention_context_object' && 
        msg.role === 'user' &&
        new Date(msg.createdAt).getTime() > new Date().getTime() - 60000 // Within last minute
      );
      
      // Extract object IDs from mention_context_object if found
      if (mentionContextMessage && mentionContextMessage.content && 
          typeof mentionContextMessage.content === 'object' && 
          'objects' in mentionContextMessage.content) {
        const content = mentionContextMessage.content as { objects: string[] };
        console.log('🔍 [STREAMING] Found mention_context_object with objects:', content.objects);
        mentionIds.push(...content.objects);
      } else {
        console.log('🔍 [STREAMING] No mention_context_object found or invalid format');
      }
      
      // Fetch actual mention objects
      const mentionObjects = [];
      for (const objId of mentionIds) {
        const obj = await storage.getObject(objId);
        if (obj) mentionObjects.push(obj);
      }
      
      // Fetch explicit context objects
      const explicitContextObjects = [];
      for (const objId of contextObjectIds) {
        const obj = await storage.getObject(objId);
        if (obj) explicitContextObjects.push(obj);
      }
      
      // Auto-retrieve relevant context using RAG (only if local setting allows it)
      // The buildAutoContext function already checks the global autoRag setting
      let autoContext;
      if (autoRetrievalEnabled) {
        autoContext = await retrievalService.buildAutoContext({
          conversationId,
          userText,
          explicitContextIds: contextObjectIds,
          mentions: mentionIds
        });
      } else {
        // Return empty context if auto-retrieval is disabled locally
        autoContext = {
          contextText: "",
          citations: [],
          usedDocs: [],
          retrievalMetadata: {
            totalDocs: 0,
            totalChunks: 0,
            estimatedTokens: 0,
            processingTimeMs: 0
          }
        };
      }
      
      // Track objects that have been referenced in this conversation before
      const referencedObjectIds = new Set<string>();
      
      // Check all previous messages in this conversation for referenced objects
      for (const msg of conversationMessages) {
        if (msg.type === 'mention_context_object' || msg.type === 'auto_retrieval_context_object') {
          if (msg.content && typeof msg.content === 'object' && 'objects' in msg.content) {
            const content = msg.content as { objects: string[] };
            content.objects.forEach(id => referencedObjectIds.add(id));
          }
        }
      }
      
      console.log('🔍 [FIRST-REFERENCE] Previously referenced objects:', Array.from(referencedObjectIds));
      
      // Combine all context objects with first-reference logic
      const allContextObjects = [];
      const referencedObjects = []; // Objects that have been referenced before (only metadata)
      
      // Process explicit context objects
      for (const obj of explicitContextObjects) {
        if (referencedObjectIds.has(obj.id)) {
          referencedObjects.push({
            id: obj.id,
            name: obj.name,
            type: obj.type,
            aliases: obj.aliases,
            date: obj.date,
            isReferenced: true
          });
        } else {
          allContextObjects.push(obj);
          referencedObjectIds.add(obj.id); // Mark as referenced
        }
      }
      
      // Process mention objects
      for (const obj of mentionObjects) {
        if (referencedObjectIds.has(obj.id)) {
          referencedObjects.push({
            id: obj.id,
            name: obj.name,
            type: obj.type,
            aliases: obj.aliases,
            date: obj.date,
            isReferenced: true
          });
        } else {
          allContextObjects.push(obj);
          referencedObjectIds.add(obj.id); // Mark as referenced
        }
      }
      
      // Process auto-retrieved context objects
      for (const contextObj of autoContext.usedDocs) {
        const fullObj = await storage.getObject(contextObj.id);
        if (fullObj) {
          if (referencedObjectIds.has(fullObj.id)) {
            referencedObjects.push({
              id: fullObj.id,
              name: fullObj.name,
              type: fullObj.type,
              aliases: fullObj.aliases,
              date: fullObj.date,
              isReferenced: true
            });
          } else {
            allContextObjects.push(fullObj);
            referencedObjectIds.add(fullObj.id); // Mark as referenced
          }
        }
      }
      
      console.log('📊 [FIRST-REFERENCE] New objects (full content):', allContextObjects.length);
      console.log('📊 [FIRST-REFERENCE] Referenced objects (metadata only):', referencedObjects.length);
      
      const contextObjects = allContextObjects;
      
      // Set SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      let fullResponse = '';
      let thinking = '';
      let functionCalls: Array<{name: string; arguments: any; result?: any}> = [];

      try {
        // Add retrieved context to system instruction (immutable)
        const enrichedMessages = [...messages];
        if (autoContext.contextText && enrichedMessages.length > 0) {
          // Prepend auto-retrieved context to the first message
          enrichedMessages[0] = {
            ...enrichedMessages[0],
            content: `${autoContext.contextText}\n\n---\n\n${enrichedMessages[0].content}`
          };
        }

        // Generate conversation group ID for this response cycle
        const conversationGroupId = `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        console.log('\n🔗 [CONVERSATION GROUP] Generated group ID:', conversationGroupId);
        
        // For now, use the regular function calling and simulate streaming
        console.log('\n🚀 [API REQUEST] Starting Gemini function calling...');
        console.log('📊 Message count:', enrichedMessages.length);
        console.log('🔍 Context objects:', contextObjects.length);
        
        const response = await chatWithGeminiFunctionsIterative({
          messages: enrichedMessages,
          contextObjects: contextObjects,
          referencedObjects: referencedObjects,
          conversationId,
          conversationGroupId
        });
        
        console.log('✅ [API RESPONSE] Gemini function calling completed');

        // Extract content from the response
        const content = response.content || '';
        
        // Extract final response content (events were already saved in real-time during streaming)
        fullResponse = content;
        
        // Update tracking variables for SSE completion
        functionCalls = response.events?.filter(e => e.type === 'function_call').map(e => ({
          name: e.name,
          arguments: e.arguments,
          result: e.result
        })) || [];
        thinking = response.events?.filter(e => e.type === 'thinking').map(e => e.content).join('\n\n--- After Function Call Analysis ---\n') || '';
        
        // Send final content (since streaming already happened in gemini-functions.ts)
        res.write(`data: ${JSON.stringify({ type: 'token', content })}\n\n`);

        // Send context metadata for transparency
        res.write(`data: ${JSON.stringify({ 
          type: 'context', 
          contextUsed: autoContext.usedDocs,
          retrievalMetadata: autoContext.retrievalMetadata,
          citations: autoContext.citations
        })}\n\n`);

        // Response chunks were already saved in real-time during streaming
        // No need for additional database operations here
        console.log('ℹ️ [STREAMING COMPLETE] All events saved in real-time during streaming');

        res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
      } catch (streamError) {
        const errorMessage = streamError instanceof Error ? streamError.message : 'Unknown error';
        res.write(`data: ${JSON.stringify({ type: 'error', content: errorMessage })}\n\n`);
      }

      res.end();
    } catch (error) {
      console.error('Error in streaming chat:', error);
      res.status(500).json({ error: "Failed to process streaming chat request" });
    }
  });
}
