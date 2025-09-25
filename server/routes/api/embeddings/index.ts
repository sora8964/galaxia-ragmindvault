import type { Express } from "express";
import { storage } from "../../../storage";
import { generateTextEmbedding } from "../../../gemini";
import { z } from "zod";

export function registerEmbeddingRoutes(app: Express) {
  // POST /api/embeddings/generate - Generate embedding
  app.post("/api/embeddings/generate", async (req, res) => {
    try {
      const { text } = req.body;
      
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: "Text is required" });
      }
      
      const appConfig = await storage.getAppConfig();
      const embedding = await generateTextEmbedding(
        text,
        appConfig.textEmbedding?.outputDimensionality || 3072
      );
      
      res.json({
        embedding,
        dimensions: embedding.length
      });
    } catch (error) {
      console.error('Embedding generation error:', error);
      res.status(500).json({ error: "Failed to generate embedding" });
    }
  });

  // GET /api/embeddings/search - Vector search (GET version for direct URL access)
  app.get("/api/embeddings/search", async (req, res) => {
    try {
      const { query, limit } = req.query;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: "Query text is required" });
      }
      
      // Get default limit from config
      const appConfig = await storage.getAppConfig();
      const defaultLimit = appConfig.retrieval?.semanticSearchLimit || 1000;
      const searchLimit = limit ? parseInt(limit as string) : defaultLimit;
      
      console.log(`🔍 [DEBUG] Semantic search test with query: "${query}", limit: ${searchLimit}`);
      
      // Generate embedding for the query
      const queryEmbedding = await generateTextEmbedding(
        query,
        appConfig.textEmbedding?.outputDimensionality || 3072
      );
      console.log(`🔍 [DEBUG] Generated embedding length: ${queryEmbedding.length}`);
      
      // Search for similar objects
      const similarObjects = await storage.searchObjectsByVector(queryEmbedding, searchLimit);
      
      console.log(`🔍 [DEBUG] Semantic search test returned ${similarObjects.length} results:`,
        similarObjects.map(doc => ({
          id: doc.id.substring(0, 8),
          name: doc.name,
          similarity: doc.similarity,
          type: doc.type
        }))
      );
      
      res.json({
        query,
        results: similarObjects,
        total: similarObjects.length
      });
    } catch (error) {
      console.error('Vector search error:', error);
      res.status(500).json({ error: "Failed to search objects by similarity" });
    }
  });

  // POST /api/embeddings/search - Vector search (POST version for programmatic access)
  app.post("/api/embeddings/search", async (req, res) => {
    try {
      const { query, limit } = req.body;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: "Query text is required" });
      }
      
      // Get default limit from config
      const appConfig = await storage.getAppConfig();
      const defaultLimit = appConfig.retrieval?.semanticSearchLimit;
      const searchLimit = limit || defaultLimit;
      
      // Generate embedding for the query
      const queryEmbedding = await generateTextEmbedding(
        query,
        appConfig.textEmbedding?.outputDimensionality || 3072
      );
      
      // Search for similar objects
      const similarObjects = await storage.searchObjectsByVector(queryEmbedding, searchLimit);
      
      res.json({
        query,
        results: similarObjects,
        total: similarObjects.length
      });
    } catch (error) {
      console.error('Vector search error:', error);
      res.status(500).json({ error: "Failed to search objects by similarity" });
    }
  });

  // GET /api/embeddings/status - Get embedding status
  app.get("/api/embeddings/status", async (req, res) => {
    try {
      const objectsNeedingEmbedding = await storage.getObjectsNeedingEmbedding();
      const allObjects = await storage.getAllObjects();
      const objectsWithEmbedding = allObjects.filter(obj => obj.hasEmbedding);
      
      res.json({
        totalObjects: allObjects.length,
        objectsWithEmbedding: objectsWithEmbedding.length,
        objectsNeedingEmbedding: objectsNeedingEmbedding.length,
        embeddingProgress: allObjects.length > 0 ? (objectsWithEmbedding.length / allObjects.length) * 100 : 0
      });
    } catch (error) {
      console.error('Embedding status error:', error);
      res.status(500).json({ error: "Failed to get embedding status" });
    }
  });
}
