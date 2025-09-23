// Reference: javascript_gemini blueprint integration  
import { GoogleGenAI, FunctionDeclaration, Type } from "@google/genai";
import { storage } from "./storage";
import type { Object, ObjectType } from "@shared/schema";
import { OBJECT_TYPES } from "@shared/schema";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Function calling tools for Gemini
const searchObjectsTool: FunctionDeclaration = {
  name: "search_objects",
  description: "Search for objects by name, content, or aliases",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: "Search query to find objects"
      },
      type: {
        type: Type.STRING,
        enum: [...OBJECT_TYPES],
        description: "Filter by object type (optional)"
      }
    },
    required: ["query"]
  }
};

const getObjectTool: FunctionDeclaration = {
  name: "get_object",
  description: "Get detailed information about a specific object by ID. For issues, automatically includes associated logs.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      id: {
        type: Type.STRING,
        description: "The object ID to retrieve"
      }
    },
    required: ["id"]
  }
};

const createObjectTool: FunctionDeclaration = {
  name: "create_object",
  description: "Create a new object entry",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: {
        type: Type.STRING,
        description: "Name of the object"
      },
      type: {
        type: Type.STRING,
        enum: [...OBJECT_TYPES],
        description: "Type of object to create"
      },
      content: {
        type: Type.STRING,
        description: "Content or description"
      },
      aliases: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Alternative names or aliases"
      }
    },
    required: ["name", "type", "content"]
  }
};

const updateObjectTool: FunctionDeclaration = {
  name: "update_object",
  description: "Update an existing object entry",
  parameters: {
    type: Type.OBJECT,
    properties: {
      id: {
        type: Type.STRING,
        description: "The object ID to update"
      },
      name: {
        type: Type.STRING,
        description: "Updated name (optional)"
      },
      content: {
        type: Type.STRING,
        description: "Updated content (optional)"
      },
      aliases: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Updated aliases (optional)"
      }
    },
    required: ["id"]
  }
};

const getObjectTypesTool: FunctionDeclaration = {
  name: "get_object_types",
  description: "Get all available object types in the system. This helps you understand what types of objects can be created, searched, and managed.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
    required: []
  }
};

// Function handlers
async function handleSearchObjects(args: any) {
  const { query, type } = args;
  const results = await storage.searchObjects(query, type);
  return {
    objects: results.objects,
    total: results.total,
    message: `Found ${results.total} ${type ? type + 's' : 'items'} matching "${query}"`
  };
}

async function handleGetObject(args: any) {
  const { id } = args;
  const object = await storage.getObject(id);
  if (!object) {
    return { error: "Object not found", id };
  }
  
  let additionalInfo = "";
  
  // If this is an issue, find all associated logs
  if (object.type === "issue") {
    try {
      const relationshipResults = await storage.findRelationships({
        sourceId: id,
        targetType: "log"
      });
      
      if (relationshipResults.relationships.length > 0) {
        // Get the actual log objects
        const logIds = relationshipResults.relationships.map(r => r.targetId);
        const logs = [];
        
        for (const logId of logIds) {
          const log = await storage.getObject(logId);
          if (log) logs.push(log);
        }
        
        // Sort logs by date field (same date = random order)
        logs.sort((a, b) => {
          if (a.date && b.date) {
            if (a.date === b.date) {
              return Math.random() - 0.5; // Random for same dates
            }
            return a.date.localeCompare(b.date);
          }
          if (a.date) return -1;
          if (b.date) return 1;
          return Math.random() - 0.5;
        });
        
        additionalInfo = `\n\nAssociated Logs (${logs.length}):\n` +
          logs.map(log => 
            `- 📝 ${log.name}${log.date ? ` (${log.date})` : ''}\n` +
            `  ${log.content.substring(0, 100)}${log.content.length > 100 ? '...' : ''}`
          ).join('\n');
      }
    } catch (error) {
      console.error('Error fetching associated logs:', error);
    }
  }
  
  return {
    object,
    message: `Retrieved ${object.type}: ${object.name}${additionalInfo}`
  };
}

async function handleCreateObject(args: any) {
  const { name, type, content, aliases = [] } = args;
  const object = await storage.createObject({
    name,
    type,
    content,
    aliases
  });
  return {
    object,
    message: `Created new ${type}: ${name}`
  };
}

async function handleUpdateObject(args: any) {
  const { id, ...updates } = args;
  const object = await storage.updateObject(id, updates);
  if (!object) {
    return { error: "Object not found", id };
  }
  return {
    object,
    message: `Updated ${object.type}: ${object.name}`
  };
}

