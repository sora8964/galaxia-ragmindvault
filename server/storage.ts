import { 
  type User, 
  type InsertUser,
  type Object,
  type InsertObject,
  type UpdateObject,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  type ObjectType,
  type UpdateMessage,
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
  type UpdateAppConfig
} from "@shared/schema";
import { randomUUID } from "crypto";

// Universal relationship filter interface
export interface RelationshipFilters {
  sourceId?: string;
  targetId?: string;
  sourceType?: ObjectType;
  targetType?: ObjectType;
  limit?: number;
  offset?: number;
}

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Object operations
  getObject(id: string): Promise<Object | undefined>;
  getAllObjects(): Promise<Object[]>;
  getObjectsByType(type: ObjectType): Promise<Object[]>;
  searchObjects(query: string, type?: ObjectType): Promise<SearchResult>;
  createObject(object: InsertObject): Promise<Object>;
  updateObject(id: string, updates: UpdateObject): Promise<Object | undefined>;
  deleteObject(id: string): Promise<boolean>;
  getMentionSuggestions(query: string): Promise<MentionItem[]>;
  
  // Embedding operations
  updateObjectEmbedding(id: string, embedding: number[]): Promise<boolean>;
  searchObjectsByVector(queryVector: number[], limit?: number): Promise<Array<Object & { similarity: number }>>;
  getObjectsNeedingEmbedding(): Promise<Object[]>;
  
  // Chunk operations
  getChunksByObjectId(objectId: string): Promise<Chunk[]>;
  createChunk(chunk: InsertChunk): Promise<Chunk>;
  updateChunk(id: string, updates: UpdateChunk): Promise<Chunk | undefined>;
  updateChunkEmbedding(id: string, embedding: number[]): Promise<boolean>;
  deleteChunk(id: string): Promise<boolean>;
  deleteChunksByObjectId(objectId: string): Promise<boolean>;
  searchChunksByVector(queryVector: number[], limit?: number): Promise<Array<Chunk & { object: Object }>>;
  
  // Mention parsing operations
  parseMentions(text: string): Promise<ParsedMention[]>;
  resolveMentionObjects(mentions: ParsedMention[]): Promise<string[]>;
  
  // Conversation operations
  getConversation(id: string): Promise<Conversation | undefined>;
  getAllConversations(): Promise<Conversation[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(id: string, updates: { title?: string }): Promise<Conversation | undefined>;
  deleteConversation(id: string): Promise<boolean>;
  
  // Message operations
  getMessagesByConversation(conversationId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessage(id: string, updates: UpdateMessage): Promise<Message | undefined>;
  deleteMessage(id: string, cascadeDelete?: boolean): Promise<boolean>;
  deleteMessagesAfter(conversationId: string, messageId: string): Promise<boolean>;
  
  // Relationship operations
  getRelationship(id: string): Promise<Relationship | undefined>;
  // Universal relationship query method
  findRelationships(filters: RelationshipFilters): Promise<{ relationships: Relationship[]; total: number }>;
  getRelationshipsBySource(sourceId: string): Promise<Relationship[]>;
  getRelationshipsByTarget(targetId: string): Promise<Relationship[]>;
  getRelationshipBetween(sourceId: string, targetId: string): Promise<Relationship[]>;
  createRelationship(relationship: InsertRelationship): Promise<Relationship>;
  createBulkRelationships(relationships: InsertRelationship[]): Promise<Relationship[]>;
  updateRelationship(id: string, updates: UpdateRelationship): Promise<Relationship | undefined>;
  deleteRelationship(id: string): Promise<boolean>;
  deleteRelationshipsBySource(sourceId: string): Promise<boolean>;
  deleteRelationshipsByTarget(targetId: string): Promise<boolean>;
  cleanupRelationshipsForObject(objectId: string): Promise<boolean>;
  
  // Settings operations
  getAppConfig(): Promise<AppConfig>;
  updateAppConfig(updates: UpdateAppConfig): Promise<AppConfig>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private objects: Map<string, Object>;
  private conversations: Map<string, Conversation>;
  private messages: Map<string, Message>;
  private chunks: Map<string, Chunk>;
  private relationships: Map<string, Relationship>;
  private appConfig: AppConfig;

  constructor() {
    this.users = new Map();
    this.objects = new Map();
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
        systemInstructions: "You are a helpful AI assistant for object and context management. Objects refer to all types of data entries including but not limited to persons, entities, issues, logs, meetings, letters, and documents.",
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
      retrieval: {
        autoRag: true,
        docTopK: 30,  // Increased to 30 for user prompts
        chunkTopK: 90, // Proportionally increased for better coverage  
        perDocChunkCap: 6,
        contextWindow: 1,
        minDocSim: 0.25,
        minChunkSim: 0.30,
        budgetTokens: 12000,  // Increased token budget for larger context
        strategy: 'balanced' as const,
        addCitations: true
      },
      chunking: {
        chunkSize: 2000,
        overlap: 200,
        enabled: true
      },
      updatedAt: new Date()
    };
    
    // Add some sample data
    this.initializeSampleData();
  }

  private async initializeSampleData() {
    // Sample objects
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
        type: "entity" as const,
        content: "中國領先的互聯網和科技公司，業務範圍涵蓋社交網絡、遊戲、媒體、電子商務、移動支付等。",
        aliases: ["騰訊", "Tencent", "騰訊公司"]
      },
      {
        name: "阿里巴巴集團",
        type: "entity" as const,
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
      await this.createObject(doc);
    }

    // Sample conversation
    const conv = await this.createConversation({ title: "AI Context Manager討論" });
    await this.createMessage({
      conversationId: conv.id,
      role: "user",
      content: "請介紹一下@[person:習近平|習主席]的背景",
      contextObjects: []
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

  // Object operations
  async getObject(id: string): Promise<Object | undefined> {
    return this.objects.get(id);
  }

  async getAllObjects(): Promise<Object[]> {
    return Array.from(this.objects.values()).sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async getObjectsByType(type: ObjectType): Promise<Object[]> {
    return Array.from(this.objects.values())
      .filter(doc => doc.type === type)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async searchObjects(query: string, type?: ObjectType): Promise<SearchResult> {
    console.log(`[MemStorage] Search called with query: "${query}", type: ${type}`);
    const allObjects = Array.from(this.objects.values());
    console.log(`[MemStorage] Total objects: ${allObjects.length}`);
    const lowerQuery = query.toLowerCase();
    
    // Enhanced search with date pattern matching and flexible terms
    const filtered = allObjects.filter(doc => {
      if (type && doc.type !== type) return false;
      
      // Basic text matching
      const matchesName = doc.name.toLowerCase().includes(lowerQuery);
      const matchesContent = doc.content.toLowerCase().includes(lowerQuery);
      const matchesAliases = doc.aliases.some(alias => 
        alias.toLowerCase().includes(lowerQuery)
      );
      
      // Enhanced date pattern matching for Chinese dates
      let matchesDatePattern = false;
      
      // Match patterns like "2025年8月" to "20250801", "2025-08", "202508" etc.
      const chineseDateMatch = query.match(/(\d{4})年(\d{1,2})月?/);
      if (chineseDateMatch) {
        const year = chineseDateMatch[1];
        const month = chineseDateMatch[2].padStart(2, '0');
        
        const datePatterns = [
          `${year}${month}`,      // 202508
          `${year}-${month}`,     // 2025-08
          `${year}/${month}`,     // 2025/08
          `${year}年${parseInt(month)}月`, // 2025年8月
          `${year}年${month}月`,   // 2025年08月
        ];
        
        matchesDatePattern = datePatterns.some(pattern => 
          doc.name.includes(pattern) || 
          doc.content.includes(pattern) ||
          (doc.date && doc.date.includes(pattern))
        );
      }
      
      // Split query into terms and handle combinations intelligently
      let matchesFlexibleTerms = false;
      const queryTerms = query.trim().split(/\s+/).filter(term => term.length > 1);
      
      // Debug: Log query analysis for all multi-term searches
      if (queryTerms.length > 1) {
        console.log(`Debug: Multi-term query "${query}"`);
        console.log(`  queryTerms:`, queryTerms);
      }
      
      if (queryTerms.length > 1) {
        // Check if query contains both content terms and date patterns
        const hasDateTerm = queryTerms.some(term => /\d{4}年\d{1,2}月?/.test(term));
        const contentTerms = queryTerms.filter(term => !/\d{4}年\d{1,2}月?/.test(term));
        
        if (queryTerms.length > 1) {
          console.log(`  hasDateTerm:`, hasDateTerm);
          console.log(`  contentTerms:`, contentTerms);
        }
        
        if (hasDateTerm && contentTerms.length > 0) {
          // For date + content queries, require ALL content terms AND date match
          const matchesAllContentTerms = contentTerms.every(term => {
            const lowerTerm = term.toLowerCase();
            return doc.name.toLowerCase().includes(lowerTerm) ||
                   doc.content.toLowerCase().includes(lowerTerm) ||
                   doc.aliases.some(alias => alias.toLowerCase().includes(lowerTerm));
          });
          // Debug: log the matching process for troubleshooting
          if (doc.name.includes('懇請會德豐同意恢復住宅屬會')) {
            console.log(`Debug match for ${doc.name}:`);
            console.log(`  contentTerms:`, contentTerms);
            console.log(`  matchesAllContentTerms:`, matchesAllContentTerms);
            console.log(`  matchesDatePattern:`, matchesDatePattern);
            console.log(`  doc.date:`, doc.date);
          }
          // Smart combination: content terms + date pattern must both match
          matchesFlexibleTerms = matchesAllContentTerms && matchesDatePattern;
        } else {
          // For non-date multi-term queries, match ANY term (OR logic)
          matchesFlexibleTerms = queryTerms.some(term => {
            const lowerTerm = term.toLowerCase();
            const matches = doc.name.toLowerCase().includes(lowerTerm) ||
                          doc.content.toLowerCase().includes(lowerTerm) ||
                          doc.aliases.some(alias => alias.toLowerCase().includes(lowerTerm));
            
            // Debug for specific terms
            if (queryTerms.length > 1 && (term === '星河明居' || term === '譚香文')) {
              console.log(`  Term "${term}" matches doc "${doc.name}": ${matches}`);
            }
            
            return matches;
          });
        }
      }
      
      // Simplified logic: for multi-term queries, use flexible matching
      if (queryTerms.length > 1) {
        console.log(`[MemStorage] Multi-term query, returning matchesFlexibleTerms: ${matchesFlexibleTerms}`);
        return matchesFlexibleTerms;
      }
      
      // For single-term queries, use basic matching
      const singleMatch = matchesName || matchesContent || matchesAliases || matchesDatePattern;
      console.log(`[MemStorage] Single-term query, returning: ${singleMatch}`);
      return singleMatch;
    });
    
    return {
      objects: filtered.sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
      total: filtered.length
    };
  }

  async createObject(insertObject: InsertObject): Promise<Object> {
    const id = randomUUID();
    const now = new Date();
    const object: Object = {
      name: insertObject.name,
      type: insertObject.type,
      content: insertObject.content || '',
      aliases: (insertObject.aliases as string[]) || [],
      date: insertObject.date || null,
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
    this.objects.set(id, object);
    return object;
  }

  async updateObject(id: string, updates: UpdateObject): Promise<Object | undefined> {
    const existing = this.objects.get(id);
    if (!existing) return undefined;
    
    // Check if content-related fields have changed
    const contentChanged = 
      (updates.content !== undefined && updates.content !== existing.content) ||
      (updates.name !== undefined && updates.name !== existing.name) ||
      (updates.aliases !== undefined && JSON.stringify(updates.aliases) !== JSON.stringify(existing.aliases)) ||
      (updates.date !== undefined && updates.date !== existing.date);
    
    const updated: Object = {
      id: existing.id,
      name: updates.name ?? existing.name,
      type: updates.type ?? existing.type,
      content: updates.content ?? existing.content,
      aliases: (updates.aliases as string[]) ?? existing.aliases,
      date: updates.date !== undefined ? updates.date : existing.date,
      embedding: contentChanged ? null : existing.embedding, // Clear embedding if content changed
      hasEmbedding: contentChanged ? false : existing.hasEmbedding, // Mark as needing re-embedding
      embeddingStatus: contentChanged ? "pending" : existing.embeddingStatus,
      needsEmbedding: contentChanged ? true : existing.needsEmbedding,
      isFromOCR: existing.isFromOCR,
      hasBeenEdited: true, // Mark as edited when updated
      createdAt: existing.createdAt,
      updatedAt: new Date()
    };
    
    this.objects.set(id, updated);
    console.log(`Updated object - ${updated.type}:${updated.name}(${id})${contentChanged ? ' (content changed - will re-embed)' : ' (metadata only)'}`);
    return updated;
  }

  async deleteObject(id: string): Promise<boolean> {
    return this.objects.delete(id);
  }

  async getMentionSuggestions(query: string): Promise<MentionItem[]> {
    const allObjects = Array.from(this.objects.values());
    const lowerQuery = query.toLowerCase();
    
    const matches = allObjects.filter(doc => {
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
      contextObjects: (insertMessage.contextObjects as string[]) || [],
      thinking: insertMessage.thinking || null,
      functionCalls: insertMessage.functionCalls ? insertMessage.functionCalls as Array<{name: string; arguments: any; result?: any}> : null,
      status: insertMessage.status || "completed",
      contextMetadata: insertMessage.contextMetadata ? insertMessage.contextMetadata as {
        mentionedPersons?: Array<{ id: string; name: string; alias?: string }>;
        mentionedObjects?: Array<{ id: string; name: string; alias?: string }>;
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

  async updateMessage(id: string, updates: UpdateMessage): Promise<Message | undefined> {
    const existing = this.messages.get(id);
    if (!existing) return undefined;

    const updated: Message = {
      ...existing,
      ...updates,
      // Ensure contextObjects is properly typed as string[]
      contextObjects: updates.contextObjects ? (updates.contextObjects as string[]) : existing.contextObjects,
      // Ensure other JSON fields are properly typed
      functionCalls: updates.functionCalls ? (updates.functionCalls as Array<{name: string; arguments: any; result?: any}>) : existing.functionCalls,
      contextMetadata: updates.contextMetadata ? (updates.contextMetadata as {
        mentionedPersons?: Array<{ id: string; name: string; alias?: string }>;
        mentionedObjects?: Array<{ id: string; name: string; alias?: string }>;
        originalPrompt?: string;
      }) : existing.contextMetadata,
      id, // Ensure ID cannot be changed
      createdAt: existing.createdAt, // Preserve original creation time
      updatedAt: new Date()
    };

    this.messages.set(id, updated);
    
    // Update conversation timestamp
    const conversation = this.conversations.get(updated.conversationId);
    if (conversation) {
      this.conversations.set(updated.conversationId, {
        ...conversation,
        updatedAt: new Date()
      });
    }
    
    // If this is a user message being edited, delete all subsequent messages in the conversation
    // since AI responses would need to be regenerated based on the new content
    if (existing.role === "user") {
      await this.deleteSubsequentMessages(existing.conversationId, existing.createdAt);
    }
    
    return updated;
  }

  async deleteMessage(id: string, cascadeDelete: boolean = false): Promise<boolean> {
    const message = this.messages.get(id);
    if (!message) return false;
    
    // Delete the message
    const deleted = this.messages.delete(id);
    
    // If cascadeDelete is true or this is a user message, delete subsequent messages
    if (deleted && (cascadeDelete || message.role === "user")) {
      await this.deleteSubsequentMessages(message.conversationId, message.createdAt);
    }
    
    return deleted;
  }

  async deleteMessagesAfter(conversationId: string, messageId: string): Promise<boolean> {
    const targetMessage = this.messages.get(messageId);
    if (!targetMessage || targetMessage.conversationId !== conversationId) {
      return false;
    }
    
    // Find messages that come after the target message (excluding the target message itself)
    const messagesToDelete = Array.from(this.messages.entries())
      .filter(([id, message]) => 
        message.conversationId === conversationId && 
        new Date(message.createdAt).getTime() > new Date(targetMessage.createdAt).getTime()
      )
      .map(([messageId]) => messageId);
    
    // Delete the messages
    let deletedCount = 0;
    for (const id of messagesToDelete) {
      if (this.messages.delete(id)) {
        deletedCount++;
      }
    }
    
    // Update conversation timestamp if messages were deleted
    if (deletedCount > 0) {
      const conversation = this.conversations.get(conversationId);
      if (conversation) {
        this.conversations.set(conversationId, {
          ...conversation,
          updatedAt: new Date()
        });
      }
    }
    
    return deletedCount > 0;
  }
  
  // Helper method to delete messages that come after a specific timestamp in a conversation
  private async deleteSubsequentMessages(conversationId: string, afterTimestamp: Date): Promise<void> {
    const conversationMessages = Array.from(this.messages.entries())
      .filter(([_, message]) => 
        message.conversationId === conversationId && 
        new Date(message.createdAt).getTime() > new Date(afterTimestamp).getTime()
      )
      .map(([messageId]) => messageId);
    
    conversationMessages.forEach(messageId => {
      this.messages.delete(messageId);
    });
  }

  // Mention parsing operations
  async parseMentions(text: string): Promise<ParsedMention[]> {
    const mentions: ParsedMention[] = [];
    // Regex to match @[type:name] or @[type:name|alias]
    const mentionRegex = /@\[(person|document|entity|issue|log):([^|\]]+)(?:\|([^\]]+))?\]/g;
    
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      const [fullMatch, type, name, alias] = match;
      
      mentions.push({
        start: match.index,
        end: match.index + fullMatch.length,
        raw: fullMatch,
        type: type as ObjectType,
        name: name.trim(),
        alias: alias?.trim(),
        objectId: undefined // Will be resolved separately
      });
    }
    
    return mentions;
  }

  async resolveMentionObjects(mentions: ParsedMention[]): Promise<string[]> {
    const objectIds: string[] = [];
    
    for (const mention of mentions) {
      // Find object by name first
      let object = Array.from(this.objects.values()).find(doc => 
        doc.type === mention.type && doc.name === mention.name
      );
      
      // If not found by name, try alias
      if (!object && mention.alias) {
        object = Array.from(this.objects.values()).find(doc => 
          doc.type === mention.type && doc.aliases.includes(mention.alias!)
        );
      }
      
      // If still not found, try searching by alias in the original name field
      if (!object) {
        object = Array.from(this.objects.values()).find(doc => 
          doc.type === mention.type && 
          (doc.aliases.includes(mention.name) || doc.name === mention.alias)
        );
      }
      
      if (object && !objectIds.includes(object.id)) {
        objectIds.push(object.id);
        // Update the mention with resolved object ID
        mention.objectId = object.id;
      }
    }
    
    return objectIds;
  }

  // Embedding operations
  async updateObjectEmbedding(id: string, embedding: number[]): Promise<boolean> {
    const existing = this.objects.get(id);
    if (!existing) return false;
    
    const updated: Object = {
      ...existing,
      embedding,
      hasEmbedding: true,
      embeddingStatus: "completed",
      needsEmbedding: false,
      updatedAt: new Date()
    };
    this.objects.set(id, updated);
    return true;
  }

  async searchObjectsByVector(queryVector: number[], limit: number = 10): Promise<Array<Object & { similarity: number }>> {
    // Simple cosine similarity implementation for in-memory storage
    const objectsWithEmbeddings = Array.from(this.objects.values())
      .filter(doc => doc.hasEmbedding && doc.embedding);
    
    const similarities = objectsWithEmbeddings.map(doc => {
      const similarity = this.cosineSimilarity(queryVector, doc.embedding!);
      return { doc, similarity };
    });
    
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(item => ({ ...item.doc, similarity: item.similarity }));
  }

  async getObjectsNeedingEmbedding(): Promise<Object[]> {
    return Array.from(this.objects.values()).filter(doc => {
      if (!doc.needsEmbedding) return false;
      
      // For OCR objects, wait until they've been edited
      if (doc.isFromOCR && !doc.hasBeenEdited) return false;
      
      // For mention-created objects, embed immediately
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
  async getChunksByObjectId(objectId: string): Promise<Chunk[]> {
    return Array.from(this.chunks.values())
      .filter(chunk => chunk.objectId === objectId)
      .sort((a, b) => a.chunkIndex - b.chunkIndex);
  }

  async createChunk(insertChunk: InsertChunk): Promise<Chunk> {
    const id = randomUUID();
    const now = new Date();
    const chunk: Chunk = {
      id,
      objectId: insertChunk.objectId,
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

  async deleteChunksByObjectId(objectId: string): Promise<boolean> {
    const chunksToDelete = Array.from(this.chunks.entries())
      .filter(([_, chunk]) => chunk.objectId === objectId)
      .map(([chunkId]) => chunkId);
    
    let deletedCount = 0;
    for (const chunkId of chunksToDelete) {
      if (this.chunks.delete(chunkId)) {
        deletedCount++;
      }
    }
    
    console.log(`Deleted ${deletedCount} chunks for object ${objectId}`);
    return deletedCount > 0;
  }

  async searchChunksByVector(queryVector: number[], limit: number = 10): Promise<Array<Chunk & { object: Object }>> {
    const chunksWithEmbeddings = Array.from(this.chunks.values())
      .filter(chunk => chunk.hasEmbedding && chunk.embedding);
    
    const similarities = chunksWithEmbeddings.map(chunk => {
      const similarity = this.cosineSimilarity(queryVector, chunk.embedding!);
      const object = this.objects.get(chunk.objectId);
      return { 
        ...chunk, 
        object: object!, 
        similarity 
      };
    }).filter(item => item.object); // Filter out chunks without objects
    
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(item => ({ ...item, similarity: item.similarity })); // Include similarity in result
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
      // Simplified filtering - direct source/target matching
      if (filters.sourceId && filters.targetId) {
        // Both sourceId and targetId specified
        relationships = relationships.filter(rel => 
          rel.sourceId === filters.sourceId && rel.targetId === filters.targetId
        );
      } else if (filters.sourceId) {
        // Only sourceId specified
        relationships = relationships.filter(rel => rel.sourceId === filters.sourceId);
      } else if (filters.targetId) {
        // Only targetId specified  
        relationships = relationships.filter(rel => rel.targetId === filters.targetId);
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



  async createRelationship(insertRelationship: InsertRelationship): Promise<Relationship> {
    const id = randomUUID();
    const now = new Date();
    
    // For backward compatibility, infer types from objects if not provided
    let sourceType = insertRelationship.sourceType;
    let targetType = insertRelationship.targetType;
    
    if (!sourceType || !targetType) {
      const sourceDoc = await this.getObject(insertRelationship.sourceId);
      const targetDoc = await this.getObject(insertRelationship.targetId);
      
      if (sourceDoc) sourceType = sourceDoc.type;
      if (targetDoc) targetType = targetDoc.type;
    }
    
    const relationship: Relationship = {
      id,
      sourceId: insertRelationship.sourceId,
      targetId: insertRelationship.targetId,
      sourceType: sourceType,
      targetType: targetType,
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
        true // No additional conditions after sourceId and targetId match
      );
      
      if (!existing) {
        const relationship = await this.createRelationship(insertRel);
        createdRelationships.push(relationship);
      }
    }
    
    return createdRelationships;
  }


  async cleanupRelationshipsForObject(objectId: string): Promise<boolean> {
    // Delete all relationships where this object is either source or target
    const relationshipsToDelete = Array.from(this.relationships.entries())
      .filter(([_, rel]) => rel.sourceId === objectId || rel.targetId === objectId)
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

import { db } from "./db";
import { objects, conversations, messages, chunks, relationships, users, settings } from "@shared/schema";
import { eq, ilike, or, desc, and, sql, isNotNull } from "drizzle-orm";

// Database storage implementation that writes to PostgreSQL
export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  // Object operations  
  async getObject(id: string): Promise<Object | undefined> {
    const result = await db.select().from(objects).where(eq(objects.id, id));
    return result[0];
  }

  async getAllObjects(): Promise<Object[]> {
    const result = await db.select().from(objects).orderBy(desc(objects.updatedAt));
    return result;
  }

  async getObjectsByType(type: ObjectType): Promise<Object[]> {
    const result = await db.select().from(objects)
      .where(eq(objects.type, type))
      .orderBy(desc(objects.updatedAt));
    return result;
  }

  async searchObjects(query: string, type?: ObjectType): Promise<SearchResult> {
    // Multi-term query support
    const queryTerms = query.trim().split(/\s+/).filter(term => term.length > 1);
    let whereCondition;
    
    if (queryTerms.length > 1) {
      // For multi-term search, search for ANY of the terms (OR logic)
      const termConditions = [];
      for (const term of queryTerms) {
        const termQuery = `%${term.toLowerCase()}%`;
        termConditions.push(ilike(objects.name, termQuery));
        termConditions.push(ilike(objects.content, termQuery));
      }
      whereCondition = or(...termConditions);
    } else {
      // Single-term search
      const lowerQuery = `%${query.toLowerCase()}%`;
      whereCondition = or(
        ilike(objects.name, lowerQuery),
        ilike(objects.content, lowerQuery)
      );
    }
    
    if (type) {
      whereCondition = and(eq(objects.type, type), whereCondition);
    }
    
    const result = await db.select().from(objects)
      .where(whereCondition)
      .orderBy(desc(objects.updatedAt));
    
    return {
      objects: result,
      total: result.length
    };
  }

  async createObject(insertObject: InsertObject): Promise<Object> {
    const result = await db.insert(objects).values(insertObject).returning();
    return result[0];
  }

  async updateObject(id: string, updates: UpdateObject): Promise<Object | undefined> {
    const result = await db.update(objects)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(objects.id, id))
      .returning();
    return result[0];
  }

  async deleteObject(id: string): Promise<boolean> {
    // Also cleanup related relationships
    await this.cleanupRelationshipsForObject(id);
    
    const result = await db.delete(objects).where(eq(objects.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getMentionSuggestions(query: string): Promise<MentionItem[]> {
    const lowerQuery = `%${query.toLowerCase()}%`;
    
    const result = await db.select({
      id: objects.id,
      name: objects.name,
      type: objects.type,
      aliases: objects.aliases
    }).from(objects)
      .where(or(
        ilike(objects.name, lowerQuery),
        ilike(objects.content, lowerQuery)
      ))
      .limit(10);
    
    return result.map(doc => ({
      id: doc.id,
      name: doc.name,
      type: doc.type as ObjectType,
      aliases: doc.aliases || []
    }));
  }

  // Embedding operations (keep as stubs for now)
  async updateObjectEmbedding(id: string, embedding: number[]): Promise<boolean> {
    const result = await db.update(objects)
      .set({ 
        embedding: embedding as any,
        hasEmbedding: true,
        embeddingStatus: "completed"
      })
      .where(eq(objects.id, id));
    return (result.rowCount || 0) > 0;
  }

  async searchObjectsByVector(queryVector: number[], limit: number = 10): Promise<Array<Object & { similarity: number }>> {
    try {
      // Use cosine distance for vector similarity search
      const result = await db.execute(sql`
        SELECT *,
        1 - (embedding <=> ${JSON.stringify(queryVector)}::vector) as similarity
        FROM objects 
        WHERE embedding IS NOT NULL 
        AND has_embedding = true
        ORDER BY embedding <=> ${JSON.stringify(queryVector)}::vector
        LIMIT ${limit}
      `);
      
      return result.rows.map(row => ({
        id: row.id as string,
        name: row.name as string,
        type: row.type as ObjectType,
        content: row.content as string,
        aliases: (row.aliases || []) as string[],
        date: row.date as string | null,
        originalFileName: row.original_file_name as string | null,
        filePath: row.file_path as string | null,
        fileSize: row.file_size as number | null,
        mimeType: row.mime_type as string | null,
        hasFile: row.has_file as boolean,
        embedding: row.embedding as number[] | null,
        hasEmbedding: row.has_embedding as boolean,
        embeddingStatus: row.embedding_status as "pending" | "completed" | "failed",
        needsEmbedding: row.needs_embedding as boolean,
        isFromOCR: row.is_from_ocr as boolean,
        hasBeenEdited: row.has_been_edited as boolean,
        createdAt: new Date(row.created_at as string),
        updatedAt: new Date(row.updated_at as string),
        similarity: row.similarity as number
      }));
    } catch (error) {
      console.error('Error in searchObjectsByVector:', error);
      return [];
    }
  }

  async getObjectsNeedingEmbedding(): Promise<Object[]> {
    const result = await db.select().from(objects)
      .where(eq(objects.needsEmbedding, true));
    return result;
  }

  // Chunk operations (keep as stubs)
  async getChunksByObjectId(objectId: string): Promise<Chunk[]> {
    const result = await db.select().from(chunks).where(eq(chunks.objectId, objectId));
    return result;
  }

  async createChunk(chunk: InsertChunk): Promise<Chunk> {
    const result = await db.insert(chunks).values(chunk).returning();
    return result[0];
  }

  async updateChunk(id: string, updates: UpdateChunk): Promise<Chunk | undefined> {
    const result = await db.update(chunks)
      .set(updates)
      .where(eq(chunks.id, id))
      .returning();
    return result[0];
  }

  async updateChunkEmbedding(id: string, embedding: number[]): Promise<boolean> {
    const result = await db.update(chunks)
      .set({ 
        embedding: embedding as any,
        hasEmbedding: true,
        embeddingStatus: "completed",
        updatedAt: new Date()
      })
      .where(eq(chunks.id, id));
    return (result.rowCount || 0) > 0;
  }

  async deleteChunk(id: string): Promise<boolean> {
    const result = await db.delete(chunks).where(eq(chunks.id, id));
    return (result.rowCount || 0) > 0;
  }

  async deleteChunksByObjectId(objectId: string): Promise<boolean> {
    const result = await db.delete(chunks).where(eq(chunks.objectId, objectId));
    return (result.rowCount || 0) > 0;
  }

  async searchChunksByVector(queryVector: number[], limit: number = 10): Promise<Array<Chunk & { object: Object; similarity: number }>> {
    try {
      console.log(`🔍 [CHUNK-SEARCH] Query vector length: ${queryVector.length}`);
      // Join chunks with their parent objects and search by vector similarity
      const result = await db.execute(sql`
        SELECT 
          c.*,
          o.name as doc_name,
          o.type as doc_type,
          o.content as doc_content,
          o.aliases as doc_aliases,
          o.date as doc_date,
          o.original_file_name as doc_original_file_name,
          o.file_path as doc_file_path,
          o.file_size as doc_file_size,
          o.mime_type as doc_mime_type,
          o.has_file as doc_has_file,
          o.embedding as doc_embedding,
          o.has_embedding as doc_has_embedding,
          o.embedding_status as doc_embedding_status,
          o.needs_embedding as doc_needs_embedding,
          o.is_from_ocr as doc_is_from_ocr,
          o.has_been_edited as doc_has_been_edited,
          o.created_at as doc_created_at,
          o.updated_at as doc_updated_at,
          1 - (c.embedding <=> ${JSON.stringify(queryVector)}::vector) as similarity
        FROM chunks c
        INNER JOIN objects o ON c.object_id = o.id
        WHERE c.embedding IS NOT NULL 
        AND c.has_embedding = true
        ORDER BY c.embedding <=> ${JSON.stringify(queryVector)}::vector
        LIMIT ${limit}
      `);
      
      console.log(`🔍 [CHUNK-SEARCH] SQL query returned ${result.rows.length} rows`);
      if (result.rows.length > 0) {
        console.log(`🔍 [CHUNK-SEARCH] First row similarity: ${result.rows[0].similarity}`);
      }
      
      return result.rows.map(row => ({
        // Chunk properties
        id: row.id as string,
        objectId: row.object_id as string,
        content: row.content as string,
        chunkIndex: row.chunk_index as number,
        startPosition: row.start_position as number,
        endPosition: row.end_position as number,
        embedding: row.embedding as number[] | null,
        hasEmbedding: row.has_embedding as boolean,
        embeddingStatus: row.embedding_status as "pending" | "completed" | "failed",
        similarity: row.similarity as number,
        createdAt: new Date(row.created_at as string),
        updatedAt: new Date(row.updated_at as string),
        // Object properties
        object: {
          id: row.object_id as string,
          name: row.doc_name as string,
          type: row.doc_type as ObjectType,
          content: row.doc_content as string,
          aliases: (row.doc_aliases || []) as string[],
          date: row.doc_date as string | null,
          originalFileName: row.doc_original_file_name as string | null,
          filePath: row.doc_file_path as string | null,
          fileSize: row.doc_file_size as number | null,
          mimeType: row.doc_mime_type as string | null,
          hasFile: row.doc_has_file as boolean,
          embedding: row.doc_embedding as number[] | null,
          hasEmbedding: row.doc_has_embedding as boolean,
          embeddingStatus: row.doc_embedding_status as "pending" | "completed" | "failed",
          needsEmbedding: row.doc_needs_embedding as boolean,
          isFromOCR: row.doc_is_from_ocr as boolean,
          hasBeenEdited: row.doc_has_been_edited as boolean,
          createdAt: new Date(row.doc_created_at as string),
          updatedAt: new Date(row.doc_updated_at as string)
        }
      }));
    } catch (error) {
      console.error('Error in searchChunksByVector:', error);
      return [];
    }
  }


  // Conversation operations
  async getConversation(id: string): Promise<Conversation | undefined> {
    const result = await db.select().from(conversations).where(eq(conversations.id, id));
    return result[0];
  }

  async getAllConversations(): Promise<Conversation[]> {
    const result = await db.select().from(conversations).orderBy(desc(conversations.updatedAt));
    return result;
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const result = await db.insert(conversations).values(conversation).returning();
    return result[0];
  }

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | undefined> {
    const result = await db.update(conversations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(conversations.id, id))
      .returning();
    return result[0];
  }

  async deleteConversation(id: string): Promise<boolean> {
    const result = await db.delete(conversations).where(eq(conversations.id, id));
    return result.rowCount > 0;
  }

  // Message operations
  async getMessage(id: string): Promise<Message | undefined> {
    const result = await db.select().from(messages).where(eq(messages.id, id));
    return result[0];
  }

  async getMessagesByConversationId(conversationId: string): Promise<Message[]> {
    const result = await db.select().from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
    return result;
  }

  async getMessagesByConversation(conversationId: string): Promise<Message[]> {
    return this.getMessagesByConversationId(conversationId);
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const result = await db.insert(messages).values(message).returning();
    return result[0];
  }

  async updateMessage(id: string, updates: UpdateMessage): Promise<Message | undefined> {
    const result = await db.update(messages)
      .set(updates)
      .where(eq(messages.id, id))
      .returning();
    return result[0];
  }

  async deleteMessage(id: string): Promise<boolean> {
    const result = await db.delete(messages).where(eq(messages.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Add the missing deleteMessagesAfter method
  async deleteMessagesAfter(conversationId: string, messageId: string): Promise<boolean> {
    // Get the timestamp of the message to delete after
    const messageResult = await db.select({ createdAt: messages.createdAt })
      .from(messages)
      .where(eq(messages.id, messageId));
    
    if (messageResult.length === 0) {
      return false;
    }
    
    const cutoffTime = messageResult[0].createdAt;
    
    // Delete all messages in the conversation that were created after this message
    const result = await db.delete(messages)
      .where(and(
        eq(messages.conversationId, conversationId),
        sql`${messages.createdAt} > ${cutoffTime}`
      ));
    
    return (result.rowCount || 0) > 0;
  }

  // Relationship operations (keep as stubs for now)
  async getRelationships(filters: RelationshipFilters): Promise<Relationship[]> {
    let query = db.select().from(relationships);
    
    if (filters.sourceId) {
      query = query.where(eq(relationships.sourceId, filters.sourceId));
    }
    
    return query.limit(filters.limit || 50);
  }

  async getRelationshipsWithDocuments(filters: RelationshipFilters): Promise<Array<Relationship & { sourceDocument: Object; targetDocument: Object }>> {
    return [];
  }

  async createRelationship(relationship: InsertRelationship): Promise<Relationship> {
    const result = await db.insert(relationships).values(relationship).returning();
    return result[0];
  }

  async deleteRelationship(id: string): Promise<boolean> {
    const result = await db.delete(relationships).where(eq(relationships.id, id));
    return (result.rowCount || 0) > 0;
  }


  async cleanupRelationshipsForObject(objectId: string): Promise<boolean> {
    const result = await db.delete(relationships)
      .where(or(
        eq(relationships.sourceId, objectId),
        eq(relationships.targetId, objectId)
      ));
    return (result.rowCount || 0) > 0;
  }

  async findRelationships(filters: RelationshipFilters): Promise<{ relationships: Relationship[]; total: number }> {
    let query = db.select().from(relationships);
    
    if (filters.sourceId) {
      query = query.where(eq(relationships.sourceId, filters.sourceId));
    }
    
    const result = await query.limit(filters.limit || 50);
    return {
      relationships: result,
      total: result.length
    };
  }

  // Add missing relationship methods that are used by routes
  async getRelationship(id: string): Promise<Relationship | undefined> {
    const result = await db.select().from(relationships).where(eq(relationships.id, id));
    return result[0];
  }

  async getRelationshipsBySource(sourceId: string): Promise<Relationship[]> {
    const result = await db.select().from(relationships)
      .where(eq(relationships.sourceId, sourceId));
    return result;
  }

  async getRelationshipsByTarget(targetId: string): Promise<Relationship[]> {
    const result = await db.select().from(relationships)
      .where(eq(relationships.targetId, targetId));
    return result;
  }





  async getRelationshipBetween(sourceId: string, targetId: string): Promise<Relationship[]> {
    const result = await db.select().from(relationships)
      .where(and(
        eq(relationships.sourceId, sourceId),
        eq(relationships.targetId, targetId)
      ));
    return result;
  }

  async createBulkRelationships(insertRelationships: InsertRelationship[]): Promise<Relationship[]> {
    const result = await db.insert(relationships).values(insertRelationships).returning();
    return result;
  }

  async updateRelationship(id: string, updates: UpdateRelationship): Promise<Relationship | undefined> {
    const result = await db.update(relationships)
      .set(updates)
      .where(eq(relationships.id, id))
      .returning();
    return result[0];
  }

  async deleteRelationshipsBySource(sourceId: string): Promise<boolean> {
    const result = await db.delete(relationships).where(eq(relationships.sourceId, sourceId));
    return (result.rowCount || 0) > 0;
  }

  async deleteRelationshipsByTarget(targetId: string): Promise<boolean> {
    const result = await db.delete(relationships).where(eq(relationships.targetId, targetId));
    return (result.rowCount || 0) > 0;
  }

  // Settings operations
  async getAppConfig(): Promise<AppConfig> {
    try {
      // Try to get config from database
      const result = await db.select()
        .from(settings)
        .where(eq(settings.key, "app_config"))
        .limit(1);

      if (result.length > 0) {
        const config = result[0].value as AppConfig;
        // Ensure all required fields are present for backward compatibility
        if (!config.functionCalling) {
          config.functionCalling = {
            enabled: true,
            maxPageSize: 50,
            defaultPageSize: 20,
            maxIterations: 5,
            enablePagination: true
          };
        }
        if (!config.chunking) {
          config.chunking = {
            chunkSize: 2000,
            overlap: 200,
            enabled: true
          };
        }
        return config;
      }
    } catch (error) {
      console.warn('Failed to load settings from database, using defaults:', error);
    }

    // Return default app configuration if no database config exists
    const defaultConfig: AppConfig = {
      retrieval: {
        autoRag: true,
        docTopK: 30, // Updated default from 6 to 30 for better context
        chunkTopK: 90, // Updated default from 24 to 90
        perDocChunkCap: 6,
        contextWindow: 1,
        minDocSim: 0.25,
        minChunkSim: 0.30,
        budgetTokens: 12000, // Updated default from 6000 to 12000
        strategy: "balanced",
        addCitations: true
      },
      functionCalling: {
        enabled: true,
        maxPageSize: 50,
        defaultPageSize: 20,
        maxIterations: 5,
        enablePagination: true
      },
      geminiApi: {
        model: "gemini-2.5-flash",
        temperature: 0.7,
        topP: 0.94,
        topK: 32,
        maxOutputTokens: 1000,
        systemInstructions: "You are a helpful AI assistant for object and context management. Objects refer to all types of data entries including but not limited to persons, entities, issues, logs, meetings, letters, and documents.",
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
      chunking: {
        chunkSize: 2000,
        overlap: 200,
        enabled: true
      },
      updatedAt: new Date()
    };

    // Save default config to database for future use
    try {
      await db.insert(settings).values({
        key: "app_config",
        value: defaultConfig
      }).onConflictDoNothing();
    } catch (error) {
      console.warn('Failed to save default config to database:', error);
    }

    return defaultConfig;
  }

  async updateAppConfig(updates: UpdateAppConfig): Promise<AppConfig> {
    const currentConfig = await this.getAppConfig();
    
    const updatedConfig = {
      ...currentConfig,
      ...updates,
      retrieval: {
        ...currentConfig.retrieval,
        ...(updates.retrieval || {})
      },
      geminiApi: {
        ...currentConfig.geminiApi,
        ...(updates.geminiApi || {}),
        safetySettings: {
          ...currentConfig.geminiApi.safetySettings,
          ...(updates.geminiApi?.safetySettings || {})
        }
      },
      textEmbedding: {
        ...currentConfig.textEmbedding,
        ...(updates.textEmbedding || {})
      },
      chunking: {
        ...currentConfig.chunking,
        ...(updates.chunking || {})
      },
      updatedAt: new Date()
    };
    
    try {
      // Update or insert the config in database
      const result = await db.insert(settings)
        .values({
          key: "app_config",
          value: updatedConfig
        })
        .onConflictDoUpdate({
          target: settings.key,
          set: {
            value: updatedConfig,
            updatedAt: sql`now()`
          }
        })
        .returning();
        
      return result[0].value as AppConfig;
    } catch (error) {
      console.error('Failed to save config to database:', error);
      throw new Error('Failed to update application configuration');
    }
  }

  // Add missing mention parsing methods
  async parseMentions(text: string): Promise<ParsedMention[]> {
    const mentions: ParsedMention[] = [];
    // Regex to match @[type:name] or @[type:name|alias]
    const mentionRegex = /@\[(person|document|entity|issue|log):([^|\]]+)(?:\|([^\]]+))?\]/g;
    
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      const [fullMatch, type, name, alias] = match;
      
      mentions.push({
        start: match.index,
        end: match.index + fullMatch.length,
        raw: fullMatch,
        type: type as ObjectType,
        name: name.trim(),
        alias: alias?.trim(),
        objectId: undefined // Will be resolved separately
      });
    }
    
    return mentions;
  }

  async resolveMentionObjects(mentions: ParsedMention[]): Promise<string[]> {
    const objectIds: string[] = [];
    
    for (const mention of mentions) {
      // Try to find object by name or alias
      const result = await db.select({ id: objects.id })
        .from(objects)
        .where(or(
          eq(objects.name, mention.name),
          and(
            isNotNull(objects.aliases),
            sql`array_length(${objects.aliases}, 1) > 0`,
            sql`${mention.name} = ANY(${objects.aliases})`
          )
        ))
        .limit(1);
      
      if (result.length > 0) {
        objectIds.push(result[0].id);
      }
    }
    
    return objectIds;
  }
}

export const storage = new DatabaseStorage();
