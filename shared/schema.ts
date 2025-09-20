import { sql } from "drizzle-orm";
import { pgTable, text, varchar, char, timestamp, json, boolean, integer, unique, index } from "drizzle-orm/pg-core";
import { vector } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const objects = pgTable("objects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type", { enum: ["person", "document", "organization", "issue", "log", "meeting"] }).notNull(),
  content: text("content").notNull().default(""),
  aliases: json("aliases").$type<string[]>().notNull().default([]),
  date: char("date", { length: 10 }), // YYYY-MM-DD format, nullable
  embedding: vector("embedding", { dimensions: 2000 }),
  hasEmbedding: boolean("has_embedding").notNull().default(false),
  embeddingStatus: text("embedding_status", { enum: ["pending", "completed", "failed"] }).notNull().default("pending"),
  needsEmbedding: boolean("needs_embedding").notNull().default(true),
  isFromOCR: boolean("is_from_ocr").notNull().default(false),
  hasBeenEdited: boolean("has_been_edited").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
  content: text("content").notNull(),
  contextDocuments: json("context_documents").$type<string[]>().notNull().default([]),
  // AI response metadata
  thinking: text("thinking"),
  functionCalls: json("function_calls").$type<Array<{
    name: string;
    arguments: any;
    result?: any;
  }>>(),
  // Message status for streaming
  status: text("status", { enum: ["pending", "streaming", "completed", "error"] }).notNull().default("completed"),
  // Additional context information
  contextMetadata: json("context_metadata").$type<{
    mentionedPersons?: Array<{ id: string; name: string; alias?: string }>;
    mentionedDocuments?: Array<{ id: string; name: string; alias?: string }>;
    originalPrompt?: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const chunks = pgTable("chunks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  objectId: varchar("object_id").notNull().references(() => objects.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  chunkIndex: integer("chunk_index").notNull(), // 0, 1, 2... for ordering
  startPosition: integer("start_position").notNull(), // Start character position in original content
  endPosition: integer("end_position").notNull(), // End character position in original content
  embedding: vector("embedding", { dimensions: 2000 }),
  hasEmbedding: boolean("has_embedding").notNull().default(false),
  embeddingStatus: text("embedding_status", { enum: ["pending", "completed", "failed"] }).notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const relationships = pgTable("relationships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceId: varchar("source_id").notNull(),
  targetId: varchar("target_id").notNull(),
  sourceType: text("source_type", { enum: ["person", "document", "organization", "issue", "log", "meeting"] }).notNull(),
  targetType: text("target_type", { enum: ["person", "document", "organization", "issue", "log", "meeting"] }).notNull(),
  relationKind: text("relation_kind").notNull().default("related"),
  relationshipType: text("relationship_type"), // Made nullable for new schema compatibility
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // Unique index to prevent duplicate relationships
  uniqueRelation: unique().on(table.sourceId, table.targetId, table.relationKind),
  // Performance indexes
  sourceIdIdx: index().on(table.sourceId),
  targetIdIdx: index().on(table.targetId),
  typeRelationIdx: index().on(table.sourceType, table.targetType, table.relationKind),
}));

// Schema definitions

// Define DocumentType enum for type safety
export const DocumentType = z.enum(["person", "document", "organization", "issue", "log", "meeting"]);
export type DocumentType = z.infer<typeof DocumentType>;

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

// Date validation function
const dateValidation = z
  .string()
  .nullable()
  .refine((val) => {
    if (val === null || val === undefined) return true;
    if (val === "") return false; // Empty strings are not allowed
    
    // Check YYYY-MM-DD format using regex
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(val)) return false;
    
    // Check if it's a valid date
    const parts = val.split('-');
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const day = parseInt(parts[2]);
    
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    
    // Basic month/day validation
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && 
           date.getMonth() === month - 1 && 
           date.getDate() === day;
  }, "Date must be in YYYY-MM-DD format")
  .transform((val) => val === "" ? null : val); // Normalize empty strings to null

