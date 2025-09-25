import type { Express } from "express";
import { storage } from "../../../storage";
import { chunkingService } from "../../../chunking-service";
import { ObjectType } from "@shared/schema";

export function registerRechunkRoutes(app: Express) {
  // POST /api/rechunk - Rechunk API endpoint
  app.post("/api/rechunk", async (req, res) => {
    try {
      const { type } = req.body;
      
      // Get all objects or filter by type
      let objects;
      if (type && ObjectType.safeParse(type).success) {
        objects = await storage.getObjectsByType(type);
      } else {
        objects = await storage.getAllObjects();
      }
      
      console.log(`Starting rechunk process for ${objects.length} objects`);
      
      let processed = 0;
      let errors = 0;
      
      // Process objects one by one to avoid overwhelming the system
      for (const object of objects) {
        try {
          await chunkingService.processObjectChunking(object);
          processed++;
          console.log(`Rechunked object ${object.name} (${processed}/${objects.length})`);
        } catch (error) {
          errors++;
          console.error(`Failed to rechunk object ${object.name}:`, error);
        }
      }
      
      res.json({
        message: "Rechunk process completed",
        processed,
        errors,
        total: objects.length
      });
      
    } catch (error) {
      console.error('Error in rechunk process:', error);
      res.status(500).json({ error: "Failed to execute rechunk process" });
    }
  });
}
