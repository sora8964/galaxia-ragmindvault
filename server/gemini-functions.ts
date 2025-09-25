// Gemini Function Calling Service
import { GoogleGenAI } from "@google/genai";
import { storage } from "./storage";
import { embeddingService } from "./embedding-service";
import { generateTextEmbedding } from "./gemini";
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
    description: "Get the full content and details of a specific document, person, letter, entity, issue, log, or meeting. For issues, automatically includes all associated logs. Supports two query methods: 1) By object ID (UUID format like 'abc123-def456'), or 2) By object type and name (use separate 'type' and 'name' fields). IMPORTANT: Do NOT use 'type:name' format as objectId - use the separate type and name fields instead.",
    parameters: {
      anyOf: [
        {
          type: "object",
          properties: {
            objectId: {
              type: "string",
              description: "The UUID of the object to retrieve (preferred method). Must be a UUID format like 'abc123-def456-ghi789'. Do NOT use 'type:name' format here."
            }
          },
          required: ["objectId"]
        },
        {
          type: "object",
          properties: {
            type: {
              type: "string",
              description: "Object type (person, document, letter, entity, issue, log, meeting) - required when using name-based query",
              enum: ["person", "document", "letter", "entity", "issue", "log", "meeting"]
            },
            name: {
              type: "string",
              description: "Object name - required when using name-based query"
            }
          },
          required: ["type", "name"]
        }
      ]
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
      appConfig.textEmbedding?.outputDimensionality || 3072
      // 查詢不需要 title
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
    const { objectId, type, name } = args;
    
    // Check if objectId is in "type:name" format (common mistake)
    if (objectId && typeof objectId === 'string' && objectId.includes(':') && !objectId.includes('-')) {
      const parts = objectId.split(':');
      if (parts.length === 2) {
        const [detectedType, detectedName] = parts;
        return `Error: You used "${objectId}" as objectId, but this appears to be in "type:name" format. Please use separate "type" and "name" fields instead: {"type": "${detectedType}", "name": "${detectedName}"}`;
      }
    }
    
    let document;
    
    // Method 1: Query by object ID (preferred)
    if (objectId) {
      document = await storage.getObject(objectId);
      if (!document) {
        return `Object with ID "${objectId}" not found.`;
      }
    }
    // Method 2: Query by type and name
    else if (type && name) {
      // Find object by type and name using semantic search
      const searchResult = await storage.searchObjects(name, type as any);
      
      if (!searchResult || !searchResult.objects || searchResult.objects.length === 0) {
        return `No ${type} found with name "${name}".`;
      }
      
      // Get the full object details using the found ID
      document = await storage.getObject(searchResult.objects[0].id);
      if (!document) {
        return `${type} "${name}" found but could not retrieve details.`;
      }
    }
    else {
      return "Error: Either 'objectId' or both 'type' and 'name' must be provided.";
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
          sourceId: document.id,
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
      // 查詢不需要 title
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

// Helper function to check if response is complete based on finishReason and content
function isResponseComplete(finishReason: string, responseText: string): boolean {
  if (finishReason === 'STOP') {
    return true;
  }
  
  if (finishReason === 'MAX_TOKENS') {
    // Check for incomplete sentences or obvious truncation
    const hasIncompleteSentence = /[，。！？]$/.test(responseText.trim());
    const hasContinuationIntent = /接下來|我將|繼續|下一步|然後|接著/.test(responseText);
    
    return !hasIncompleteSentence && !hasContinuationIntent;
  }
  
  if (finishReason === 'SAFETY' || finishReason === 'RECITATION') {
    // These are complete responses, just blocked
    return true;
  }
  
  // For unknown or other reasons, assume incomplete
  return false;
}

// Helper function to check if conversation should continue
function shouldContinueConversation(
  finishReason: string, 
  hasFunctionCalls: boolean, 
  responseText: string, 
  thinkingText: string
): boolean {
  // If there are function calls, always continue
  if (hasFunctionCalls) {
    return true;
  }
  
  // Check finishReason
  if (finishReason === 'STOP') {
    // Completely trust Gemini's STOP output - no continuation intent checking
    return false;
  }
  
  if (finishReason === 'MAX_TOKENS') {
    // Response was truncated, likely needs continuation
    const hasIncompleteSentence = /[，。！？]$/.test(responseText.trim());
    const hasContinuationIntent = /接下來|我將|繼續|下一步|然後|接著/.test(responseText);
    
    return hasIncompleteSentence || hasContinuationIntent;
  }
  
  if (finishReason === 'SAFETY' || finishReason === 'RECITATION') {
    // These are complete responses, just blocked
    return false;
  }
  
  // For unknown or other reasons, be conservative and continue
  return true;
}

// Function call dispatcher
export async function callFunction(functionName: string, args: any): Promise<string> {
  console.log(`\n🔧 [CALL FUNCTION] Executing: ${functionName}`);
  console.log('📋 Function arguments:', JSON.stringify(args, null, 2));
  
  const startTime = Date.now();
  let result: string;
  
  try {
  switch (functionName) {
    case "searchObjects":
        result = await searchObjects(args);
        break;
    case "getObjectTypes":
        result = await getObjectTypes(args);
        break;
    case "getObjectDetails":
        result = await getObjectDetails(args);
        break;
    case "createObject":
        result = await createObject(args);
        break;
    case "updateObject":
        result = await updateObject(args);
        break;
    case "findSimilarDocuments":
        result = await findSimilarDocuments(args);
        break;
    case "parseMentions":
        result = await parseMentions(args);
        break;
    case "findRelevantExcerpts":
        result = await findRelevantExcerpts(args);
        break;
    default:
        result = `Unknown function: ${functionName}`;
    }
    
    const duration = Date.now() - startTime;
    console.log(`✅ [FUNCTION COMPLETED] ${functionName} executed in ${duration}ms`);
    console.log('📊 Result length:', result.length);
    //console.log('📄 Result preview:', result.substring(0, 300) + (result.length > 300 ? '...' : ''));
    console.log('📄 Result:', result);
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [FUNCTION ERROR] ${functionName} failed after ${duration}ms:`, error);
    throw error;
  }
}

// Event types for multi-stage thinking
export interface ThinkingEvent {
  type: 'thinking';
  content: string;
  stage: 'initial' | 'post_function_call';
  functionCallIndex?: number; // Which function call this thinking follows (for post_function_call)
}

export interface FunctionCallEvent {
  type: 'function_call';
  name: string;
  arguments: any;
  result: any;
}

export type AIEvent = ThinkingEvent | FunctionCallEvent;

// Main chat interface with function calling
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  contextObjects?: string[];
}

export interface GeminiFunctionChatOptions {
  messages: ChatMessage[];
  contextObjects?: Object[];
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

// Helper function to merge consecutive response messages
async function mergeConsecutiveResponseMessages(conversationId: string, conversationGroupId: string): Promise<void> {
  try {
    console.log('🔄 [MERGE RESPONSES] Starting merge for conversation group:', conversationGroupId);
    
    // Get all messages for this conversation group, ordered by created_at
    const allMessages = await storage.getMessagesByConversation(conversationId);
    const groupMessages = allMessages
      .filter(msg => msg.conversationGroupId === conversationGroupId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    console.log('📊 [MERGE RESPONSES] Found', groupMessages.length, 'messages in group');
    
    // Debug: Show all messages in the group
    groupMessages.forEach((msg, index) => {
      console.log(`  ${index + 1}. ${msg.role}/${msg.type}: ${msg.id} (${new Date(msg.createdAt).toISOString()})`);
    });
    
    // Find consecutive response sequences
    const sequences: Array<{start: number, end: number, messages: any[]}> = [];
    let currentSequence: any[] = [];
    
    for (let i = 0; i < groupMessages.length; i++) {
      const msg = groupMessages[i];
      
      if (msg.role === 'assistant' && msg.type === 'response') {
        currentSequence.push({...msg, index: i});
      } else {
        // Non-response message, end current sequence if it exists
        if (currentSequence.length > 1) {
          sequences.push({
            start: currentSequence[0].index,
            end: currentSequence[currentSequence.length - 1].index,
            messages: [...currentSequence]
          });
        }
        currentSequence = [];
      }
    }
    
    // Check if there's a sequence at the end
    if (currentSequence.length > 1) {
      sequences.push({
        start: currentSequence[0].index,
        end: currentSequence[currentSequence.length - 1].index,
        messages: [...currentSequence]
      });
    }
    
    console.log('🔍 [MERGE RESPONSES] Found', sequences.length, 'consecutive response sequences');
    
    // Merge each sequence (process in reverse order to maintain indices)
    for (let seqIndex = sequences.length - 1; seqIndex >= 0; seqIndex--) {
      const sequence = sequences[seqIndex];
      
      if (sequence.messages.length <= 1) continue;
      
      console.log('🔄 [MERGE RESPONSES] Merging sequence with', sequence.messages.length, 'messages');
      console.log('📝 [MERGE RESPONSES] Message IDs:', sequence.messages.map(m => m.id));
      
      // Combine all response texts
      const combinedText = sequence.messages
        .map(msg => msg.content?.text || '')
        .join('');
      
      console.log('📄 [MERGE RESPONSES] Combined text length:', combinedText.length);
      console.log('📄 [MERGE RESPONSES] Text preview:', combinedText.substring(0, 100) + '...');
      
      // Use the timestamp of the last message in the sequence
      const lastMessage = sequence.messages[sequence.messages.length - 1];
      
      // Update the last message with merged content
      await storage.updateMessage(lastMessage.id, { content: { text: combinedText } });
      console.log('✅ [MERGE RESPONSES] Updated message:', lastMessage.id, 'with merged content');
      
      // Delete all messages in the sequence except the last one
      const messagesToDelete = sequence.messages.slice(0, -1);
      for (const msg of messagesToDelete) {
        await storage.deleteMessage(msg.id);
        console.log('🗑️ [MERGE RESPONSES] Deleted message:', msg.id);
      }
    }
    
    console.log('✅ [MERGE RESPONSES] Merge completed successfully');
    
  } catch (error) {
    console.error('❌ [MERGE RESPONSES] Error merging consecutive response messages:', error);
  }
}

// New iterative function calling implementation
export async function chatWithGeminiFunctionsIterative(options: GeminiFunctionChatOptions & {
  conversationId?: string;
  conversationGroupId?: string;
  referencedObjects?: Array<{
    id: string;
    name: string;
    type: string;
    aliases: string[];
    date?: string | null;
    isReferenced: boolean;
  }>;
}): Promise<{
  content: string;
  events: AIEvent[];
}> {
  try {
    const { messages, contextObjects = [], referencedObjects = [], conversationId, conversationGroupId } = options;
    
    console.log('\n🚀 [ITERATIVE] Starting iterative function calling:', {
      messageCount: messages.length,
      contextObjectCount: contextObjects.length,
      conversationId: conversationId ? 'provided' : 'none',
      conversationGroupId: conversationGroupId ? 'provided' : 'none'
    });
    
    if (contextObjects.length > 0) {
      console.log('📦 [CONTEXT OBJECTS] Available context objects:');
      contextObjects.forEach((obj, index) => {
        console.log(`  ${index + 1}. ${obj.type}: ${obj.name} (ID: ${obj.id})`);
        console.log(`     Content preview: ${obj.content.substring(0, 100)}...`);
      });
    } else {
      console.log('📦 [CONTEXT OBJECTS] No context objects available');
    }

    // Build system instruction (same as original)
    let systemInstruction = `You are an AI assistant for an advanced object and knowledge management system. You help users organize, search, and understand their objects, people, entities, issues, logs, and meetings.

Objects refer to all types of data entries including but not limited to persons, entities, issues, logs, meetings, letters, and documents. You can use the getObjectTypes function to see all available object types.

You have access to the following functions to help users:

**SEARCH & EXPLORATION FUNCTIONS (Use iteratively for comprehensive analysis):**
- searchObjects: **POWERFUL SEMANTIC SEARCH** with pagination - Returns lightweight summaries (titles, snippets, relevance scores) of unlimited results. Use this extensively to explore the knowledge base with different queries and then selectively read full content with getObjectDetails. Perfect for comprehensive research and discovery.
- getObjectDetails: Get full content of specific objects - supports two query methods: 1) By objectId (UUID format, preferred), or 2) By type and name (e.g., {type: "meeting", name: "第18屆第2次業主委員會會議紀錄"}). NEVER use "type:name" format as objectId.
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
3. Use getObjectDetails selectively to read full content - you can query by objectId (UUID) or by {type, name} combination. NEVER use "type:name" format as objectId.
4. Call additional functions as you think through the problem - don't limit yourself to one function per response
5. Combine insights from multiple objects to provide comprehensive answers

**FUNCTION CALLING PRINCIPLES:**
- You can call multiple functions in sequence during a single response
- You can call functions WHILE THINKING - thinking and function calling can be interleaved
- When analyzing a complex question, use functions during your thinking process to gather information
- After each function call, continue thinking about the results and call additional functions if needed
- Think → Call Function → Analyze Results → Think More → Call Another Function (if needed)
- When a user asks for multiple function calls, execute them step by step
- Provide output text between function calls to explain what you're doing
- Continue the conversation naturally after each function call
- Use function calls iteratively based on results from previous calls

**IMPORTANT PRINCIPLES:**
- DON'T be afraid of the context window - Gemini 2.5 Pro can handle very large contexts
- USE searchObjects extensively with different queries to explore the knowledge base thoroughly  
- ITERATE through multiple pages of results when relevant
- READ full documents with getObjectDetails when you need complete information (use UUID for objectId, or separate type/name fields)
- COMBINE information from multiple sources for comprehensive responses
- EXECUTE multiple function calls when requested by the user
- INTEGRATE function calling into your thinking process - call functions as you analyze and reason

**EXAMPLE WORKFLOW:**
Think about the question → Call a function to gather data → Analyze the results → Think more → Call another function if needed → Provide final answer

Use @mentions like @[person:習近平], @[document:項目計劃書], @[letter:感謝信], @[entity:公司名稱], @[issue:問題標題], @[log:日誌名稱], or @[meeting:會議名稱] when referring to specific entities.`;

    if (contextObjects.length > 0 || referencedObjects.length > 0) {
      systemInstruction += `\n\nContext Objects:`;
      const getIcon = (type: string) => {
        switch (type) {
          case 'person': return '👤';
          case 'document': return '📄';
          case 'entity': return '🏢';
          case 'issue': return '📋';
          case 'log': return '📝';
          case 'meeting': return '🤝';
          case 'letter': return '✉️';
          default: return '📄';
        }
      };
      
      // Add new objects with full content
      if (contextObjects.length > 0) {
        systemInstruction += `\n\n**New Objects (Full Content Available):**`;
        contextObjects.forEach((doc, index) => {
          systemInstruction += `\n${index + 1}. ${getIcon(doc.type)} **${doc.name}**`;
          if (doc.aliases.length > 0) {
            systemInstruction += ` (${doc.aliases.join(', ')})`;
          }
          systemInstruction += `\n   📝 ${doc.content.substring(0, 200)}${doc.content.length > 200 ? '...' : ''}`;
        });
      }
      
      // Add previously referenced objects (metadata only)
      if (referencedObjects.length > 0) {
        systemInstruction += `\n\n**Previously Referenced Objects (Content Available via getObjectDetails):**`;
        referencedObjects.forEach((obj, index) => {
          systemInstruction += `\n${index + 1}. ${getIcon(obj.type)} **${obj.name}**`;
          if (obj.aliases.length > 0) {
            systemInstruction += ` (${obj.aliases.join(', ')})`;
          }
          if (obj.date) {
            systemInstruction += ` - ${obj.date}`;
          }
          systemInstruction += `\n   ℹ️ This object was referenced earlier in this conversation. Use getObjectDetails to access its full content if needed.`;
        });
      }
    }

    // Initialize conversation history
    const conversationHistory = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : msg.role,
      parts: [{ text: msg.content }]
    }));

    // Track all events and response content
    const allEvents: AIEvent[] = [];
    let allResponseText = '';
    let roundCount = 0;
    
    console.log('\n🔄 [ITERATIVE] Starting conversation loop');
    console.log('🔧 Available Functions:', Object.keys(functions));
    
    // Iterative conversation loop
    while (roundCount < 10) { // Safety limit
      roundCount++;
      console.log(`\n🔄 [ROUND ${roundCount}] Starting round`);
      
      // Call Gemini with current conversation history
      console.log('\n🚀 [GEMINI API REQUEST] Raw request data:');
      console.log('📋 Model:', "gemini-2.5-pro");
      console.log('📝 System Instruction:', systemInstruction);
      console.log('🔧 Function Declarations:', JSON.stringify(Object.values(functions), null, 2));
      console.log('💬 Conversation History:', JSON.stringify(conversationHistory, null, 2));
      
      const result = await ai.models.generateContentStream({
      model: "gemini-2.5-pro",
      config: {
        systemInstruction,
        tools: [{
          functionDeclarations: Object.values(functions) as any[]
          }]
        },
        contents: conversationHistory
      });
      
      let roundResponseText = '';
      let roundThinking = '';
      const roundFunctionCalls: Array<{name: string; arguments: any; result: any}> = [];
      let hasFunctionCalls = false;
      
      // Process stream chunks
      let finalResponseObj: any = null;
      for await (const chunk of result) {
        // Store the final response object for finishReason checking
        finalResponseObj = chunk;
        
        if (chunk.candidates?.[0]?.content?.parts) {
          const parts = chunk.candidates[0].content.parts;
          
      for (const part of parts) {
            // Handle thinking
        if (part.text && part.thought) {
              console.log(`💭 [ROUND ${roundCount}] THINKING:`, part.text);
              roundThinking += part.text;
              
              if (conversationId && conversationGroupId) {
                await storage.createMessage({
                  conversationId,
                  conversationGroupId,
                  role: "assistant",
                  type: "thinking",
                  content: { text: part.text }
                });
              }
              
              allEvents.push({
                type: 'thinking',
                content: part.text,
                stage: roundFunctionCalls.length === 0 ? 'initial' : 'post_function_call'
              });
            }
            
            // Handle response text
            else if (part.text && !part.thought) {
              console.log(`💬 [ROUND ${roundCount}] RESPONSE:`, part.text);
              roundResponseText += part.text;
              allResponseText += part.text;
              
              if (conversationId && conversationGroupId && part.text.trim()) {
                await storage.createMessage({
                  conversationId,
                  conversationGroupId,
                  role: "assistant",
                  type: "response",
                  content: { text: part.text }
                });
              }
            }
            
            // Handle function calls
            else if (part.functionCall) {
          const { name: functionName, args } = part.functionCall;
              console.log(`🔧 [ROUND ${roundCount}] FUNCTION CALL: ${functionName}`);
              hasFunctionCalls = true;
              
              try {
                const functionResult = await callFunction(functionName || "", args);
                console.log(`✅ [ROUND ${roundCount}] Function completed`);
                
                if (conversationId && conversationGroupId) {
                  await storage.createMessage({
                    conversationId,
                    conversationGroupId,
                    role: "assistant",
                    type: "function_call",
                    content: { name: functionName || '', arguments: args || {}, result: functionResult }
                  });
                }

                const functionCallData = {
            name: functionName || '',
            arguments: args || {},
                  result: functionResult
                };
                
                roundFunctionCalls.push(functionCallData);
                allEvents.push({
                  type: 'function_call',
                  ...functionCallData
                });
                
              } catch (error) {
                console.error(`❌ [ROUND ${roundCount}] Function error:`, error);
                const errorResult = `Error: ${error}`;
                
                if (conversationId && conversationGroupId) {
                  await storage.createMessage({
                    conversationId,
                    conversationGroupId,
                    role: "assistant",
                    type: "function_call",
                    content: { name: functionName || '', arguments: args || {}, result: errorResult }
                  });
                }

                const functionCallData = {
                  name: functionName || '',
                  arguments: args || {},
                  result: errorResult
                };
                
                roundFunctionCalls.push(functionCallData);
                allEvents.push({
                  type: 'function_call',
                  ...functionCallData
                });
              }
            }
          }
        }
      }
      
      // Check finishReason after stream processing
      const finishReason = finalResponseObj?.candidates?.[0]?.finishReason;
      console.log(`🏁 [ROUND ${roundCount}] FINISH REASON:`, finishReason);
      
      // Log finish reason details
      if (finishReason === 'STOP') {
        console.log(`✅ [ROUND ${roundCount}] Response completed normally`);
      } else if (finishReason === 'MAX_TOKENS') {
        console.warn(`⚠️ [ROUND ${roundCount}] Response truncated due to max tokens limit`);
      } else if (finishReason === 'SAFETY') {
        console.warn(`⚠️ [ROUND ${roundCount}] Response blocked due to safety settings`);
      } else if (finishReason === 'RECITATION') {
        console.warn(`⚠️ [ROUND ${roundCount}] Response blocked due to recitation detection`);
      } else if (finishReason === 'OTHER') {
        console.warn(`⚠️ [ROUND ${roundCount}] Response ended for other reasons`);
      } else {
        console.warn(`⚠️ [ROUND ${roundCount}] Unknown finish reason:`, finishReason);
      }
      
      console.log(`🎯 [ROUND ${roundCount}] Round complete:`, {
        responseText: roundResponseText.length,
        thinking: roundThinking.length,
        functionCalls: roundFunctionCalls.length,
        hasFunctionCalls
      });
      
      // Add assistant's text response to conversation history
      if (roundResponseText || roundThinking) {
        const assistantContent = roundThinking ? `${roundThinking}\n\n${roundResponseText}` : roundResponseText;
        conversationHistory.push({
          role: 'model',
          parts: [{ text: assistantContent }]
        });
      }
      
      // Check if we should continue based on finishReason and function calls
      const shouldContinue = shouldContinueConversation(
        finishReason, 
        roundFunctionCalls.length > 0, 
        roundResponseText, 
        roundThinking
      );
      
      if (roundFunctionCalls.length > 0) {
        // Add function results as a user message containing the function results
        let functionResultsText = "Function call results:\n";
        for (const call of roundFunctionCalls) {
          functionResultsText += `\n${call.name}() returned: ${JSON.stringify(call.result, null, 2)}\n`;
        }
        
        conversationHistory.push({
          role: 'user',
          parts: [{
            text: functionResultsText
          }]
        });
        
        console.log(`🔄 [ROUND ${roundCount}] Function results added as user message, continuing to next round...`);
        continue; // Continue to next round
      }
      
      // No function calls - check if we should continue based on finishReason
      if (shouldContinue) {
        console.log(`🔄 [ROUND ${roundCount}] No function calls but should continue based on finishReason: ${finishReason}`);
        continue;
      }
      
      // Conversation is complete
      console.log(`✅ [ROUND ${roundCount}] No function calls and finishReason indicates completion: ${finishReason}`);
      break;
    }
    
    console.log('\n🎯 [ITERATIVE COMPLETE] All rounds finished');
    console.log('💭 Total events:', allEvents.length);
    console.log('💬 Total response length:', allResponseText.length);
    console.log('🔧 Total function calls:', allEvents.filter(e => e.type === 'function_call').length);
    console.log('🔄 Total rounds:', roundCount);
    
    // Merge consecutive response messages after completion
    console.log('🔍 [MERGE CHECK] conversationId:', conversationId);
    console.log('🔍 [MERGE CHECK] conversationGroupId:', conversationGroupId);
    if (conversationId && conversationGroupId) {
      console.log('🚀 [MERGE CHECK] Starting merge process...');
      await mergeConsecutiveResponseMessages(conversationId, conversationGroupId);
    } else {
      console.log('❌ [MERGE CHECK] Missing conversationId or conversationGroupId, skipping merge');
    }
    
    return {
      content: allResponseText,
      events: allEvents
    };

  } catch (error) {
    console.error('❌ [ITERATIVE ERROR]:', error);
    throw error;
  }
}

export async function chatWithGeminiFunctionsStreaming(options: GeminiFunctionChatOptions & {
  conversationId?: string;
  conversationGroupId?: string;
  referencedObjects?: Array<{
    id: string;
    name: string;
    type: string;
    aliases: string[];
    date?: string | null;
    isReferenced: boolean;
  }>;
}): Promise<{
  content: string;
  events: AIEvent[];
}> {
  try {
    const { messages, contextObjects = [], referencedObjects = [], conversationId, conversationGroupId } = options;
    
    // Build system instruction
    let systemInstruction = `You are an AI assistant for an advanced object and knowledge management system. You help users organize, search, and understand their objects, people, entities, issues, logs, and meetings.

Objects refer to all types of data entries including but not limited to persons, entities, issues, logs, meetings, letters, and documents. You can use the getObjectTypes function to see all available object types.

You have access to the following functions to help users:

**SEARCH & EXPLORATION FUNCTIONS (Use iteratively for comprehensive analysis):**
- searchObjects: **POWERFUL SEMANTIC SEARCH** with pagination - Returns lightweight summaries (titles, snippets, relevance scores) of unlimited results. Use this extensively to explore the knowledge base with different queries and then selectively read full content with getObjectDetails. Perfect for comprehensive research and discovery.
- getObjectDetails: Get full content of specific objects - supports two query methods: 1) By objectId (UUID format, preferred), or 2) By type and name (e.g., {type: "meeting", name: "第18屆第2次業主委員會會議紀錄"}). NEVER use "type:name" format as objectId.
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
3. Use getObjectDetails selectively to read full content - you can query by objectId (UUID) or by {type, name} combination. NEVER use "type:name" format as objectId.
4. Call additional functions as you think through the problem - don't limit yourself to one function per response
5. Combine insights from multiple objects to provide comprehensive answers

