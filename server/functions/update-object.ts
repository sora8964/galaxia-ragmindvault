import { storage } from "../storage";
import { embeddingService } from "../embedding-service";
import { generateTextEmbedding } from "../gemini";

export async function updateObject(args: any): Promise<string> {
  const { objectId, name, content, aliases, date, tags } = args;
  
  console.log(`✏️ [UPDATE] ObjectId: ${objectId}`);
  
  try {
    // Get existing object
    const existingObject = await storage.getObject(objectId);
    if (!existingObject) {
      return `Object with ID "${objectId}" not found.`;
    }
    
    // Prepare update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (content !== undefined) updateData.content = content;
    if (aliases !== undefined) updateData.aliases = aliases;
    if (date !== undefined) updateData.date = date;
    if (tags !== undefined) updateData.tags = tags;
    
    // Update object
    const updatedObject = await storage.updateObject(objectId, updateData);
    
    // Regenerate embedding if content or name changed
    if (name !== undefined || content !== undefined) {
      const embedding = await generateTextEmbedding(
        `${updatedObject.name} ${updatedObject.content}`,
        3072,
      );
      
      await storage.updateObject(objectId, { embedding });
      
      // Update chunks
      await embeddingService.updateChunksForObject(updatedObject);
    }
    
    return `✅ Successfully updated object: "${updatedObject.name}"\n🆔 ID: ${objectId}\n📝 Updated fields: ${Object.keys(updateData).join(', ')}`;
  } catch (error) {
    console.error('Update object error:', error);
    return `Error updating object: ${error}`;
  }
}
