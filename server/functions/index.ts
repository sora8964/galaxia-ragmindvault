// Function definitions and dispatcher
import { searchObjects } from "./search-objects";
import { getObjectDetails } from "./get-object-details";
import { createObject } from "./create-object";
import { updateObject } from "./update-object";
import { findSimilarObjects } from "./find-similar-objects";
import { parseMentions } from "./parse-mentions";
import { findRelevantExcerpts } from "./find-relevant-excerpts";
import { getObjectTypes } from "./get-object-types";

// Function definitions for Gemini
export const functions = {
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
        },
        date: {
          type: "string",
          description: "Date associated with the entry (optional, format: YYYY-MM-DD)"
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags for categorization (optional)"
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
        objectId: {
          type: "string",
          description: "The UUID of the object to update"
        },
        name: {
          type: "string",
          description: "Updated name/title (optional)"
        },
        content: {
          type: "string",
          description: "Updated content/description (optional)"
        },
        aliases: {
          type: "array",
          items: { type: "string" },
          description: "Updated aliases (optional)"
        },
        date: {
          type: "string",
          description: "Updated date (optional, format: YYYY-MM-DD)"
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Updated tags (optional)"
        }
      },
      required: ["objectId"]
    }
  },

  findSimilarObjects: {
    name: "findSimilarObjects",
    description: "Find objects similar to a given object based on semantic similarity",
    parameters: {
      type: "object",
      properties: {
        objectId: {
          type: "string",
          description: "The UUID of the object to find similar objects for"
        },
        limit: {
          type: "number",
          description: "Maximum number of similar objects to return (default: 5)"
        }
      },
      required: ["objectId"]
    }
  },

  parseMentions: {
    name: "parseMentions",
    description: "Parse @mentions in text and resolve them to actual objects in the knowledge base",
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
    description: "Find specific excerpts from objects that are relevant to a query",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Query to find relevant excerpts for"
        },
        objectId: {
          type: "string",
          description: "Optional object ID to limit search to specific object"
        },
        limit: {
          type: "number",
          description: "Maximum number of excerpts to return (default: 3)"
        }
      },
      required: ["query"]
    }
  }
};

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
      case "findSimilarObjects":
        result = await findSimilarObjects(args);
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
    console.log('📄 Result:', result);
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [FUNCTION ERROR] ${functionName} failed after ${duration}ms:`, error);
    throw error;
  }
}
