import { storage } from "../storage";
import { embeddingService } from "../embedding-service";
import { generateTextEmbedding } from "../gemini";
import type { SearchResult } from "@shared/schema";

export async function searchObjects(args: any): Promise<string> {
  const { query, type, page = 1, pageSize = 10 } = args;
  
  console.log(`🔍 [SEARCH] Query: "${query}", Type: ${type || 'all'}, Page: ${page}, PageSize: ${pageSize}`);
  
  try {
    // Generate query embedding
    const queryEmbedding = await generateTextEmbedding(
      query,
      3072,
    );
    
    // Perform semantic search
    const searchResults = await embeddingService.searchSimilarChunks(
      queryEmbedding,
      type,
      pageSize,
      (page - 1) * pageSize
    );
    
    if (searchResults.length === 0) {
      // Return simple structure for empty results
      return JSON.stringify({
        results: [],
        pagination: { page: 1, pageSize, totalPages: 1, hasMore: false }
      });
    }

    // Create structured results for frontend display
    const structuredResults = searchResults.map((searchResult: any) => ({
      id: searchResult.objectId,
      name: searchResult.objectName,
      type: searchResult.objectType,
      snippet: searchResult.content.substring(0, 200) + (searchResult.content.length > 200 ? '...' : ''),
      similarity: searchResult.relevanceScore,
      date: null // TODO: Get actual date from object if available
    }));

    // Create pagination info
    const pagination = {
      page: page,
      pageSize: pageSize,
      totalPages: Math.max(1, page + (searchResults.length >= pageSize ? 1 : 0)),
      hasMore: searchResults.length >= pageSize
    };

    // Return clean structure that frontend expects (without message field)
    const result = {
      results: structuredResults,
      pagination: pagination
    };
    
    return JSON.stringify(result);
  } catch (error) {
    console.error('Search error:', error);
    return `Error searching for "${query}": ${error}`;
  }
}
