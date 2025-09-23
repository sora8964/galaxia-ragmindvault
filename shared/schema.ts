import { sql } from "drizzle-orm";
import { pgTable, text, varchar, char, timestamp, json, boolean, integer, unique, index } from "drizzle-orm/pg-core";
import { vector } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Object types constants
export const OBJECT_TYPES = ["person", "document", "letter", "entity", "issue", "log", "meeting"] as const;

/**
 * Object type configuration - single source of truth
 * 
 * 這個配置是系統中所有 Object 類型信息的單一事實來源，包含：
 * - chineseName: 中文名稱（用於顯示）
 * - navigationName: 主導航名稱（用於導航選單）
 * - englishSingular: 英文單數形式
 * - englishPlural: 英文複數形式
 * - canUploadFile: 是否可以上傳檔案（預設 false）
 * - hasDateField: 是否有日期欄位（預設 false）
 * - icon: 圖標 emoji
 * - description: 類型描述
 * 
 * 使用範例：
 * ```typescript
 * import { getObjectTypeConfig, hasObjectTypeDateField, canObjectTypeUploadFile } from "./schema";
 * 
 * // 獲取特定類型的配置
 * const config = getObjectTypeConfig("meeting");
 * console.log(config.chineseName); // "會議記錄"
 * console.log(config.navigationName); // "會議"
 * 
 * // 檢查功能
 * if (hasObjectTypeDateField("meeting")) {
 *   // 顯示日期欄位
 * }
 * 
 * if (canObjectTypeUploadFile("document")) {
 *   // 顯示檔案上傳功能
 * }
 * ```
 */
export const OBJECT_TYPE_CONFIG = {
  person: {
    chineseName: "人員",
    navigationName: "人員",
    englishSingular: "person",
    englishPlural: "people",
    canUploadFile: false,
    hasDateField: false,
    icon: "👤",
    description: "個人或組織成員"
  },
  document: {
    chineseName: "文件",
    navigationName: "文件",
    englishSingular: "document",
    englishPlural: "documents",
    canUploadFile: true,
    hasDateField: true,
    icon: "📄",
    description: "各種類型的文件檔案"
  },
  letter: {
    chineseName: "信件",
    navigationName: "信件",
    englishSingular: "letter",
    englishPlural: "letters",
    canUploadFile: true,
    hasDateField: true,
    icon: "✉️",
    description: "書信往來記錄"
  },
  entity: {
    chineseName: "實體",
    navigationName: "實體",
    englishSingular: "entity",
    englishPlural: "entities",
    canUploadFile: false,
    hasDateField: false,
    icon: "🏢",
    description: "組織、公司、機構等實體"
  },
  issue: {
    chineseName: "議題",
    navigationName: "議題",
    englishSingular: "issue",
    englishPlural: "issues",
    canUploadFile: false,
    hasDateField: true,
    icon: "📋",
    description: "需要討論或解決的問題"
  },
  log: {
    chineseName: "日誌",
    navigationName: "日誌",
    englishSingular: "log",
    englishPlural: "logs",
    canUploadFile: false,
    hasDateField: true,
    icon: "📝",
    description: "活動記錄或日誌"
  },
  meeting: {
    chineseName: "會議記錄",
    navigationName: "會議",
    englishSingular: "meeting",
    englishPlural: "meetings",
    canUploadFile: true,
    hasDateField: true,
    icon: "🤝",
    description: "會議記錄和相關文件"
  }
} as const;

// Type definitions for object type configuration
export type ObjectTypeKey = keyof typeof OBJECT_TYPE_CONFIG;
export type ObjectTypeConfig = typeof OBJECT_TYPE_CONFIG[ObjectTypeKey];

/**
 * Helper functions for object type configuration
 * 這些函數提供了便捷的方式來訪問 Object 類型配置信息
 */

/**
 * 獲取指定 Object 類型的完整配置
 * @param type Object 類型鍵值
 * @returns 完整的類型配置對象
 */
export function getObjectTypeConfig(type: ObjectTypeKey): ObjectTypeConfig {
  return OBJECT_TYPE_CONFIG[type];
}

/**
 * 獲取指定 Object 類型的中文名稱
 * @param type Object 類型鍵值
 * @returns 中文名稱
 */
export function getObjectTypeChineseName(type: ObjectTypeKey): string {
  return OBJECT_TYPE_CONFIG[type].chineseName;
}

/**
 * 獲取指定 Object 類型的主導航名稱
 * @param type Object 類型鍵值
 * @returns 主導航名稱（用於導航選單顯示）
 */
export function getObjectTypeNavigationName(type: ObjectTypeKey): string {
  return OBJECT_TYPE_CONFIG[type].navigationName;
}

/**
 * 獲取指定 Object 類型的英文單數形式
 * @param type Object 類型鍵值
 * @returns 英文單數形式
 */
