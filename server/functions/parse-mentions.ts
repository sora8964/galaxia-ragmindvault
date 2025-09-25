import { storage } from "../storage";
import type { MentionItem } from "@shared/schema";

export async function parseMentions(args: any): Promise<string> {
  const { text } = args;
  
  console.log(`🔗 [PARSE MENTIONS] Text: "${text.substring(0, 100)}..."`);
  
  try {
    // Parse @mentions in the text
    const mentionRegex = /@\[([^:]+):([^\]]+)\]/g;
    const mentions: MentionItem[] = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      const [, type, name] = match;
      mentions.push({ type, name, id: '', aliases: [] });
    }
    
    if (mentions.length === 0) {
      return "No @mentions found in the text.";
    }
    
    // Resolve mentions to actual objects
    const resolvedMentions: Array<MentionItem & { found: boolean; objectId?: string }> = [];
    for (const mention of mentions) {
      const searchResult = await storage.searchObjects(mention.name, mention.type as any);
      
      if (searchResult && searchResult.objects && searchResult.objects.length > 0) {
        resolvedMentions.push({
          ...mention,
          objectId: searchResult.objects[0].id,
          found: true
        });
      } else {
        resolvedMentions.push({
          ...mention,
          found: false
        });
      }
    }
    
    // Format results
    let result = `Found ${mentions.length} @mentions in the text:\n\n`;
    
    resolvedMentions.forEach((mention, index) => {
      result += `${index + 1}. @[${mention.type}:${mention.name}]\n`;
      if (mention.found && mention.objectId) {
        result += `   ✅ Found: ${mention.objectId}\n`;
      } else {
        result += `   ❌ Not found in knowledge base\n`;
      }
    });
    
    return result;
  } catch (error) {
    console.error('Parse mentions error:', error);
    return `Error parsing mentions: ${error}`;
  }
}
