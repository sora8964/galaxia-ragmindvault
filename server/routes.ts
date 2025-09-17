import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertDocumentSchema, updateDocumentSchema, insertConversationSchema, insertMessageSchema, parseMentionsSchema } from "@shared/schema";
import { chatWithGemini, extractTextFromPDF, extractTextFromWord, generateTextEmbedding } from "./gemini-simple";
import { embeddingService } from "./embedding-service";
import { chunkingService } from "./chunking-service";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Document routes
  app.get("/api/documents", async (req, res) => {
    try {
      const { type, search } = req.query;
      
      if (search) {
        const result = await storage.searchDocuments(
          search as string, 
          type as "person" | "document" | undefined
        );
        res.json(result);
      } else if (type) {
        const documents = await storage.getDocumentsByType(type as "person" | "document");
        res.json({ documents, total: documents.length });
      } else {
        const documents = await storage.getAllDocuments();
        res.json({ documents, total: documents.length });
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  app.get("/api/documents/:id", async (req, res) => {
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

  app.post("/api/documents", async (req, res) => {
    try {
      const validatedData = insertDocumentSchema.parse(req.body);
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

  app.put("/api/documents/:id", async (req, res) => {
    try {
      const validatedData = updateDocumentSchema.parse(req.body);
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

  app.delete("/api/documents/:id", async (req, res) => {
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
  app.post("/api/documents/word-upload", async (req, res) => {
    try {
      const { wordBase64, filename, name } = req.body;
      
      if (!wordBase64) {
        return res.status(400).json({ error: "Word document data is required" });
      }
      
      // Extract text from Word document
      const extractedText = await extractTextFromWord(wordBase64);
      
      // Create document entry
      const documentData = {
        name: name || filename?.replace(/\.[^/.]+$/, "") || "Untitled Document",
        type: "document" as const,
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
  app.post("/api/documents/pdf-upload", async (req, res) => {
    try {
      const { pdfBase64, filename, name } = req.body;
      
      if (!pdfBase64) {
        return res.status(400).json({ error: "PDF data is required" });
      }
      
      // Extract text from PDF
      const extractedText = await extractTextFromPDF(pdfBase64);
      
      // Create document entry
      const documentData = {
        name: name || filename?.replace(/\.[^/.]+$/, "") || "Untitled Document",
        type: "document" as const,
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

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  const httpServer = createServer(app);
  return httpServer;
}
