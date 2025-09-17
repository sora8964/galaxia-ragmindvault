// Gemini Function Calling Service
import { GoogleGenAI } from "@google/genai";
import { storage } from "./storage";
import { embeddingService } from "./embedding-service";
import { generateTextEmbedding } from "./gemini-simple";
import type { Document, MentionItem, SearchResult } from "@shared/schema";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Function definitions for Gemini
const functions = {
  searchDocuments: {
    name: "searchDocuments",
    description: "Search for documents and people in the knowledge base using keywords",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query keywords"
        },
        type: {
          type: "string",
          description: "Filter by document type (optional)"
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default: 10)"
        }
      },
      required: ["query"]
    }
  },

  getDocumentDetails: {
    name: "getDocumentDetails",
    description: "Get the full content and details of a specific document or person",
    parameters: {
      type: "object",
      properties: {
        documentId: {
          type: "string",
          description: "The ID of the document to retrieve"
        }
      },
      required: ["documentId"]
    }
  },

  createDocument: {
    name: "createDocument",
    description: "Create a new document or person profile in the knowledge base",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "The name/title of the document or person"
        },
        type: {
          type: "string",
          description: "Whether this is a person profile or document"
        },
        content: {
          type: "string",
          description: "The main content/description"
        },
        aliases: {
          type: "array",
          items: { type: "string" },
          description: "Alternative names or aliases (optional)"
        }
      },
      required: ["name", "type", "content"]
    }
  },

  updateDocument: {
    name: "updateDocument",
    description: "Update an existing document or person profile",
    parameters: {
      type: "object",
      properties: {
        documentId: {
          type: "string",
          description: "The ID of the document to update"
        },
        name: {
          type: "string",
          description: "New name/title (optional)"
        },
        content: {
          type: "string",
          description: "New content (optional)"
        },
        aliases: {
          type: "array",
          items: { type: "string" },
          description: "New aliases (optional)"
        }
      },
      required: ["documentId"]
    }
  },

  findSimilarDocuments: {
    name: "findSimilarDocuments",
    description: "Find documents similar to a given text using semantic search (vector similarity)",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The text to find similar documents for"
        },
        limit: {
          type: "number",
          description: "Maximum number of similar documents to return (default: 5)"
        },
        threshold: {
          type: "number",
          description: "Similarity threshold between 0-1 (default: 0.7)"
        }
      },
      required: ["text"]
    }
  },

  parseMentions: {
    name: "parseMentions",
    description: "Parse @mentions in text and resolve them to actual documents/people",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Text containing @mentions to parse"
        }
      },
      required: ["text"]
    }
  }
};

// Function implementations
async function searchDocuments(args: any): Promise<string> {
  try {
    const { query, type, limit = 10 } = args;
    
    const result = await storage.searchDocuments(query, type);
    const documents = result.documents.slice(0, limit);
    
    if (documents.length === 0) {
      return `No documents found for query: "${query}"`;
    }
    
    const summary = documents.map(doc => 
      `- ${doc.type === 'person' ? '👤' : '📄'} **${doc.name}** (ID: ${doc.id})\n` +
      `  ${doc.content.substring(0, 150)}${doc.content.length > 150 ? '...' : ''}\n` +
      (doc.aliases.length > 0 ? `  Also known as: ${doc.aliases.join(', ')}\n` : '')
    ).join('\n');
    
    return `Found ${documents.length} document(s):\n\n${summary}`;
  } catch (error) {
    return `Error searching documents: ${error}`;
  }
}

async function getDocumentDetails(args: any): Promise<string> {
  try {
    const { documentId } = args;
    
    const document = await storage.getDocument(documentId);
    if (!document) {
      return `Document with ID "${documentId}" not found.`;
    }
    
    const result = `${document.type === 'person' ? '👤 Person Profile' : '📄 Document'}: **${document.name}**\n\n` +
      `**Content:**\n${document.content}\n\n` +
      (document.aliases.length > 0 ? `**Aliases:** ${document.aliases.join(', ')}\n\n` : '') +
      `**Status:** ${document.hasEmbedding ? '✅ Indexed' : '⏳ Processing'}\n` +
      `**Created:** ${new Date(document.createdAt).toLocaleDateString()}\n` +
      `**Updated:** ${new Date(document.updatedAt).toLocaleDateString()}`;
    
    return result;
  } catch (error) {
    return `Error getting document details: ${error}`;
  }
}

