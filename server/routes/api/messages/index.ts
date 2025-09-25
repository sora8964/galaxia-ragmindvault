import type { Express } from "express";
import { storage } from "../../../storage";
import { insertMessageSchema, updateMessageSchema, parseMentionsSchema } from "@shared/schema";
import { z } from "zod";

// Helper function to process user message and create context messages
async function processUserMessage({
  conversationId,
  content,
  autoRetrievalEnabled = true,
  explicitContextObjects = [],
  isRegeneration = false
}: {
  conversationId: string;
  content: string;
  autoRetrievalEnabled?: boolean;
  explicitContextObjects?: string[];
  isRegeneration?: boolean;
}) {
  // Parse mentions from content and auto-populate contextObjects
  const mentions = await storage.parseMentions(content);
  const contextObjects = await storage.resolveMentionObjects(mentions);
  
  // Generate conversation group ID for this prompt-response cycle
  const conversationGroupId = `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
      // Import retrieval service for auto-context on user messages
      const { retrievalService } = await import('../../../retrieval-service');
  
  // Auto-retrieve relevant context using RAG for user messages (only if both global and local settings allow it)
  let autoContext;
  if (autoRetrievalEnabled) {
    autoContext = await retrievalService.buildAutoContext({
      conversationId,
      userText: content,
      explicitContextIds: explicitContextObjects,
      mentions: contextObjects
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
  
  // Combine all context objects including auto-retrieved ones (deduplicated)
  const allContextObjects = Array.from(new Set([
    ...explicitContextObjects, 
    ...contextObjects,
    ...autoContext.usedDocs.map(d => d.id)
  ]));
  
  // Create the main prompt message (skip if regeneration)
  let promptMessage = null;
  if (!isRegeneration) {
    promptMessage = await storage.createMessage({
      conversationId,
      conversationGroupId,
      role: 'user',
      type: 'prompt',
      content: { text: content }
    });
  }
  
  // Create auto-retrieval context message if there are retrieved docs
  let autoRetrievalMessage = null;
  if (autoContext.usedDocs.length > 0) {
    autoRetrievalMessage = await storage.createMessage({
      conversationId,
      conversationGroupId,
      role: 'user',
      type: 'auto_retrieval_context_object',
      content: {
        objects: allContextObjects,
        metadata: {
          usedDocs: autoContext.usedDocs,
          retrievalMetadata: autoContext.retrievalMetadata,
          citations: autoContext.citations
        }
      }
    });
  }
  
  // Create mention context message if there are explicit mentions
  let mentionMessage = null;
  if (mentions.length > 0) {
    mentionMessage = await storage.createMessage({
      conversationId,
      conversationGroupId,
      role: 'user',
      type: 'mention_context_object',
      content: {
        objects: contextObjects,
        mentions: mentions.map(m => ({
          id: m.objectId,
          name: m.name,
          alias: m.alias,
          type: m.type
        }))
      }
    });
  }
  
  return {
    promptMessage,
    conversationGroupId,
    parsedMentions: mentions,
    autoContext: {
      usedDocs: autoContext.usedDocs,
      retrievalMetadata: autoContext.retrievalMetadata,
      citations: autoContext.citations
    },
    contextMessages: {
      autoRetrieval: autoRetrievalMessage,
      mention: mentionMessage
    }
  };
}

export function registerMessageRoutes(app: Express) {
  // GET /api/conversations/:id/messages - Get messages for conversation
  app.get("/api/conversations/:id/messages", async (req, res) => {
    try {
      const messages = await storage.getMessagesByConversation(req.params.id);
      res.json(messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // POST /api/conversations/:id/messages - Create new message
  app.post("/api/conversations/:id/messages", async (req, res) => {
    try {
      const content = typeof req.body.content === 'string' 
        ? req.body.content 
        : req.body.content?.text || '';
      const autoRetrievalEnabled = req.body.autoRetrievalEnabled !== false; // Default to true for backward compatibility
      
      const result = await processUserMessage({
        conversationId: req.params.id,
        content,
        autoRetrievalEnabled,
        explicitContextObjects: req.body.contextObjects || []
      });
      
      res.status(201).json({
        message: result.promptMessage,
        conversationGroupId: result.conversationGroupId,
        parsedMentions: result.parsedMentions,
        autoContext: result.autoContext,
        contextMessages: result.contextMessages
      });
    } catch (error) {
      console.error('Error creating message:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid message data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create message" });
    }
  });

  // DELETE /api/messages/:id - Delete message
  app.delete("/api/messages/:id", async (req, res) => {
    try {
      const success = await storage.deleteMessage(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Message not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting message:', error);
      res.status(500).json({ error: "Failed to delete message" });
    }
  });

  // POST /api/conversations/:id/reprocess-message - Reprocess message for regeneration
  app.post("/api/conversations/:id/reprocess-message", async (req, res) => {
    try {
      const { messageId, autoRetrievalEnabled = true } = req.body;
      
      // Get the original user message
      const messages = await storage.getMessagesByConversation(req.params.id);
      const userMessage = messages.find(msg => msg.id === messageId && msg.role === 'user' && msg.type === 'prompt');
      
      if (!userMessage) {
        return res.status(404).json({ error: "User message not found" });
      }
      
      const content = typeof userMessage.content === 'string' 
        ? userMessage.content 
        : (userMessage.content as { text?: string })?.text || '';
      
      // Process the user message to recreate context messages (skip creating new prompt message)
      const result = await processUserMessage({
        conversationId: req.params.id,
        content,
        autoRetrievalEnabled,
        explicitContextObjects: [],
        isRegeneration: true
      });
      
      res.status(200).json({
        message: result.promptMessage,
        conversationGroupId: result.conversationGroupId,
        parsedMentions: result.parsedMentions,
        autoContext: result.autoContext,
        contextMessages: result.contextMessages
      });
    } catch (error) {
      console.error('Error reprocessing message:', error);
      res.status(500).json({ error: "Failed to reprocess message" });
    }
  });

  // PATCH /api/conversations/:conversationId/messages/:messageId - Update message
  app.patch("/api/conversations/:conversationId/messages/:messageId", async (req, res) => {
    try {
      // Validate that the message belongs to the specified conversation
      const messages = await storage.getMessagesByConversation(req.params.conversationId);
      const messageExists = messages.some(msg => msg.id === req.params.messageId);
      
      if (!messageExists) {
        return res.status(404).json({ error: "Message not found in this conversation" });
      }
      
      // Parse mentions from content if it's being updated
      let contextObjects = req.body.contextObjects || [];
      if (req.body.content) {
        const mentions = await storage.parseMentions(req.body.content);
        const resolvedObjects = await storage.resolveMentionObjects(mentions);
        contextObjects = [...contextObjects, ...resolvedObjects];
      }
      
      const validatedData = updateMessageSchema.parse(req.body);
      
      const updatedMessage = await storage.updateMessage(req.params.messageId, validatedData);
      if (!updatedMessage) {
        return res.status(404).json({ error: "Message not found" });
      }
      
      res.json(updatedMessage);
    } catch (error) {
      console.error('Error updating message:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid message data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update message" });
    }
  });

  // DELETE /api/conversations/:conversationId/messages/:messageId - Delete message with conversation context
  app.delete("/api/conversations/:conversationId/messages/:messageId", async (req, res) => {
    try {
      // Validate that the message belongs to the specified conversation
      const messages = await storage.getMessagesByConversation(req.params.conversationId);
      const messageExists = messages.some(msg => msg.id === req.params.messageId);
      
      if (!messageExists) {
        return res.status(404).json({ error: "Message not found in this conversation" });
      }
      
      // Check if conversation exists
      const conversation = await storage.getConversation(req.params.conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      // Delete with cascading logic (always true to ensure subsequent messages are deleted)
      const success = await storage.deleteMessage(req.params.messageId);
      if (!success) {
        return res.status(404).json({ error: "Message not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting message:', error);
      res.status(500).json({ error: "Failed to delete message" });
    }
  });

  // DELETE /api/conversations/:conversationId/messages/:messageId/after - Delete messages after specific message
  app.delete("/api/conversations/:conversationId/messages/:messageId/after", async (req, res) => {
    console.log('🌐 [API DELETE] Received delete messages after request');
    console.log('🌐 [API DELETE] Conversation ID:', req.params.conversationId);
    console.log('🌐 [API DELETE] Message ID:', req.params.messageId);
    
    try {
      // Check if conversation exists
      const conversation = await storage.getConversation(req.params.conversationId);
      console.log('🌐 [API DELETE] Conversation exists:', !!conversation);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      // Validate that the message belongs to the specified conversation
      const messages = await storage.getMessagesByConversation(req.params.conversationId);
      console.log('🌐 [API DELETE] Total messages in conversation:', messages.length);
      const messageExists = messages.some(msg => msg.id === req.params.messageId);
      console.log('🌐 [API DELETE] Target message exists:', messageExists);
      
      if (!messageExists) {
        return res.status(404).json({ error: "Message not found in this conversation" });
      }
      
      // Delete all messages after the specified message
      console.log('🌐 [API DELETE] Calling storage.deleteMessagesAfter...');
      const success = await storage.deleteMessagesAfter(req.params.conversationId, req.params.messageId);
      console.log('🌐 [API DELETE] Delete result:', success);
      
      res.json({ 
        success,
        message: success ? "Messages deleted successfully" : "No messages were deleted" 
      });
    } catch (error) {
      console.error('🌐 [API DELETE] Error deleting messages after specified message:', error);
      res.status(500).json({ error: "Failed to delete messages" });
    }
  });
}
