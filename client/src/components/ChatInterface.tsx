import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, Brain, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MentionSearch } from "./MentionSearch";
import { ContextIndicator } from "./ContextIndicator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { MentionItem, Message as DbMessage, Conversation } from "@shared/schema";

interface StreamMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
  contextUsed?: Array<{ id: string; name: string; type: 'person' | 'document' }>;
  thinking?: string | null;
  functionCalls?: Array<{name: string; arguments: any; result?: any}> | null;
  isStreaming?: boolean;
}

interface ChatInterfaceProps {
  conversationId?: string;
}

export function ChatInterface({ conversationId }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [input, setInput] = useState('');
  const [contextDocumentIds, setContextDocumentIds] = useState<string[]>([]);
  const [mentionPosition, setMentionPosition] = useState<{ x: number; y: number } | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get conversation data
  const { data: conversation } = useQuery<Conversation>({
    queryKey: ['/api/conversations', conversationId],
    enabled: !!conversationId,
  });

  // Load conversation messages
  const { data: conversationMessages = [] } = useQuery<DbMessage[]>({
    queryKey: ['/api/conversations', conversationId, 'messages'],
    enabled: !!conversationId,
  });

  // Convert database messages to stream messages
  useEffect(() => {
    if (conversationMessages.length > 0) {
      const formattedMessages: StreamMessage[] = conversationMessages.map((msg: DbMessage) => ({
        id: msg.id,
        content: msg.content,
        role: msg.role,
        timestamp: new Date(msg.createdAt),
        thinking: msg.thinking,
        functionCalls: msg.functionCalls,
        isStreaming: false,
      }));
      setMessages(formattedMessages);
    } else if (conversationId && messages.length === 0) {
      // Add welcome message for new conversations only if no messages exist
      setMessages([{
        id: 'welcome',
        content: '你好！我是AI Context Manager。我可以幫助你管理文件、處理PDF並進行智能對話。你可以使用@提及功能來引用你的文件。',
        role: 'assistant',
        timestamp: new Date(),
      }]);
    }
  }, [conversationMessages, conversationId, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup event source on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);

    // Check for @ mention trigger
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    
    if (atIndex !== -1 && (atIndex === 0 || textBeforeCursor[atIndex - 1] === ' ')) {
      const mentionText = textBeforeCursor.slice(atIndex + 1);
      if (!mentionText.includes(' ')) {
        setMentionQuery(mentionText);
        
        // Calculate position for mention dropdown
        if (textareaRef.current) {
          const rect = textareaRef.current.getBoundingClientRect();
          setMentionPosition({
            x: rect.left,
            y: rect.bottom
          });
        }
      } else {
        setMentionPosition(null);
      }
    } else {
      setMentionPosition(null);
    }
  };

  const handleMentionSelect = (mention: MentionItem, alias?: string) => {
    const cursorPosition = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = input.slice(0, cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    
    const mentionSyntax = `@[${mention.type}:${mention.name}${alias ? `|${alias}` : ''}]`;
    
    const newInput = 
      input.slice(0, atIndex) + 
      mentionSyntax + 
      input.slice(cursorPosition);
    
    setInput(newInput);
    setMentionPosition(null);
    
    // Add document ID to context
    if (!contextDocumentIds.includes(mention.id)) {
      setContextDocumentIds(prev => [...prev, mention.id]);
    }
    
    textareaRef.current?.focus();
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isStreaming || !conversationId) return;

    const messageId = `msg-${Date.now()}`;
    const userMessage: StreamMessage = {
      id: messageId,
      content: input,
      role: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const messageContent = input;
    const currentContextIds = [...contextDocumentIds];
    setInput('');
    setContextDocumentIds([]);

    try {
      // Save user message to backend
      await apiRequest("POST", `/api/conversations/${conversationId}/messages`, {
        role: 'user',
        content: messageContent,
        contextDocuments: currentContextIds
      });

      // Start streaming AI response
      setIsStreaming(true);
      const assistantMessageId = `assistant-${Date.now()}`;
      setStreamingMessageId(assistantMessageId);

      // Add empty assistant message for streaming
      const assistantMessage: StreamMessage = {
        id: assistantMessageId,
        content: '',
        role: 'assistant',
        timestamp: new Date(),
        isStreaming: true,
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Prepare messages for AI
      const chatMessages = [...messages, userMessage].map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Start streaming
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: chatMessages,
          contextDocumentIds: currentContextIds,
          conversationId: conversationId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start streaming');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let buffer = '';
        
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          // Decode chunk and add to buffer
          buffer += decoder.decode(value, { stream: true });
          
          // Process complete lines
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'token') {
                  // Update streaming message content
                  setMessages(prev => prev.map(msg => 
                    msg.id === assistantMessageId 
                      ? { ...msg, content: msg.content + data.content }
                      : msg
                  ));
                } else if (data.type === 'thinking') {
                  // Update thinking content
                  setMessages(prev => prev.map(msg => 
                    msg.id === assistantMessageId 
                      ? { ...msg, thinking: data.content }
                      : msg
                  ));
                } else if (data.type === 'function_call') {
                  // Add function call
                  setMessages(prev => prev.map(msg => 
                    msg.id === assistantMessageId 
                      ? { 
                          ...msg, 
                          functionCalls: [...(msg.functionCalls || []), data.content]
                        }
                      : msg
                  ));
                } else if (data.type === 'complete') {
                  // Mark as complete
                  setMessages(prev => prev.map(msg => 
                    msg.id === assistantMessageId 
                      ? { ...msg, isStreaming: false }
                      : msg
                  ));
                  setIsStreaming(false);
                  setStreamingMessageId(null);
                  
                  // Invalidate conversation messages to refresh
                  queryClient.invalidateQueries({ 
                    queryKey: ['/api/conversations', conversationId, 'messages'] 
                  });
                } else if (data.type === 'error') {
                  throw new Error(data.content);
                }
              } catch (parseError) {
                console.error('Error parsing streaming data:', parseError);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setIsStreaming(false);
      setStreamingMessageId(null);
      
      // Remove the empty assistant message on error
      setMessages(prev => prev.filter(msg => msg.id !== streamingMessageId));
      
      toast({
        title: '錯誤',
        description: '送出訊息失敗，請再試一次',
        variant: 'destructive'
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !mentionPosition) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && (
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary-foreground" />
                </div>
              </div>
            )}
            
            <div className={`max-w-2xl ${message.role === 'user' ? 'order-2' : ''}`}>
              {/* Thinking indicator */}
              {message.thinking && (
                <div className="mb-2">
                  <Card className="bg-muted/50 border-dashed">
                    <CardContent className="p-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Brain className="h-3 w-3" />
                        <span>思考中: {message.thinking}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Function calls */}
              {message.functionCalls && message.functionCalls.length > 0 && (
                <div className="mb-2 space-y-1">
                  {message.functionCalls.map((fc, index) => (
                    <Card key={index} className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                      <CardContent className="p-2">
                        <div className="flex items-center gap-2 text-xs">
                          <Settings className="h-3 w-3" />
                          <span className="font-medium">{fc.name}</span>
                          {fc.result && (
                            <Badge variant="secondary" className="text-xs">
                              完成
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {message.contextUsed && message.contextUsed.length > 0 && (
                <ContextIndicator contexts={message.contextUsed} className="mb-2" />
              )}
              
              <Card className={`${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card'}`}>
                <CardContent className="p-3">
                  <div className="text-sm whitespace-pre-wrap">
                    {message.content}
                    {message.isStreaming && (
                      <span className="inline-block w-2 h-4 bg-current animate-pulse ml-1">|</span>
                    )}
                  </div>
                  <div className="text-xs opacity-70 mt-2">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {message.role === 'user' && (
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                  <User className="h-4 w-4 text-secondary-foreground" />
                </div>
              </div>
            )}
          </div>
        ))}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t p-4">
        {/* Context indicators */}
        {contextDocumentIds.length > 0 && (
          <div className="mb-3">
            <div className="text-xs text-muted-foreground mb-2">Context documents:</div>
            <div className="flex flex-wrap gap-2">
              {contextDocumentIds.map((docId) => (
                <Badge 
                  key={docId} 
                  variant="secondary" 
                  className="text-xs"
                >
                  Document #{docId.slice(-4)}
                  <button
                    onClick={() => setContextDocumentIds(prev => prev.filter(id => id !== docId))}
                    className="ml-1 hover:text-destructive"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="輸入訊息... 使用 @ 來提及文件"
            className="w-full p-3 pr-12 min-h-[60px] max-h-32 resize-none border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="textarea-chat-input"
            disabled={isStreaming}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!input.trim() || isStreaming}
            size="icon"
            className="absolute right-2 bottom-2 h-8 w-8"
            data-testid="button-send-message"
          >
            {isStreaming ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Mention Search Dropdown */}
      <MentionSearch
        searchQuery={mentionQuery}
        position={mentionPosition}
        onMentionSelect={handleMentionSelect}
        onClose={() => setMentionPosition(null)}
      />
    </div>
  );
}