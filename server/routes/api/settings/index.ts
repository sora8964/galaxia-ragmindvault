import type { Express } from "express";
import { storage } from "../../../storage";
import { updateAppConfigSchema } from "@shared/schema";
import { z } from "zod";

export function registerSettingsRoutes(app: Express) {
  // GET /api/settings - Get app settings
  app.get("/api/settings", async (req, res) => {
    try {
      const config = await storage.getAppConfig();
      res.json(config);
    } catch (error) {
      console.error('Error fetching app config:', error);
      res.status(500).json({ error: "Failed to fetch application settings" });
    }
  });

  // PATCH /api/settings - Update app settings
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
}
