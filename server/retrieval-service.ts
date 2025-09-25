import { storage } from './storage';
import { generateTextEmbedding } from './gemini-simple';
import { AppObject } from '@shared/schema';

// Interfaces for auto-context and retrieval
export interface Citation {
  id: number;
  docId: string;
  docName: string;
  docType: string;
  chunkIds?: number[];
  relevanceScore: number;
}

export interface RetrievalContext {
  contextText: string;
  citations: Citation[];
  usedDocs: ContextDocument[];
  retrievalMetadata: RetrievalMetadata;
}

export interface RetrievalConfig {
  docTopK: number;
  chunkTopK: number;
  perDocChunkCap: number;
  minDocSim: number;
  minChunkSim: number;
  contextWindow: number;
  budgetTokens: number;
  addCitations: boolean;
}

export interface ContextDocument {
  id: string;
  name: string;
  type: string;
}

export interface RetrievalMetadata {
  totalDocs: number;
  totalChunks: number;
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
    
    console.log(`🔍 [AUTO-RETRIEVAL] Starting auto-context build for query: "${userText}"`);
    
    // Get current app config
    const appConfig = await storage.getAppConfig();
    const retrievalConfig = { ...appConfig.retrieval, ...config };
    
    console.log(`🔍 [AUTO-RETRIEVAL] Config:`, {
      autoRag: retrievalConfig.autoRag,
      docTopK: retrievalConfig.docTopK,
      chunkTopK: retrievalConfig.chunkTopK,
      minDocSim: retrievalConfig.minDocSim,
      minChunkSim: retrievalConfig.minChunkSim,
      budgetTokens: retrievalConfig.budgetTokens
    });
    
    // Skip if autoRag is disabled
    if (!retrievalConfig.autoRag) {
      return {
        contextText: "",
        citations: [],
        usedDocs: [],
        retrievalMetadata: {
          totalDocs: 0,
          totalChunks: 0,
          estimatedTokens: 0,
          processingTimeMs: Date.now() - startTime
        }
      };
    }

    // Skip for very short queries (adjusted for Chinese text)
    if (userText.trim().length < 3) {
      return {
        contextText: "",
        citations: [],
        usedDocs: [],
        retrievalMetadata: {
          totalDocs: 0,
          totalChunks: 0,
          estimatedTokens: 0,
          processingTimeMs: Date.now() - startTime
        }
      };
    }

