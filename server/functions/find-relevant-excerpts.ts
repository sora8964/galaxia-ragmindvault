import { storage } from "../storage";
import { embeddingService } from "../embedding-service";
import { generateTextEmbedding } from "../gemini";
import type { SearchResult } from "@shared/schema";

export async function findRelevantExcerpts(args: any): Promise<string> {
  const { query, objectId, limit = 3 } = args;
  
  console.log(`📖 [FIND EXCERPTS] Query: "${query}", ObjectId: ${objectId}, Limit: ${limit}`);
  
  try {
    // Generate query embedding
    const queryEmbedding = await generateTextEmbedding(
      query,
      3072,
      `Excerpt search: ${query}`
    );
    
    // Search for relevant excerpts
    const searchResults = await embeddingService.searchSimilarChunks(
      queryEmbedding,
      undefined,
      limit,
      0
    );
    
    // Filter by objectId if provided
    const filteredResults = objectId 
      ? searchResults.filter(result => result.objectId === objectId)
      : searchResults;
    
    if (filteredResults.length === 0) {
      return `No relevant excerpts found for query: "${query}"${objectId ? ` in object ${objectId}` : ''}`;
    }
    
    // Format results
    let result = `Found ${filteredResults.length} relevant excerpts for query: "${query}"\n\n`;
    
    filteredResults.forEach((excerpt: SearchResult, index: number) => {
      result += `${index + 1}. **${excerpt.objectName}** (${excerpt.objectType})\n`;
      result += `   📝 ${excerpt.content}\n`;
      result += `   📊 Relevance: ${(excerpt.relevanceScore * 100).toFixed(1)}%\n`;
      result += `   🆔 Object ID: ${excerpt.objectId}\n\n`;
    });
    
    return result;
  } catch (error) {
    console.error('Find relevant excerpts error:', error);
    return `Error finding relevant excerpts: ${error}`;
  }
}
