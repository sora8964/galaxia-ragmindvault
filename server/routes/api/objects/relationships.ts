import type { Express } from "express";
import { storage, RelationshipFilters } from "../../../storage";
import { ObjectType } from "@shared/schema";
import { z } from "zod";

// Object relationship query schema
const objectRelationshipQuerySchema = z.object({
  targetType: ObjectType.optional(),
  limit: z.coerce.number().min(1).max(1000).optional(),
  offset: z.coerce.number().min(0).optional()
});

export function registerObjectRelationshipRoutes(app: Express) {
  // GET /api/objects/:id/relationships - Get object relationships
  app.get("/api/objects/:id/relationships", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedQuery = objectRelationshipQuerySchema.parse(req.query);
      
      // Verify object exists
      const object = await storage.getObject(id);
      if (!object) {
        return res.status(404).json({ error: "Object not found" });
      }

      // Simplified: Only get outgoing relationships (current object as source)
      const filters: RelationshipFilters = {
        sourceId: id,
        limit: validatedQuery.limit || 50,
        offset: validatedQuery.offset || 0
      };

      // Add additional filters
      if (validatedQuery.targetType) {
        filters.targetType = validatedQuery.targetType;
      }

      const result = await storage.findRelationships(filters);
      
      // Transform relationships - only outgoing relationships, no direction needed
      const transformedRelationships = await Promise.all(
        result.relationships.map(async (rel) => {
          const targetObject = await storage.getObject(rel.targetId);
          
          const relatedObject = targetObject ? { 
            id: targetObject.id, 
            name: targetObject.name, 
            type: targetObject.type,
            date: targetObject.date
          } : null;
          
          return {
            relationship: rel,
            relatedObject
          };
        })
      );

      res.json({
        relationships: transformedRelationships,
        total: result.total,
        object: {
          id: object.id,
          name: object.name,
          type: object.type
        }
      });
    } catch (error) {
      console.error('Error fetching object relationships:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid query parameters", details: error.errors });
      }
      res.status(500).json({ error: "Failed to fetch object relationships" });
    }
  });
}
