// Unified Gemini AI Service
import { GoogleGenAI } from "@google/genai";
import { storage } from "./storage";
import { embeddingService } from "./embedding-service";
import { functions, callFunction } from "./functions";
import type { Object, MentionItem, SearchResult, ObjectType } from "@shared/schema";
import { OBJECT_TYPES, OBJECT_TYPE_CONFIG, getObjectTypeChineseName, getObjectTypeIcon } from "@shared/schema";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Helper function to generate dynamic object types list
function generateObjectTypesList(): string {
  const typeNames = Object.keys(OBJECT_TYPE_CONFIG).map(type => {
    const config = OBJECT_TYPE_CONFIG[type as keyof typeof OBJECT_TYPE_CONFIG];
    return `${config.icon} ${config.chineseName} (${config.englishSingular})`;
  });
  return typeNames.join(', ');
}

// Helper function to get icon for object types
function getIcon(type: string): string {
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
}

// Basic chat interfaces
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  contextObjects?: string[];
}

export interface GeminiChatOptions {
  messages: ChatMessage[];
  contextObjects?: Object[];
}

// Function calling interfaces
export interface GeminiFunctionChatOptions {
  messages: ChatMessage[];
  contextObjects?: Object[];
}

// Event types for multi-stage thinking
export interface ThinkingEvent {
  type: 'thinking';
  content: string;
  stage: 'initial' | 'post_function_call';
  functionCallIndex?: number;
}

export interface FunctionCallEvent {
  type: 'function_call';
  name: string;
  arguments: any;
  result: any;
}

export type AIEvent = ThinkingEvent | FunctionCallEvent;

// Basic chat function (no function calling)
export async function chatWithGemini(options: GeminiChatOptions): Promise<string> {
  try {
    const { messages, contextObjects = [] } = options;
    
    // Build system instruction with context
    const objectTypesList = generateObjectTypesList();
    let systemInstruction = `You are an AI assistant for an advanced object and knowledge management system. You help users organize, search, and understand their objects, people, entities, issues, logs, and meetings.

Objects refer to all types of data entries including but not limited to: ${objectTypesList}.

You can help users with:
- Understanding and analyzing objects
- Finding information about people and objects
- Organizing knowledge and information
- Answering questions based on provided context

When users mention objects or people using @mentions (like @[person:習近平|習主席]), you should understand they are referring to specific entities in their knowledge base and respond accordingly.`;

    if (contextObjects.length > 0) {
      systemInstruction += `\n\nContext Objects (Available for reference):`;
      contextObjects.forEach((doc, index) => {
        systemInstruction += `\n${index + 1}. ${doc.type === 'person' ? '👤' : '📄'} ${doc.name}`;
        if (doc.aliases.length > 0) {
          systemInstruction += ` (also known as: ${doc.aliases.join(', ')})`;
        }
        systemInstruction += `\n   📝 ${doc.content.substring(0, 300)}${doc.content.length > 300 ? '...' : ''}`;
      });
      
      systemInstruction += `\n\nPlease reference these objects in your responses when relevant.`;
    }

    // Convert messages to Gemini format
    const geminiMessages = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : msg.role,
      parts: [{ text: msg.content }]
    }));

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      config: {
        systemInstruction
      },
      contents: geminiMessages
    });

    return response.text || "I apologize, but I couldn't generate a response. Please try again.";
  } catch (error) {
    console.error('Gemini chat error:', error);
    throw new Error(`Failed to chat with Gemini: ${error}`);
  }
}

// Text Embedding function
export async function generateTextEmbedding(
  text: string, 
  outputDimensionality: number = 3072
): Promise<number[]> {
  try {
    const response = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: {
        parts: [{ text }],
      }
    });

    const embedding = response.embeddings?.[0]?.values || [];
    
    if (embedding.length > outputDimensionality) {
      console.warn(`Warning: Embedding dimension ${embedding.length} exceeds requested ${outputDimensionality}, keeping original dimension`);
    }
    
    return embedding;
  } catch (error) {
    console.error('Text embedding error:', error);
    throw new Error(`Failed to generate text embedding: ${error}`);
  }
}

// Document extraction functions
export async function extractTextFromWord(wordBase64: string): Promise<string> {
  try {
    const mammoth = (await import('mammoth')).default;
    const buffer = Buffer.from(wordBase64, 'base64');
    const result = await mammoth.extractRawText({ buffer: buffer });
    
    if (result.messages && result.messages.length > 0) {
      console.log('Mammoth extraction messages:', result.messages);
    }
    
    return result.value || "";
  } catch (error) {
    console.error('Word extraction error:', error);
    throw new Error(`Failed to extract text from Word document: ${error}`);
  }
}

