import { storage } from "../storage";
import { embeddingService } from "../embedding-service";
import { generateTextEmbedding } from "../gemini";
import type { SearchResult } from "@shared/schema";

export async function findSimilarObjects(args: any): Promise<string> {
  const { objectId, limit = 5 } = args;
  
  console.log(`🔍 [FIND SIMILAR] ObjectId: ${objectId}, Limit: ${limit}`);
  
  try {
    // Get the source object
    const sourceObject = await storage.getObject(objectId);
    if (!sourceObject) {
      return `Object with ID "${objectId}" not found.`;
    }
    
    // Use the object's embedding if available, otherwise generate one
    let queryEmbedding = sourceObject.embedding;
    if (!queryEmbedding || queryEmbedding.length === 0) {
      queryEmbedding = await generateTextEmbedding(
        `${sourceObject.name} ${sourceObject.content}`,
        3072,
      );
    }
    
    // Find similar objects
    const similarResults = await embeddingService.searchSimilarChunks(
      queryEmbedding,
      undefined, // No type filter
      limit + 1, // +1 to exclude the source object
      0
    );
    
    // Filter out the source object itself
    const filteredResults = similarResults.filter(result => result.objectId !== objectId);
    
    if (filteredResults.length === 0) {
      return `No similar objects found for "${sourceObject.name}".`;
    }
    
    // Format results
    let result = `Found ${filteredResults.length} similar objects to "${sourceObject.name}":\n\n`;
    
    filteredResults.forEach((similar: SearchResult, index: number) => {
      result += `${index + 1}. **${similar.objectName}** (${similar.objectType})\n`;
      result += `   📝 ${similar.content.substring(0, 150)}${similar.content.length > 150 ? '...' : ''}\n`;
      result += `   📊 Similarity: ${(similar.relevanceScore * 100).toFixed(1)}%\n`;
      result += `   🆔 Object ID: ${similar.objectId}\n\n`;
    });
    
    return result;
  } catch (error) {
    console.error('Find similar objects error:', error);
    return `Error finding similar objects: ${error}`;
  }
}
