import { 
  type User, 
  type InsertUser,
  type Document,
  type InsertDocument,
  type UpdateDocument,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  type Chunk,
  type InsertChunk,
  type UpdateChunk,
  type Relationship,
  type InsertRelationship,
  type UpdateRelationship,
  type SearchResult,
  type MentionItem,
  type ParsedMention,
  type AppConfig,
  type InsertAppConfig,
  type UpdateAppConfig,
  type DocumentType
} from "@shared/schema";
import { randomUUID } from "crypto";

// Universal relationship filter interface
export interface RelationshipFilters {
  sourceId?: string;
  targetId?: string;
  sourceType?: DocumentType;
  targetType?: DocumentType;
  relationKind?: string;
  direction?: "out" | "in" | "both"; // out: sourceId matches, in: targetId matches, both: either
  limit?: number;
  offset?: number;
}

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Document operations
  getDocument(id: string): Promise<Document | undefined>;
  getAllDocuments(): Promise<Document[]>;
  getDocumentsByType(type: "person" | "document" | "organization" | "issue" | "log"): Promise<Document[]>;
  searchDocuments(query: string, type?: "person" | "document" | "organization" | "issue" | "log"): Promise<SearchResult>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: string, updates: UpdateDocument): Promise<Document | undefined>;
  deleteDocument(id: string): Promise<boolean>;
  getMentionSuggestions(query: string): Promise<MentionItem[]>;
  
  // Embedding operations
  updateDocumentEmbedding(id: string, embedding: number[]): Promise<boolean>;
  searchDocumentsByVector(queryVector: number[], limit?: number): Promise<Document[]>;
  getDocumentsNeedingEmbedding(): Promise<Document[]>;
  
  // Chunk operations
  getChunksByDocumentId(documentId: string): Promise<Chunk[]>;
  createChunk(chunk: InsertChunk): Promise<Chunk>;
  updateChunk(id: string, updates: UpdateChunk): Promise<Chunk | undefined>;
  updateChunkEmbedding(id: string, embedding: number[]): Promise<boolean>;
  deleteChunk(id: string): Promise<boolean>;
  deleteChunksByDocumentId(documentId: string): Promise<boolean>;
  searchChunksByVector(queryVector: number[], limit?: number): Promise<Array<Chunk & { document: Document }>>;
  
  // Mention parsing operations
  parseMentions(text: string): Promise<ParsedMention[]>;
  resolveMentionDocuments(mentions: ParsedMention[]): Promise<string[]>;
  
  // Conversation operations
  getConversation(id: string): Promise<Conversation | undefined>;
  getAllConversations(): Promise<Conversation[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(id: string, updates: { title?: string }): Promise<Conversation | undefined>;
  deleteConversation(id: string): Promise<boolean>;
  
  // Message operations
  getMessagesByConversation(conversationId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  deleteMessage(id: string): Promise<boolean>;
  
  // Relationship operations
  getRelationship(id: string): Promise<Relationship | undefined>;
  // Universal relationship query method
  findRelationships(filters: RelationshipFilters): Promise<{ relationships: Relationship[]; total: number }>;
  getRelationshipsBySource(sourceId: string): Promise<Relationship[]>;
  getRelationshipsByTarget(targetId: string): Promise<Relationship[]>;
  getRelationshipsByType(relationshipType: string): Promise<Relationship[]>;
  getRelationshipsByKind(relationKind: string): Promise<Relationship[]>;
  getRelationshipsBySourceAndType(sourceId: string, relationshipType: string): Promise<Relationship[]>;
  getRelationshipsByTargetAndType(targetId: string, relationshipType: string): Promise<Relationship[]>;
  getRelationshipsBySourceAndKind(sourceId: string, relationKind: string): Promise<Relationship[]>;
  getRelationshipsByTargetAndKind(targetId: string, relationKind: string): Promise<Relationship[]>;
  getRelationshipBetween(sourceId: string, targetId: string): Promise<Relationship[]>;
  createRelationship(relationship: InsertRelationship): Promise<Relationship>;
  createBulkRelationships(relationships: InsertRelationship[]): Promise<Relationship[]>;
  updateRelationship(id: string, updates: UpdateRelationship): Promise<Relationship | undefined>;
  deleteRelationship(id: string): Promise<boolean>;
  deleteRelationshipsBySource(sourceId: string): Promise<boolean>;
  deleteRelationshipsByTarget(targetId: string): Promise<boolean>;
  deleteRelationshipsByType(relationshipType: string): Promise<boolean>;
  cleanupRelationshipsForDocument(documentId: string): Promise<boolean>;
  
  // Settings operations
  getAppConfig(): Promise<AppConfig>;
  updateAppConfig(updates: UpdateAppConfig): Promise<AppConfig>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private documents: Map<string, Document>;
  private conversations: Map<string, Conversation>;
  private messages: Map<string, Message>;
  private chunks: Map<string, Chunk>;
  private relationships: Map<string, Relationship>;
  private appConfig: AppConfig;

  constructor() {
    this.users = new Map();
    this.documents = new Map();
    this.conversations = new Map();
    this.messages = new Map();
    this.chunks = new Map();
    this.relationships = new Map();
    
    // Initialize default app configuration
    this.appConfig = {
      geminiApi: {
        model: "gemini-2.5-flash",
        temperature: 0.7,
        topP: 0.94,
        topK: 32,
        maxOutputTokens: 1000,
        systemInstructions: "You are a helpful AI assistant for document and context management.",
        safetySettings: {
          harassment: "BLOCK_MEDIUM_AND_ABOVE",
          hateSpeech: "BLOCK_MEDIUM_AND_ABOVE",
          sexuallyExplicit: "BLOCK_MEDIUM_AND_ABOVE",
          dangerousContent: "BLOCK_MEDIUM_AND_ABOVE",
          civicIntegrity: "BLOCK_MEDIUM_AND_ABOVE"
        }
      },
      textEmbedding: {
        model: "gemini-embedding-001",
        taskType: "RETRIEVAL_DOCUMENT",
        outputDimensionality: 3072,
        autoEmbedding: true,
        autoTruncate: true,
        batchSize: 10
      },
      updatedAt: new Date()
    };
    
    // Add some sample data
    this.initializeSampleData();
  }

  private async initializeSampleData() {
    // Sample documents
    const sampleDocs = [
      {
        name: "習近平",
        type: "person" as const,
        content: "中華人民共和國國家主席，中國共產黨中央委員會總書記。曾任中共中央軍委主席。",
        aliases: ["習總書記", "習主席", "國家主席"]
      },
      {
        name: "項目計劃書",
        type: "document" as const,
        content: "2025年度重點項目開發計劃，包含AI技術應用、產品設計規範、進度安排等內容。",
        aliases: ["計劃書", "項目文檔"]
      },
      {
        name: "技術文檔",
        type: "document" as const,
        content: "系統架構設計文檔，包含前端React組件、後端API設計、數據庫結構等詳細說明。",
        aliases: ["技術規範", "開發文檔"]
      },
      {
        name: "李強",
        type: "person" as const,
        content: "中華人民共和國國務院總理，中國共產黨中央政治局常委。",
        aliases: ["李總理", "國務院總理"]
      },
      {
        name: "騰訊控股",
        type: "organization" as const,
        content: "中國領先的互聯網和科技公司，業務範圍涵蓋社交網絡、遊戲、媒體、電子商務、移動支付等。",
        aliases: ["騰訊", "Tencent", "騰訊公司"]
      },
      {
        name: "阿里巴巴集團",
        type: "organization" as const,
        content: "中國最大的電子商務公司，旗下擁有淘寶、天貓、支付寶等知名平台，同時涉及雲計算、物流等領域。",
        aliases: ["阿里巴巴", "Alibaba", "阿里集團"]
      },
      {
        name: "數據安全合規持續監控",
        type: "issue" as const,
        content: "隨著GDPR、CCPA等國際數據保護法規的不斷更新，需要持續監控和評估我們的數據處理流程是否符合最新的合規要求。這包括定期審查數據收集方式、存儲期限、用戶同意機制，以及第三方數據處理協議的合規性檢查。",
        aliases: ["數據合規", "GDPR合規", "隱私保護追蹤", "法規遵循監控"]
      },
      {
        name: "用戶體驗持續改善計劃",
        type: "issue" as const,
        content: "基於用戶反饋和數據分析結果，持續追蹤和改善產品的用戶體驗。包括介面易用性評估、用戶流程優化、載入速度改善、無障礙設計提升等。需要定期收集用戶反饋、分析使用數據，並制定相應的改善措施。這是一個需要跨團隊協作的長期項目。",
        aliases: ["UX改善", "用戶體驗優化", "界面改進", "用戶反饋追蹤"]
      },
      {
        name: "技術債務管理與架構優化",
        type: "issue" as const,
        content: "持續識別、評估和清理系統中的技術債務，包括過時的代碼庫、不安全的依賴項、效能瓶頸、代碼重複等問題。同時制定長期的系統架構優化計劃，確保技術架構能夠支撐業務的長期發展。這需要定期的代碼審查、效能監控和架構評估。",
        aliases: ["技術債務", "架構優化", "代碼重構", "系統升級", "效能優化"]
      },
      // Log entries with different dates
      {
        name: "系統效能監控記錄 - 2025年1月",
        type: "log" as const,
        content: "2025年1月系統效能監控摘要：API回應時間平均250ms，CPU使用率維持在65%，記憶體使用率72%。發現資料庫查詢瓶頸，需要優化索引結構。用戶併發數峰值達到5,000人次。",
        aliases: ["1月效能記錄", "效能監控1月", "系統監控紀錄"],
        date: "2025-01-15"
      },
      {
        name: "資安漏洞修復日誌 - 2025年2月",
        type: "log" as const,
        content: "發現並修復三個中等風險資安漏洞：SQL注入防護強化、XSS過濾機制更新、檔案上傳驗證加嚴。所有修復已通過安全測試並部署至生產環境。影響範圍：用戶登入模組、檔案管理系統。",
        aliases: ["2月資安日誌", "漏洞修復記錄", "安全更新日誌"],
        date: "2025-02-08"
      },
      {
        name: "用戶反饋處理記錄 - 2025年3月",
        type: "log" as const,
        content: "本月處理用戶反饋126件，其中功能改善建議78件，錯誤回報32件，介面優化建議16件。重點改善項目：搜尋功能速度提升40%，報表匯出增加Excel格式支援，行動版介面適配優化。用戶滿意度評分從4.2提升至4.6。",
        aliases: ["3月反饋記錄", "用戶意見處理", "客戶服務日誌"],
        date: "2025-03-20"
      }
    ];
    
    for (const doc of sampleDocs) {
      await this.createDocument(doc);
    }

    // Sample conversation
    const conv = await this.createConversation({ title: "AI Context Manager討論" });
    await this.createMessage({
      conversationId: conv.id,
      role: "user",
      content: "請介紹一下@[person:習近平|習主席]的背景",
      contextDocuments: []
    });
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Document operations
  async getDocument(id: string): Promise<Document | undefined> {
    return this.documents.get(id);
  }

  async getAllDocuments(): Promise<Document[]> {
    return Array.from(this.documents.values()).sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async getDocumentsByType(type: "person" | "document" | "organization" | "issue" | "log"): Promise<Document[]> {
    return Array.from(this.documents.values())
      .filter(doc => doc.type === type)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async searchDocuments(query: string, type?: "person" | "document" | "organization" | "issue" | "log"): Promise<SearchResult> {
    const allDocs = Array.from(this.documents.values());
    const lowerQuery = query.toLowerCase();
    
    const filtered = allDocs.filter(doc => {
      if (type && doc.type !== type) return false;
      
      const matchesName = doc.name.toLowerCase().includes(lowerQuery);
      const matchesContent = doc.content.toLowerCase().includes(lowerQuery);
      const matchesAliases = doc.aliases.some(alias => 
        alias.toLowerCase().includes(lowerQuery)
      );
      
      return matchesName || matchesContent || matchesAliases;
    });
    
    return {
      documents: filtered.sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
      total: filtered.length
    };
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const id = randomUUID();
    const now = new Date();
    const document: Document = {
      name: insertDocument.name,
      type: insertDocument.type,
      content: insertDocument.content || '',
      aliases: (insertDocument.aliases as string[]) || [],
      date: insertDocument.date || null,
      embedding: null,
      hasEmbedding: false,
      embeddingStatus: "pending",
      needsEmbedding: true,
      isFromOCR: false,
      hasBeenEdited: false,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.documents.set(id, document);
    return document;
  }

  async updateDocument(id: string, updates: UpdateDocument): Promise<Document | undefined> {
    const existing = this.documents.get(id);
    if (!existing) return undefined;
    
    const updated: Document = {
      id: existing.id,
      name: updates.name ?? existing.name,
      type: updates.type ?? existing.type,
      content: updates.content ?? existing.content,
      aliases: (updates.aliases as string[]) ?? existing.aliases,
      date: updates.date !== undefined ? updates.date : existing.date,
      embedding: existing.embedding,
      hasEmbedding: existing.hasEmbedding,
      embeddingStatus: existing.embeddingStatus,
      needsEmbedding: existing.needsEmbedding,
      isFromOCR: existing.isFromOCR,
      hasBeenEdited: true, // Mark as edited when updated
      createdAt: existing.createdAt,
      updatedAt: new Date()
    };
    this.documents.set(id, updated);
    return updated;
  }

  async deleteDocument(id: string): Promise<boolean> {
    return this.documents.delete(id);
  }

  async getMentionSuggestions(query: string): Promise<MentionItem[]> {
    const allDocs = Array.from(this.documents.values());
    const lowerQuery = query.toLowerCase();
    
    const matches = allDocs.filter(doc => {
      const matchesName = doc.name.toLowerCase().includes(lowerQuery);
      const matchesAliases = doc.aliases.some(alias => 
        alias.toLowerCase().includes(lowerQuery)
      );
      return matchesName || matchesAliases;
    });
    
    return matches.map(doc => ({
      id: doc.id,
      name: doc.name,
      type: doc.type,
      aliases: doc.aliases
    })).slice(0, 10); // Limit to 10 suggestions
  }

  // Conversation operations
  async getConversation(id: string): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

  async getAllConversations(): Promise<Conversation[]> {
    return Array.from(this.conversations.values()).sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const id = randomUUID();
    const now = new Date();
    const conversation: Conversation = {
      ...insertConversation,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.conversations.set(id, conversation);
    return conversation;
  }

  async updateConversation(id: string, updates: { title?: string }): Promise<Conversation | undefined> {
    const existing = this.conversations.get(id);
    if (!existing) return undefined;
    
    const updated: Conversation = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };
    this.conversations.set(id, updated);
    return updated;
  }

  async deleteConversation(id: string): Promise<boolean> {
    // Also delete all messages in this conversation
    const messagesToDelete = Array.from(this.messages.entries())
      .filter(([_, message]) => message.conversationId === id)
      .map(([messageId]) => messageId);
    
    messagesToDelete.forEach(messageId => this.messages.delete(messageId));
    
    return this.conversations.delete(id);
  }

  // Message operations
  async getMessagesByConversation(conversationId: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(message => message.conversationId === conversationId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = randomUUID();
    const now = new Date();
    const message: Message = {
      id,
      conversationId: insertMessage.conversationId,
      role: insertMessage.role,
      content: insertMessage.content,
      contextDocuments: (insertMessage.contextDocuments as string[]) || [],
      thinking: insertMessage.thinking || null,
      functionCalls: insertMessage.functionCalls ? insertMessage.functionCalls as Array<{name: string; arguments: any; result?: any}> : null,
      status: insertMessage.status || "completed",
      contextMetadata: insertMessage.contextMetadata ? insertMessage.contextMetadata as {
        mentionedPersons?: Array<{ id: string; name: string; alias?: string }>;
        mentionedDocuments?: Array<{ id: string; name: string; alias?: string }>;
        originalPrompt?: string;
      } : null,
      createdAt: now,
      updatedAt: now
    };
    this.messages.set(id, message);
    
    // Update conversation timestamp
    const conversation = this.conversations.get(insertMessage.conversationId);
    if (conversation) {
      this.conversations.set(insertMessage.conversationId, {
        ...conversation,
        updatedAt: new Date()
      });
    }
    
    return message;
  }

  async deleteMessage(id: string): Promise<boolean> {
    return this.messages.delete(id);
  }

  // Mention parsing operations
  async parseMentions(text: string): Promise<ParsedMention[]> {
    const mentions: ParsedMention[] = [];
    // Regex to match @[type:name] or @[type:name|alias]
    const mentionRegex = /@\[(person|document|organization|issue|log):([^|\]]+)(?:\|([^\]]+))?\]/g;
    
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      const [fullMatch, type, name, alias] = match;
      
      mentions.push({
        start: match.index,
        end: match.index + fullMatch.length,
        raw: fullMatch,
        type: type as "person" | "document" | "organization" | "issue" | "log",
        name: name.trim(),
        alias: alias?.trim(),
        documentId: undefined // Will be resolved separately
      });
    }
    
    return mentions;
  }

  async resolveMentionDocuments(mentions: ParsedMention[]): Promise<string[]> {
    const documentIds: string[] = [];
    
    for (const mention of mentions) {
      // Find document by name first
      let document = Array.from(this.documents.values()).find(doc => 
        doc.type === mention.type && doc.name === mention.name
      );
      
      // If not found by name, try alias
      if (!document && mention.alias) {
        document = Array.from(this.documents.values()).find(doc => 
          doc.type === mention.type && doc.aliases.includes(mention.alias!)
        );
      }
      
      // If still not found, try searching by alias in the original name field
      if (!document) {
        document = Array.from(this.documents.values()).find(doc => 
          doc.type === mention.type && 
          (doc.aliases.includes(mention.name) || doc.name === mention.alias)
        );
      }
      
      if (document && !documentIds.includes(document.id)) {
        documentIds.push(document.id);
        // Update the mention with resolved document ID
        mention.documentId = document.id;
      }
    }
    
    return documentIds;
  }

  // Embedding operations
  async updateDocumentEmbedding(id: string, embedding: number[]): Promise<boolean> {
    const existing = this.documents.get(id);
    if (!existing) return false;
    
    const updated: Document = {
      ...existing,
      embedding,
      hasEmbedding: true,
      embeddingStatus: "completed",
      needsEmbedding: false,
      updatedAt: new Date()
    };
    this.documents.set(id, updated);
    return true;
  }

  async searchDocumentsByVector(queryVector: number[], limit: number = 10): Promise<Document[]> {
    // Simple cosine similarity implementation for in-memory storage
    const docsWithEmbeddings = Array.from(this.documents.values())
      .filter(doc => doc.hasEmbedding && doc.embedding);
    
    const similarities = docsWithEmbeddings.map(doc => {
      const similarity = this.cosineSimilarity(queryVector, doc.embedding!);
      return { doc, similarity };
    });
    
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(item => item.doc);
  }

  async getDocumentsNeedingEmbedding(): Promise<Document[]> {
    return Array.from(this.documents.values()).filter(doc => {
      if (!doc.needsEmbedding) return false;
      
      // For OCR documents, wait until they've been edited
      if (doc.isFromOCR && !doc.hasBeenEdited) return false;
      
      // For mention-created documents, embed immediately
      return true;
    });
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // Chunk operations
  async getChunksByDocumentId(documentId: string): Promise<Chunk[]> {
    return Array.from(this.chunks.values())
      .filter(chunk => chunk.documentId === documentId)
      .sort((a, b) => a.chunkIndex - b.chunkIndex);
  }

  async createChunk(insertChunk: InsertChunk): Promise<Chunk> {
    const id = randomUUID();
    const now = new Date();
    const chunk: Chunk = {
      id,
      documentId: insertChunk.documentId,
      content: insertChunk.content,
      chunkIndex: insertChunk.chunkIndex,
      startPosition: insertChunk.startPosition,
      endPosition: insertChunk.endPosition,
      embedding: insertChunk.embedding || null,
      hasEmbedding: insertChunk.hasEmbedding || false,
      embeddingStatus: insertChunk.embeddingStatus || "pending",
      createdAt: now,
      updatedAt: now
    };
    this.chunks.set(id, chunk);
    return chunk;
  }

  async updateChunk(id: string, updates: UpdateChunk): Promise<Chunk | undefined> {
    const existing = this.chunks.get(id);
    if (!existing) return undefined;
    
    const updated: Chunk = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };
    this.chunks.set(id, updated);
    return updated;
  }

  async updateChunkEmbedding(id: string, embedding: number[]): Promise<boolean> {
    const existing = this.chunks.get(id);
    if (!existing) return false;
    
    const updated: Chunk = {
      ...existing,
      embedding,
      hasEmbedding: true,
      embeddingStatus: "completed",
      updatedAt: new Date()
    };
    this.chunks.set(id, updated);
    return true;
  }

  async deleteChunk(id: string): Promise<boolean> {
    return this.chunks.delete(id);
  }

  async deleteChunksByDocumentId(documentId: string): Promise<boolean> {
    const chunksToDelete = Array.from(this.chunks.entries())
      .filter(([_, chunk]) => chunk.documentId === documentId)
      .map(([chunkId]) => chunkId);
    
    let deletedCount = 0;
    for (const chunkId of chunksToDelete) {
      if (this.chunks.delete(chunkId)) {
        deletedCount++;
      }
    }
    
    console.log(`Deleted ${deletedCount} chunks for document ${documentId}`);
    return deletedCount > 0;
  }

  async searchChunksByVector(queryVector: number[], limit: number = 10): Promise<Array<Chunk & { document: Document }>> {
    const chunksWithEmbeddings = Array.from(this.chunks.values())
      .filter(chunk => chunk.hasEmbedding && chunk.embedding);
    
    const similarities = chunksWithEmbeddings.map(chunk => {
      const similarity = this.cosineSimilarity(queryVector, chunk.embedding!);
      const document = this.documents.get(chunk.documentId);
      return { 
        ...chunk, 
        document: document!, 
        similarity 
      };
    }).filter(item => item.document); // Filter out chunks without documents
    
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(item => ({ ...item, similarity: undefined })); // Remove similarity from result
  }

  // Settings operations
  async getAppConfig(): Promise<AppConfig> {
    return this.appConfig;
  }

  async updateAppConfig(updates: UpdateAppConfig): Promise<AppConfig> {
    // Deep merge the updates with existing config
    this.appConfig = {
      ...this.appConfig,
      ...updates,
      geminiApi: {
        ...this.appConfig.geminiApi,
        ...(updates.geminiApi || {}),
        safetySettings: {
          ...this.appConfig.geminiApi.safetySettings,
          ...(updates.geminiApi?.safetySettings || {})
        }
      },
      textEmbedding: {
        ...this.appConfig.textEmbedding,
        ...(updates.textEmbedding || {})
      },
      updatedAt: new Date()
    };
    
    return this.appConfig;
  }

  // Relationship operations
  async getRelationship(id: string): Promise<Relationship | undefined> {
    return this.relationships.get(id);
  }

  // Universal relationship query method with advanced filtering
  async findRelationships(filters: RelationshipFilters): Promise<{ relationships: Relationship[]; total: number }> {
    let relationships = Array.from(this.relationships.values());

    // Apply filters
    if (filters.sourceId || filters.targetId) {
      // Handle direction parameter
      if (filters.direction === "out") {
        // Only outgoing relationships (where the entity is the source)
        if (filters.sourceId) {
          relationships = relationships.filter(rel => rel.sourceId === filters.sourceId);
        }
      } else if (filters.direction === "in") {
        // Only incoming relationships (where the entity is the target)
        if (filters.targetId) {
          relationships = relationships.filter(rel => rel.targetId === filters.targetId);
        }
      } else if (filters.direction === "both" || !filters.direction) {
        // Both directions (default behavior)
        if (filters.sourceId && filters.targetId) {
          // Both sourceId and targetId specified
          relationships = relationships.filter(rel => 
            rel.sourceId === filters.sourceId && rel.targetId === filters.targetId
          );
        } else if (filters.sourceId) {
          // Only sourceId specified, find relationships in both directions
          relationships = relationships.filter(rel => 
            rel.sourceId === filters.sourceId || rel.targetId === filters.sourceId
          );
        } else if (filters.targetId) {
          // Only targetId specified, find relationships in both directions
          relationships = relationships.filter(rel => 
            rel.sourceId === filters.targetId || rel.targetId === filters.targetId
          );
        }
      }
    }

    // Filter by source type
    if (filters.sourceType) {
      relationships = relationships.filter(rel => rel.sourceType === filters.sourceType);
    }

    // Filter by target type
    if (filters.targetType) {
      relationships = relationships.filter(rel => rel.targetType === filters.targetType);
    }

    // Filter by relation kind
    if (filters.relationKind) {
      relationships = relationships.filter(rel => rel.relationKind === filters.relationKind);
    }

    // Sort by creation date (newest first)
    relationships.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = relationships.length;

    // Apply pagination
    if (filters.offset || filters.limit) {
      const offset = filters.offset || 0;
      const limit = filters.limit || 50;
      relationships = relationships.slice(offset, offset + limit);
    }

    return { relationships, total };
  }

  async getRelationshipsBySource(sourceId: string): Promise<Relationship[]> {
    return Array.from(this.relationships.values())
      .filter(rel => rel.sourceId === sourceId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getRelationshipsByTarget(targetId: string): Promise<Relationship[]> {
    return Array.from(this.relationships.values())
      .filter(rel => rel.targetId === targetId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getRelationshipsByType(relationshipType: string): Promise<Relationship[]> {
    return Array.from(this.relationships.values())
      .filter(rel => rel.relationshipType === relationshipType)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // New method for filtering by relationKind
  async getRelationshipsByKind(relationKind: string): Promise<Relationship[]> {
    return Array.from(this.relationships.values())
      .filter(rel => rel.relationKind === relationKind)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createRelationship(insertRelationship: InsertRelationship): Promise<Relationship> {
    const id = randomUUID();
    const now = new Date();
    
    // For backward compatibility, infer types from documents if not provided
    let sourceType = insertRelationship.sourceType;
    let targetType = insertRelationship.targetType;
    
    if (!sourceType || !targetType) {
      const sourceDoc = await this.getDocument(insertRelationship.sourceId);
      const targetDoc = await this.getDocument(insertRelationship.targetId);
      
      if (sourceDoc) sourceType = sourceDoc.type;
      if (targetDoc) targetType = targetDoc.type;
    }
    
    const relationship: Relationship = {
      id,
      sourceId: insertRelationship.sourceId,
      targetId: insertRelationship.targetId,
      sourceType: sourceType || "document", // Default fallback
      targetType: targetType || "document", // Default fallback
      relationKind: insertRelationship.relationKind || "related",
      relationshipType: insertRelationship.relationshipType,
      createdAt: now,
      updatedAt: now
    };
    this.relationships.set(id, relationship);
    return relationship;
  }

  async updateRelationship(id: string, updates: UpdateRelationship): Promise<Relationship | undefined> {
    const existing = this.relationships.get(id);
    if (!existing) return undefined;
    
    const updated: Relationship = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };
    this.relationships.set(id, updated);
    return updated;
  }

  async deleteRelationship(id: string): Promise<boolean> {
    return this.relationships.delete(id);
  }

  async deleteRelationshipsBySource(sourceId: string): Promise<boolean> {
    const relationshipsToDelete = Array.from(this.relationships.entries())
      .filter(([_, rel]) => rel.sourceId === sourceId)
      .map(([relId]) => relId);
    
    let deletedCount = 0;
    for (const relId of relationshipsToDelete) {
      if (this.relationships.delete(relId)) {
        deletedCount++;
      }
    }
    
    return deletedCount > 0;
  }

  async deleteRelationshipsByTarget(targetId: string): Promise<boolean> {
    const relationshipsToDelete = Array.from(this.relationships.entries())
      .filter(([_, rel]) => rel.targetId === targetId)
      .map(([relId]) => relId);
    
    let deletedCount = 0;
    for (const relId of relationshipsToDelete) {
      if (this.relationships.delete(relId)) {
        deletedCount++;
      }
    }
    
    return deletedCount > 0;
  }

  async getRelationshipsBySourceAndType(sourceId: string, relationshipType: string): Promise<Relationship[]> {
    return Array.from(this.relationships.values())
      .filter(rel => rel.sourceId === sourceId && rel.relationshipType === relationshipType)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getRelationshipsByTargetAndType(targetId: string, relationshipType: string): Promise<Relationship[]> {
    return Array.from(this.relationships.values())
      .filter(rel => rel.targetId === targetId && rel.relationshipType === relationshipType)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // New methods for filtering by relationKind
  async getRelationshipsBySourceAndKind(sourceId: string, relationKind: string): Promise<Relationship[]> {
    return Array.from(this.relationships.values())
      .filter(rel => rel.sourceId === sourceId && rel.relationKind === relationKind)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getRelationshipsByTargetAndKind(targetId: string, relationKind: string): Promise<Relationship[]> {
    return Array.from(this.relationships.values())
      .filter(rel => rel.targetId === targetId && rel.relationKind === relationKind)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getRelationshipBetween(sourceId: string, targetId: string): Promise<Relationship[]> {
    return Array.from(this.relationships.values())
      .filter(rel => rel.sourceId === sourceId && rel.targetId === targetId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createBulkRelationships(insertRelationships: InsertRelationship[]): Promise<Relationship[]> {
    const createdRelationships: Relationship[] = [];
    
    for (const insertRel of insertRelationships) {
      // Check if relationship already exists to avoid duplicates
      const existing = Array.from(this.relationships.values()).find(rel => 
        rel.sourceId === insertRel.sourceId && 
        rel.targetId === insertRel.targetId && 
        rel.relationshipType === insertRel.relationshipType
      );
      
      if (!existing) {
        const relationship = await this.createRelationship(insertRel);
        createdRelationships.push(relationship);
      }
    }
    
    return createdRelationships;
  }

  async deleteRelationshipsByType(relationshipType: string): Promise<boolean> {
    const relationshipsToDelete = Array.from(this.relationships.entries())
      .filter(([_, rel]) => rel.relationshipType === relationshipType)
      .map(([relId]) => relId);
    
    let deletedCount = 0;
    for (const relId of relationshipsToDelete) {
      if (this.relationships.delete(relId)) {
        deletedCount++;
      }
    }
    
    return deletedCount > 0;
  }

  async cleanupRelationshipsForDocument(documentId: string): Promise<boolean> {
    // Delete all relationships where this document is either source or target
    const relationshipsToDelete = Array.from(this.relationships.entries())
      .filter(([_, rel]) => rel.sourceId === documentId || rel.targetId === documentId)
      .map(([relId]) => relId);
    
    let deletedCount = 0;
    for (const relId of relationshipsToDelete) {
      if (this.relationships.delete(relId)) {
        deletedCount++;
      }
    }
    
    return deletedCount > 0;
  }
}

export const storage = new MemStorage();
