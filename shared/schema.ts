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
    englishPlural: "persons",
    canUploadFile: false,
    hasDateField: false,
    icon: "👤",
    description: "個人或組織成員",
    route: "/people"
  },
  document: {
    chineseName: "文件",
    navigationName: "文件",
    englishSingular: "document",
    englishPlural: "documents",
    canUploadFile: true,
    hasDateField: true,
    icon: "📄",
    description: "各種類型的文件檔案",
    route: "/documents"
  },
  letter: {
    chineseName: "信件",
    navigationName: "信件",
    englishSingular: "letter",
    englishPlural: "letters",
    canUploadFile: true,
    hasDateField: true,
    icon: "✉️",
    description: "書信往來記錄",
    route: "/letters"
  },
  entity: {
    chineseName: "實體",
    navigationName: "實體",
    englishSingular: "entity",
    englishPlural: "entities",
    canUploadFile: false,
    hasDateField: false,
    icon: "🏢",
    description: "組織、公司、機構等實體",
    route: "/entities"
  },
  issue: {
    chineseName: "議題",
    navigationName: "議題",
    englishSingular: "issue",
    englishPlural: "issues",
    canUploadFile: false,
    hasDateField: true,
    icon: "📋",
    description: "需要討論或解決的問題",
    route: "/issues"
  },
  log: {
    chineseName: "日誌",
    navigationName: "日誌",
    englishSingular: "log",
    englishPlural: "logs",
    canUploadFile: false,
    hasDateField: true,
    icon: "📝",
    description: "活動記錄或日誌",
    route: "/logs"
  },
  meeting: {
    chineseName: "會議記錄",
    navigationName: "會議",
    englishSingular: "meeting",
    englishPlural: "meetings",
    canUploadFile: true,
    hasDateField: true,
    icon: "🤝",
    description: "會議記錄和相關文件",
    route: "/meetings"
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
  conversationGroupId: varchar("conversation_group_id"),
  role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
  content: json("content").notNull().default({}),
  type: text("type").notNull(),
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
    // Only object types with date fields can have a date value
    if (data.date !== null && data.date !== undefined) {
      const typesWithDateField = getObjectTypesWithDateField();
      return typesWithDateField.includes(data.type);
    }
    return true;
  }, {
    message: "Only object types with date fields can have a date value",
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
    // Only object types with date fields can have a date value
    if (data.date !== null && data.date !== undefined && data.type !== undefined) {
      const typesWithDateField = getObjectTypesWithDateField();
      return typesWithDateField.includes(data.type);
    }
    return true;
  }, {
    message: "Only object types with date fields can have a date value",
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

// ============================================================================
// 設定配置常數 - 單一事實來源
// ============================================================================

/**
 * 安全設定選項 - 單一事實來源
 */
export const SAFETY_SETTING_LEVELS = [
  "BLOCK_NONE",
  "BLOCK_LOW_AND_ABOVE", 
  "BLOCK_MEDIUM_AND_ABOVE",
  "BLOCK_HIGH_AND_ABOVE"
] as const;

export type SafetySettingLevel = typeof SAFETY_SETTING_LEVELS[number];

/**
 * 安全設定類型 - 單一事實來源
 */
export const SAFETY_SETTING_TYPES = [
  "harassment",
  "hateSpeech", 
  "sexuallyExplicit",
  "dangerousContent",
  "civicIntegrity"
] as const;

export type SafetySettingType = typeof SAFETY_SETTING_TYPES[number];

/**
 * Gemini 模型選項 - 單一事實來源
 */
export const GEMINI_MODELS = [
  "gemini-2.5-flash", 
  "gemini-2.5-pro"
] as const;

export type GeminiModel = typeof GEMINI_MODELS[number];

/**
 * 嵌入任務類型選項 - 單一事實來源
 */
export const EMBEDDING_TASK_TYPES = [
  "TASK_TYPE_UNSPECIFIED",
  "RETRIEVAL_QUERY",
  "RETRIEVAL_DOCUMENT", 
  "SEMANTIC_SIMILARITY",
  "CLASSIFICATION",
  "CLUSTERING",
  "QUESTION_ANSWERING",
  "FACT_VERIFICATION",
  "CODE_RETRIEVAL_QUERY"
] as const;

export type EmbeddingTaskType = typeof EMBEDDING_TASK_TYPES[number];

/**
 * 檢索策略選項 - 單一事實來源
 */
export const RETRIEVAL_STRATEGIES = [
  'balanced', 
  'aggressive', 
  'conservative'
] as const;

export type RetrievalStrategy = typeof RETRIEVAL_STRATEGIES[number];

/**
 * 數值範圍常數 - 單一事實來源
 */
export const NUMERIC_RANGES = {
  // Gemini API 範圍
  temperature: { min: 0, max: 2, default: 0.7 },
  topP: { min: 0, max: 1, default: 0.94 },
  topK: { min: 1, max: 40, default: 32 },
  maxOutputTokens: { min: 1, max: 8192, default: 1000 },
  
  // 嵌入配置範圍
  outputDimensionality: { min: 1, max: 3072, default: 2000 },
  batchSize: { min: 1, max: 100, default: 10 },
  
  // 檢索配置範圍
  docTopK: { min: 1, max: 100, default: 30 },
  chunkTopK: { min: 1, max: 200, default: 90 },
  perDocChunkCap: { min: 1, max: 20, default: 6 },
  contextWindow: { min: 0, max: 2, default: 1 },
  minDocSim: { min: 0, max: 1, default: 0.15 },
  minChunkSim: { min: 0, max: 1, default: 0.30 },
  budgetTokens: { min: 1000, max: 50000, default: 12000 },
  semanticSearchLimit: { min: 100, max: 5000, default: 1000 },
  contentTruncateLength: { min: 100, max: 10000, default: 1000 },
  
  // 函數調用配置範圍
  maxPageSize: { min: 1, max: 50, default: 50 },
  defaultPageSize: { min: 1, max: 50, default: 20 },
  maxIterations: { min: 1, max: 10, default: 5 },
  
  // 分塊配置範圍
  chunkSize: { min: 256, max: 8000, default: 2000 },
  overlap: { min: 0, max: 2000, default: 200 }
} as const;

/**
 * 預設值常數 - 單一事實來源
 */
export const DEFAULT_VALUES = {
  systemInstructions: "You are a helpful AI assistant for object and context management. Objects refer to all types of data entries including but not limited to persons, entities, issues, logs, meetings, letters, and documents.",
  autoEmbedding: true,
  autoTruncate: true,
  autoRag: true,
  addCitations: true,
  enabled: true,
  enablePagination: true
} as const;

// ============================================================================
// Zod Schema 定義 - 使用上述常數
// ============================================================================

export const geminiApiConfigSchema = z.object({
  model: z.enum(GEMINI_MODELS).default(GEMINI_MODELS[0]),
  temperature: z.number()
    .min(NUMERIC_RANGES.temperature.min)
    .max(NUMERIC_RANGES.temperature.max)
    .default(NUMERIC_RANGES.temperature.default),
  topP: z.number()
    .min(NUMERIC_RANGES.topP.min)
    .max(NUMERIC_RANGES.topP.max)
    .default(NUMERIC_RANGES.topP.default),
  topK: z.number().int()
    .min(NUMERIC_RANGES.topK.min)
    .max(NUMERIC_RANGES.topK.max)
    .default(NUMERIC_RANGES.topK.default),
  maxOutputTokens: z.number().int()
    .min(NUMERIC_RANGES.maxOutputTokens.min)
    .max(NUMERIC_RANGES.maxOutputTokens.max)
    .default(NUMERIC_RANGES.maxOutputTokens.default),
  systemInstructions: z.string().default(DEFAULT_VALUES.systemInstructions),
  safetySettings: z.object({
    harassment: z.enum(SAFETY_SETTING_LEVELS).default(SAFETY_SETTING_LEVELS[0]),
    hateSpeech: z.enum(SAFETY_SETTING_LEVELS).default(SAFETY_SETTING_LEVELS[0]),
    sexuallyExplicit: z.enum(SAFETY_SETTING_LEVELS).default(SAFETY_SETTING_LEVELS[0]),
    dangerousContent: z.enum(SAFETY_SETTING_LEVELS).default(SAFETY_SETTING_LEVELS[0]),
    civicIntegrity: z.enum(SAFETY_SETTING_LEVELS).default(SAFETY_SETTING_LEVELS[0])
  }).default({}),
});

export const textEmbeddingConfigSchema = z.object({
  model: z.enum(["gemini-embedding-001"]).default("gemini-embedding-001"),
  taskType: z.enum(EMBEDDING_TASK_TYPES).default(EMBEDDING_TASK_TYPES[2]), // RETRIEVAL_DOCUMENT
  outputDimensionality: z.number().int()
    .min(NUMERIC_RANGES.outputDimensionality.min)
    .max(NUMERIC_RANGES.outputDimensionality.max)
    .default(NUMERIC_RANGES.outputDimensionality.default),
  autoEmbedding: z.boolean().default(DEFAULT_VALUES.autoEmbedding),
  autoTruncate: z.boolean().default(DEFAULT_VALUES.autoTruncate),
  batchSize: z.number().int()
    .min(NUMERIC_RANGES.batchSize.min)
    .max(NUMERIC_RANGES.batchSize.max)
    .default(NUMERIC_RANGES.batchSize.default),
});

export const retrievalConfigSchema = z.object({
  autoRag: z.boolean().default(DEFAULT_VALUES.autoRag),
  docTopK: z.number()
    .min(NUMERIC_RANGES.docTopK.min)
    .max(NUMERIC_RANGES.docTopK.max)
    .default(NUMERIC_RANGES.docTopK.default),
  chunkTopK: z.number()
    .min(NUMERIC_RANGES.chunkTopK.min)
    .max(NUMERIC_RANGES.chunkTopK.max)
    .default(NUMERIC_RANGES.chunkTopK.default),
  perDocChunkCap: z.number()
    .min(NUMERIC_RANGES.perDocChunkCap.min)
    .max(NUMERIC_RANGES.perDocChunkCap.max)
    .default(NUMERIC_RANGES.perDocChunkCap.default),
  contextWindow: z.number()
    .min(NUMERIC_RANGES.contextWindow.min)
    .max(NUMERIC_RANGES.contextWindow.max)
    .default(NUMERIC_RANGES.contextWindow.default),
  minDocSim: z.number()
    .min(NUMERIC_RANGES.minDocSim.min)
    .max(NUMERIC_RANGES.minDocSim.max)
    .default(NUMERIC_RANGES.minDocSim.default),
  minChunkSim: z.number()
    .min(NUMERIC_RANGES.minChunkSim.min)
    .max(NUMERIC_RANGES.minChunkSim.max)
    .default(NUMERIC_RANGES.minChunkSim.default),
  budgetTokens: z.number()
    .min(NUMERIC_RANGES.budgetTokens.min)
    .max(NUMERIC_RANGES.budgetTokens.max)
    .default(NUMERIC_RANGES.budgetTokens.default),
  strategy: z.enum(RETRIEVAL_STRATEGIES).default(RETRIEVAL_STRATEGIES[0]), // balanced
  addCitations: z.boolean().default(DEFAULT_VALUES.addCitations),
  semanticSearchLimit: z.number().int()
    .min(NUMERIC_RANGES.semanticSearchLimit.min)
    .max(NUMERIC_RANGES.semanticSearchLimit.max)
    .default(NUMERIC_RANGES.semanticSearchLimit.default),
  contentTruncateLength: z.number().int()
    .min(NUMERIC_RANGES.contentTruncateLength.min)
    .max(NUMERIC_RANGES.contentTruncateLength.max)
    .default(NUMERIC_RANGES.contentTruncateLength.default)
});

export const functionCallingConfigSchema = z.object({
  enabled: z.boolean().default(DEFAULT_VALUES.enabled),
  maxPageSize: z.number().int()
    .min(NUMERIC_RANGES.maxPageSize.min)
    .max(NUMERIC_RANGES.maxPageSize.max)
    .default(NUMERIC_RANGES.maxPageSize.default),
  defaultPageSize: z.number().int()
    .min(NUMERIC_RANGES.defaultPageSize.min)
    .max(NUMERIC_RANGES.defaultPageSize.max)
    .default(NUMERIC_RANGES.defaultPageSize.default),
  maxIterations: z.number().int()
    .min(NUMERIC_RANGES.maxIterations.min)
    .max(NUMERIC_RANGES.maxIterations.max)
    .default(NUMERIC_RANGES.maxIterations.default),
  enablePagination: z.boolean().default(DEFAULT_VALUES.enablePagination)
});

export const chunkingConfigSchema = z.object({
  chunkSize: z.number().int()
    .min(NUMERIC_RANGES.chunkSize.min)
    .max(NUMERIC_RANGES.chunkSize.max)
    .default(NUMERIC_RANGES.chunkSize.default),
  overlap: z.number().int()
    .min(NUMERIC_RANGES.overlap.min)
    .max(NUMERIC_RANGES.overlap.max)
    .default(NUMERIC_RANGES.overlap.default),
  enabled: z.boolean().default(DEFAULT_VALUES.enabled)
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

// ============================================================================
// 輔助函數 - 讓前端更容易使用配置常數
// ============================================================================

/**
 * 獲取指定欄位的數值範圍
 * @param field 欄位名稱
 * @returns 數值範圍配置
 */
export function getNumericRange(field: keyof typeof NUMERIC_RANGES) {
  return NUMERIC_RANGES[field];
}

/**
 * 獲取所有安全設定級別
 * @returns 安全設定級別陣列
 */
export function getSafetySettingLevels() {
  return SAFETY_SETTING_LEVELS;
}

/**
 * 獲取所有安全設定類型
 * @returns 安全設定類型陣列
 */
export function getSafetySettingTypes() {
  return SAFETY_SETTING_TYPES;
}

/**
 * 獲取所有 Gemini 模型選項
 * @returns Gemini 模型陣列
 */
export function getGeminiModels() {
  return GEMINI_MODELS;
}

/**
 * 獲取所有嵌入任務類型
 * @returns 嵌入任務類型陣列
 */
export function getEmbeddingTaskTypes() {
  return EMBEDDING_TASK_TYPES;
}

/**
 * 獲取所有檢索策略選項
 * @returns 檢索策略陣列
 */
export function getRetrievalStrategies() {
  return RETRIEVAL_STRATEGIES;
}

/**
 * 獲取預設值
 * @param key 預設值鍵值
 * @returns 預設值
 */
export function getDefaultValue(key: keyof typeof DEFAULT_VALUES) {
  return DEFAULT_VALUES[key];
}

export type InsertAppConfig = z.infer<typeof insertAppConfigSchema>;
export type UpdateAppConfig = z.infer<typeof updateAppConfigSchema>;

// Temporary aliases for migration compatibility
export type Object = AppObject;

/**
 * 圖標映射配置 - 將 emoji 圖標映射到對應的 Lucide React 圖標組件名稱
 * 這個映射確保前端組件能正確顯示對應的圖標
 */
export const LUCIDE_ICON_MAPPING = {
  '👤': 'User',
  '📄': 'FileText', 
  '✉️': 'FileText',
  '🏢': 'Building',
  '📋': 'AlertTriangle',
  '📝': 'BookOpen',
  '🤝': 'Users'
} as const;

/**
 * 獲取指定 Object 類型對應的 Lucide React 圖標組件名稱
 * @param type Object 類型鍵值
 * @returns Lucide React 圖標組件名稱
 */
export function getObjectTypeLucideIcon(type: ObjectTypeKey): string {
  const emojiIcon = getObjectTypeIcon(type);
  return LUCIDE_ICON_MAPPING[emojiIcon as keyof typeof LUCIDE_ICON_MAPPING] || 'FileText';
}

/**
 * 圖標組件映射配置 - 將圖標名稱映射到實際的 React 組件
 * 這個映射需要在每個使用圖標的組件中定義，因為 React 組件不能跨模組共享
 */
export const LUCIDE_ICON_COMPONENT_NAMES = {
  'User': 'User',
  'FileText': 'FileText', 
  'Building': 'Building',
  'AlertTriangle': 'AlertTriangle',
  'BookOpen': 'BookOpen',
  'Users': 'Users'
} as const;

/**
 * 獲取指定 Object 類型對應的列表頁面路徑
 * @param type Object 類型鍵值
 * @returns 列表頁面路徑
 */
export function getObjectTypeRoute(type: ObjectTypeKey): string {
  return OBJECT_TYPE_CONFIG[type].route || '/objects';
}
