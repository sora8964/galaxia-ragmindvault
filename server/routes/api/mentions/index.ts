import type { Express } from "express";
import { storage } from "../../../storage";
import { parseMentionsSchema } from "@shared/schema";
import { z } from "zod";

export function registerMentionRoutes(app: Express) {
  // GET /api/mentions - Get mention suggestions
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

  // POST /api/mentions/parse - Parse mentions from text
  app.post("/api/mentions/parse", async (req, res) => {
    try {
      const validatedData = parseMentionsSchema.parse(req.body);
      const mentions = await storage.parseMentions(validatedData.text);
      const resolvedObjectIds = await storage.resolveMentionObjects(mentions);
      
      res.json({
        mentions,
        resolvedObjectIds: resolvedObjectIds
      });
    } catch (error) {
      console.error('Error parsing mentions:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to parse mentions" });
    }
  });
}
