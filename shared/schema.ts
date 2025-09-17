import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, json, boolean, integer } from "drizzle-orm/pg-core";
import { vector } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type", { enum: ["person", "document", "organization"] }).notNull(),
  content: text("content").notNull().default(""),
  aliases: json("aliases").$type<string[]>().notNull().default([]),
  date: varchar("date", { length: 10 }), // YYYY-MM-DD format, nullable
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
  documentId: varchar("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
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

// Schema definitions
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateDocumentSchema = insertDocumentSchema.partial();

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

export const insertChunkSchema = createInsertSchema(chunks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateChunkSchema = insertChunkSchema.partial();

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type UpdateDocument = z.infer<typeof updateDocumentSchema>;
export type Document = typeof documents.$inferSelect;

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export type InsertChunk = z.infer<typeof insertChunkSchema>;
export type UpdateChunk = z.infer<typeof updateChunkSchema>;
export type Chunk = typeof chunks.$inferSelect;

// API Response types
export interface SearchResult {
  documents: Document[];
  total: number;
}

export interface MentionItem {
  id: string;
  name: string;
  type: "person" | "document" | "organization";
  aliases: string[];
}

export interface ContextSuggestion {
  document: Document;
  relevance: number;
  reason: string;
}

export interface ParsedMention {
  start: number;
  end: number;
  raw: string;
  type: "person" | "document";
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

export const appConfigSchema = z.object({
  geminiApi: geminiApiConfigSchema.default({}),
  textEmbedding: textEmbeddingConfigSchema.default({}),
  updatedAt: z.date().default(() => new Date())
});

// Types
export type GeminiApiConfig = z.infer<typeof geminiApiConfigSchema>;
export type TextEmbeddingConfig = z.infer<typeof textEmbeddingConfigSchema>;
export type AppConfig = z.infer<typeof appConfigSchema>;

export const insertAppConfigSchema = appConfigSchema.omit({ updatedAt: true });
export const updateAppConfigSchema = insertAppConfigSchema.partial();

export type InsertAppConfig = z.infer<typeof insertAppConfigSchema>;
export type UpdateAppConfig = z.infer<typeof updateAppConfigSchema>;
