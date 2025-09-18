// Reference: javascript_gemini blueprint integration  
import { GoogleGenAI, FunctionDeclaration, Type } from "@google/genai";
import { storage } from "./storage";
import type { Document } from "@shared/schema";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Function calling tools for Gemini
const searchDocumentsTool: FunctionDeclaration = {
  name: "search_documents",
  description: "Search for documents, people, organizations, issues, and logs by name, content, or aliases",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: "Search query to find documents, people, organizations, issues, or logs"
      },
      type: {
        type: Type.STRING,
        enum: ["person", "document", "organization", "issue", "log"],
        description: "Filter by document type (optional)"
      }
    },
    required: ["query"]
  }
};

const getDocumentTool: FunctionDeclaration = {
  name: "get_document",
  description: "Get detailed information about a specific document, person, organization, issue, or log by ID. For issues, automatically includes associated logs.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      id: {
        type: Type.STRING,
        description: "The document ID to retrieve"
      }
    },
    required: ["id"]
  }
};

const createDocumentTool: FunctionDeclaration = {
  name: "create_document",
  description: "Create a new document, person profile, organization, issue, or log entry",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: {
        type: Type.STRING,
        description: "Name of the document, person, organization, issue, or log"
      },
      type: {
        type: Type.STRING,
        enum: ["person", "document", "organization", "issue", "log"],
        description: "Type of entry to create"
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

const updateDocumentTool: FunctionDeclaration = {
  name: "update_document",
  description: "Update an existing document, person profile, organization, issue, or log entry",
  parameters: {
    type: Type.OBJECT,
    properties: {
      id: {
        type: Type.STRING,
        description: "The document ID to update"
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

// Function handlers
async function handleSearchDocuments(args: any) {
  const { query, type } = args;
  const results = await storage.searchDocuments(query, type);
  return {
    documents: results.documents,
    total: results.total,
    message: `Found ${results.total} ${type ? type + 's' : 'items'} matching "${query}"`
  };
}

async function handleGetDocument(args: any) {
  const { id } = args;
  const document = await storage.getDocument(id);
  if (!document) {
    return { error: "Document not found", id };
  }
  
  let additionalInfo = "";
  
  // If this is an issue, find all associated logs
  if (document.type === "issue") {
    try {
      const relationshipResults = await storage.findRelationships({
        sourceId: id,
        targetType: "log"
      });
      
      if (relationshipResults.relationships.length > 0) {
        // Get the actual log documents
        const logIds = relationshipResults.relationships.map(r => r.targetId);
        const logs = [];
        
        for (const logId of logIds) {
          const log = await storage.getDocument(logId);
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
    document,
    message: `Retrieved ${document.type}: ${document.name}${additionalInfo}`
  };
}

async function handleCreateDocument(args: any) {
  const { name, type, content, aliases = [] } = args;
  const document = await storage.createDocument({
    name,
    type,
    content,
    aliases
  });
  return {
    document,
    message: `Created new ${type}: ${name}`
  };
}

async function handleUpdateDocument(args: any) {
  const { id, ...updates } = args;
  const document = await storage.updateDocument(id, updates);
  if (!document) {
    return { error: "Document not found", id };
  }
  return {
    document,
    message: `Updated ${document.type}: ${document.name}`
  };
}

const functionHandlers = {
  search_documents: handleSearchDocuments,
  get_document: handleGetDocument,
  create_document: handleCreateDocument,
  update_document: handleUpdateDocument
};

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  contextDocuments?: string[];
}

export interface GeminiChatOptions {
  messages: ChatMessage[];
  contextDocuments?: Document[];
  enableFunctionCalling?: boolean;
}

export async function chatWithGemini(options: GeminiChatOptions): Promise<string> {
  try {
    const { messages, contextDocuments = [], enableFunctionCalling = true } = options;
    
    // Build system instruction with context
    let systemInstruction = `You are an AI assistant specializing in document and knowledge management. You help users organize, search, and understand their documents, people, organizations, issues, and logs.

Key capabilities:
- Search through documents, people, organizations, issues, and logs
- Retrieve detailed information about specific items (issues automatically include associated logs)
- Create new entries of any type
- Update existing entries
- Access relationships between entities

You have access to function calling tools to search, retrieve, create, and modify all types of documents and entities.`;

    if (contextDocuments.length > 0) {
      systemInstruction += `\n\nContext Documents:`;
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
      { functionDeclarations: [searchDocumentsTool, getDocumentTool, createDocumentTool, updateDocumentTool] }
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