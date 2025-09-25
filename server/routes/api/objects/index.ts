import type { Express } from "express";
import { storage } from "../../../storage";
import { insertObjectSchema, updateObjectSchema, ObjectType } from "@shared/schema";
import { embeddingService } from "../../../embedding-service";
import { gcpStorageService } from "../../../gcp-storage";
import { z } from "zod";

// Preprocess request data to normalize empty strings to null for nullable fields
function preprocessObjectData(data: any) {
  return {
    ...data,
    date: data.date === "" ? null : data.date
  };
}

export function registerObjectRoutes(app: Express) {
  // GET /api/objects - Get all objects or search
  app.get("/api/objects", async (req, res) => {
    try {
      const { type, search } = req.query;
      
      if (search) {
        const result = await storage.searchObjects(
          search as string, 
          type as ObjectType | undefined
        );
        res.json(result);
      } else if (type) {
        const objects = await storage.getObjectsByType(type as ObjectType);
        res.json({ objects: objects, total: objects.length });
      } else {
        const objects = await storage.getAllObjects();
        res.json({ objects: objects, total: objects.length });
      }
    } catch (error) {
      console.error('Error fetching objects:', error);
      res.status(500).json({ error: "Failed to fetch objects" });
    }
  });

  // GET /api/objects/:id - Get specific object
  app.get("/api/objects/:id", async (req, res) => {
    try {
      const object = await storage.getObject(req.params.id);
      if (!object) {
        return res.status(404).json({ error: "Object not found" });
      }
      res.json(object);
    } catch (error) {
      console.error('Error fetching object:', error);
      res.status(500).json({ error: "Failed to fetch object" });
    }
  });

  // POST /api/objects - Create new object
  app.post("/api/objects", async (req, res) => {
    try {
      // Preprocess data to normalize empty strings
      const preprocessedData = preprocessObjectData(req.body);
      const validatedData = insertObjectSchema.parse(preprocessedData);
      
      const object = await storage.createObject(validatedData);
      
      // Trigger immediate embedding for mention-created objects
      if (!validatedData.isFromOCR) {
        await embeddingService.triggerImmediateEmbedding(object.id);
      }
      
      res.status(201).json(object);
    } catch (error) {
      console.error('Error creating object:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid object data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create object" });
    }
  });

  // PUT /api/objects/:id - Update object
  app.put("/api/objects/:id", async (req, res) => {
    try {
      // Preprocess data to normalize empty strings
      const preprocessedData = preprocessObjectData(req.body);
      const validatedData = updateObjectSchema.parse(preprocessedData);
      
      const object = await storage.updateObject(req.params.id, validatedData);
      if (!object) {
        return res.status(404).json({ error: "Object not found" });
      }
      
      // Trigger immediate chunking and embedding after object update if needed
      if (object.needsEmbedding) {
        await embeddingService.triggerImmediateEmbedding(object.id);
      }
      
      res.json(object);
    } catch (error) {
      console.error('Error updating object:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid object data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update object" });
    }
  });

  // DELETE /api/objects/:id - Delete object
  app.delete("/api/objects/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get object first to check if it has a file
      const object = await storage.getObject(id);
      if (!object) {
        return res.status(404).json({ error: "Object not found" });
      }
      
      // Delete the object from database
      const success = await storage.deleteObject(id);
      if (!success) {
        return res.status(404).json({ error: "Failed to delete object" });
      }
      
      // If object had a file, delete it from GCP Storage
      if (object.hasFile && object.filePath) {
        try {
          await gcpStorageService.deleteFile(object.filePath);
          console.log(`Deleted file from GCP Storage: ${object.filePath}`);
        } catch (storageError) {
          console.warn(`Failed to delete file from GCP Storage: ${object.filePath}`, storageError);
          // Don't fail the entire delete operation if file deletion fails
        }
      }
      
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting object:', error);
      res.status(500).json({ error: "Failed to delete object" });
    }
  });
}
