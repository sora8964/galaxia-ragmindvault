import type { Express } from "express";
import { extractTextFromPDF } from "../../../gemini";

export function registerPdfExtractRoutes(app: Express) {
  // POST /api/pdf/extract - PDF OCR endpoint
  app.post("/api/pdf/extract", async (req, res) => {
    try {
      const { pdfBase64, filename } = req.body;
      
      if (!pdfBase64) {
        return res.status(400).json({ error: "PDF data is required" });
      }
      
      const extractedText = await extractTextFromPDF(pdfBase64);
      
      res.json({
        text: extractedText,
        filename: filename || 'untitled.pdf'
      });
    } catch (error) {
      console.error('PDF extraction error:', error);
      res.status(500).json({ error: "Failed to extract text from PDF" });
    }
  });
}