export async function extractTextFromPDF(pdfBase64: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: [
        {
          inlineData: {
            data: pdfBase64,
            mimeType: "application/pdf"
          }
        },
        "Extract all text content from this PDF document. Preserve the structure and formatting as much as possible, including headings, paragraphs, and any important organizational elements. Return the text in a clean, readable format."
      ]
    });

    return response.text || "";
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error(`Failed to extract text from PDF: ${error}`);
  }
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
      }
    }
    
    console.log('✅ [MERGE RESPONSES] Merge completed successfully');
    
  } catch (error) {
    console.error('❌ [MERGE RESPONSES] Error merging consecutive response messages:', error);
  }
}

// Function calling with iterative approach
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
  
  // Build system instruction
  const objectTypesList = generateObjectTypesList();
  let systemInstruction = `You are an AI assistant for an advanced object and knowledge management system. You help users organize, search, and understand their objects, people, entities, issues, logs, and meetings.

Objects refer to all types of data entries including but not limited to: ${objectTypesList}. You can use the getObjectTypes function to see all available object types.

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

**IMPORTANT GUIDELINES:**
1. **Always use searchObjects first** to explore the knowledge base comprehensively before making conclusions
2. **Use pagination** - if you find many results, use different page numbers to explore more
3. **Be thorough** - don't just look at the first few results, explore multiple pages and different search terms
4. **Use getObjectDetails** to get full content of the most relevant objects you find
5. **Think step by step** - use the thinking capability to plan your approach
6. **Be conversational** - provide helpful, detailed responses based on your findings

When users mention objects or people using @mentions (like @[person:習近平|習主席]), you should understand they are referring to specific entities in their knowledge base and respond accordingly.`;

  if (contextObjects.length > 0) {
    systemInstruction += `\n\nContext Objects (Available for reference):`;
    contextObjects.forEach((doc, index) => {
      systemInstruction += `\n${index + 1}. ${doc.type === 'person' ? '👤' : '📄'} ${doc.name}`;
      if (doc.aliases.length > 0) {
        systemInstruction += ` (also known as: ${doc.aliases.join(', ')})`;
      }
      systemInstruction += `\n   📝 ${doc.content.substring(0, 300)}${doc.content.length > 300 ? '...' : ''}`;
    });
    
    systemInstruction += `\n\nPlease reference these objects in your responses when relevant.`;
  }

  if (referencedObjects.length > 0) {
    systemInstruction += `\n\nReferenced Objects (Mentioned in conversation):`;
    referencedObjects.forEach((obj, index) => {
      systemInstruction += `\n${index + 1}. ${obj.type === 'person' ? '👤' : '📄'} ${obj.name}`;
      if (obj.aliases.length > 0) {
        systemInstruction += ` (also known as: ${obj.aliases.join(', ')})`;
      }
      if (obj.date) {
        systemInstruction += ` (${obj.date})`;
      }
      systemInstruction += ` - ${obj.isReferenced ? 'Referenced' : 'Available'}`;
    });
  }

  // Convert messages to Gemini format
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
      if (chunk.candidates && chunk.candidates[0]) {
        const candidate = chunk.candidates[0];
        
        if (candidate.content && candidate.content.parts) {
          for (const part of candidate.content.parts) {
            if (part.text) {
              roundResponseText += part.text;
              
              // Save response chunk immediately when it arrives
              if (conversationId && conversationGroupId && part.text.trim()) {
                try {
                  console.log('💾 [IMMEDIATE SAVE] Saving response chunk...');
                  await storage.createMessage({
                    conversationId,
                    conversationGroupId,
                    role: "assistant",
                    type: "response",
                    content: { text: part.text }
                  });
                  console.log('✅ [SAVED RESPONSE CHUNK] Immediately saved to database');
                } catch (error) {
                  console.error('❌ [SAVE ERROR] Failed to save response chunk:', error);
                }
              }
            }
            
            if (part.functionCall) {
              hasFunctionCalls = true;
              console.log('🔧 [FUNCTION CALL]', part.functionCall.name, part.functionCall.args);
              
              try {
                const functionResult = await callFunction(part.functionCall.name || '', part.functionCall.args || {});
                roundFunctionCalls.push({
                  name: part.functionCall.name || '',
                  arguments: part.functionCall.args || {},
                  result: functionResult
                });
                
                // Save function call immediately when it completes
                if (conversationId && conversationGroupId) {
                  try {
                    console.log('💾 [IMMEDIATE SAVE] Saving function call result...');
                    
                    // For searchObjects, parse the JSON result to store as object
                    let resultToStore = functionResult;
                    if (part.functionCall.name === 'searchObjects') {
                      try {
                        resultToStore = JSON.parse(functionResult);
                        console.log('📦 [FUNCTION_CALL] Parsed searchObjects result as JSON object');
                      } catch (parseError) {
                        console.log('⚠️ [FUNCTION_CALL] Failed to parse searchObjects result, storing as string');
                      }
                    }
                    
                    await storage.createMessage({
                      conversationId,
                      conversationGroupId,
                      role: "assistant",
                      type: "function_call",
                      content: {
                        name: part.functionCall.name || '',
                        arguments: part.functionCall.args || {},
                        result: resultToStore
                      }
                    });
                    console.log('✅ [SAVED FUNCTION_CALL] Immediately saved to database');
                  } catch (error) {
                    console.error('❌ [SAVE ERROR] Failed to save function call:', error);
                  }
                }
                
                // Add function call event
                allEvents.push({
                  type: 'function_call',
                  name: part.functionCall.name || '',
                  arguments: part.functionCall.args || {},
                  result: functionResult
                });
                
                // Function result is handled internally, no need to add to conversation history
                
              } catch (error) {
                console.error('Function call error:', error);
                const errorResult = `Error calling function ${part.functionCall.name || ''}: ${error}`;
                roundFunctionCalls.push({
                  name: part.functionCall.name || '',
                  arguments: part.functionCall.args || {},
                  result: errorResult
                });
                
                // Save function call error immediately
                if (conversationId && conversationGroupId) {
                  try {
                    console.log('💾 [IMMEDIATE SAVE] Saving function call error...');
                    
                    // For searchObjects errors, try to parse if it's JSON, otherwise store as string
                    let errorToStore = errorResult;
                    if (part.functionCall.name === 'searchObjects') {
                      try {
                        errorToStore = JSON.parse(errorResult);
                        console.log('📦 [FUNCTION_CALL] Parsed searchObjects error as JSON object');
                      } catch (parseError) {
                        console.log('⚠️ [FUNCTION_CALL] Storing searchObjects error as string');
                      }
                    }
                    
                    await storage.createMessage({
                      conversationId,
                      conversationGroupId,
                      role: "assistant",
                      type: "function_call",
                      content: {
                        name: part.functionCall.name || '',
                        arguments: part.functionCall.args || {},
                        result: errorToStore
                      }
                    });
                    console.log('✅ [SAVED FUNCTION_CALL ERROR] Immediately saved to database');
                  } catch (saveError) {
                    console.error('❌ [SAVE ERROR] Failed to save function call error:', saveError);
                  }
                }
                
                // Function error is handled internally, no need to add to conversation history
              }
            }
          }
        }
        
        if (candidate.finishReason) {
          finalResponseObj = candidate;
        }
      }
    }
    
    // Add thinking event if there was thinking
    if (roundThinking) {
      allEvents.push({
        type: 'thinking',
        content: roundThinking,
        stage: 'initial'
      });
    }
    
    // Add response text to conversation history
    if (roundResponseText) {
      conversationHistory.push({
        role: 'model',
        parts: [{ text: roundResponseText }]
      });
      allResponseText += roundResponseText;
    }
    
    // Check if we should continue
    // Only stop if we got a STOP finish reason AND no function calls were made this round
    if (finalResponseObj?.finishReason === 'STOP' && !hasFunctionCalls) {
      console.log('🏁 [ITERATIVE] Conversation complete - AI indicated STOP and no function calls needed');
      break;
    }
    
    // If we had function calls, continue to next round to let AI process the results
    if (hasFunctionCalls) {
      console.log(`🔄 [ITERATIVE] Function calls completed, continuing to next round for AI analysis`);
    }
    
    console.log(`✅ [ROUND ${roundCount}] Completed with ${roundFunctionCalls.length} function calls`);
  }
  
  console.log(`🎯 [ITERATIVE] Final response: ${allResponseText.substring(0, 200)}...`);
  console.log('ℹ️ [ITERATIVE] All messages have been saved in real-time during streaming');
  
  // Merge consecutive response messages after completion (if enabled)
  console.log('🔍 [MERGE CHECK] conversationId:', conversationId);
  console.log('🔍 [MERGE CHECK] conversationGroupId:', conversationGroupId);
  if (conversationId && conversationGroupId) {
    try {
      // Get app config to check if merging is enabled
      const appConfig = await storage.getAppConfig();
      const shouldMerge = appConfig.geminiApi.mergeResponses ?? true; // Default to true for backward compatibility
      
      console.log('🔍 [MERGE CHECK] Merge responses setting:', shouldMerge);
      
      if (shouldMerge) {
        console.log('🚀 [MERGE CHECK] Starting merge process...');
        await mergeConsecutiveResponseMessages(conversationId, conversationGroupId);
      } else {
        console.log('⚠️ [MERGE CHECK] Response merging is disabled in settings, skipping merge');
      }
    } catch (error) {
      console.error('❌ [MERGE CHECK] Error checking merge setting:', error);
      // Fallback to merging if there's an error reading config
      console.log('🚀 [MERGE CHECK] Fallback: Starting merge process...');
      await mergeConsecutiveResponseMessages(conversationId, conversationGroupId);
    }
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

// Function calling with streaming
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
  const objectTypesList = generateObjectTypesList();
  let systemInstruction = `You are an AI assistant for an advanced object and knowledge management system. You help users organize, search, and understand their objects, people, entities, issues, logs, and meetings.

Objects refer to all types of data entries including but not limited to: ${objectTypesList}. You can use the getObjectTypes function to see all available object types.

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

**IMPORTANT GUIDELINES:**
1. **Always use searchObjects first** to explore the knowledge base comprehensively before making conclusions
2. **Use pagination** - if you find many results, use different page numbers to explore more
3. **Be thorough** - don't just look at the first few results, explore multiple pages and different search terms
4. **Use getObjectDetails** to get full content of the most relevant objects you find
5. **Think step by step** - use the thinking capability to plan your approach
6. **Be conversational** - provide helpful, detailed responses based on your findings

When users mention objects or people using @mentions (like @[person:習近平|習主席]), you should understand they are referring to specific entities in their knowledge base and respond accordingly.`;

  if (contextObjects.length > 0) {
    systemInstruction += `\n\nContext Objects (Available for reference):`;
    contextObjects.forEach((doc, index) => {
      systemInstruction += `\n${index + 1}. ${doc.type === 'person' ? '👤' : '📄'} ${doc.name}`;
      if (doc.aliases.length > 0) {
        systemInstruction += ` (also known as: ${doc.aliases.join(', ')})`;
      }
      systemInstruction += `\n   📝 ${doc.content.substring(0, 300)}${doc.content.length > 300 ? '...' : ''}`;
    });
    
    systemInstruction += `\n\nPlease reference these objects in your responses when relevant.`;
  }

  if (referencedObjects.length > 0) {
    systemInstruction += `\n\nReferenced Objects (Mentioned in conversation):`;
    referencedObjects.forEach((obj, index) => {
      systemInstruction += `\n${index + 1}. ${obj.type === 'person' ? '👤' : '📄'} ${obj.name}`;
      if (obj.aliases.length > 0) {
        systemInstruction += ` (also known as: ${obj.aliases.join(', ')})`;
      }
      if (obj.date) {
        systemInstruction += ` (${obj.date})`;
      }
      systemInstruction += ` - ${obj.isReferenced ? 'Referenced' : 'Available'}`;
    });
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
    console.log('📦 [STREAM CHUNK]', JSON.stringify(chunk, null, 2));
    
    if (chunk.candidates && chunk.candidates[0]) {
      const candidate = chunk.candidates[0];
      
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.text) {
            responseTextBuffer += part.text;
            finalResponse += part.text;
          }
          
          if (part.functionCall) {
            console.log('🔧 [FUNCTION CALL]', part.functionCall.name, part.functionCall.args);
            
            try {
              const functionResult = await callFunction(part.functionCall.name || '', part.functionCall.args || {});
              
              // Add function call event
              events.push({
                type: 'function_call',
                name: part.functionCall.name || '',
                arguments: part.functionCall.args || {},
                result: functionResult
              });
              
            } catch (error) {
              console.error('Function call error:', error);
              const errorResult = `Error calling function ${part.functionCall.name || ''}: ${error}`;
              
              events.push({
                type: 'function_call',
                name: part.functionCall.name || '',
                arguments: part.functionCall.args || {},
                result: errorResult
              });
            }
          }
        }
      }
      
      if (candidate.finishReason) {
        finalResponseObj = candidate;
        console.log('🏁 [STREAMING] Finish reason:', candidate.finishReason);
      }
    }
  }
  
  console.log(`🎯 [STREAMING] Final response: ${finalResponse.substring(0, 200)}...`);
  
  return {
    content: finalResponse,
    events: events
  };
  } catch (error) {
    console.error('Gemini streaming function calling error:', error);
    return {
      content: `Error: ${error}`,
      events: []
    };
  }
}