export function getObjectTypeEnglishSingular(type: ObjectTypeKey): string {
  return OBJECT_TYPE_CONFIG[type].englishSingular;
}

/**
 * 獲取指定 Object 類型的英文複數形式
 * @param type Object 類型鍵值
 * @returns 英文複數形式
 */
export function getObjectTypeEnglishPlural(type: ObjectTypeKey): string {
  return OBJECT_TYPE_CONFIG[type].englishPlural;
}

/**
 * 檢查指定 Object 類型是否可以上傳檔案
 * @param type Object 類型鍵值
 * @returns 是否可以上傳檔案
 */
export function canObjectTypeUploadFile(type: ObjectTypeKey): boolean {
  return OBJECT_TYPE_CONFIG[type].canUploadFile;
}

/**
 * 檢查指定 Object 類型是否有日期欄位
 * @param type Object 類型鍵值
 * @returns 是否有日期欄位
 */
export function hasObjectTypeDateField(type: ObjectTypeKey): boolean {
  return OBJECT_TYPE_CONFIG[type].hasDateField;
}

/**
 * 獲取指定 Object 類型的圖標
 * @param type Object 類型鍵值
 * @returns 圖標 emoji
 */
export function getObjectTypeIcon(type: ObjectTypeKey): string {
  return OBJECT_TYPE_CONFIG[type].icon;
}

/**
 * 獲取指定 Object 類型的描述
 * @param type Object 類型鍵值
 * @returns 類型描述
 */
export function getObjectTypeDescription(type: ObjectTypeKey): string {
  return OBJECT_TYPE_CONFIG[type].description;
}

/**
 * 獲取所有可以上傳檔案的 Object 類型
 * @returns 可以上傳檔案的類型鍵值數組
 * @example
 * const fileTypes = getObjectTypesWithFileUpload();
 * // 返回: ["document", "letter", "meeting"]
 */
export function getObjectTypesWithFileUpload(): ObjectTypeKey[] {
  return Object.keys(OBJECT_TYPE_CONFIG).filter(
    type => OBJECT_TYPE_CONFIG[type as ObjectTypeKey].canUploadFile
  ) as ObjectTypeKey[];
}

/**
 * 獲取所有有日期欄位的 Object 類型
 * @returns 有日期欄位的類型鍵值數組
 * @example
 * const dateTypes = getObjectTypesWithDateField();
 * // 返回: ["letter", "issue", "log", "meeting"]
 */
export function getObjectTypesWithDateField(): ObjectTypeKey[] {
  return Object.keys(OBJECT_TYPE_CONFIG).filter(
    type => OBJECT_TYPE_CONFIG[type as ObjectTypeKey].hasDateField
  ) as ObjectTypeKey[];
}

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const objects = pgTable("objects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type", { enum: OBJECT_TYPES }).notNull(),
  content: text("content").notNull().default(""),
  aliases: json("aliases").$type<string[]>().notNull().default([]),
  date: char("date", { length: 10 }), // YYYY-MM-DD format, nullable
  // File-related fields for GCP Storage
  originalFileName: text("original_file_name"), // Original filename for uploaded files
  filePath: text("file_path"), // GCP Storage path: {type}/{id}.extension
  fileSize: integer("file_size"), // File size in bytes
  mimeType: text("mime_type"), // MIME type of the uploaded file
  hasFile: boolean("has_file").notNull().default(false), // Whether this object has an associated file
  embedding: vector("embedding", { dimensions: 3072 }),
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
  contextObjects: json("context_objects").$type<string[]>().notNull().default([]),
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
    mentionedObjects?: Array<{ id: string; name: string; alias?: string }>;
    originalPrompt?: string;
    autoRetrieved?: {
      usedDocs: Array<{
        id: string;
        name: string;
        type: 'person' | 'document' | 'letter' | 'entity' | 'issue' | 'log' | 'meeting';
      }>;
      retrievalMetadata: {
        totalDocs: number;
        totalChunks: number;
        strategy: string;
        estimatedTokens: number;
        processingTimeMs?: number;
      };
      citations?: Array<{
        id: number;
        docId: string;
        docName: string;
        docType: string;
        relevanceScore: number;
      }>;
    };
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
  embedding: vector("embedding", { dimensions: 3072 }),
  hasEmbedding: boolean("has_embedding").notNull().default(false),
  embeddingStatus: text("embedding_status", { enum: ["pending", "completed", "failed"] }).notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const relationships = pgTable("relationships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceId: varchar("source_id").notNull(),
  targetId: varchar("target_id").notNull(),
  sourceType: text("source_type", { enum: OBJECT_TYPES }).notNull(),
  targetType: text("target_type", { enum: OBJECT_TYPES }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // Unique index to prevent duplicate relationships
  uniqueRelation: unique().on(table.sourceId, table.targetId),
  // Performance indexes
  sourceIdIdx: index().on(table.sourceId),
  targetIdIdx: index().on(table.targetId),
  typeRelationIdx: index().on(table.sourceType, table.targetType),
}));

