// Reference: javascript_gemini blueprint integration  
import { GoogleGenAI } from "@google/genai";
import type { Object } from "@shared/schema";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  contextObjects?: string[];
}

export interface GeminiChatOptions {
  messages: ChatMessage[];
  contextObjects?: Object[];
}

export async function chatWithGemini(options: GeminiChatOptions): Promise<string> {
  try {
    const { messages, contextObjects = [] } = options;
    
    // Build system instruction with context
    let systemInstruction = `You are an AI assistant specializing in object and knowledge management. You help users organize, search, and understand their objects and information about people.

Objects refer to all types of data entries including but not limited to persons, entities, issues, logs, meetings, letters, and documents.

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

    // Convert messages to Gemini format - map "assistant" to "model" for Gemini API
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

// Text Embedding function with configurable dimensions
export async function generateTextEmbedding(
  text: string, 
  outputDimensionality: number = 3072,
  autoTruncate: boolean = true
): Promise<number[]> {
  try {
    const response = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: [{
        parts: [{ text }]
      }]
    });

    const embedding = response.embeddings?.[0]?.values || [];
    
    // Apply dimensionality truncation if needed
    if (autoTruncate && embedding.length > outputDimensionality) {
      console.log(`Truncating embedding from ${embedding.length} to ${outputDimensionality} dimensions`);
      return embedding.slice(0, outputDimensionality);
    }
    
    return embedding;
  } catch (error) {
    console.error('Text embedding error:', error);
    throw new Error(`Failed to generate text embedding: ${error}`);
  }
}

// Word document extraction function using mammoth
export async function extractTextFromWord(wordBase64: string): Promise<string> {
  try {
    const mammoth = (await import('mammoth')).default;
    
    // Convert base64 to buffer
    const buffer = Buffer.from(wordBase64, 'base64');
    
    // Extract raw text from DOCX
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