// Reference: javascript_gemini blueprint integration
import { storage } from "./storage";
import { generateTextEmbedding } from "./gemini-simple";
import type { Document, Chunk, InsertChunk } from "@shared/schema";

export class ChunkingService {
  // Optimized chunk size for Chinese text with reduced chunking overhead
  private readonly CHUNK_SIZE = 1300; // 1300 characters per chunk (increased from 800)
  private readonly OVERLAP_SIZE = 100; // 100 characters overlap (reduced from 150 but maintained for context)
  private readonly MIN_CHUNK_SIZE = 400; // Don't chunk if smaller than this (increased from 200)

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

  // Create chunks from document content
  private createChunks(content: string): Array<{
    content: string;
    chunkIndex: number;
    startPosition: number;
    endPosition: number;
  }> {
    const embeddingContent = this.convertMentionsToEmbeddingFormat(content);
    
    // If content is smaller than minimum chunk size, don't chunk
    if (embeddingContent.length <= this.MIN_CHUNK_SIZE) {
      return [{
        content: embeddingContent,
        chunkIndex: 0,
        startPosition: 0,
        endPosition: embeddingContent.length
      }];
    }

    const chunks = [];
    let chunkIndex = 0;
    let startPos = 0;

    while (startPos < embeddingContent.length) {
      let endPos = Math.min(startPos + this.CHUNK_SIZE, embeddingContent.length);
      
      // Try to break at word boundary if not at the end
      if (endPos < embeddingContent.length) {
        // Look for sentence ending within last 100 characters
        const lastSentenceEnd = embeddingContent.lastIndexOf('。', endPos);
        const lastQuestionEnd = embeddingContent.lastIndexOf('？', endPos);
        const lastExclamationEnd = embeddingContent.lastIndexOf('！', endPos);
        
        const sentenceEnd = Math.max(lastSentenceEnd, lastQuestionEnd, lastExclamationEnd);
        
        if (sentenceEnd > startPos + (this.CHUNK_SIZE * 0.7)) {
          endPos = sentenceEnd + 1;
        } else {
          // Look for whitespace or punctuation
          const breakChars = [' ', '\n', '\t', '，', '、', '；', '：'];
          for (let i = endPos - 1; i > startPos + (this.CHUNK_SIZE * 0.8); i--) {
            if (breakChars.includes(embeddingContent[i])) {
              endPos = i + 1;
              break;
            }
          }
        }
      }

      const chunkContent = embeddingContent.slice(startPos, endPos).trim();
      
      if (chunkContent.length > 0) {
        chunks.push({
          content: chunkContent,
          chunkIndex,
          startPosition: startPos,
          endPosition: endPos
        });
        chunkIndex++;
      }

      // Move start position with overlap
      startPos = Math.max(startPos + 1, endPos - this.OVERLAP_SIZE);
      
      // Prevent infinite loop
      if (startPos >= embeddingContent.length - 10) {
        break;
      }
    }

    return chunks;
  }

  // Process document chunking and embedding
  async processDocumentChunking(document: Document): Promise<void> {
    try {
      console.log(`Processing chunks for document: ${document.name}`);
      
      // Step 1: Delete all existing chunks for this document
      await storage.deleteChunksByDocumentId(document.id);
      
      // Step 2: Create embedding content (name + aliases + content)
      const embeddingText = [
        document.name,
        ...document.aliases,
        document.content
      ].filter(Boolean).join(' ');

      // Step 3: Generate main document embedding
      const documentEmbedding = await generateTextEmbedding(embeddingText);
      await storage.updateDocumentEmbedding(document.id, documentEmbedding);
      
      // Step 4: Check if chunking is needed
      const processedContent = this.convertMentionsToEmbeddingFormat(document.content);
      
      if (processedContent.length <= this.MIN_CHUNK_SIZE) {
        console.log(`Document ${document.name} is small (${processedContent.length} chars), no chunking needed`);
        return;
      }

      // Step 5: Create chunks
      const chunks = this.createChunks(document.content);
      console.log(`Created ${chunks.length} chunks for document: ${document.name}`);

      // Step 6: Save chunks and generate embeddings
      for (const chunkData of chunks) {
        const chunk = await storage.createChunk({
          objectId: document.id,
          content: chunkData.content,
          chunkIndex: chunkData.chunkIndex,
          startPosition: chunkData.startPosition,
          endPosition: chunkData.endPosition,
          embedding: null,
          hasEmbedding: false,
          embeddingStatus: "pending" as const
        });

        // Generate embedding for chunk
        const chunkEmbedding = await generateTextEmbedding(chunkData.content);
        await storage.updateChunkEmbedding(chunk.id, chunkEmbedding);
        
        console.log(`Generated embedding for chunk ${chunkData.chunkIndex} of document: ${document.name}`);
      }
      
      console.log(`Completed chunking and embedding for document: ${document.name}`);
    } catch (error) {
      console.error(`Error processing chunks for document ${document.id}:`, error);
      throw error;
    }
  }

  // Search chunks by vector similarity
  async searchChunksByVector(queryVector: number[], limit: number = 10): Promise<Array<Chunk & { document: Document }>> {
    return await storage.searchChunksByVector(queryVector, limit);
  }
}

export const chunkingService = new ChunkingService();