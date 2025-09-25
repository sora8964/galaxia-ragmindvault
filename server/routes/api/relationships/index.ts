import type { Express } from "express";
import { storage, RelationshipFilters } from "../../../storage";
import { insertRelationshipSchema, updateRelationshipSchema, ObjectType } from "@shared/schema";
import { z } from "zod";

// Relationship query schema
const relationshipQuerySchema = z.object({
  sourceId: z.string().optional(),
  targetId: z.string().optional(),
  sourceType: ObjectType.optional(),
  targetType: ObjectType.optional(),
  limit: z.coerce.number().min(1).max(1000).optional(),
  offset: z.coerce.number().min(0).optional()
});

export function registerRelationshipRoutes(app: Express) {
  // GET /api/relationships - Universal relationship query endpoint with advanced filtering
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

  // POST /api/relationships - Create relationship
  app.post("/api/relationships", async (req, res) => {
    try {
      const validatedData = insertRelationshipSchema.parse(req.body);
      
      // No longer need to set relationshipType - removed for simplification
      
      // Check for duplicate relationships 
      const existingRelationships = await storage.getRelationshipBetween(
        validatedData.sourceId, 
        validatedData.targetId
      );
      
      if (existingRelationships.length > 0) {
        return res.status(409).json({ 
          error: "A relationship already exists between these items",
          detail: `關聯已存在於這兩個項目之間`,
          existingRelationship: existingRelationships[0],
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

  // DELETE /api/relationships/:id - Delete relationship
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
}