async function createDocument(args: any): Promise<string> {
  try {
    const { name, type, content, aliases = [] } = args;
    
    const document = await storage.createDocument({
      name,
      type,
      content,
      aliases,
      embedding: null,
      hasEmbedding: false,
      embeddingStatus: "pending",
      needsEmbedding: true,
      isFromOCR: false,
      hasBeenEdited: false
    });
    
    // Trigger immediate embedding
    await embeddingService.triggerImmediateEmbedding(document.id);
    
    return `✅ Successfully created ${type === 'person' ? 'person profile' : 'document'}: **${name}**\n` +
      `ID: ${document.id}\n` +
      `The content has been indexed and will be available for search shortly.`;
  } catch (error) {
    return `Error creating document: ${error}`;
  }
}

async function updateDocument(args: any): Promise<string> {
  try {
    const { documentId, name, content, aliases } = args;
    
    const updateData: any = {};
    if (name) updateData.name = name;
    if (content) updateData.content = content;
    if (aliases) updateData.aliases = aliases;
    
    const document = await storage.updateDocument(documentId, updateData);
    if (!document) {
      return `Document with ID "${documentId}" not found.`;
    }
    
    // Trigger re-embedding after update
    await embeddingService.queueDocumentForEmbedding(documentId);
    
    return `✅ Successfully updated ${document.type === 'person' ? 'person profile' : 'document'}: **${document.name}**\n` +
      `The content has been re-indexed and will be available for search shortly.`;
  } catch (error) {
    return `Error updating document: ${error}`;
  }
}

async function findSimilarDocuments(args: any): Promise<string> {
  try {
    const { text, limit = 5, threshold = 0.7 } = args;
    
    // Generate embedding for the query text
    const queryEmbedding = await generateTextEmbedding(text);
    if (queryEmbedding.length === 0) {
      return "Unable to generate embedding for the query text.";
    }
    
    // Get all documents with embeddings
    const allDocuments = await storage.getAllDocuments();
    const documentsWithEmbeddings = allDocuments.filter(doc => doc.hasEmbedding && doc.embedding);
    
    if (documentsWithEmbeddings.length === 0) {
      return "No indexed documents available for similarity search.";
    }
    
    // Calculate cosine similarity
    const similarities = documentsWithEmbeddings.map(doc => {
      const similarity = cosineSimilarity(queryEmbedding, doc.embedding!);
      return { document: doc, similarity };
    });
    
    // Filter by threshold and sort by similarity
    const relevantDocs = similarities
      .filter(item => item.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
    
    if (relevantDocs.length === 0) {
      return `No documents found with similarity >= ${threshold}`;
    }
    
    const summary = relevantDocs.map(item => 
      `- ${item.document.type === 'person' ? '👤' : '📄'} **${item.document.name}** (Similarity: ${(item.similarity * 100).toFixed(1)}%)\n` +
      `  ${item.document.content.substring(0, 150)}${item.document.content.length > 150 ? '...' : ''}\n`
    ).join('\n');
    
    return `Found ${relevantDocs.length} similar document(s):\n\n${summary}`;
  } catch (error) {
    return `Error finding similar documents: ${error}`;
  }
}

async function parseMentions(args: any): Promise<string> {
  try {
    const { text } = args;
    
    // Simple regex to find @mentions in format @[type:name] or @[type:name|alias]
    const mentionRegex = /@\[(person|document):([^|\]]+)(?:\|([^]]+))?\]/g;
    const mentions = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      const [fullMatch, type, name, alias] = match;
      
      // Try to find the document
      const searchResult = await storage.searchDocuments(name, type as "person" | "document");
      const foundDoc = searchResult.documents.find(doc => 
        doc.name.toLowerCase() === name.toLowerCase() ||
        doc.aliases.some(a => a.toLowerCase() === name.toLowerCase())
      );
      
      mentions.push({
        mention: fullMatch,
        type,
        name,
        alias,
        found: !!foundDoc,
        documentId: foundDoc?.id,
        resolvedName: foundDoc?.name
      });
    }
    
    if (mentions.length === 0) {
      return "No @mentions found in the text.";
    }
    
    const summary = mentions.map(mention => 
      `- ${mention.mention}: ${mention.found ? '✅' : '❌'} ` +
      (mention.found ? `Found "${mention.resolvedName}" (ID: ${mention.documentId})` : 'Not found')
    ).join('\n');
    
    return `Found ${mentions.length} mention(s):\n\n${summary}`;
  } catch (error) {
    return `Error parsing mentions: ${error}`;
  }
}

