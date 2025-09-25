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
      return `No results found for query: "${query}"${type ? ` in type: ${type}` : ''}`;
    }
    
    // Format results
    let result = `Found ${searchResults.length} results for query: "${query}"${type ? ` (type: ${type})` : ''}\n\n`;
    
    searchResults.forEach((result: SearchResult, index: number) => {
      const pageNum = (page - 1) * pageSize + index + 1;
      result += `${pageNum}. **${result.objectName}** (${result.objectType})\n`;
      result += `   📝 ${result.content.substring(0, 200)}${result.content.length > 200 ? '...' : ''}\n`;
      result += `   📊 Relevance: ${(result.relevanceScore * 100).toFixed(1)}%\n`;
      result += `   🆔 Object ID: ${result.objectId}\n\n`;
    });
    
    if (searchResults.length === pageSize) {
      result += `\n💡 Tip: Use page ${page + 1} to see more results, or refine your search query.`;
    }
    
    return result;
  } catch (error) {
    console.error('Search error:', error);
    return `Error searching for "${query}": ${error}`;
  }
}
