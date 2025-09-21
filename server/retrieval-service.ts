// Intelligent RAG (Retrieval-Augmented Generation) Service
// Implements dual-stage retrieval with context windowing and citation management

import { storage } from "./storage";
import { generateTextEmbedding } from "./gemini-simple";
import { AppObject, RetrievalConfig } from "@shared/schema";

export interface RetrievalContext {
  contextText: string;
  citations: Citation[];
  usedDocs: ContextDocument[];
  retrievalMetadata: RetrievalMetadata;
}

export interface Citation {
  id: number;
  docId: string;
  docName: string;
  docType: string;
  chunkIds?: number[];
  relevanceScore: number;
}

export interface ContextDocument {
  id: string;
  name: string;
  type: string;
}

export interface RetrievalMetadata {
  totalDocs: number;
  totalChunks: number;
  strategy: string;
  estimatedTokens: number;
  processingTimeMs: number;
}

export interface AutoContextOptions {
  conversationId?: string;
  userText: string;
  explicitContextIds?: string[];
  mentions?: string[];
  config?: Partial<RetrievalConfig>;
}

export class RetrievalService {
  
  async buildAutoContext(options: AutoContextOptions): Promise<RetrievalContext> {
    const startTime = Date.now();
    const { userText, explicitContextIds = [], mentions = [], config } = options;
    
    // Get current app config
    const appConfig = await storage.getAppConfig();
    const retrievalConfig = { ...appConfig.retrieval, ...config };
    
    // Skip if autoRag is disabled
    if (!retrievalConfig.autoRag) {
      return {
        contextText: "",
        citations: [],
        usedDocs: [],
        retrievalMetadata: {
          totalDocs: 0,
          totalChunks: 0,
          strategy: 'disabled',
          estimatedTokens: 0,
          processingTimeMs: Date.now() - startTime
        }
      };
    }

    // Skip for very short queries
    if (userText.trim().length < 10) {
      return {
        contextText: "",
        citations: [],
        usedDocs: [],
        retrievalMetadata: {
          totalDocs: 0,
          totalChunks: 0,
          strategy: 'skipped_short',
          estimatedTokens: 0,
          processingTimeMs: Date.now() - startTime
        }
      };
    }

    try {
      // Stage 1: Generate query embedding
      const queryEmbedding = await generateTextEmbedding(userText);
      
      // Stage 2: Document-level retrieval
      const candidateDocs = await this.performDocumentRetrieval(
        queryEmbedding, 
        retrievalConfig, 
        explicitContextIds.concat(mentions)
      );

      if (candidateDocs.length === 0) {
        return {
          contextText: "",
          citations: [],
          usedDocs: [],
          retrievalMetadata: {
            totalDocs: 0,
            totalChunks: 0,
            strategy: 'no_docs_found',
            estimatedTokens: 0,
            processingTimeMs: Date.now() - startTime
          }
        };
      }

      // Stage 3: Chunk-level retrieval and windowing
      const retrievalResult = await this.performChunkRetrieval(
        candidateDocs,
        queryEmbedding,
        userText,
        retrievalConfig
      );

      const processingTime = Date.now() - startTime;
      
      return {
        ...retrievalResult,
        retrievalMetadata: {
          ...retrievalResult.retrievalMetadata,
          processingTimeMs: processingTime
        }
      };

    } catch (error) {
      console.error('Error in buildAutoContext:', error);
      return {
        contextText: "",
        citations: [],
        usedDocs: [],
        retrievalMetadata: {
          totalDocs: 0,
          totalChunks: 0,
          strategy: 'error',
          estimatedTokens: 0,
          processingTimeMs: Date.now() - startTime
        }
      };
    }
  }

  private async performDocumentRetrieval(
    queryEmbedding: number[],
    config: RetrievalConfig,
    excludeIds: string[]
  ): Promise<AppObject[]> {
    try {
      // Get top candidates using vector search
      const vectorCandidates = await storage.searchObjectsByVector(
        queryEmbedding, 
        config.docTopK * 2 // Get more candidates for filtering
      );

      // Filter out excluded documents
      const filtered = vectorCandidates.filter(doc => 
        !excludeIds.includes(doc.id)
      );

      // Apply minimum similarity threshold and return top K
      return filtered
        .filter(doc => doc.similarity && doc.similarity >= config.minDocSim)
        .slice(0, config.docTopK);

    } catch (error) {
      console.error('Error in document retrieval:', error);
      return [];
    }
  }