export const insertObjectSchema = createInsertSchema(objects)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    date: dateValidation.optional()
  })
  .refine((data) => {
    // Only documents and logs can have a date field
    if (data.date !== null && data.date !== undefined && data.type !== "document" && data.type !== "log") {
      return false;
    }
    return true;
  }, {
    message: "Only documents and logs can have a date field",
    path: ["date"]
  });

export const updateObjectSchema = createInsertSchema(objects)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    date: dateValidation.optional()
  })
  .partial()
  .refine((data) => {
    // Only documents and logs can have a date field
    if (data.date !== null && data.date !== undefined && data.type !== undefined && data.type !== "document" && data.type !== "log") {
      return false;
    }
    return true;
  }, {
    message: "Only documents and logs can have a date field",
    path: ["date"]
  });

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateMessageSchema = insertMessageSchema.partial();

export const insertChunkSchema = createInsertSchema(chunks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateChunkSchema = insertChunkSchema.partial();

// Create base schema without refinement for backward compatibility
const baseInsertRelationshipSchema = createInsertSchema(relationships)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    // Make new fields optional with defaults for backward compatibility
    sourceType: DocumentType.optional(),
    targetType: DocumentType.optional(), 
    relationKind: z.string().optional().default("related"),
    // Make relationshipType optional for new schema
    relationshipType: z.string().optional(),
  });

export const insertRelationshipSchema = baseInsertRelationshipSchema
  .refine((data) => {
    // Either provide the new format (sourceType + targetType) or legacy format (relationshipType)
    const hasNewFormat = data.sourceType && data.targetType;
    const hasLegacyFormat = !!data.relationshipType;
    
    return hasNewFormat || hasLegacyFormat;
  }, {
    message: "Either sourceType+targetType or relationshipType must be provided",
  });

export const updateRelationshipSchema = baseInsertRelationshipSchema.partial();

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertObject = z.infer<typeof insertObjectSchema>;
export type UpdateObject = z.infer<typeof updateObjectSchema>;
export type AppObject = typeof objects.$inferSelect;

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type UpdateMessage = z.infer<typeof updateMessageSchema>;
export type Message = typeof messages.$inferSelect;

export type InsertChunk = z.infer<typeof insertChunkSchema>;
export type UpdateChunk = z.infer<typeof updateChunkSchema>;
export type Chunk = typeof chunks.$inferSelect;

export type InsertRelationship = z.infer<typeof insertRelationshipSchema>;
export type UpdateRelationship = z.infer<typeof updateRelationshipSchema>;
export type Relationship = typeof relationships.$inferSelect;

// API Response types
export interface SearchResult {
  objects: AppObject[];
  total: number;
}

export interface MentionItem {
  id: string;
  name: string;
  type: "person" | "document" | "organization" | "issue" | "log";
  aliases: string[];
}

export interface ContextSuggestion {
  object: AppObject;
  relevance: number;
  reason: string;
}

export interface ParsedMention {
  start: number;
  end: number;
  raw: string;
  type: "person" | "document" | "organization" | "issue" | "log";
  name: string;
  alias?: string;
  documentId?: string;
}

export interface ParseMentionsRequest {
  text: string;
}

export interface ParseMentionsResponse {
  mentions: ParsedMention[];
  resolvedDocumentIds: string[];
}

export const parseMentionsSchema = z.object({
  text: z.string()
});

