import { storage } from "../storage";
import type { Object } from "@shared/schema";

export async function getObjectDetails(args: any): Promise<string> {
  const { objectId, type, name } = args;
  
  console.log(`📄 [GET DETAILS] ObjectId: ${objectId}, Type: ${type}, Name: ${name}`);
  
  try {
    let obj: Object | null = null;
    
    if (objectId) {
      // Query by object ID
      obj = await storage.getObject(objectId);
      if (!obj) {
        return `Object with ID "${objectId}" not found.`;
      }
    } else if (type && name) {
      // Query by type and name
      const objects = await storage.searchObjects({ type, name });
      if (objects.length === 0) {
        return `No ${type} found with name "${name}".`;
      } else if (objects.length > 1) {
        return `Multiple ${type}s found with name "${name}". Please use object ID for precise retrieval.`;
      }
      obj = objects[0];
    } else {
      return "Error: Either objectId or both type and name must be provided.";
    }
    
    if (!obj) {
      return "Object not found.";
    }
    
    // Format object details
    let result = `**${obj.name}** (${obj.type})\n`;
    result += `🆔 ID: ${obj.id}\n`;
    result += `📅 Created: ${new Date(obj.createdAt).toLocaleString()}\n`;
    result += `📅 Updated: ${new Date(obj.updatedAt).toLocaleString()}\n`;
    
    if (obj.aliases && obj.aliases.length > 0) {
      result += `🏷️ Aliases: ${obj.aliases.join(', ')}\n`;
    }
    
    if (obj.date) {
      result += `📅 Date: ${obj.date}\n`;
    }
    
    if (obj.tags && obj.tags.length > 0) {
      result += `🏷️ Tags: ${obj.tags.join(', ')}\n`;
    }
    
    result += `\n📝 Content:\n${obj.content}`;
    
    // For issues, include associated logs
    if (obj.type === 'issue') {
      const logs = await storage.searchObjects({ type: 'log' });
      const relatedLogs = logs.filter(log => 
        log.content.toLowerCase().includes(obj.name.toLowerCase()) ||
        log.name.toLowerCase().includes(obj.name.toLowerCase())
      );
      
      if (relatedLogs.length > 0) {
        result += `\n\n📋 Related Logs (${relatedLogs.length}):\n`;
        relatedLogs.forEach((log, index) => {
          result += `${index + 1}. **${log.name}** (${new Date(log.createdAt).toLocaleDateString()})\n`;
          result += `   ${log.content.substring(0, 150)}${log.content.length > 150 ? '...' : ''}\n\n`;
        });
      }
    }
    
    return result;
  } catch (error) {
    console.error('Get object details error:', error);
    return `Error retrieving object details: ${error}`;
  }
}
