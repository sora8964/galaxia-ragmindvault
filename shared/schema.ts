import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, json, boolean } from "drizzle-orm/pg-core";
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
  type: text("type", { enum: ["person", "document"] }).notNull(),
  content: text("content").notNull().default(""),
  aliases: json("aliases").$type<string[]>().notNull().default([]),
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
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  contextDocuments: json("context_documents").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
});

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

// API Response types
export interface SearchResult {
  documents: Document[];
  total: number;
}

export interface MentionItem {
  id: string;
  name: string;
  type: "person" | "document";
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