export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: json("value").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Schema definitions

// Define ObjectType enum for type safety
export const ObjectType = z.enum(OBJECT_TYPES);
export type ObjectType = z.infer<typeof ObjectType>;

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
    // Only objects, letters and logs can have a date field
    if (data.date !== null && data.date !== undefined && data.type !== "document" && data.type !== "letter" && data.type !== "log") {
      return false;
    }
    return true;
  }, {
    message: "Only documents, letters and logs can have a date field",
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
    // Only objects, letters and logs can have a date field
    if (data.date !== null && data.date !== undefined && data.type !== undefined && data.type !== "document" && data.type !== "letter" && data.type !== "log") {
      return false;
    }
    return true;
  }, {
    message: "Only documents, letters and logs can have a date field",
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

// Simplified relationship schema
const baseInsertRelationshipSchema = createInsertSchema(relationships)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  });

export const insertRelationshipSchema = baseInsertRelationshipSchema;

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

// Settings schema
export const insertSettingSchema = createInsertSchema(settings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateSettingSchema = insertSettingSchema.partial();

export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type UpdateSetting = z.infer<typeof updateSettingSchema>;
export type Setting = typeof settings.$inferSelect;

// API Response types
export interface SearchResult {
  objects: AppObject[];
  total: number;
}

export interface MentionItem {
  id: string;
  name: string;
  type: ObjectType;
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
  type: ObjectType;
  name: string;
  alias?: string;
  objectId?: string;
}

export interface ParseMentionsRequest {
  text: string;
}

export interface ParseMentionsResponse {
  mentions: ParsedMention[];
  resolvedObjectIds: string[];
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
  systemInstructions: z.string().default("You are a helpful AI assistant for object and context management. Objects refer to all types of data entries including but not limited to persons, entities, issues, logs, meetings, letters, and documents."),
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
  outputDimensionality: z.number().int().min(1).max(3072).default(2000),
  autoEmbedding: z.boolean().default(true),
  autoTruncate: z.boolean().default(true),
  batchSize: z.number().int().min(1).max(100).default(10),
});

export const retrievalConfigSchema = z.object({
  autoRag: z.boolean().default(true),
  docTopK: z.number().default(30), // Updated default from 6 to 30 for better context
  chunkTopK: z.number().default(90), // Updated default from 24 to 90
  perDocChunkCap: z.number().default(6),
  contextWindow: z.number().default(1),
  minDocSim: z.number().default(0.15), // Lowered from 0.25 to 0.15 for more inclusive results
  minChunkSim: z.number().default(0.30),
  budgetTokens: z.number().default(12000), // Updated default from 6000 to 12000
  strategy: z.enum(['balanced', 'aggressive', 'conservative']).default('balanced'),
  addCitations: z.boolean().default(true),
  semanticSearchLimit: z.number().int().min(100).max(5000).default(1000), // Maximum results for semantic search
  contentTruncateLength: z.number().int().min(100).max(10000).default(1000) // Maximum content length for display
});

export const functionCallingConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxPageSize: z.number().int().min(1).max(50).default(50),
  defaultPageSize: z.number().int().min(1).max(50).default(20), // Increased from 10 to 20 for better results
  maxIterations: z.number().int().min(1).max(10).default(5),
  enablePagination: z.boolean().default(true)
});

export const chunkingConfigSchema = z.object({
  chunkSize: z.number().int().min(256).max(8000).default(2000), // Characters per chunk
  overlap: z.number().int().min(0).max(2000).default(200), // Overlap characters between chunks
  enabled: z.boolean().default(true) // Whether chunking is enabled
});

export const appConfigSchema = z.object({
  geminiApi: geminiApiConfigSchema.default({}),
  textEmbedding: textEmbeddingConfigSchema.default({}),
  retrieval: retrievalConfigSchema.default({}),
  functionCalling: functionCallingConfigSchema.default({}),
  chunking: chunkingConfigSchema.default({}),
  updatedAt: z.date().default(() => new Date())
});

// Types
export type GeminiApiConfig = z.infer<typeof geminiApiConfigSchema>;
export type TextEmbeddingConfig = z.infer<typeof textEmbeddingConfigSchema>;
export type RetrievalConfig = z.infer<typeof retrievalConfigSchema>;
export type FunctionCallingConfig = z.infer<typeof functionCallingConfigSchema>;
export type ChunkingConfig = z.infer<typeof chunkingConfigSchema>;
export type AppConfig = z.infer<typeof appConfigSchema>;

export const insertAppConfigSchema = appConfigSchema.omit({ updatedAt: true });
export const updateAppConfigSchema = insertAppConfigSchema.partial();

export type InsertAppConfig = z.infer<typeof insertAppConfigSchema>;
export type UpdateAppConfig = z.infer<typeof updateAppConfigSchema>;

// Temporary aliases for migration compatibility
export type Object = AppObject;
