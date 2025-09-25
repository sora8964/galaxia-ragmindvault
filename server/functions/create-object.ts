import { storage } from "../storage";
import { embeddingService } from "../embedding-service";
import { generateTextEmbedding } from "../gemini";
import type { Object } from "@shared/schema";

export async function createObject(args: any): Promise<string> {
  const { name, type, content, aliases = [], date, tags = [] } = args;
  
  console.log(`➕ [CREATE] Type: ${type}, Name: "${name}"`);
  
  try {
    // Validate required fields
    if (!name || !type || !content) {
      return "Error: name, type, and content are required fields.";
    }
    
    // Create object
    const newObject: Omit<Object, 'id' | 'createdAt' | 'updatedAt'> = {
      name,
      type,
      content,
      aliases,
      date,
      tags,
      embedding: []
    };
    
    const createdObject = await storage.createObject(newObject);
    
    // Generate embedding for the new object
    const embedding = await generateTextEmbedding(
      `${name} ${content}`,
      3072,
      name
    );
    
    // Update object with embedding
    const updatedObject = await storage.updateObject(createdObject.id, {
      embedding
    });
    
    // Create chunks for better searchability
    await embeddingService.createChunksForObject(updatedObject);
    
    return `✅ Successfully created ${type}: "${name}"\n🆔 ID: ${createdObject.id}\n📝 Content preview: ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`;
  } catch (error) {
    console.error('Create object error:', error);
    return `Error creating ${type}: ${error}`;
  }
}
