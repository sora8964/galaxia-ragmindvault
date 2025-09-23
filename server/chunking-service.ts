// Reference: javascript_gemini blueprint integration
import { storage } from "./storage";
import { generateTextEmbedding } from "./gemini-simple";
import type { Document, Chunk, InsertChunk } from "@shared/schema";

export class ChunkingService {
  // Configuration will be loaded from app settings at runtime

  // Convert @mentions to embedding format
  private convertMentionsToEmbeddingFormat(text: string): string {
    // Convert @[type:name|alias] to "alias name" or just "name" if no alias
    return text.replace(/@\[(person|document):([^|\]]+)(?:\|([^\]]+))?\]/g, (match, type, name, alias) => {
      if (alias) {
        return `${alias.trim()} ${name.trim()}`;
      } else {
        return name.trim();
      }
    });
  }

  // Create chunks from object content using pure character count (no boundary detection)
  private async createChunks(originalContent: string): Promise<Array<{
    content: string;
    chunkIndex: number;
    startPosition: number;
    endPosition: number;
  }>> {
    // Handle empty content
    if (!originalContent || originalContent.length === 0) {
      return [];
    }

    // Get chunking configuration from app settings with fallback defaults
    let appConfig;
    try {
      appConfig = await storage.getAppConfig();
    } catch (error) {
      console.warn('Failed to get app config, using defaults:', error);
      appConfig = {
        chunking: {
          chunkSize: 2000,
          overlap: 200,
          enabled: true
        }
      };
    }
    
    // Extract chunking config with safe defaults
    const chunkSize = appConfig.chunking?.chunkSize || 2000;
    const overlap = Math.min(appConfig.chunking?.overlap || 200, chunkSize - 1); // Prevent infinite loops
    
    // Convert mentions for embedding purposes only (don't use for position tracking)
    const embeddingContent = this.convertMentionsToEmbeddingFormat(originalContent);
    
    // If content is smaller than chunk size, return single chunk
    if (originalContent.length <= chunkSize) {
      return [{
        content: embeddingContent,
        chunkIndex: 0,
        startPosition: 0,
        endPosition: originalContent.length
      }];
    }

    const chunks = [];
    let chunkIndex = 0;
    let startPos = 0;

    while (startPos < originalContent.length) {
      // Calculate end position using pure character count
      const endPos = Math.min(startPos + chunkSize, originalContent.length);
      
      // Extract chunk from original content for position tracking
      const originalChunk = originalContent.slice(startPos, endPos);
      
      // Convert to embedding format for storage
      const embeddingChunk = this.convertMentionsToEmbeddingFormat(originalChunk);
      
      // Always add chunk (no trimming, no empty checking)
      chunks.push({
        content: embeddingChunk,
        chunkIndex,
        startPosition: startPos,
        endPosition: endPos
      });
      chunkIndex++;

      // Move start position with overlap (fixed window advancement)
      const step = chunkSize - overlap;
      startPos += step;
      
      // Prevent infinite loop if step is too small
      if (step <= 0) {
        startPos = endPos;
      }
    }

    return chunks;
  }

  // Process object chunking and embedding
  async processObjectChunking(object: Document): Promise<void> {
    try {
      console.log(`Processing chunks for object - ${object.type}:${object.name}(${object.id})`);
      
      // Step 1: Check if chunking is enabled
      let appConfig;
      try {
        appConfig = await storage.getAppConfig();
      } catch (error) {
        console.warn('Failed to get app config for chunking check, proceeding with defaults');
        appConfig = { chunking: { enabled: true } };
      }
      
      // Step 2: Delete all existing chunks for this object
      await storage.deleteChunksByObjectId(object.id);
      
      // Step 3: Create embedding content (name + aliases + date + content)
      const embeddingText = [
        object.name,
        ...object.aliases,
        object.date, // 包含日期信息以支持時間搜索
        object.content
      ].filter(Boolean).join(' ');

      // Step 3: Generate main object embedding
      const objectEmbedding = await generateTextEmbedding(
        embeddingText,
        appConfig.textEmbedding?.outputDimensionality || 3072,
        appConfig.textEmbedding?.autoTruncate !== false
      );
      await storage.updateObjectEmbedding(object.id, objectEmbedding);
      
      // Step 4: Check if chunking is enabled for chunk creation
      if (appConfig.chunking?.enabled === false) {
        console.log(`Chunking disabled for object - ${object.type}:${object.name}(${object.id}), skipping chunk creation`);
        return; // Skip chunk creation but object embedding is already done
      }

      // Step 5: Create chunks (pure character-based chunking)
      const chunks = await this.createChunks(object.content);
      console.log(`Created ${chunks.length} chunks for object - ${object.type}:${object.name}(${object.id})`);

      // Step 6: Save chunks and generate embeddings
      for (const chunkData of chunks) {
        const chunk = await storage.createChunk({
          objectId: object.id,
          content: chunkData.content,
          chunkIndex: chunkData.chunkIndex,
          startPosition: chunkData.startPosition,
          endPosition: chunkData.endPosition,
          embedding: null,
          hasEmbedding: false,
          embeddingStatus: "pending" as const
        });

        // Generate embedding for chunk
        const chunkEmbedding = await generateTextEmbedding(
          chunkData.content,
          appConfig.textEmbedding?.outputDimensionality || 3072,
          appConfig.textEmbedding?.autoTruncate !== false
        );
        await storage.updateChunkEmbedding(chunk.id, chunkEmbedding);
        
        console.log(`Generated embedding for chunk ${chunkData.chunkIndex} of object - ${object.type}:${object.name}`);
      }
      
      console.log(`Completed chunking and embedding for object: ${object.type}:${object.name}`);
    } catch (error) {
      console.error(`Error processing chunks for object - ${object.type}:${object.name}(${object.id}):`, error);
      throw error;
    }
  }

  // Search chunks by vector similarity
  async searchChunksByVector(queryVector: number[], limit: number = 10): Promise<Array<Chunk & { document: Document }>> {
    return await storage.searchChunksByVector(queryVector, limit);
  }
}

export const chunkingService = new ChunkingService();