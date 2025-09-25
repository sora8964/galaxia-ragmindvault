import type { Express } from "express";
import { storage } from "../../../storage";
import { extractTextFromPDF } from "../../../gemini";
import { gcpStorageService } from "../../../gcp-storage";
import { embeddingService } from "../../../embedding-service";

export function registerPdfUploadRoutes(app: Express) {
  // POST /api/objects/pdf-upload - Create object from PDF upload
  app.post("/api/objects/pdf-upload", async (req, res) => {
    try {
      const { pdfBase64, filename, name, objectType = "document" } = req.body;
      
      if (!pdfBase64) {
        return res.status(400).json({ error: "PDF data is required" });
      }
      
      // Validate objectType
      if (!["document", "letter", "meeting"].includes(objectType)) {
        return res.status(400).json({ error: "Invalid objectType. Must be 'document', 'letter', or 'meeting'" });
      }
      
      // Extract text from PDF
      const extractedText = await extractTextFromPDF(pdfBase64);
      
      // Convert base64 to buffer for file upload
      const fileBuffer = Buffer.from(pdfBase64, 'base64');
      const originalFileName = filename || "document.pdf";
      const fileSize = fileBuffer.length;
      const mimeType = "application/pdf";
      
      // Create object entry with file info
      const objectData = {
        name: name || filename?.replace(/\.[^/.]+$/, "") || "Untitled Document",
        type: objectType as "document" | "letter" | "meeting",
        content: extractedText,
        aliases: [],
        isFromOCR: true, // PDF requires OCR, wait for user edit
        hasBeenEdited: false,
        needsEmbedding: true,
        originalFileName: originalFileName,
        fileSize: fileSize,
        mimeType: mimeType,
        hasFile: true
      };
      
      const object = await storage.createObject(objectData);
      
      // Upload file to GCP Storage after object creation
      try {
        const filePath = await gcpStorageService.uploadFile(
          object.id,
          objectType,
          fileBuffer,
          originalFileName,
          mimeType
        );
        
        // Update object with file path
        await storage.updateObject(object.id, { filePath });
        
        // Return object with updated file info
        const updatedObject = await storage.getObject(object.id);
        res.status(201).json(updatedObject);
      } catch (storageError) {
        console.warn('File upload to GCP Storage failed, but object was created:', storageError);
        // Return object even if file upload failed
        res.status(201).json(object);
      }
    } catch (error) {
      console.error('PDF upload error:', error);
      res.status(500).json({ error: "Failed to process PDF upload" });
    }
  });
}
