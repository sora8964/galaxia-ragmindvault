import type { Express } from "express";
import { storage } from "../../../storage";
import { gcpStorageService } from "../../../gcp-storage";

export function registerObjectDownloadRoutes(app: Express) {
  // GET /api/objects/:id/download - Download file
  app.get("/api/objects/:id/download", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get object from database
      const object = await storage.getObject(id);
      if (!object) {
        return res.status(404).json({ error: "Object not found" });
      }
      
      // Check if object has a file
      if (!object.hasFile || !object.filePath) {
        return res.status(404).json({ error: "No file associated with this object" });
      }
      
      // Download file from GCP Storage
      const { buffer, metadata } = await gcpStorageService.downloadFile(object.filePath);
      
      // Set response headers for file download
      const fileName = object.originalFileName || `${object.name}.pdf`;
      const mimeType = object.mimeType || "application/octet-stream";
      
      // Properly encode filename for Content-Disposition header to handle Chinese characters
      const encodedFileName = encodeURIComponent(fileName);
      
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}`);
      res.setHeader('Content-Length', buffer.length);
      
      // Send file
      res.send(buffer);
    } catch (error) {
      console.error('File download error:', error);
      res.status(500).json({ error: "Failed to download file" });
    }
  });

  // GET /api/objects/:id/download-url - Generate signed URL for file download
  app.get("/api/objects/:id/download-url", async (req, res) => {
    try {
      const { id } = req.params;
      const { expires = 60 } = req.query; // Default 60 minutes
      
      // Get object from database
      const object = await storage.getObject(id);
      if (!object) {
        return res.status(404).json({ error: "Object not found" });
      }
      
      // Check if object has a file
      if (!object.hasFile || !object.filePath) {
        return res.status(404).json({ error: "No file associated with this object" });
      }
      
      // Generate signed URL
      const signedUrl = await gcpStorageService.generateSignedUrl(
        object.filePath, 
        parseInt(expires as string)
      );
      
      res.json({
        downloadUrl: signedUrl,
        fileName: object.originalFileName || `${object.name}.pdf`,
        mimeType: object.mimeType || "application/pdf",
        expiresInMinutes: parseInt(expires as string)
      });
    } catch (error) {
      console.error('Signed URL generation error:', error);
      res.status(500).json({ error: "Failed to generate download URL" });
    }
  });
}
