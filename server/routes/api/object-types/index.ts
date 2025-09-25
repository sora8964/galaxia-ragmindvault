import type { Express } from "express";
import { OBJECT_TYPE_CONFIG } from "@shared/schema";

export function registerObjectTypeRoutes(app: Express) {
  // GET /api/object-types - Get Object type configuration
  app.get("/api/object-types", async (req, res) => {
    try {
      res.json(OBJECT_TYPE_CONFIG);
    } catch (error) {
      console.error("Error getting object type configuration:", error);
      res.status(500).json({ error: "Failed to get object type configuration" });
    }
  });
}
