import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, type RelationshipFilters } from "./storage";
import { insertObjectSchema, updateObjectSchema, insertConversationSchema, insertMessageSchema, updateMessageSchema, parseMentionsSchema, updateAppConfigSchema, insertRelationshipSchema, updateRelationshipSchema, DocumentType } from "@shared/schema";
import { chatWithGemini, extractTextFromPDF, extractTextFromWord, generateTextEmbedding } from "./gemini-simple";
import { chatWithGeminiFunctions } from "./gemini-functions";
import { embeddingService } from "./embedding-service";
import { chunkingService } from "./chunking-service";
import { z } from "zod";

// Zod schemas for relationship query validation
const relationshipQuerySchema = z.object({
  sourceId: z.string().optional(),
  targetId: z.string().optional(),
  sourceType: DocumentType.optional(),
  targetType: DocumentType.optional(),
  relationKind: z.string().optional(),
  direction: z.enum(["out", "in", "both"]).optional(),
  limit: z.coerce.number().min(1).max(1000).optional(),
  offset: z.coerce.number().min(0).optional()
});

const documentRelationshipQuerySchema = z.object({
  direction: z.enum(["out", "in", "both"]).optional(),
  relationKind: z.string().optional(),
  targetType: DocumentType.optional(),
  limit: z.coerce.number().min(1).max(1000).optional(),
  offset: z.coerce.number().min(0).optional()
});