  private async performChunkRetrieval(
    docs: AppObject[],
    queryEmbedding: number[],
    userText: string,
    config: RetrievalConfig
  ): Promise<Omit<RetrievalContext, 'retrievalMetadata'> & { retrievalMetadata: Omit<RetrievalMetadata, 'processingTimeMs'> }> {
    
    const allExcerpts: Array<{
      docId: string;
      docName: string;
      docType: string;
      content: string;
      relevanceScore: number;
      chunkIndex: number;
      isFullDocument: boolean;
    }> = [];

    let totalChunks = 0;

    // Process each document
    for (const doc of docs) {
      try {
        // Get chunks for this document
        const chunks = await storage.getChunksByObjectId(doc.id);
        totalChunks += chunks.length;

        if (chunks.length === 0) {
          // Fallback: use document content directly for short docs
          if (doc.content.length <= 2000) {
            allExcerpts.push({
              docId: doc.id,
              docName: doc.name,
              docType: doc.type,
              content: doc.content,
              relevanceScore: (doc as any).similarity || 0.5,
              chunkIndex: 0,
              isFullDocument: true
            });
          }
          continue;
        }

        // Score chunks and apply windowing
        const docExcerpts = await this.scoreAndWindowChunks(
          doc,
          chunks,
          userText,
          config
        );

        allExcerpts.push(...docExcerpts.slice(0, config.perDocChunkCap));

      } catch (error) {
        console.error(`Error processing chunks for document ${doc.id}:`, error);
      }
    }

    // Rank all excerpts by relevance
    allExcerpts.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Apply token budget and build context
    const { finalExcerpts, estimatedTokens } = this.applyTokenBudget(
      allExcerpts, 
      config.budgetTokens
    );

    // Build citations and context text
    const citations: Citation[] = [];
    const usedDocs: ContextDocument[] = [];
    const contextParts: string[] = [];

    finalExcerpts.forEach((excerpt, index) => {
      const citationId = index + 1;
      
      citations.push({
        id: citationId,
        docId: excerpt.docId,
        docName: excerpt.docName,
        docType: excerpt.docType,
        chunkIds: excerpt.isFullDocument ? undefined : [excerpt.chunkIndex],
        relevanceScore: excerpt.relevanceScore
      });

      // Add to used docs if not already present
      if (!usedDocs.find(d => d.id === excerpt.docId)) {
        usedDocs.push({
          id: excerpt.docId,
          name: excerpt.docName,
          type: excerpt.docType
        });
      }

      // Add to context with citation
      const citationLabel = config.addCitations ? ` [#${citationId}]` : '';
      contextParts.push(`${excerpt.content}${citationLabel}`);
    });

    const contextText = contextParts.length > 0 
      ? `Retrieved Context:\n\n${contextParts.join('\n\n---\n\n')}`
      : '';

    return {
      contextText,
      citations,
      usedDocs,
      retrievalMetadata: {
        totalDocs: docs.length,
        totalChunks,
        strategy: config.strategy,
        estimatedTokens
      }
    };
  }

  private async scoreAndWindowChunks(
    doc: AppObject,
    chunks: any[],
    userText: string,
    config: RetrievalConfig
  ): Promise<Array<{
    docId: string;
    docName: string;
    docType: string;
    content: string;
    relevanceScore: number;
    chunkIndex: number;
    isFullDocument: boolean;
  }>> {
    
    const lowerQuery = userText.toLowerCase();
    const queryWords = lowerQuery.split(/\s+/).filter(word => word.length > 2);
    const excerpts = [];

    for (const chunk of chunks) {
      const lowerContent = chunk.content.toLowerCase();
      
      // Simple relevance scoring
      let score = 0;
      for (const word of queryWords) {
        const occurrences = (lowerContent.match(new RegExp(word, 'g')) || []).length;
        score += occurrences * word.length;
      }

      if (score > 0 && score >= config.minChunkSim * 100) { // Adjust threshold
        // Apply context windowing
        const windowedContent = this.applyContextWindow(
          doc.content,
          chunk.startPosition,
          chunk.endPosition,
          config.contextWindow
        );

        excerpts.push({
          docId: doc.id,
          docName: doc.name,
          docType: doc.type,
          content: windowedContent,
          relevanceScore: score / 100, // Normalize
          chunkIndex: chunk.chunkIndex,
          isFullDocument: false
        });
      }
    }

    return excerpts;
  }

  private applyContextWindow(
    fullContent: string,
    chunkStart: number,
    chunkEnd: number,
    windowSize: number
  ): string {
    if (windowSize <= 0) {
      return fullContent.substring(chunkStart, chunkEnd);
    }

    const windowExpansion = Math.floor((chunkEnd - chunkStart) * windowSize / 2);
    const expandedStart = Math.max(0, chunkStart - windowExpansion);
    const expandedEnd = Math.min(fullContent.length, chunkEnd + windowExpansion);
    
    return fullContent.substring(expandedStart, expandedEnd);
  }

  private applyTokenBudget(
    excerpts: any[],
    budgetTokens: number
  ): { finalExcerpts: any[]; estimatedTokens: number } {
    
    const finalExcerpts = [];
    let estimatedTokens = 0;

    for (const excerpt of excerpts) {
      const excerptTokens = Math.ceil(excerpt.content.length / 4); // Rough estimate
      
      if (estimatedTokens + excerptTokens <= budgetTokens) {
        finalExcerpts.push(excerpt);
        estimatedTokens += excerptTokens;
      } else {
        break; // Budget exceeded
      }
    }

    return { finalExcerpts, estimatedTokens };
  }
}

// Export singleton instance
export const retrievalService = new RetrievalService();