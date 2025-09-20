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
    description: "Search for documents, people, organizations, issues, logs, and meetings in the knowledge base using keywords",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query keywords"
        },
        type: {
          type: "string",
          description: "Filter by document type: person, document, organization, issue, log, or meeting (optional)"
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
    description: "Get the full content and details of a specific document, person, organization, issue, log, or meeting. For issues, automatically includes all associated logs.",
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
    description: "Create a new document, person profile, organization, issue, log, or meeting entry in the knowledge base",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "The name/title of the document, person, organization, issue, log, or meeting"
        },
        type: {
          type: "string",
          description: "Type of entry: person, document, organization, issue, log, or meeting"
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
    description: "Update an existing document, person profile, organization, issue, log, or meeting entry",
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
  },

  findRelevantExcerpts: {
    name: "findRelevantExcerpts",
    description: "Find relevant excerpts from documents using intelligent dual-stage retrieval. Use this for long documents instead of getting full content. Returns contextualized snippets with citations.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "User's question or search query to find relevant content"
        },
        documentId: {
          type: "string",
          description: "Optional: Specific document ID to search within. If not provided, searches across all documents"
        },
        type: {
          type: "string",
          enum: ["person", "document", "organization", "issue", "log", "meeting"],
          description: "Optional: Filter by document type"
        },
        maxExcerpts: {
          type: "number",
          description: "Maximum number of excerpts to return (default: 5)"
        },
        contextWindow: {
          type: "number", 
          description: "Context window size around matching chunks in characters (default: 400)"
        }
      },
      required: ["query"]
    }
  }
};