async function handleGetObjectTypes(args: any) {
  const objectTypes = [
    { type: "person", name: "Person", description: "Individual people with personal information and relationships", icon: "👤" },
    { type: "document", name: "Document", description: "Text documents, reports, and written materials", icon: "📄" },
    { type: "letter", name: "Letter", description: "Correspondence and written communications", icon: "✉️" },
    { type: "entity", name: "Entity", description: "Organizations, companies, and institutional entities", icon: "🏢" },
    { type: "issue", name: "Issue", description: "Problems, challenges, and matters requiring attention", icon: "⚠️" },
    { type: "log", name: "Log", description: "Records of events, activities, and chronological entries", icon: "📝" },
    { type: "meeting", name: "Meeting", description: "Meeting records, minutes, and discussion summaries", icon: "🤝" }
  ];
  
  return {
    objectTypes,
    message: `Available object types: ${objectTypes.map(t => `${t.icon} ${t.name}`).join(', ')}`
  };
}

const functionHandlers = {
  search_objects: handleSearchObjects,
  get_object: handleGetObject,
  create_object: handleCreateObject,
  update_object: handleUpdateObject,
  get_object_types: handleGetObjectTypes
};

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  contextDocuments?: string[];
}

export interface GeminiChatOptions {
  messages: ChatMessage[];
  contextDocuments?: Object[];
  enableFunctionCalling?: boolean;
}

export async function chatWithGemini(options: GeminiChatOptions): Promise<string> {
  try {
    const { messages, contextDocuments = [], enableFunctionCalling = true } = options;
    
    // Build system instruction with context
    let systemInstruction = `You are an AI assistant specializing in object and knowledge management. You help users organize, search, and understand their objects.

Objects refer to all types of data entries including but not limited to persons, entities, issues, logs, meetings, letters, and documents. You can use the getObjectTypes function to see all available object types.

Key capabilities:
- Search through objects
- Retrieve detailed information about specific objects (issues automatically include associated logs)
- Create new objects of any type
- Update existing objects
- Access relationships between objects
- Get information about available object types

You have access to function calling tools to search, retrieve, create, and modify all types of objects. Use getObjectTypes to understand what types of objects are available in the system.`;

    if (contextDocuments.length > 0) {
      systemInstruction += `\n\nContext Objects:`;
      contextDocuments.forEach((doc, index) => {
        systemInstruction += `\n${index + 1}. ${doc.type}: ${doc.name}`;
        if (doc.aliases.length > 0) {
          systemInstruction += ` (aliases: ${doc.aliases.join(', ')})`;
        }
        systemInstruction += `\n   ${doc.content.substring(0, 200)}${doc.content.length > 200 ? '...' : ''}`;
      });
    }

    // Convert messages to Gemini format
    const geminiMessages = messages.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }]
    }));

    const tools = enableFunctionCalling ? [
      { functionDeclarations: [searchObjectsTool, getObjectTool, createObjectTool, updateObjectTool, getObjectTypesTool] }
    ] : undefined;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction,
        ...(tools && { tools })
      },
      contents: geminiMessages
    });

    // Handle function calls if present
    if (response.candidates?.[0]?.content?.parts) {
      const parts = response.candidates[0].content.parts;
      let finalResponse = "";
      
      for (const part of parts) {
        if (part.text) {
          finalResponse += part.text;
        } else if (part.functionCall) {
          const functionName = part.functionCall.name;
          const functionArgs = part.functionCall.args;
          
          console.log(`Executing function: ${functionName}`, functionArgs);
          
          if (functionHandlers[functionName as keyof typeof functionHandlers]) {
            try {
              const result = await functionHandlers[functionName as keyof typeof functionHandlers](functionArgs);
              
              // Make a follow-up call with the function result
              const followUpResponse = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                config: { systemInstruction },
                contents: [
                  ...geminiMessages,
                  {
                    role: "assistant",
                    parts: [{ functionCall: part.functionCall }]
                  },
                  {
                    role: "function",
                    parts: [{ 
                      functionResponse: { 
                        name: functionName, 
                        response: result 
                      } 
                    }]
                  }
                ]
              });
              
              finalResponse += followUpResponse.text || "";
            } catch (error) {
              console.error(`Function call error:`, error);
              finalResponse += `Error executing ${functionName}: ${error}`;
            }
          }
        }
      }
      
      return finalResponse || response.text || "No response generated";
    }

    return response.text || "No response generated";
  } catch (error) {
    console.error('Gemini chat error:', error);
    throw new Error(`Failed to chat with Gemini: ${error}`);
  }
}

export async function extractTextFromPDF(pdfBase64: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          inlineData: {
            data: pdfBase64,
            mimeType: "application/pdf"
          }
        },
        "Extract all text content from this PDF document. Preserve the structure and formatting as much as possible, including headings, paragraphs, and any important organizational elements."
      ]
    });

    return response.text || "";
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error(`Failed to extract text from PDF: ${error}`);
  }
}