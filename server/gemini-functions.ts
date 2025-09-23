// Gemini Function Calling Service
import { GoogleGenAI } from "@google/genai";
import { storage } from "./storage";
import { embeddingService } from "./embedding-service";
import { generateTextEmbedding } from "./gemini-simple";
import type { Object, MentionItem, SearchResult, ObjectType } from "@shared/schema";
import { OBJECT_TYPES } from "@shared/schema";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Function definitions for Gemini
const functions = {
  searchObjects: {
    name: "searchObjects",
    description: "Perform semantic search for documents, people, letters, entities, issues, logs, and meetings with pagination support. Returns only titles and basic info, allowing you to fetch full content later using getObjectDetails. Use this for comprehensive exploration of relevant documents.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Semantic search query (natural language)"
        },
        type: {
          type: "string",
          description: "Filter by document type: person, document, letter, entity, issue, log, or meeting (optional)"
        },
        page: {
          type: "number",
          description: "Page number (starting from 1, default: 1)"
        },
        pageSize: {
          type: "number",
          description: "Number of results per page (default: 10, max: 50)"
        }
      },
      required: ["query"]
    }
  },

  getObjectTypes: {
    name: "getObjectTypes",
    description: "Get all available object types in the system. This helps you understand what types of objects can be created, searched, and managed.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },

  getObjectDetails: {
    name: "getObjectDetails",
    description: "Get the full content and details of a specific document, person, letter, entity, issue, log, or meeting. For issues, automatically includes all associated logs.",
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

  createObject: {
    name: "createObject",
    description: "Create a new document, person profile, letter, entity, issue, log, or meeting entry in the knowledge base",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "The name/title of the document, person, letter, entity, issue, log, or meeting"
        },
        type: {
          type: "string",
          description: "Type of entry: person, document, letter, entity, issue, log, or meeting"
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

  updateObject: {
    name: "updateObject",
    description: "Update an existing document, person profile, letter, entity, issue, log, or meeting entry",
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
          enum: [...OBJECT_TYPES],
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
async function searchObjects(args: any): Promise<string> {
  try {
    // Get app config for default page size
    const appConfig = await storage.getAppConfig();
    const { query, type, page = 1, pageSize = appConfig.functionCalling.defaultPageSize } = args;
    
    // Validate and clamp parameters using config
    const validPage = Math.max(1, Number(page) || 1);
    const validPageSize = Math.min(Math.max(pageSize, 1), appConfig.functionCalling.maxPageSize);
    const startIndex = (validPage - 1) * validPageSize;
    
    console.log(`Semantic search: query="${query}", type=${type}, page=${page}, pageSize=${validPageSize}`);
    
    // Generate embedding for semantic search
    const queryEmbedding = await generateTextEmbedding(
      query,
      appConfig.textEmbedding?.outputDimensionality || 3072,
      appConfig.textEmbedding?.autoTruncate !== false
    );
    if (queryEmbedding.length === 0) {
      return JSON.stringify({
        results: [],
        pagination: { page, pageSize: validPageSize, totalResults: 0, totalPages: 0 },
        message: "Unable to generate embedding for semantic search"
      });
    }
    
    // Perform vector search to get semantic results 
    const searchLimit = appConfig.retrieval?.semanticSearchLimit || 1000;
    const vectorResults = await storage.searchObjectsByVector(queryEmbedding, searchLimit);
    
    // Sort by similarity to ensure consistent ordering
    const sortedResults = vectorResults.sort((a: any, b: any) => (b.similarity || 0) - (a.similarity || 0));
    
    // Filter by type if specified
    const filteredResults = type 
      ? sortedResults.filter((doc: any) => doc.type === type)
      : sortedResults;
    
    // Calculate pagination
    const totalResults = filteredResults.length;
    const totalPages = Math.ceil(totalResults / validPageSize);
    const endIndex = Math.min(startIndex + validPageSize, totalResults);
    const pageResults = filteredResults.slice(startIndex, endIndex);
    
    const getIcon = (type: string) => {
      switch (type) {
        case 'person': return '👤';
        case 'document': return '📄';
        case 'letter': return '✉️';
        case 'entity': return '🏢';
        case 'issue': return '📋';
        case 'log': return '📝';
        case 'meeting': return '👥';
        default: return '📄';
      }
    };
    
    // Format results as lightweight summaries (titles and basic info only)
    const results = pageResults.map((doc: any) => ({
      id: doc.id,
      name: doc.name,
      type: doc.type,
      snippet: doc.content.substring(0, 100) + (doc.content.length > 100 ? '...' : ''),
      aliases: doc.aliases || [],
      date: doc.date || null,
      similarity: doc.similarity,
      icon: getIcon(doc.type)
    }));

    return JSON.stringify({
      results,
      pagination: {
        page: validPage,
        pageSize: validPageSize,
        totalResults,
        totalPages
      },
      query,
      type,
      message: `Found ${totalResults} semantic matches${type ? ` (type: ${type})` : ''}`
    });
  } catch (error) {
    console.error('Semantic search error:', error);
    return JSON.stringify({
      results: [],
      pagination: { page: 1, pageSize: 10, totalResults: 0, totalPages: 0 },
      error: `Semantic search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
}

async function getObjectDetails(args: any): Promise<string> {
  try {
    const { documentId } = args;
    
    const document = await storage.getObject(documentId);
    if (!document) {
      return `Document with ID "${documentId}" not found.`;
    }
    
    const getIcon = (type: string) => {
      switch (type) {
        case 'person': return '👤 Person Profile';
        case 'document': return '📄 Document';
        case 'letter': return '✉️ Letter';
        case 'entity': return '🏢 Entity';
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

async function createObject(args: any): Promise<string> {
  try {
    const { name, type, content, aliases = [] } = args;
    
    const document = await storage.createObject({
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
        case 'letter': return 'letter';
        case 'entity': return 'entity';
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

async function updateObject(args: any): Promise<string> {
  try {
    const { documentId, name, content, aliases } = args;
    
    const updateData: any = {};
    if (name) updateData.name = name;
    if (content) updateData.content = content;
    if (aliases) updateData.aliases = aliases;
    
    const document = await storage.updateObject(documentId, updateData);
    if (!document) {
      return `Document with ID "${documentId}" not found.`;
    }
    
    // Trigger re-embedding after update
    await embeddingService.queueDocumentForEmbedding(documentId);
    
    const getTypeName = (type: string) => {
      switch (type) {
        case 'person': return 'person profile';
        case 'document': return 'document';
        case 'letter': return 'letter';
        case 'entity': return 'entity';
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
    const appConfig = await storage.getAppConfig();
    const queryEmbedding = await generateTextEmbedding(
      text,
      appConfig.textEmbedding?.outputDimensionality || 3072,
      appConfig.textEmbedding?.autoTruncate !== false
    );
    if (queryEmbedding.length === 0) {
      return "Unable to generate embedding for the query text.";
    }
    
    // Get all documents with embeddings
    const allDocuments = await storage.getAllObjects();
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
        case 'letter': return '✉️';
        case 'entity': return '🏢';
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
    const mentionRegex = /@\[(person|document|entity|issue|log|meeting):([^|\]]+)(?:\|([^]]+))?\]/g;
    const mentions = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      const [fullMatch, type, name, alias] = match;
      
      // Try to find the document
      const searchResult = await storage.searchObjects(name, type as ObjectType);
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
      const doc = await storage.getObject(documentId);
      if (doc) targetDocuments.push(doc);
    } else {
      // Use existing searchDocuments for document-level filtering
      const searchResult = await storage.searchObjects(query, type);
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
        const chunks = await storage.getChunksByObjectId(doc.id);
        
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
        case 'letter': return '✉️';
        case 'entity': return '🏢';
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

// Get all available object types
async function getObjectTypes(args: any): Promise<string> {
  try {
    const objectTypes = [
      {
        type: "person",
        name: "Person",
        description: "Individual people with personal information, roles, and relationships",
        icon: "👤"
      },
      {
        type: "document",
        name: "Document",
        description: "Text documents, reports, articles, and written materials",
        icon: "📄"
      },
      {
        type: "letter",
        name: "Letter",
        description: "Correspondence, letters, and formal communications",
        icon: "✉️"
      },
      {
        type: "entity",
        name: "Entity",
        description: "Organizations, companies, institutions, and other entities",
        icon: "🏢"
      },
      {
        type: "issue",
        name: "Issue",
        description: "Problems, topics, or matters that need attention or resolution",
        icon: "⚠️"
      },
      {
        type: "log",
        name: "Log",
        description: "Records, logs, and chronological entries of events or activities",
        icon: "📝"
      },
      {
        type: "meeting",
        name: "Meeting",
        description: "Meeting records, minutes, and meeting-related information",
        icon: "🤝"
      }
    ];

    let result = "Available Object Types in the System:\n\n";
    
    objectTypes.forEach((objType, index) => {
      result += `${index + 1}. ${objType.icon} **${objType.name}** (${objType.type})\n`;
      result += `   ${objType.description}\n\n`;
    });

    result += "You can use these object types when:\n";
    result += "- Searching with searchObjects (use the 'type' parameter)\n";
    result += "- Creating new objects with createObject\n";
    result += "- Using @mentions like @[person:Name], @[document:Title], etc.\n";
    result += "- Filtering and organizing information";

    return result;

  } catch (error) {
    return `Error getting object types: ${error}`;
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
    case "searchObjects":
      return await searchObjects(args);
    case "getObjectTypes":
      return await getObjectTypes(args);
    case "getObjectDetails":
      return await getObjectDetails(args);
    case "createObject":
      return await createObject(args);
    case "updateObject":
      return await updateObject(args);
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
  contextDocuments?: Object[];
}

// Helper function to handle generateContent with retry logic
async function generateContentWithRetry(ai: any, params: any, functionResult?: string): Promise<any> {
  try {
    return await ai.models.generateContent(params);
  } catch (error: any) {
    // If it's an INTERNAL 500 error and we have function result, try with shortened result
    if (error?.status === 500 && functionResult) {
      console.warn('Gemini API returned 500, retrying with shortened function result');
      try {
        // Shorten function result by 50%
        const shortenedResult = functionResult.substring(0, Math.floor(functionResult.length * 0.5)) + '\n\n[Result truncated due to size limits]';
        
        // Update the function response in params
        const retryParams = { ...params };
        if (retryParams.contents && retryParams.contents.length > 0) {
          const lastContent = retryParams.contents[retryParams.contents.length - 1];
          if (lastContent?.parts?.[0]?.functionResponse) {
            lastContent.parts[0].functionResponse.response.result = shortenedResult;
          }
        }
        
        return await ai.models.generateContent(retryParams);
      } catch (retryError) {
        console.error('Retry with shortened result also failed:', retryError);
        // Return a minimal fallback response
        return {
          text: 'I found relevant information but encountered processing limits. Please try a more specific query or break your request into smaller parts.'
        };
      }
    }
    throw error;
  }
}

export async function chatWithGeminiFunctions(options: GeminiFunctionChatOptions): Promise<{
  content: string;
  functionCalls: Array<{name: string; arguments: any; result?: any}>;
  thinking?: string;
}> {
  try {
    const { messages, contextDocuments = [] } = options;
    
    // Build system instruction
    let systemInstruction = `You are an AI assistant for an advanced object and knowledge management system. You help users organize, search, and understand their objects, people, entities, issues, logs, and meetings.

Objects refer to all types of data entries including but not limited to persons, entities, issues, logs, meetings, letters, and documents. You can use the getObjectTypes function to see all available object types.

You have access to the following functions to help users:

**SEARCH & EXPLORATION FUNCTIONS (Use iteratively for comprehensive analysis):**
- searchObjects: **POWERFUL SEMANTIC SEARCH** with pagination - Returns lightweight summaries (titles, snippets, relevance scores) of unlimited results. Use this extensively to explore the knowledge base with different queries and then selectively read full content with getObjectDetails. Perfect for comprehensive research and discovery.
- getObjectDetails: Get full content of specific objects - use AFTER finding relevant IDs with searchObjects
- findRelevantExcerpts: Find specific excerpts from objects using intelligent retrieval
- getObjectTypes: List all available object types in the system

**CONTENT MANAGEMENT FUNCTIONS:**
- createObject: Create new objects, person profiles, entities, issues, logs, or meetings
- updateObject: Modify existing objects
- findSimilarObjects: Find semantically similar content
- parseMentions: Analyze @mentions in text

**ITERATIVE RESEARCH STRATEGY:**
1. Start with searchObjects to get a comprehensive overview of relevant objects
2. Review pagination results and explore multiple pages if needed
3. Use getObjectDetails selectively to read full content of the most relevant objects
4. Combine insights from multiple objects to provide comprehensive answers

**IMPORTANT PRINCIPLES:**
- DON'T be afraid of the context window - Gemini 2.5 Pro can handle very large contexts
- USE searchObjects extensively with different queries to explore the knowledge base thoroughly  
- ITERATE through multiple pages of results when relevant
- READ full documents with getObjectDetails when you need complete information
- COMBINE information from multiple sources for comprehensive responses

Use @mentions like @[person:習近平], @[document:項目計劃書], @[letter:感謝信], @[entity:公司名稱], @[issue:問題標題], @[log:日誌名稱], or @[meeting:會議名稱] when referring to specific entities.`;

    if (contextDocuments.length > 0) {
      systemInstruction += `\n\nContext Objects (Currently available):`;
      const getIcon = (type: string) => {
        switch (type) {
          case 'person': return '👤';
          case 'document': return '📄';
          case 'entity': return '🏢';
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

    const response = await generateContentWithRetry(ai, {
      model: "gemini-2.5-pro",
      config: {
        systemInstruction,
        tools: [{
          functionDeclarations: Object.values(functions) as any[]
        }],
        thinkingConfig: {
          includeThoughts: true,
          thinkingBudget: -1  // Dynamic thinking - let model decide
        }
      },
      contents: geminiMessages
    });

    // Track function calls and thinking for the response
    const functionCalls: Array<{name: string; arguments: any; result?: any}> = [];
    let finalResponse = '';
    let thinkingSummary = '';

    // Handle function calls with proper follow-up analysis
    if (response.candidates?.[0]?.content?.parts) {
      const parts = response.candidates[0].content.parts;
      let hasTextResponse = false;
      
      // Process all parts to extract thinking, text, and function calls
      for (const part of parts) {
        if (part.text && part.thought) {
          // This is thinking content
          thinkingSummary += part.text;
        } else if (part.text && !part.thought) {
          // This is regular response text
          hasTextResponse = true;
          finalResponse += part.text;
        }
      }
      
      // Process function calls
      for (const part of parts) {
        if (part.functionCall) {
          const { name: functionName, args } = part.functionCall;
          console.log(`Calling function: ${functionName}`, args);
          
          // Record the function call
          const functionCallRecord = {
            name: functionName || '',
            arguments: args || {},
            result: undefined as any
          };
          
          try {
            const functionResult = await callFunction(functionName || "", args);
            functionCallRecord.result = functionResult;
            
            // Make follow-up call with function result for analysis (with retry logic)
            const followUpResponse = await generateContentWithRetry(ai, {
              model: "gemini-2.5-pro",
              config: { 
                systemInstruction,
                thinkingConfig: {
                  includeThoughts: true,
                  thinkingBudget: -1  // Dynamic thinking
                }
              },
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
            }, functionResult);
            
            // Extract thinking and text from follow-up response
            if (followUpResponse.candidates?.[0]?.content?.parts) {
              const followUpParts = followUpResponse.candidates[0].content.parts;
              let followUpContent = '';
              for (const followUpPart of followUpParts) {
                if (followUpPart.text && followUpPart.thought) {
                  thinkingSummary += followUpPart.text;
                } else if (followUpPart.text && !followUpPart.thought) {
                  followUpContent += followUpPart.text;
                }
              }
              if (followUpContent) {
                finalResponse = followUpContent;
              }
            }
            
            if (!finalResponse) {
              finalResponse = followUpResponse.text || "I apologize, but I couldn't analyze the search results. Please try again.";
            }
          } catch (error) {
            console.error(`Function call error for ${functionName}:`, error);
            functionCallRecord.result = `Error: ${error}`;
            finalResponse = `Error executing ${functionName}: ${error}`;
          }
          
          functionCalls.push(functionCallRecord);
        }
      }
      
      // If there's text response but no function calls, use it
      if (hasTextResponse && functionCalls.length === 0) {
        finalResponse = response.text || "I apologize, but I couldn't generate a response. Please try again.";
      }
    } else {
      finalResponse = response.text || "I apologize, but I couldn't generate a response. Please try again.";
    }

    return {
      content: finalResponse,
      functionCalls,
      thinking: thinkingSummary || undefined
    };
  } catch (error) {
    console.error('Gemini function calling error:', error);
    return {
      content: `Error: ${error}`,
      functionCalls: [],
      thinking: undefined
    };
  }
}