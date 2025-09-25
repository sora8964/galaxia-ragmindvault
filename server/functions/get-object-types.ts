import { OBJECT_TYPES } from "@shared/schema";

export async function getObjectTypes(args: any): Promise<string> {
  console.log(`📋 [GET TYPES] Retrieving available object types`);
  
  try {
    let result = `Available object types in the system:\n\n`;
    
    Object.entries(OBJECT_TYPES).forEach(([key, typeInfo], index) => {
      result += `${index + 1}. **${key}**\n`;
      result += `   📝 ${typeInfo.description}\n`;
      if (typeInfo.fields && Object.keys(typeInfo.fields).length > 0) {
        result += `   📋 Fields: ${Object.keys(typeInfo.fields).join(', ')}\n`;
      }
      result += `\n`;
    });
    
    result += `💡 Use these types when creating or searching for objects.`;
    
    return result;
  } catch (error) {
    console.error('Get object types error:', error);
    return `Error retrieving object types: ${error}`;
  }
}