// Preprocess request data to normalize empty strings to null for nullable fields
function preprocessDocumentData(data: any) {
  return {
    ...data,
    date: data.date === "" ? null : data.date
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Document routes
  app.get("/api/objects", async (req, res) => {
    try {
      const { type, search } = req.query;
      
      if (search) {
        const result = await storage.searchDocuments(
          search as string, 
          type as "person" | "document" | "organization" | "issue" | "log" | undefined
        );
        res.json(result);
      } else if (type) {
        const documents = await storage.getDocumentsByType(type as "person" | "document" | "organization" | "issue" | "log");
        res.json({ objects: documents, total: documents.length });
      } else {
        const documents = await storage.getAllDocuments();
        res.json({ objects: documents, total: documents.length });
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  app.get("/api/objects/:id", async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.json(document);
    } catch (error) {
      console.error('Error fetching document:', error);
      res.status(500).json({ error: "Failed to fetch document" });
    }
  });

  app.post("/api/objects", async (req, res) => {
    try {
      // Preprocess data to normalize empty strings
      const preprocessedData = preprocessDocumentData(req.body);
      const validatedData = insertObjectSchema.parse(preprocessedData);
      
      const document = await storage.createDocument(validatedData);
      
      // Trigger immediate embedding for mention-created documents
      if (!validatedData.isFromOCR) {
        await embeddingService.triggerImmediateEmbedding(document.id);
      }
      
      res.status(201).json(document);
    } catch (error) {
      console.error('Error creating document:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid document data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create document" });
    }
  });

  app.put("/api/objects/:id", async (req, res) => {
    try {
      // Preprocess data to normalize empty strings
      const preprocessedData = preprocessDocumentData(req.body);
      const validatedData = updateObjectSchema.parse(preprocessedData);
      
      const document = await storage.updateDocument(req.params.id, validatedData);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      // Trigger chunking and embedding after document update
      await embeddingService.queueDocumentForEmbedding(document.id);
      
      res.json(document);
    } catch (error) {
      console.error('Error updating document:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid document data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update document" });
    }
  });

  app.delete("/api/objects/:id", async (req, res) => {
    try {
      const success = await storage.deleteDocument(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting document:', error);
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  // Mention suggestions endpoint
  app.get("/api/mentions", async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string') {
        return res.json([]);
      }
      
      const suggestions = await storage.getMentionSuggestions(q);
      res.json(suggestions);
    } catch (error) {
      console.error('Error fetching mention suggestions:', error);
      res.status(500).json({ error: "Failed to fetch mention suggestions" });
    }
  });

  // Conversation routes
  app.get("/api/conversations", async (req, res) => {
    try {
      const conversations = await storage.getAllConversations();
      res.json(conversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.get("/api/conversations/:id", async (req, res) => {
    try {
      const conversation = await storage.getConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      res.json(conversation);
    } catch (error) {
      console.error('Error fetching conversation:', error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  app.post("/api/conversations", async (req, res) => {
    try {
      const validatedData = insertConversationSchema.parse(req.body);
      const conversation = await storage.createConversation(validatedData);
      res.status(201).json(conversation);
    } catch (error) {
      console.error('Error creating conversation:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid conversation data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  app.put("/api/conversations/:id", async (req, res) => {
    try {
      const { title } = req.body;
      const conversation = await storage.updateConversation(req.params.id, { title });
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      res.json(conversation);
    } catch (error) {
      console.error('Error updating conversation:', error);
      res.status(500).json({ error: "Failed to update conversation" });
    }
  });

  app.delete("/api/conversations/:id", async (req, res) => {
    try {
      const success = await storage.deleteConversation(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting conversation:', error);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  // Message routes
  app.get("/api/conversations/:id/messages", async (req, res) => {
    try {
      const messages = await storage.getMessagesByConversation(req.params.id);
      res.json(messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/conversations/:id/messages", async (req, res) => {
    try {
      // Parse mentions from content and auto-populate contextDocuments
      const content = req.body.content || '';
      const mentions = await storage.parseMentions(content);
      const contextDocuments = await storage.resolveMentionDocuments(mentions);
      
      const validatedData = insertMessageSchema.parse({
        ...req.body,
        conversationId: req.params.id,
        contextDocuments: [...(req.body.contextDocuments || []), ...contextDocuments]
      });
      
      const message = await storage.createMessage(validatedData);
      res.status(201).json({
        message,
        parsedMentions: mentions
      });
    } catch (error) {
      console.error('Error creating message:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid message data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create message" });
    }
  });

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

  // Message editing endpoint with conversation context
  app.patch("/api/conversations/:conversationId/messages/:messageId", async (req, res) => {
    try {
      // Validate that the message belongs to the specified conversation
      const messages = await storage.getMessagesByConversation(req.params.conversationId);
      const messageExists = messages.some(msg => msg.id === req.params.messageId);
      
      if (!messageExists) {
        return res.status(404).json({ error: "Message not found in this conversation" });
      }
      
      // Parse mentions from content if it's being updated
      let contextDocuments = req.body.contextDocuments || [];
      if (req.body.content) {
        const mentions = await storage.parseMentions(req.body.content);
        const resolvedDocuments = await storage.resolveMentionDocuments(mentions);
        contextDocuments = [...contextDocuments, ...resolvedDocuments];
      }
      
      const validatedData = updateMessageSchema.parse({
        ...req.body,
        contextDocuments
      });
      
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

  // Message deletion endpoint with conversation context and cascading delete
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
      const success = await storage.deleteMessage(req.params.messageId, true);
      if (!success) {
        return res.status(404).json({ error: "Message not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting message:', error);
      res.status(500).json({ error: "Failed to delete message" });
    }
  });

  // Bulk delete messages after specific message endpoint (for regenerate functionality)
  app.delete("/api/conversations/:conversationId/messages/:messageId/after", async (req, res) => {
    try {
      // Check if conversation exists
      const conversation = await storage.getConversation(req.params.conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      // Validate that the message belongs to the specified conversation
      const messages = await storage.getMessagesByConversation(req.params.conversationId);
      const messageExists = messages.some(msg => msg.id === req.params.messageId);
      
      if (!messageExists) {
        return res.status(404).json({ error: "Message not found in this conversation" });
      }
      
      // Delete all messages after the specified message
      const success = await storage.deleteMessagesAfter(req.params.conversationId, req.params.messageId);
      
      res.json({ 
        success,
        message: success ? "Messages deleted successfully" : "No messages were deleted" 
      });
    } catch (error) {
      console.error('Error deleting messages after specified message:', error);
      res.status(500).json({ error: "Failed to delete messages" });
    }
  });

  // Mention parsing endpoint
  app.post("/api/mentions/parse", async (req, res) => {
    try {
      const validatedData = parseMentionsSchema.parse(req.body);
      const mentions = await storage.parseMentions(validatedData.text);
      const resolvedDocumentIds = await storage.resolveMentionDocuments(mentions);
      
      res.json({
        mentions,
        resolvedDocumentIds
      });
    } catch (error) {
      console.error('Error parsing mentions:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to parse mentions" });
    }
  });

  // Chat routes
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, contextDocumentIds = [] } = req.body;
      
      // Fetch context documents if provided
      const contextDocuments = [];
      for (const docId of contextDocumentIds) {
        const doc = await storage.getDocument(docId);
        if (doc) contextDocuments.push(doc);
      }
      
      const response = await chatWithGemini({
        messages,
        contextDocuments
      });
      
      res.json({ response });
    } catch (error) {
      console.error('Chat error:', error);
      res.status(500).json({ error: "Failed to process chat request" });
    }
  });

  // Enhanced chat with function calling
  app.post("/api/chat/functions", async (req, res) => {
    try {
      const { messages, contextDocumentIds = [] } = req.body;
      
      // Fetch context documents if provided
      const contextDocuments = [];
      for (const docId of contextDocumentIds) {
        const doc = await storage.getDocument(docId);
        if (doc) contextDocuments.push(doc);
      }
      
      console.log('Function calling chat request:', { 
        messageCount: messages?.length, 
        contextDocumentIds: contextDocumentIds.length 
      });
      
      const response = await chatWithGeminiFunctions({
        messages,
        contextDocuments
      });
      
      res.json({ response });
    } catch (error) {
      console.error('Function calling chat error:', error);
      res.status(500).json({ error: "Failed to process function calling chat request" });
    }
  });

  // Streaming chat with function calling
  app.post("/api/chat/stream", async (req, res) => {
    try {
      const { messages, contextDocumentIds = [], conversationId } = req.body;
      
      // Fetch context documents if provided
      const contextDocuments = [];
      for (const docId of contextDocumentIds) {
        const doc = await storage.getDocument(docId);
        if (doc) contextDocuments.push(doc);
      }
      
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
        // For now, use the regular function calling and simulate streaming
        const response = await chatWithGeminiFunctions({
          messages,
          contextDocuments
        });

        // Since response is a string, we'll use it as content directly
        // Note: thinking and functionCalls are not available in this implementation
        
        // Stream content token by token
        const content = response || '';
        const words = content.split(' ');
        for (let i = 0; i < words.length; i++) {
          const token = (i === 0 ? '' : ' ') + words[i];
          fullResponse += token;
          res.write(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`);
          
          // Small delay to simulate streaming
          await new Promise(resolve => setTimeout(resolve, 30));
        }

        // Save complete message if conversationId provided
        if (conversationId) {
          await storage.createMessage({
            conversationId,
            role: "assistant",
            content: fullResponse,
            contextDocuments: contextDocumentIds,
            thinking: null,
            functionCalls: null,
            status: "completed"
          });
        }

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

  // PDF OCR endpoint
  app.post("/api/pdf/extract", async (req, res) => {
    try {
      const { pdfBase64, filename } = req.body;
      
      if (!pdfBase64) {
        return res.status(400).json({ error: "PDF data is required" });
      }
      
      const extractedText = await extractTextFromPDF(pdfBase64);
      
      res.json({
        text: extractedText,
        filename: filename || 'untitled.pdf'
      });
    } catch (error) {
      console.error('PDF extraction error:', error);
      res.status(500).json({ error: "Failed to extract text from PDF" });
    }
  });

  // Word document extraction endpoint
  app.post("/api/word/extract", async (req, res) => {
    try {
      const { wordBase64, filename } = req.body;
      
      if (!wordBase64) {
        return res.status(400).json({ error: "Word document data is required" });
      }
      
      const extractedMarkdown = await extractTextFromWord(wordBase64);
      
      res.json({
        text: extractedMarkdown,
        filename: filename || 'untitled.docx'
      });
    } catch (error) {
      console.error('Word extraction error:', error);
      res.status(500).json({ error: "Failed to extract text from Word document" });
    }
  });

  // Create document from Word upload
  app.post("/api/objects/word-upload", async (req, res) => {
    try {
      const { wordBase64, filename, name, objectType = "document" } = req.body;
      
      if (!wordBase64) {
        return res.status(400).json({ error: "Word document data is required" });
      }
      
      // Validate objectType
      if (!["document", "meeting"].includes(objectType)) {
        return res.status(400).json({ error: "Invalid objectType. Must be 'document' or 'meeting'" });
      }
      
      // Extract text from Word document
      const extractedText = await extractTextFromWord(wordBase64);
      
      // Create document entry
      const documentData = {
        name: name || filename?.replace(/\.[^/.]+$/, "") || "Untitled Document",
        type: objectType as "document" | "meeting",
        content: extractedText,
        aliases: [],
        isFromOCR: false, // Word extraction is direct, no OCR needed
        hasBeenEdited: false,
        needsEmbedding: true
      };
      
      const document = await storage.createDocument(documentData);
      
      // Trigger immediate embedding since Word documents are clean
      await embeddingService.triggerImmediateEmbedding(document.id);
      
      res.status(201).json(document);
    } catch (error) {
      console.error('Word upload error:', error);
      res.status(500).json({ error: "Failed to process Word document upload" });
    }
  });

  // Create document from PDF upload  
  app.post("/api/objects/pdf-upload", async (req, res) => {
    try {
      const { pdfBase64, filename, name, objectType = "document" } = req.body;
      
      if (!pdfBase64) {
        return res.status(400).json({ error: "PDF data is required" });
      }
      
      // Validate objectType
      if (!["document", "meeting"].includes(objectType)) {
        return res.status(400).json({ error: "Invalid objectType. Must be 'document' or 'meeting'" });
      }
      
      // Extract text from PDF
      const extractedText = await extractTextFromPDF(pdfBase64);
      
      // Create document entry
      const documentData = {
        name: name || filename?.replace(/\.[^/.]+$/, "") || "Untitled Document",
        type: objectType as "document" | "meeting",
        content: extractedText,
        aliases: [],
        isFromOCR: true, // PDF requires OCR, wait for user edit
        hasBeenEdited: false,
        needsEmbedding: true
      };
      
      const document = await storage.createDocument(documentData);
      
      res.status(201).json(document);
    } catch (error) {
      console.error('PDF upload error:', error);
      res.status(500).json({ error: "Failed to process PDF upload" });
    }
  });

  // Embedding endpoints
  app.post("/api/embeddings/generate", async (req, res) => {
    try {
      const { text } = req.body;
      
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: "Text is required" });
      }
      
      const embedding = await generateTextEmbedding(text);
      
      res.json({
        embedding,
        dimensions: embedding.length
      });
    } catch (error) {
      console.error('Embedding generation error:', error);
      res.status(500).json({ error: "Failed to generate embedding" });
    }
  });

  app.post("/api/embeddings/search", async (req, res) => {
    try {
      const { query, limit = 10 } = req.body;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: "Query text is required" });
      }
      
      // Generate embedding for the query
      const queryEmbedding = await generateTextEmbedding(query);
      
      // Search for similar documents
      const similarDocuments = await storage.searchDocumentsByVector(queryEmbedding, limit);
      
      res.json({
        query,
        results: similarDocuments,
        total: similarDocuments.length
      });
    } catch (error) {
      console.error('Vector search error:', error);
      res.status(500).json({ error: "Failed to search documents by similarity" });
    }
  });

  app.get("/api/embeddings/status", async (req, res) => {
    try {
      const documentsNeedingEmbedding = await storage.getDocumentsNeedingEmbedding();
      const allDocuments = await storage.getAllDocuments();
      const documentsWithEmbedding = allDocuments.filter(doc => doc.hasEmbedding);
      
      res.json({
        totalDocuments: allDocuments.length,
        documentsWithEmbedding: documentsWithEmbedding.length,
        documentsNeedingEmbedding: documentsNeedingEmbedding.length,
        embeddingProgress: allDocuments.length > 0 ? (documentsWithEmbedding.length / allDocuments.length) * 100 : 0
      });
    } catch (error) {
      console.error('Embedding status error:', error);
      res.status(500).json({ error: "Failed to get embedding status" });
    }
  });

  // Universal Relationship API endpoints
  
  // Universal relationship query endpoint with advanced filtering
  app.get("/api/relationships", async (req, res) => {
    try {
      const validatedQuery = relationshipQuerySchema.parse(req.query);
      
      const filters: RelationshipFilters = {
        ...validatedQuery,
        limit: validatedQuery.limit || 50,
        offset: validatedQuery.offset || 0
      };
      
      const result = await storage.findRelationships(filters);
      res.json(result);
    } catch (error) {
      console.error('Error fetching relationships:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid query parameters", details: error.errors });
      }
      res.status(500).json({ error: "Failed to fetch relationships" });
    }
  });

  // Enhanced document relationships endpoint with direction and filtering support
  app.get("/api/objects/:id/relationships", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedQuery = documentRelationshipQuerySchema.parse(req.query);
      
      // Verify document exists
      const document = await storage.getDocument(id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Build filters based on query parameters and direction
      const filters: RelationshipFilters = {
        limit: validatedQuery.limit || 50,
        offset: validatedQuery.offset || 0
      };

      // Handle direction parameter
      if (validatedQuery.direction === "out") {
        filters.sourceId = id;
      } else if (validatedQuery.direction === "in") {
        filters.targetId = id;  
      } else {
        // Default to "both" - relationships where document is either source or target
        filters.sourceId = id; // Will be handled by findRelationships to include both directions
        filters.direction = "both";
      }

      // Add additional filters
      if (validatedQuery.relationKind) {
        filters.relationKind = validatedQuery.relationKind;
      }
      if (validatedQuery.targetType) {
        filters.targetType = validatedQuery.targetType;
      }

      const result = await storage.findRelationships(filters);
      
      // Enrich with document information for easier frontend consumption
      const enrichedRelationships = await Promise.all(
        result.relationships.map(async (rel) => {
          const sourceDoc = await storage.getDocument(rel.sourceId);
          const targetDoc = await storage.getDocument(rel.targetId);
          return {
            ...rel,
            sourceDocument: sourceDoc ? { id: sourceDoc.id, name: sourceDoc.name, type: sourceDoc.type } : null,
            targetDocument: targetDoc ? { id: targetDoc.id, name: targetDoc.name, type: targetDoc.type } : null
          };
        })
      );

      res.json({
        relationships: enrichedRelationships,
        total: result.total,
        document: {
          id: document.id,
          name: document.name,
          type: document.type
        }
      });
    } catch (error) {
      console.error('Error fetching document relationships:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid query parameters", details: error.errors });
      }
      res.status(500).json({ error: "Failed to fetch document relationships" });
    }
  });

  // Legacy Relationship API endpoints (maintained for backward compatibility)
  app.get("/api/relationships/:sourceId", async (req, res) => {
    try {
      const { sourceId } = req.params;
      const relationships = await storage.getRelationshipsBySource(sourceId);
      res.json(relationships);
    } catch (error) {
      console.error('Error fetching relationships:', error);
      res.status(500).json({ error: "Failed to fetch relationships" });
    }
  });

  app.post("/api/relationships", async (req, res) => {
    try {
      const validatedData = insertRelationshipSchema.parse(req.body);
      
      // Ensure backward compatibility by setting relationshipType if not provided
      if (!validatedData.relationshipType && validatedData.sourceType && validatedData.targetType) {
        validatedData.relationshipType = `${validatedData.sourceType}_to_${validatedData.targetType}`;
      }
      
      // Check for duplicate relationships based on relationKind (modern) or relationshipType (legacy)
      const existingRelationships = await storage.getRelationshipBetween(
        validatedData.sourceId, 
        validatedData.targetId
      );
      
      // Check for duplicates using the modern relationKind approach first
      const duplicateRelationship = existingRelationships.find(rel => {
        if (validatedData.relationKind && rel.relationKind) {
          // Both have relationKind - compare by relationKind
          return rel.relationKind === validatedData.relationKind;
        }
        // Fall back to legacy relationshipType comparison
        return rel.relationshipType === validatedData.relationshipType;
      });
      
      if (duplicateRelationship) {
        const relationLabel = validatedData.relationKind || validatedData.relationshipType;
        return res.status(409).json({ 
          error: "A relationship of this type already exists between these items",
          detail: `關聯類型「${relationLabel}」已存在於這兩個項目之間`,
          existingRelationship: duplicateRelationship,
          errorCode: "DUPLICATE_RELATIONSHIP"
        });
      }
      
      const relationship = await storage.createRelationship(validatedData);
      res.status(201).json(relationship);
    } catch (error) {
      console.error('Error creating relationship:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid relationship data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create relationship" });
    }
  });

  app.delete("/api/relationships/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteRelationship(id);
      if (!success) {
        return res.status(404).json({ error: "Relationship not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting relationship:', error);
      res.status(500).json({ error: "Failed to delete relationship" });
    }
  });

  // Document-issue relationship endpoints
  app.get("/api/objects/:id/related-issues", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Verify document exists
      const document = await storage.getDocument(id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      // Get relationships where this document is the source and target is an issue
      const relationships = await storage.getRelationshipsBySourceAndType(id, `${document.type}_to_issue`);
      
      // Get the related issue documents
      const relatedIssues = [];
      for (const rel of relationships) {
        const issue = await storage.getDocument(rel.targetId);
        if (issue && issue.type === "issue") {
          relatedIssues.push({
            relationship: rel,
            issue: issue
          });
        }
      }
      
      res.json({
        document,
        relatedIssues,
        total: relatedIssues.length
      });
    } catch (error) {
      console.error('Error fetching related issues:', error);
      res.status(500).json({ error: "Failed to fetch related issues" });
    }
  });

  app.post("/api/objects/:id/relate-to-issue", async (req, res) => {
    try {
      const { id } = req.params;
      const { issueId } = req.body;
      
      if (!issueId) {
        return res.status(400).json({ error: "Issue ID is required" });
      }
      
      // Verify both documents exist
      const document = await storage.getDocument(id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      const issue = await storage.getDocument(issueId);
      if (!issue) {
        return res.status(404).json({ error: "Issue not found" });
      }
      
      if (issue.type !== "issue") {
        return res.status(400).json({ error: "Target document must be of type 'issue'" });
      }
      
      // Only documents and logs can be related to issues
      if (document.type !== "document" && document.type !== "log") {
        return res.status(400).json({ error: "Only documents and logs can be related to issues" });
      }
      
      // Check if relationship already exists
      const existingRelationships = await storage.getRelationshipBetween(id, issueId);
      const relationshipType = `${document.type}_to_issue`;
      const existingRel = existingRelationships.find(rel => rel.relationshipType === relationshipType);
      
      if (existingRel) {
        return res.status(409).json({ error: "Relationship already exists", relationship: existingRel });
      }
      
      // Create the relationship
      const relationship = await storage.createRelationship({
        sourceId: id,
        targetId: issueId,
        sourceType: document.type,
        targetType: issue.type,
        relationKind: "related",
        relationshipType
      });
      
      res.status(201).json({
        relationship,
        source: document,
        target: issue
      });
    } catch (error) {
      console.error('Error creating document-issue relationship:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid relationship data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create relationship" });
    }
  });

  app.delete("/api/objects/:objectId/relationships/:issueId", async (req, res) => {
    try {
      const { objectId, issueId } = req.params;
      
      // Verify both documents exist
      const document = await storage.getDocument(objectId);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      const issue = await storage.getDocument(issueId);
      if (!issue) {
        return res.status(404).json({ error: "Issue not found" });
      }
      
      // Find and delete the relationship
      const relationships = await storage.getRelationshipBetween(objectId, issueId);
      const relationshipType = `${document.type}_to_issue`;
      const targetRel = relationships.find(rel => rel.relationshipType === relationshipType);
      
      if (!targetRel) {
        return res.status(404).json({ error: "Relationship not found" });
      }
      
      const success = await storage.deleteRelationship(targetRel.id);
      if (!success) {
        return res.status(500).json({ error: "Failed to delete relationship" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting document-issue relationship:', error);
      res.status(500).json({ error: "Failed to delete relationship" });
    }
  });

  // Settings API endpoints
  app.get("/api/settings", async (req, res) => {
    try {
      const config = await storage.getAppConfig();
      res.json(config);
    } catch (error) {
      console.error('Error fetching app config:', error);
      res.status(500).json({ error: "Failed to fetch application settings" });
    }
  });

  app.patch("/api/settings", async (req, res) => {
    try {
      const validatedUpdates = updateAppConfigSchema.parse(req.body);
      const updatedConfig = await storage.updateAppConfig(validatedUpdates);
      res.json(updatedConfig);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid settings data", 
          details: error.errors 
        });
      }
      console.error('Error updating app config:', error);
      res.status(500).json({ error: "Failed to update application settings" });
    }
  });

  // Temporary aliases for migration compatibility (remove after frontend migration)
  app.get("/api/documents", (req, res, next) => req.url = "/api/objects" && next());
  app.get("/api/documents/:id", (req, res, next) => req.url = `/api/objects/${req.params.id}` && next());
  app.put("/api/documents/:id", (req, res, next) => req.url = `/api/objects/${req.params.id}` && next());
  app.delete("/api/documents/:id", (req, res, next) => req.url = `/api/objects/${req.params.id}` && next());
  app.get("/api/documents/:id/relationships", (req, res, next) => req.url = `/api/objects/${req.params.id}/relationships` && next());
  app.post("/api/documents/:objectId/relationships/:issueId", (req, res, next) => req.url = `/api/objects/${req.params.objectId}/relationships/${req.params.issueId}` && next());
  app.delete("/api/documents/:objectId/relationships/:issueId", (req, res, next) => req.url = `/api/objects/${req.params.objectId}/relationships/${req.params.issueId}` && next());

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  const httpServer = createServer(app);
  return httpServer;
}
