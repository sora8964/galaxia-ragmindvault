import type { Express } from "express";
import { extractTextFromWord } from "../../../gemini";

export function registerWordExtractRoutes(app: Express) {
  // POST /api/word/extract - Word object extraction endpoint
  app.post("/api/word/extract", async (req, res) => {
    try {
      const { wordBase64, filename } = req.body;
      
      if (!wordBase64) {
        return res.status(400).json({ error: "Word document data is required" });
      }
      
      const extractedMarkdown = await extractTextFromWord(wordBase64);
      
      res.json({
        text: extractedMarkdown,
        filename: filename || 'untitled.docx'
      });
    } catch (error) {
      console.error('Word extraction error:', error);
      res.status(500).json({ error: "Failed to extract text from Word document" });
    }
  });
}