    try {
      // Stage 1: Generate query embedding
      console.log(`🔍 [AUTO-RETRIEVAL] Stage 1: Generating query embedding...`);
      const appConfig = await storage.getAppConfig();
      const queryEmbedding = await generateTextEmbedding(
        userText,
        appConfig.textEmbedding?.outputDimensionality || 3072,
        appConfig.textEmbedding?.autoTruncate !== false
      );
      console.log(`🔍 [AUTO-RETRIEVAL] Query embedding generated, length: ${queryEmbedding.length}`);
      
      // Stage 2: Object-level retrieval
      console.log(`🔍 [AUTO-RETRIEVAL] Stage 2: Object-level retrieval...`);
      const candidateDocs = await this.performDocumentRetrieval(
        queryEmbedding, 
        retrievalConfig, 
        explicitContextIds.concat(mentions)
      );
      console.log(`🔍 [AUTO-RETRIEVAL] Object retrieval returned ${candidateDocs.length} candidate objects`);

      if (candidateDocs.length === 0) {
        console.log(`🔍 [AUTO-RETRIEVAL] No candidate objects found, returning empty context`);
        return {
          contextText: "",
          citations: [],
          usedDocs: [],
          retrievalMetadata: {
            totalDocs: 0,
            totalChunks: 0,
            estimatedTokens: 0,
            processingTimeMs: Date.now() - startTime
          }
        };
      }

      // Stage 3: Chunk-level retrieval using vector search
      console.log(`🔍 [AUTO-RETRIEVAL] Stage 3: Chunk-level retrieval...`);
      const retrievalResult = await this.performChunkRetrieval(
        candidateDocs,
        queryEmbedding,
        userText,
        retrievalConfig,
        appConfig
      );
      console.log(`🔍 [AUTO-RETRIEVAL] Chunk retrieval completed, found ${retrievalResult.usedDocs.length} used docs`);

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
      console.log(`🔍 [DEBUG] Auto-retrieval starting with config:`, {
        docTopK: config.docTopK,
        minDocSim: config.minDocSim,
        excludeIds: excludeIds.length,
        embeddingLength: queryEmbedding.length
      });

      // Get top candidates using vector search
      const vectorCandidates = await storage.searchObjectsByVector(
        queryEmbedding, 
        config.docTopK * 2 // Get more candidates for filtering
      );

      console.log(`🔍 [DEBUG] Vector search returned ${vectorCandidates.length} candidates:`, 
        vectorCandidates.map(doc => ({
          id: doc.id.substring(0, 8),
          name: doc.name,
          similarity: doc.similarity,
          type: doc.type
        }))
      );

      // Filter out excluded objects
      const filtered = vectorCandidates.filter(doc => 
        !excludeIds.includes(doc.id)
      );

      console.log(`🔍 [DEBUG] After excluding ${excludeIds.length} docs: ${filtered.length} candidates remain`);

      // Apply minimum similarity threshold and return top K
      const thresholdFiltered = filtered.filter(doc => doc.similarity && doc.similarity >= config.minDocSim);
      console.log(`🔍 [DEBUG] After ${config.minDocSim} threshold: ${thresholdFiltered.length} docs remain:`,
        thresholdFiltered.map(doc => ({
          id: doc.id.substring(0, 8),
          name: doc.name,
          similarity: doc.similarity
        }))
      );

      const final = thresholdFiltered.slice(0, config.docTopK);
      console.log(`🔍 [DEBUG] Final ${config.docTopK} docs selected:`, final.length);

      return final;

    } catch (error) {
      console.error('Error in object retrieval:', error);
      return [];
    }
  }

  private async performChunkRetrieval(
    docs: AppObject[],
    queryEmbedding: number[],
    userText: string,
    config: RetrievalConfig,
    appConfig: any
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
    
    // Use vector-based chunk search - this is the key fix!
    console.log(`🔍 [CHUNK-RETRIEVAL] Searching for chunks with query embedding length: ${queryEmbedding.length}`);
    const vectorChunks = await storage.searchChunksByVector(queryEmbedding, config.chunkTopK || 20);
    console.log(`🔍 [CHUNK-RETRIEVAL] Vector search returned ${vectorChunks.length} chunks total`);
    
    // Log top chunks with similarity scores
    if (vectorChunks.length > 0) {
      console.log(`🔍 [CHUNK-RETRIEVAL] Top 5 chunks by similarity:`, 
        vectorChunks.slice(0, 5).map(chunk => ({
          id: chunk.id.substring(0, 8),
          objectId: chunk.objectId.substring(0, 8),
          similarity: chunk.similarity,
          contentLength: chunk.content.length
        }))
      );
    }
    
    // Filter chunks to only include those from our candidate objects
    const candidateDocIds = new Set(docs.map(doc => doc.id));
    console.log(`🔍 [CHUNK-RETRIEVAL] Candidate object IDs:`, Array.from(candidateDocIds).map(id => id.substring(0, 8)));
    const filteredChunks = vectorChunks.filter(chunk => candidateDocIds.has(chunk.objectId));
    console.log(`🔍 [CHUNK-RETRIEVAL] After filtering to candidate docs: ${filteredChunks.length} chunks remain`);

    // Process each vector-matched chunk
    console.log(`🔍 [CHUNK-RETRIEVAL] Processing ${filteredChunks.length} filtered chunks with minChunkSim=${config.minChunkSim}`);
    for (const chunk of filteredChunks) {
      const doc = docs.find(d => d.id === chunk.objectId);
      if (!doc) continue;

      console.log(`🔍 [CHUNK-RETRIEVAL] Processing chunk from ${doc.name}: similarity=${chunk.similarity}, minChunkSim=${config.minChunkSim}`);

      // Apply minimum similarity threshold
      if (chunk.similarity && chunk.similarity >= config.minChunkSim) {
        // Apply context windowing
        const windowedContent = this.applyContextWindow(
          doc.content,
          chunk.startPosition,
          chunk.endPosition,
          config.contextWindow
        );

        allExcerpts.push({
          docId: doc.id,
          docName: doc.name,
          docType: doc.type,
          content: windowedContent,
          relevanceScore: chunk.similarity,
          chunkIndex: chunk.chunkIndex,
          isFullDocument: false
        });
        console.log(`🔍 [CHUNK-RETRIEVAL] ✅ Added excerpt from ${doc.name}, relevance: ${chunk.similarity}`);
      } else {
        console.log(`🔍 [CHUNK-RETRIEVAL] ❌ Chunk from ${doc.name} below threshold: ${chunk.similarity} < ${config.minChunkSim}`);
      }
    }

    // Fallback: handle objects without chunks
    console.log(`🔍 [CHUNK-RETRIEVAL] Checking fallback for ${docs.length} objects...`);
    for (const doc of docs) {
      const chunks = await storage.getChunksByObjectId(doc.id);
      totalChunks += chunks.length;

      if (chunks.length === 0) {
        console.log(`🔍 [CHUNK-RETRIEVAL] 📄 Fallback: Object ${doc.name} has no chunks, content length: ${doc.content.length}`);
        // Fallback: use object content directly for short objects
        if (doc.content.length <= (appConfig.chunking?.chunkSize)) {
          console.log(`🔍 [CHUNK-RETRIEVAL] ✅ Using fallback for ${doc.name} (length <= ${appConfig.chunking?.chunkSize})`);
          allExcerpts.push({
            docId: doc.id,
            docName: doc.name,
            docType: doc.type,
            content: doc.content,
            relevanceScore: (doc as any).similarity || 0.5,
            chunkIndex: 0,
            isFullDocument: true
          });
        } else {
          console.log(`🔍 [CHUNK-RETRIEVAL] ❌ Skipping fallback for ${doc.name} (length > ${appConfig.chunking?.chunkSize}: ${doc.content.length})`);
        }
      } else {
        console.log(`🔍 [CHUNK-RETRIEVAL] Object ${doc.name} has ${chunks.length} chunks, skipping fallback`);
      }
    }

    // Rank all excerpts by relevance
    allExcerpts.sort((a, b) => b.relevanceScore - a.relevanceScore);
    console.log(`🔍 [CHUNK-RETRIEVAL] Total excerpts collected: ${allExcerpts.length}`);

    // Apply token budget and build context
    const { finalExcerpts, estimatedTokens } = this.applyTokenBudget(
      allExcerpts, 
      config.budgetTokens
    );
    console.log(`🔍 [CHUNK-RETRIEVAL] Final excerpts after token budget: ${finalExcerpts.length}`);

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

    const contextText = contextParts.join('\n\n');

    console.log(`🔍 [DEBUG] Final result: ${finalExcerpts.length} excerpts, ${usedDocs.length} unique docs used`);
    console.log(`🔍 [DEBUG] Used docs:`, usedDocs.map(d => ({ id: d.id.substring(0, 8), name: d.name })));

    return {
      contextText,
      citations,
      usedDocs,
      retrievalMetadata: {
        totalDocs: docs.length,
        totalChunks,
        estimatedTokens
      }
    };
  }

  private applyContextWindow(
    fullContent: string,
    startPos: number,
    endPos: number,
    windowSize: number
  ): string {
    if (windowSize <= 0) {
      return fullContent.substring(startPos, endPos);
    }

    const expandedStart = Math.max(0, startPos - windowSize);
    const expandedEnd = Math.min(fullContent.length, endPos + windowSize);
    
    return fullContent.substring(expandedStart, expandedEnd);
  }

  private applyTokenBudget(
    excerpts: Array<{
      docId: string;
      docName: string;
      docType: string;
      content: string;
      relevanceScore: number;
      chunkIndex: number;
      isFullDocument: boolean;
    }>,
    budgetTokens: number
  ): {
    finalExcerpts: Array<{
      docId: string;
      docName: string;
      docType: string;
      content: string;
      relevanceScore: number;
      chunkIndex: number;
      isFullDocument: boolean;
    }>;
    estimatedTokens: number;
  } {
    const finalExcerpts = [];
    let estimatedTokens = 0;

    for (const excerpt of excerpts) {
      // Rough token estimation: ~4 characters per token
      const excerptTokens = Math.ceil(excerpt.content.length / 4);
      
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