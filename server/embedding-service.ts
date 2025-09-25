// Reference: javascript_gemini blueprint integration
import { storage } from "./storage";
import { generateTextEmbedding } from "./gemini";
import { chunkingService } from "./chunking-service";

export class EmbeddingService {
  private isProcessing = false;
  private processingQueue: string[] = [];
  
  constructor() {
    // Start background processing
    this.startBackgroundProcessing();
  }

  // Add object to embedding queue
  async queueDocumentForEmbedding(documentId: string): Promise<void> {
    if (!this.processingQueue.includes(documentId)) {
      this.processingQueue.push(documentId);
      console.log(`Queued object ${documentId} for embedding`);
    }
  }

  // Process a single object embedding with chunking
  async processDocumentEmbedding(documentId: string): Promise<boolean> {
    try {
      const object = await storage.getObject(documentId);
      if (!object) {
        console.error(`Object ${documentId} not found`);
        return false;
      }

      if (object.hasEmbedding && !object.needsEmbedding) {
        console.log(`Object ${documentId} already has embedding and doesn't need re-embedding, skipping...`);
        return true;
      }

      console.log(`Processing object with chunking: ${object.name}`);
      
      // Use chunking service to handle embedding and chunking
      await chunkingService.processObjectChunking(object);
      
      console.log(`Successfully processed object with chunking: ${object.name}`);
      return true;
    } catch (error) {
      console.error(`Error processing embedding for object ${documentId}:`, error);
      return false;
    }
  }

  // Background processing loop
  private async startBackgroundProcessing(): Promise<void> {
    setInterval(async () => {
      if (this.isProcessing || this.processingQueue.length === 0) {
        return;
      }

      this.isProcessing = true;
      
      try {
        // Process objects needing embedding
        const documentsNeedingEmbedding = await storage.getObjectsNeedingEmbedding();
        
        for (const doc of documentsNeedingEmbedding) {
          if (!this.processingQueue.includes(doc.id)) {
            this.processingQueue.push(doc.id);
          }
        }

        // Process queue
        while (this.processingQueue.length > 0) {
          const documentId = this.processingQueue.shift()!;
          await this.processDocumentEmbedding(documentId);
          
          // Small delay to prevent overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error('Error in background embedding processing:', error);
      } finally {
        this.isProcessing = false;
      }
    }, 5000); // Check every 5 seconds
  }

  // Trigger immediate embedding for mention-created objects
  async triggerImmediateEmbedding(documentId: string): Promise<void> {
    await this.queueDocumentForEmbedding(documentId);
    
    // Process immediately for mention-created objects
    if (!this.isProcessing) {
      this.isProcessing = true;
      try {
        await this.processDocumentEmbedding(documentId);
      } finally {
        this.isProcessing = false;
      }
    }
  }

  // Mark OCR object as ready for embedding after editing
  async markOCRDocumentAsEdited(documentId: string): Promise<void> {
    const doc = await storage.getObject(documentId);
    if (doc && doc.isFromOCR) {
      await storage.updateObject(documentId, { hasBeenEdited: true });
      await this.queueDocumentForEmbedding(documentId);
    }
  }
}

export const embeddingService = new EmbeddingService();