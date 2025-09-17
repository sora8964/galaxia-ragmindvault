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
  type SearchResult,
  type MentionItem,
  type ParsedMention
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Document operations
  getDocument(id: string): Promise<Document | undefined>;
  getAllDocuments(): Promise<Document[]>;
  getDocumentsByType(type: "person" | "document"): Promise<Document[]>;
  searchDocuments(query: string, type?: "person" | "document"): Promise<SearchResult>;
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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private documents: Map<string, Document>;
  private conversations: Map<string, Conversation>;
  private messages: Map<string, Message>;
  private chunks: Map<string, Chunk>;

  constructor() {
    this.users = new Map();
    this.documents = new Map();
    this.conversations = new Map();
    this.messages = new Map();
    this.chunks = new Map();
    
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

  async getDocumentsByType(type: "person" | "document"): Promise<Document[]> {
    return Array.from(this.documents.values())
      .filter(doc => doc.type === type)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async searchDocuments(query: string, type?: "person" | "document"): Promise<SearchResult> {
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
    const message: Message = {
      id,
      conversationId: insertMessage.conversationId,
      role: insertMessage.role,
      content: insertMessage.content,
      contextDocuments: (insertMessage.contextDocuments as string[]) || [],
      createdAt: new Date()
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
    const mentionRegex = /@\[(person|document):([^|\]]+)(?:\|([^\]]+))?\]/g;
    
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      const [fullMatch, type, name, alias] = match;
      
      mentions.push({
        start: match.index,
        end: match.index + fullMatch.length,
        raw: fullMatch,
        type: type as "person" | "document",
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
      .sort((a, b) => parseInt(a.chunkIndex) - parseInt(b.chunkIndex));
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
}

export const storage = new MemStorage();