**FUNCTION CALLING PRINCIPLES:**
- You can call multiple functions in sequence during a single response
- You can call functions WHILE THINKING - thinking and function calling can be interleaved
- When analyzing a complex question, use functions during your thinking process to gather information
- After each function call, continue thinking about the results and call additional functions if needed
- Think → Call Function → Analyze Results → Think More → Call Another Function (if needed)
- When a user asks for multiple function calls, execute them step by step
- Provide output text between function calls to explain what you're doing
- Continue the conversation naturally after each function call
- Use function calls iteratively based on results from previous calls

**IMPORTANT PRINCIPLES:**
- DON'T be afraid of the context window - Gemini 2.5 Pro can handle very large contexts
- USE searchObjects extensively with different queries to explore the knowledge base thoroughly  
- ITERATE through multiple pages of results when relevant
- READ full documents with getObjectDetails when you need complete information (use UUID for objectId, or separate type/name fields)
- COMBINE information from multiple sources for comprehensive responses
- EXECUTE multiple function calls when requested by the user
- INTEGRATE function calling into your thinking process - call functions as you analyze and reason

**EXAMPLE WORKFLOW:**
Think about the question → Call a function to gather data → Analyze the results → Think more → Call another function if needed → Provide final answer

Use @mentions like @[person:習近平], @[document:項目計劃書], @[letter:感謝信], @[entity:公司名稱], @[issue:問題標題], @[log:日誌名稱], or @[meeting:會議名稱] when referring to specific entities.`;

    if (contextObjects.length > 0 || referencedObjects.length > 0) {
      systemInstruction += `\n\nContext Objects:`;
      const getIcon = (type: string) => {
        switch (type) {
          case 'person': return '👤';
          case 'document': return '📄';
          case 'entity': return '🏢';
          case 'issue': return '📋';
          case 'log': return '📝';
          case 'meeting': return '🤝';
          case 'letter': return '✉️';
          default: return '📄';
        }
      };
      
      // Add new objects with full content
      if (contextObjects.length > 0) {
        systemInstruction += `\n\n**New Objects (Full Content Available):**`;
        contextObjects.forEach((doc, index) => {
          systemInstruction += `\n${index + 1}. ${getIcon(doc.type)} **${doc.name}**`;
          if (doc.aliases.length > 0) {
            systemInstruction += ` (${doc.aliases.join(', ')})`;
          }
          systemInstruction += `\n   📝 ${doc.content.substring(0, 200)}${doc.content.length > 200 ? '...' : ''}`;
        });
      }
      
      // Add previously referenced objects (metadata only)
      if (referencedObjects.length > 0) {
        systemInstruction += `\n\n**Previously Referenced Objects (Content Available via getObjectDetails):**`;
        referencedObjects.forEach((obj, index) => {
          systemInstruction += `\n${index + 1}. ${getIcon(obj.type)} **${obj.name}**`;
          if (obj.aliases.length > 0) {
            systemInstruction += ` (${obj.aliases.join(', ')})`;
          }
          if (obj.date) {
            systemInstruction += ` - ${obj.date}`;
          }
          systemInstruction += `\n   ℹ️ This object was referenced earlier in this conversation. Use getObjectDetails to access its full content if needed.`;
        });
      }
    }

    // Convert messages to Gemini format
    const geminiMessages = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : msg.role,
      parts: [{ text: msg.content }]
    }));

    console.log('\n🤖 [GEMINI STREAMING] Starting streaming function calling request');
    console.log('📝 System Instruction:', systemInstruction);
    console.log('💬 Messages:', JSON.stringify(geminiMessages, null, 2));
    console.log('🔧 Available Functions:', Object.keys(functions));
    
    // Use streaming API
    const result = await ai.models.generateContentStream({
              model: "gemini-2.5-pro",
              config: { 
                systemInstruction,
        tools: [{
          functionDeclarations: Object.values(functions) as any[]
        }]
      },
      contents: geminiMessages
    });
    
    console.log('\n🌊 [STREAMING] Starting to process stream chunks...');

    // Track events and response content
    const events: AIEvent[] = [];
    let finalResponse = '';
    let accumulatedThinking = '';
    let responseTextBuffer = '';
    
    // Process stream chunks in real-time
    let finalResponseObj: any = null;
    for await (const chunk of result) {
      console.log('\n🌊 [CHUNK] Processing new chunk...');
      
      // Store the final response object for finishReason checking
      finalResponseObj = chunk;
      
      if (chunk.candidates?.[0]?.content?.parts) {
        const parts = chunk.candidates[0].content.parts;
        
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          console.log(`📄 Chunk Part ${i + 1}:`, {
            hasText: !!part.text,
            hasThought: !!part.thought,
            hasFunctionCall: !!part.functionCall,
            textLength: part.text?.length || 0
          });
          
          // Handle thinking content - save immediately
          if (part.text && part.thought) {
            console.log('💭 [THINKING CHUNK]:', part.text);
            accumulatedThinking += part.text;
            
            // Save thinking immediately when chunk arrives
            if (conversationId && conversationGroupId) {
              console.log('💾 [IMMEDIATE SAVE] Saving thinking chunk...');
              await storage.createMessage({
                conversationId,
                conversationGroupId,
                role: "assistant",
                type: "thinking",
                content: { text: part.text }
              });
              console.log('✅ [SAVED THINKING CHUNK] Immediately saved to database');
            }
            
            events.push({
              type: 'thinking',
              content: part.text,
              stage: 'initial'
            });
          }
          
          // Handle regular response text - save immediately
          else if (part.text && !part.thought) {
            console.log('💬 [RESPONSE CHUNK]:', part.text);
            responseTextBuffer += part.text;
            finalResponse += part.text;
            
            // Save response chunk immediately when it arrives
            if (conversationId && conversationGroupId && part.text.trim()) {
              console.log('💾 [IMMEDIATE SAVE] Saving response chunk...');
              await storage.createMessage({
                conversationId,
                conversationGroupId,
                role: "assistant",
                type: "response",
                content: { text: part.text }
              });
              console.log('✅ [SAVED RESPONSE CHUNK] Immediately saved to database');
            }
          }
          
          // Handle function calls - execute and save immediately
          else if (part.functionCall) {
            const { name: functionName, args } = part.functionCall;
            console.log(`🔧 [FUNCTION CALL CHUNK] Executing: ${functionName}`);
            
            try {
              const functionResult = await callFunction(functionName || "", args);
              console.log('✅ [FUNCTION RESULT] Function completed successfully');
              
              // Save function call immediately when it completes
              if (conversationId && conversationGroupId) {
                console.log('💾 [IMMEDIATE SAVE] Saving function call result...');
                await storage.createMessage({
                  conversationId,
                  conversationGroupId,
                  role: "assistant",
                  type: "function_call",
                  content: {
                    name: functionName || '',
                    arguments: args || {},
                    result: functionResult
                  }
                });
                console.log('✅ [SAVED FUNCTION_CALL] Immediately saved to database');
              }
              
              events.push({
                type: 'function_call',
                name: functionName || '',
                arguments: args || {},
                result: functionResult
              });
              
          } catch (error) {
              console.error(`❌ [FUNCTION ERROR] ${functionName}:`, error);
              const errorResult = `Error: ${error}`;
              
              // Save function call error immediately
              if (conversationId && conversationGroupId) {
                await storage.createMessage({
                  conversationId,
                  conversationGroupId,
                  role: "assistant",
                  type: "function_call",
                  content: {
                    name: functionName || '',
                    arguments: args || {},
                    result: errorResult
                  }
                });
              }
              
              events.push({
                type: 'function_call',
                name: functionName || '',
                arguments: args || {},
                result: errorResult
              });
            }
          }
        }
      }
    }
    
    // Check finishReason after stream processing
    const finishReason = finalResponseObj?.candidates?.[0]?.finishReason;
    console.log('🏁 [FINISH REASON]', finishReason);
    
    // Log finish reason details
    if (finishReason === 'STOP') {
      console.log('✅ [STREAMING] Response completed normally');
    } else if (finishReason === 'MAX_TOKENS') {
      console.warn('⚠️ [STREAMING] Response truncated due to max tokens limit');
    } else if (finishReason === 'SAFETY') {
      console.warn('⚠️ [STREAMING] Response blocked due to safety settings');
    } else if (finishReason === 'RECITATION') {
      console.warn('⚠️ [STREAMING] Response blocked due to recitation detection');
    } else if (finishReason === 'OTHER') {
      console.warn('⚠️ [STREAMING] Response ended for other reasons');
    } else {
      console.warn('⚠️ [STREAMING] Unknown finish reason:', finishReason);
    }
    
    console.log('\n🎯 [STREAMING COMPLETE] All chunks processed');
    console.log('💭 Events count:', events.length);
    console.log('💬 Final response length:', finalResponse.length);
    console.log('🔧 Function calls count:', events.filter(e => e.type === 'function_call').length);
    console.log('🧠 Thinking events count:', events.filter(e => e.type === 'thinking').length);

    // Merge consecutive response messages after completion
    console.log('🔍 [MERGE CHECK] conversationId:', conversationId);
    console.log('🔍 [MERGE CHECK] conversationGroupId:', conversationGroupId);
    if (conversationId && conversationGroupId) {
      console.log('🚀 [MERGE CHECK] Starting merge process...');
      await mergeConsecutiveResponseMessages(conversationId, conversationGroupId);
    } else {
      console.log('❌ [MERGE CHECK] Missing conversationId or conversationGroupId, skipping merge');
    }

    return {
      content: finalResponse,
      events
    };
  } catch (error) {
    console.error('Gemini streaming function calling error:', error);
    return {
      content: `Error: ${error}`,
      events: []
    };
  }
}