// Function implementations
async function searchDocuments(args: any): Promise<string> {
  try {
    const { query, type, limit = 10 } = args;
    
    const result = await storage.searchDocuments(query, type);
    const documents = result.objects.slice(0, limit);
    
    if (documents.length === 0) {
      return `No documents found for query: "${query}"`;
    }
    
    const getIcon = (type: string) => {
      switch (type) {
        case 'person': return '👤';
        case 'document': return '📄';
        case 'organization': return '🏢';
        case 'issue': return '📋';
        case 'log': return '📝';
        case 'meeting': return '👥';
        default: return '📄';
      }
    };
    
    const summary = documents.map(doc => 
      `- ${getIcon(doc.type)} **${doc.name}** (ID: ${doc.id})\n` +
      `  ${doc.content.substring(0, 800)}${doc.content.length > 800 ? '...' : ''}\n` +
      (doc.aliases.length > 0 ? `  Also known as: ${doc.aliases.join(', ')}\n` : '')
    ).join('\n');
    
    return `Found ${documents.length} document(s). Please analyze the content below to answer the user's question:\n\n${summary}`;
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
    
    const getIcon = (type: string) => {
      switch (type) {
        case 'person': return '👤 Person Profile';
        case 'document': return '📄 Document';
        case 'organization': return '🏢 Organization';
        case 'issue': return '📋 Issue';
        case 'log': return '📝 Log';
        case 'meeting': return '👥 Meeting';
        default: return '📄 Document';
      }
    };
    
    let result = `${getIcon(document.type)}: **${document.name}**\n\n` +
      `**Content:**\n${document.content}\n\n` +
      (document.aliases.length > 0 ? `**Aliases:** ${document.aliases.join(', ')}\n\n` : '') +
      (document.date ? `**Date:** ${document.date}\n\n` : '') +
      `**Status:** ${document.hasEmbedding ? '✅ Indexed' : '⏳ Processing'}\n` +
      `**Created:** ${new Date(document.createdAt).toLocaleDateString()}\n` +
      `**Updated:** ${new Date(document.updatedAt).toLocaleDateString()}\n\n` +
      `Please analyze the above content to answer the user's question about this ${document.type}.`;
    
    // If this is an issue, find all associated logs
    if (document.type === 'issue') {
      try {
        const relationshipResults = await storage.findRelationships({
          sourceId: documentId,
          targetType: 'log'
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
          
          result += `\n\n**Associated Logs (${logs.length}):**\n`;
          logs.forEach(log => {
            result += `\n- 📝 **${log.name}**${log.date ? ` (${log.date})` : ''}\n`;
            result += `  ${log.content.substring(0, 100)}${log.content.length > 100 ? '...' : ''}\n`;
          });
        }
      } catch (error) {
        console.error('Error fetching associated logs:', error);
      }
    }
    
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
    
    const getTypeName = (type: string) => {
      switch (type) {
        case 'person': return 'person profile';
        case 'document': return 'document';
        case 'organization': return 'organization';
        case 'issue': return 'issue';
        case 'log': return 'log';
        case 'meeting': return 'meeting';
        default: return 'document';
      }
    };
    
    return `✅ Successfully created ${getTypeName(type)}: **${name}**\n` +
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
    
    const getTypeName = (type: string) => {
      switch (type) {
        case 'person': return 'person profile';
        case 'document': return 'document';
        case 'organization': return 'organization';
        case 'issue': return 'issue';
        case 'log': return 'log';
        case 'meeting': return 'meeting';
        default: return 'document';
      }
    };
    
    return `✅ Successfully updated ${getTypeName(document.type)}: **${document.name}**\n` +
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
    
    const getIcon = (type: string) => {
      switch (type) {
        case 'person': return '👤';
        case 'document': return '📄';
        case 'organization': return '🏢';
        case 'issue': return '📋';
        case 'log': return '📝';
        case 'meeting': return '👥';
        default: return '📄';
      }
    };
    
    const summary = relevantDocs.map(item => 
      `- ${getIcon(item.document.type)} **${item.document.name}** (Similarity: ${(item.similarity * 100).toFixed(1)}%)\n` +
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
    const mentionRegex = /@\[(person|document|organization|issue|log|meeting):([^|\]]+)(?:\|([^]]+))?\]/g;
    const mentions = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      const [fullMatch, type, name, alias] = match;
      
      // Try to find the document
      const searchResult = await storage.searchDocuments(name, type as "person" | "document" | "organization" | "issue" | "log");
      const foundDoc = searchResult.objects.find(doc => 
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

async function findRelevantExcerpts(args: any): Promise<string> {
  try {
    const { 
      query, 
      documentId, 
      type, 
      maxExcerpts = 5, 
      contextWindow = 400 
    } = args;

    // Stage 1: Document-level search if no specific document provided
    let targetDocuments = [];
    
    if (documentId) {
      const doc = await storage.getDocument(documentId);
      if (doc) targetDocuments.push(doc);
    } else {
      // Use existing searchDocuments for document-level filtering
      const searchResult = await storage.searchDocuments(query, type);
      targetDocuments = searchResult.objects.slice(0, 10); // Top 10 documents
    }

    if (targetDocuments.length === 0) {
      return `No relevant documents found for query: "${query}"`;
    }

    // Stage 2: Chunk-level search within target documents
    let allExcerpts = [];
    
    for (const doc of targetDocuments) {
      try {
        // Get chunks for this document  
        const chunks = await storage.getChunksByDocument(doc.id);
        
        if (chunks.length === 0) {
          // Fallback: use document content directly for shorter docs
          if (doc.content.length <= 2000) {
            allExcerpts.push({
              documentId: doc.id,
              documentName: doc.name,
              documentType: doc.type,
              content: doc.content,
              relevanceScore: 1.0,
              chunkIndex: 0,
              isFullDocument: true
            });
          }
          continue;
        }

        // Simple relevance scoring based on query matching
        for (const chunk of chunks) {
          const lowerQuery = query.toLowerCase();
          const lowerContent = chunk.content.toLowerCase();
          
          let score = 0;
          const queryWords = lowerQuery.split(/\s+/);
          
          for (const word of queryWords) {
            if (word.length > 2) { // Skip very short words
              const occurrences = (lowerContent.match(new RegExp(word, 'g')) || []).length;
              score += occurrences * word.length; // Weight by word length
            }
          }
          
          if (score > 0) {
            // Calculate context window
            const startPos = Math.max(0, chunk.startPosition - contextWindow/2);
            const endPos = Math.min(doc.content.length, chunk.endPosition + contextWindow/2);
            const contextContent = doc.content.substring(startPos, endPos);
            
            allExcerpts.push({
              documentId: doc.id,
              documentName: doc.name,
              documentType: doc.type,
              content: contextContent,
              relevanceScore: score,
              chunkIndex: chunk.chunkIndex,
              startPosition: startPos,
              endPosition: endPos,
              isFullDocument: false
            });
          }
        }
      } catch (chunkError) {
        console.error(`Error processing chunks for document ${doc.id}:`, chunkError);
        // Fallback to document search
        if (doc.content.toLowerCase().includes(query.toLowerCase())) {
          allExcerpts.push({
            documentId: doc.id,
            documentName: doc.name,
            documentType: doc.type,
            content: doc.content.substring(0, 1000) + (doc.content.length > 1000 ? '...' : ''),
            relevanceScore: 0.5,
            chunkIndex: 0,
            isFullDocument: false
          });
        }
      }
    }

    // Stage 3: Rank and return top excerpts
    allExcerpts.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const topExcerpts = allExcerpts.slice(0, maxExcerpts);

    if (topExcerpts.length === 0) {
      return `No relevant excerpts found for query: "${query}"`;
    }

    const getIcon = (type: string) => {
      switch (type) {
        case 'person': return '👤';
        case 'document': return '📄';
        case 'organization': return '🏢';
        case 'issue': return '📋';
        case 'log': return '📝';
        case 'meeting': return '👥';
        default: return '📄';
      }
    };

    const excerptsSummary = topExcerpts.map((excerpt, index) => {
      const citation = excerpt.isFullDocument 
        ? `[${excerpt.documentName}]`
        : `[${excerpt.documentName}, chunk ${excerpt.chunkIndex + 1}]`;
      
      return `**Excerpt ${index + 1}** ${getIcon(excerpt.documentType)} ${citation}\n` +
        `${excerpt.content}\n` +
        `*Relevance Score: ${excerpt.relevanceScore.toFixed(2)}*\n`;
    }).join('\n---\n');

    return `Found ${topExcerpts.length} relevant excerpt(s) for: "${query}"\n\n${excerptsSummary}\n\n` +
      `Based on these excerpts, please provide a comprehensive answer to the user's question.`;

  } catch (error) {
    return `Error finding relevant excerpts: ${error}`;
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
    case "findRelevantExcerpts":
      return await findRelevantExcerpts(args);
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
    let systemInstruction = `You are an AI assistant for an advanced document and knowledge management system. You help users organize, search, and understand their documents, people, organizations, issues, logs, and meetings.

You have access to the following functions to help users:
- searchDocuments: Find documents, people, organizations, issues, logs, and meetings by keywords
- getDocumentDetails: Get full content of specific documents (issues automatically include associated logs)
- findRelevantExcerpts: **PREFERRED for long documents** - Find relevant excerpts using intelligent dual-stage retrieval. Returns contextualized snippets with citations instead of overwhelming full content
- createDocument: Create new documents, person profiles, organizations, issues, logs, or meetings
- updateDocument: Modify existing documents
- findSimilarDocuments: Find semantically similar content
- parseMentions: Analyze @mentions in text

**IMPORTANT**: For documents that might be long (meetings, detailed reports, etc.), prefer findRelevantExcerpts over getDocumentDetails to provide focused, relevant information with proper citations. Always call the appropriate function rather than making assumptions about what exists in the knowledge base.

Use @mentions like @[person:習近平], @[document:項目計劃書], @[organization:公司名稱], @[issue:問題標題], @[log:日誌名稱], or @[meeting:會議名稱] when referring to specific entities.`;

    if (contextDocuments.length > 0) {
      systemInstruction += `\n\nContext Documents (Currently available):`;
      const getIcon = (type: string) => {
        switch (type) {
          case 'person': return '👤';
          case 'document': return '📄';
          case 'organization': return '🏢';
          case 'issue': return '📋';
          case 'log': return '📝';
          default: return '📄';
        }
      };
      
      contextDocuments.forEach((doc, index) => {
        systemInstruction += `\n${index + 1}. ${getIcon(doc.type)} ${doc.name}`;
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

    // Handle function calls with proper follow-up analysis
    if (response.candidates?.[0]?.content?.parts) {
      const parts = response.candidates[0].content.parts;
      let hasTextResponse = false;
      
      // Check if there's both function calls and text response
      for (const part of parts) {
        if (part.text) {
          hasTextResponse = true;
          break;
        }
      }
      
      // If there are function calls but no text response, we need follow-up analysis
      for (const part of parts) {
        if (part.functionCall) {
          const { name: functionName, args } = part.functionCall;
          console.log(`Calling function: ${functionName}`, args);
          
          const functionResult = await callFunction(functionName || "", args);
          
          // Make follow-up call with function result for analysis
          const followUpResponse = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            config: { systemInstruction },
            contents: [
              ...geminiMessages,
              {
                role: "model",
                parts: [{ functionCall: part.functionCall }]
              },
              {
                role: "user",
                parts: [{
                  functionResponse: {
                    name: functionName,
                    response: { result: functionResult }
                  }
                }]
              }
            ]
          });
          
          return followUpResponse.text || "I apologize, but I couldn't analyze the search results. Please try again.";
        }
      }
      
      // If there's text response, return it
      if (hasTextResponse) {
        return response.text || "I apologize, but I couldn't generate a response. Please try again.";
      }
    }

    return response.text || "I apologize, but I couldn't generate a response. Please try again.";
  } catch (error) {
    console.error('Gemini function calling error:', error);
    throw new Error(`Failed to chat with Gemini functions: ${error}`);
  }
}