// Settings Configuration Schema
export const geminiApiConfigSchema = z.object({
  model: z.enum([
    "gemini-2.5-flash", 
    "gemini-2.5-pro"
  ]).default("gemini-2.5-flash"),
  temperature: z.number().min(0).max(2).default(0.7),
  topP: z.number().min(0).max(1).default(0.94),
  topK: z.number().int().min(1).max(40).default(32),
  maxOutputTokens: z.number().int().min(1).max(8192).default(1000),
  systemInstructions: z.string().default("You are a helpful AI assistant for document and context management."),
  safetySettings: z.object({
    harassment: z.enum(["BLOCK_NONE", "BLOCK_LOW_AND_ABOVE", "BLOCK_MEDIUM_AND_ABOVE", "BLOCK_HIGH_AND_ABOVE"]).default("BLOCK_MEDIUM_AND_ABOVE"),
    hateSpeech: z.enum(["BLOCK_NONE", "BLOCK_LOW_AND_ABOVE", "BLOCK_MEDIUM_AND_ABOVE", "BLOCK_HIGH_AND_ABOVE"]).default("BLOCK_MEDIUM_AND_ABOVE"),
    sexuallyExplicit: z.enum(["BLOCK_NONE", "BLOCK_LOW_AND_ABOVE", "BLOCK_MEDIUM_AND_ABOVE", "BLOCK_HIGH_AND_ABOVE"]).default("BLOCK_MEDIUM_AND_ABOVE"),
    dangerousContent: z.enum(["BLOCK_NONE", "BLOCK_LOW_AND_ABOVE", "BLOCK_MEDIUM_AND_ABOVE", "BLOCK_HIGH_AND_ABOVE"]).default("BLOCK_MEDIUM_AND_ABOVE"),
    civicIntegrity: z.enum(["BLOCK_NONE", "BLOCK_LOW_AND_ABOVE", "BLOCK_MEDIUM_AND_ABOVE", "BLOCK_HIGH_AND_ABOVE"]).default("BLOCK_MEDIUM_AND_ABOVE")
  }).default({}),
});

export const textEmbeddingConfigSchema = z.object({
  model: z.enum(["gemini-embedding-001"]).default("gemini-embedding-001"),
  taskType: z.enum([
    "TASK_TYPE_UNSPECIFIED",
    "RETRIEVAL_QUERY",
    "RETRIEVAL_DOCUMENT", 
    "SEMANTIC_SIMILARITY",
    "CLASSIFICATION",
    "CLUSTERING",
    "QUESTION_ANSWERING",
    "FACT_VERIFICATION",
    "CODE_RETRIEVAL_QUERY"
  ]).default("RETRIEVAL_DOCUMENT"),
  outputDimensionality: z.number().int().min(1).max(3072).default(3072),
  autoEmbedding: z.boolean().default(true),
  autoTruncate: z.boolean().default(true),
  batchSize: z.number().int().min(1).max(100).default(10),
});

export const retrievalConfigSchema = z.object({
  autoRag: z.boolean().default(true),
  docTopK: z.number().default(6),
  chunkTopK: z.number().default(24), 
  perDocChunkCap: z.number().default(6),
  contextWindow: z.number().default(1),
  minDocSim: z.number().default(0.25),
  minChunkSim: z.number().default(0.30),
  budgetTokens: z.number().default(6000),
  strategy: z.enum(['balanced', 'aggressive', 'conservative']).default('balanced'),
  addCitations: z.boolean().default(true)
});

export const appConfigSchema = z.object({
  geminiApi: geminiApiConfigSchema.default({}),
  textEmbedding: textEmbeddingConfigSchema.default({}),
  retrieval: retrievalConfigSchema.default({}),
  updatedAt: z.date().default(() => new Date())
});

// Types
export type GeminiApiConfig = z.infer<typeof geminiApiConfigSchema>;
export type TextEmbeddingConfig = z.infer<typeof textEmbeddingConfigSchema>;
export type RetrievalConfig = z.infer<typeof retrievalConfigSchema>;
export type AppConfig = z.infer<typeof appConfigSchema>;

export const insertAppConfigSchema = appConfigSchema.omit({ updatedAt: true });
export const updateAppConfigSchema = insertAppConfigSchema.partial();

export type InsertAppConfig = z.infer<typeof insertAppConfigSchema>;
export type UpdateAppConfig = z.infer<typeof updateAppConfigSchema>;

// Temporary aliases for migration compatibility
export type Document = AppObject;
export type DocumentType = ObjectType;