// Helper function to calculate cosine similarity
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

// Function call dispatcher
export async function callFunction(functionName: string, args: any): Promise<string> {
  switch (functionName) {
    case "searchDocuments":
      return await searchDocuments(args);
    case "getDocumentDetails":
      return await getDocumentDetails(args);
    case "createDocument":
      return await createDocument(args);
    case "updateDocument":
      return await updateDocument(args);
    case "findSimilarDocuments":
      return await findSimilarDocuments(args);
    case "parseMentions":
      return await parseMentions(args);
    default:
      return `Unknown function: ${functionName}`;
  }
}

// Main chat interface with function calling
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  contextDocuments?: string[];
}

export interface GeminiFunctionChatOptions {
  messages: ChatMessage[];
  contextDocuments?: Document[];
}

export async function chatWithGeminiFunctions(options: GeminiFunctionChatOptions): Promise<string> {
  try {
    const { messages, contextDocuments = [] } = options;
    
    // Build system instruction
    let systemInstruction = `You are an AI assistant for an advanced document and knowledge management system. You help users organize, search, and understand their documents and information about people.

You have access to the following functions to help users:
- searchDocuments: Find documents and people by keywords
- getDocumentDetails: Get full content of specific documents
- createDocument: Create new documents or person profiles  
- updateDocument: Modify existing documents
- findSimilarDocuments: Find semantically similar content
- parseMentions: Analyze @mentions in text

When users ask about finding, creating, or managing documents, proactively use these functions to help them. Always call the appropriate function rather than making assumptions about what exists in the knowledge base.

Use @mentions like @[person:習近平] or @[document:項目計劃書] when referring to specific entities.`;

    if (contextDocuments.length > 0) {
      systemInstruction += `\n\nContext Documents (Currently available):`;
      contextDocuments.forEach((doc, index) => {
        systemInstruction += `\n${index + 1}. ${doc.type === 'person' ? '👤' : '📄'} ${doc.name}`;
        if (doc.aliases.length > 0) {
          systemInstruction += ` (${doc.aliases.join(', ')})`;
        }
        systemInstruction += `\n   📝 ${doc.content.substring(0, 200)}${doc.content.length > 200 ? '...' : ''}`;
      });
    }

    // Convert messages to Gemini format
    const geminiMessages = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : msg.role,
      parts: [{ text: msg.content }]
    }));

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      config: {
        systemInstruction,
        tools: [{
          functionDeclarations: Object.values(functions) as any[]
        }]
      },
      contents: geminiMessages
    });

    // Handle function calls
    if (response.candidates?.[0]?.content?.parts) {
      let finalResponse = "";
      
      for (const part of response.candidates[0].content.parts) {
        if (part.functionCall) {
          const { name: functionName, args } = part.functionCall;
          console.log(`Calling function: ${functionName}`, args);
          
          const functionResult = await callFunction(functionName || "", args);
          finalResponse += functionResult + "\n\n";
        } else if (part.text) {
          finalResponse += part.text;
        }
      }
      
      return finalResponse.trim() || "I apologize, but I couldn't generate a response. Please try again.";
    }

    return response.text || "I apologize, but I couldn't generate a response. Please try again.";
  } catch (error) {
    console.error('Gemini function calling error:', error);
    throw new Error(`Failed to chat with Gemini functions: ${error}`);
  }
}