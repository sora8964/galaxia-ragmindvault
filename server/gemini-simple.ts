// Reference: javascript_gemini blueprint integration  
import { GoogleGenAI } from "@google/genai";
import type { Document } from "@shared/schema";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  contextDocuments?: string[];
}

export interface GeminiChatOptions {
  messages: ChatMessage[];
  contextDocuments?: Document[];
}

export async function chatWithGemini(options: GeminiChatOptions): Promise<string> {
  try {
    const { messages, contextDocuments = [] } = options;
    
    // Build system instruction with context
    let systemInstruction = `You are an AI assistant specializing in document and knowledge management. You help users organize, search, and understand their documents and information about people.

You can help users with:
- Understanding and analyzing documents
- Finding information about people and documents
- Organizing knowledge and information
- Answering questions based on provided context

When users mention documents or people using @mentions (like @[person:習近平|習主席]), you should understand they are referring to specific entities in their knowledge base and respond accordingly.`;

    if (contextDocuments.length > 0) {
      systemInstruction += `\n\nContext Documents (Available for reference):`;
      contextDocuments.forEach((doc, index) => {
        systemInstruction += `\n${index + 1}. ${doc.type === 'person' ? '👤' : '📄'} ${doc.name}`;
        if (doc.aliases.length > 0) {
          systemInstruction += ` (also known as: ${doc.aliases.join(', ')})`;
        }
        systemInstruction += `\n   📝 ${doc.content.substring(0, 300)}${doc.content.length > 300 ? '...' : ''}`;
      });
      
      systemInstruction += `\n\nPlease reference these documents in your responses when relevant.`;
    }

    // Convert messages to Gemini format
    const geminiMessages = messages.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }]
    }));

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
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

export async function extractTextFromPDF(pdfBase64: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
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