import type { Express } from "express";
import { storage } from "../../../storage";
import { extractTextFromWord } from "../../../gemini";
import { embeddingService } from "../../../embedding-service";

export function registerWordUploadRoutes(app: Express) {
  // POST /api/objects/word-upload - Create object from Word upload
  app.post("/api/objects/word-upload", async (req, res) => {
    try {
      const { wordBase64, filename, name, objectType = "document" } = req.body;
      
      if (!wordBase64) {
        return res.status(400).json({ error: "Word document data is required" });
      }
      
      // Validate objectType
      if (!["document", "letter", "meeting"].includes(objectType)) {
        return res.status(400).json({ error: "Invalid objectType. Must be 'document', 'letter', or 'meeting'" });
      }
      
      // Extract text from Word object
      const extractedText = await extractTextFromWord(wordBase64);
      
      // Create object entry
      const objectData = {
        name: name || filename?.replace(/\.[^/.]+$/, "") || "Untitled Document",
        type: objectType as "document" | "letter" | "meeting",
        content: extractedText,
        aliases: [],
        isFromOCR: false, // Word extraction is direct, no OCR needed
        hasBeenEdited: false,
        needsEmbedding: true
      };
      
      const object = await storage.createObject(objectData);
      
      // Trigger immediate embedding since Word objects are clean
      await embeddingService.triggerImmediateEmbedding(object.id);
      
      res.status(201).json(object);
    } catch (error) {
      console.error('Word upload error:', error);
      res.status(500).json({ error: "Failed to process Word document upload" });
    }
  });
}
