import { useState, useRef, useEffect, useMemo } from "react";
import { Send, Bot, User, Sparkles, Brain, Settings, MoreVertical, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  // Separate state for local messages and database messages
  const [localMessages, setLocalMessages] = useState<StreamMessage[]>([]);
  const [databaseMessages, setDatabaseMessages] = useState<StreamMessage[]>([]);
  const [input, setInput] = useState('');
  const [contextDocumentIds, setContextDocumentIds] = useState<string[]>([]);
  const [mentionPosition, setMentionPosition] = useState<{ x: number; y: number } | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(conversationId || null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Debug logging
  console.log('ChatInterface props:', { conversationId, currentConversationId });

  // Smart merge function to combine database messages with local messages
  const mergeMessages = (dbMessages: StreamMessage[], localMsgs: StreamMessage[]): StreamMessage[] => {
    // Create a map of database messages by ID for quick lookup
    const dbMessageMap = new Map(dbMessages.map(msg => [msg.id, msg]));
    
    // Create a combined list starting with database messages
    const merged: StreamMessage[] = [...dbMessages];
    
    // Add local messages that are not yet in the database
    localMsgs.forEach(localMsg => {
      if (!dbMessageMap.has(localMsg.id)) {
        merged.push(localMsg);
      }
    });
    
    // Sort by timestamp to maintain correct order
    return merged.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  };

  // Compute the final messages to display
  const messages = useMemo(() => {
    return mergeMessages(databaseMessages, localMessages);
  }, [databaseMessages, localMessages]);

  // Create new conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/conversations", {
        title: "新對話",
        isActive: true
      });
      return response.json();
    },
    onSuccess: (newConversation) => {
      console.log('Created new conversation:', newConversation);
      setCurrentConversationId(newConversation.id);
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    },
    onError: (error) => {
      console.error('Failed to create conversation:', error);
      toast({
        title: '錯誤',
        description: '建立對話失敗，請再試一次',
        variant: 'destructive'
      });
    }
  });

  // Get conversation data
  const { data: conversation } = useQuery<Conversation>({
    queryKey: ['/api/conversations', currentConversationId],
    enabled: !!currentConversationId,
  });

  // Load conversation messages
  const { data: conversationMessages = [] } = useQuery<DbMessage[]>({
    queryKey: ['/api/conversations', currentConversationId, 'messages'],
    enabled: !!currentConversationId,
  });

  // Convert database messages to stream messages without overriding local state
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
      setDatabaseMessages(formattedMessages);
    } else if (currentConversationId && databaseMessages.length === 0 && localMessages.length === 0) {
      // Add welcome message for new conversations only if no messages exist
      setDatabaseMessages([{
        id: 'welcome',
        content: '你好！我是AI Context Manager。我可以幫助你管理文件、處理PDF並進行智能對話。你可以使用@提及功能來引用你的文件。',
        role: 'assistant',
        timestamp: new Date(),
      }]);
    }
  }, [conversationMessages, currentConversationId, databaseMessages.length, localMessages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
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
    console.log('handleSendMessage called:', { 
      inputTrim: input.trim(), 
      isStreaming, 
      conversationId, 
      currentConversationId 
    });
    
    if (!input.trim() || isStreaming) return;

    // Create conversation if none exists
    let activeConversationId = currentConversationId;
    if (!activeConversationId) {
      console.log('No conversation ID, creating new conversation...');
      try {
        const newConversation = await createConversationMutation.mutateAsync();
        activeConversationId = newConversation.id;
        console.log('Created conversation:', activeConversationId);
      } catch (error) {
        console.error('Failed to create conversation:', error);
        return;
      }
    }

    if (!activeConversationId) {
      console.error('Still no conversation ID after creation attempt');
      return;
    }

    const messageId = `msg-${Date.now()}`;
    const userMessage: StreamMessage = {
      id: messageId,
      content: input,
      role: 'user',
      timestamp: new Date(),
    };

    // Immediately add user message to local messages for instant display
    setLocalMessages(prev => [...prev, userMessage]);
    const messageContent = input;
    const currentContextIds = [...contextDocumentIds];
    setInput('');
    setContextDocumentIds([]);

    try {
      // Save user message to backend
      console.log('Saving user message to backend:', activeConversationId);
      await apiRequest("POST", `/api/conversations/${activeConversationId}/messages`, {
        role: 'user',
        content: messageContent,
        contextDocuments: currentContextIds
      });

      // Start streaming AI response
      setIsStreaming(true);
      const assistantMessageId = `assistant-${Date.now()}`;
      setStreamingMessageId(assistantMessageId);

      // Add empty assistant message for streaming to local messages
      const assistantMessage: StreamMessage = {
        id: assistantMessageId,
        content: '',
        role: 'assistant',
        timestamp: new Date(),
        isStreaming: true,
      };
      setLocalMessages(prev => [...prev, assistantMessage]);

      // Prepare messages for AI - combine all messages for context
      const allMessages = mergeMessages(databaseMessages, [...localMessages, userMessage]);
      const chatMessages = allMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Create abort controller for this request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Start streaming
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: chatMessages,
          contextDocumentIds: currentContextIds,
          conversationId: activeConversationId
        }),
        signal: abortController.signal,
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
                  // Update streaming message content in local messages
                  setLocalMessages(prev => prev.map(msg => 
                    msg.id === assistantMessageId 
                      ? { ...msg, content: msg.content + data.content }
                      : msg
                  ));
                } else if (data.type === 'thinking') {
                  // Update thinking content in local messages
                  setLocalMessages(prev => prev.map(msg => 
                    msg.id === assistantMessageId 
                      ? { ...msg, thinking: data.content }
                      : msg
                  ));
                } else if (data.type === 'function_call') {
                  // Add function call to local messages
                  setLocalMessages(prev => prev.map(msg => 
                    msg.id === assistantMessageId 
                      ? { 
                          ...msg, 
                          functionCalls: [...(msg.functionCalls || []), data.content]
                        }
                      : msg
                  ));
                } else if (data.type === 'complete') {
                  // Mark as complete in local messages
                  setLocalMessages(prev => prev.map(msg => 
                    msg.id === assistantMessageId 
                      ? { ...msg, isStreaming: false }
                      : msg
                  ));
                  setIsStreaming(false);
                  setStreamingMessageId(null);
                  abortControllerRef.current = null;
                  
                  // Clear local messages after successful completion
                  // The database will be updated and the messages will reload from there
                  setTimeout(() => {
                    setLocalMessages([]);
                  }, 100);
                  
                  // Invalidate conversation messages and conversations list
                  queryClient.invalidateQueries({ 
                    queryKey: ['/api/conversations', activeConversationId, 'messages'] 
                  });
                  queryClient.invalidateQueries({
                    queryKey: ['/api/conversations']
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
      
      // Clean up abort controller
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // Remove the empty assistant message on error from local messages
      if (streamingMessageId) {
        setLocalMessages(prev => prev.filter(msg => msg.id !== streamingMessageId));
      }
      
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

  // Event handlers for message actions (empty for now, will be implemented later)
  const handleEditMessage = (messageId: string) => {
    // TODO: Implement edit functionality
    console.log('Edit message:', messageId);
    setOpenMenuId(null);
  };

  const handleDeleteMessage = (messageId: string) => {
    // TODO: Implement delete functionality
    console.log('Delete message:', messageId);
    setOpenMenuId(null);
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
              
              <div 
                className="relative group"
                onMouseEnter={() => setHoveredMessageId(message.id)}
                onMouseLeave={() => {
                  if (openMenuId !== message.id) {
                    setHoveredMessageId(null);
                  }
                }}
                data-testid={`message-container-${message.id}`}
              >
                <Card className={`${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card'}`}>
                  <CardContent className="p-3">
                    <div className="text-sm whitespace-pre-wrap">
                      {message.content}
                      {message.isStreaming && (
                        <>
                          {!message.content && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <div className="flex space-x-1">
                                <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                <div className="w-2 h-2 bg-current rounded-full animate-bounce"></div>
                              </div>
                              <span className="text-xs ml-2">思考中...</span>
                            </div>
                          )}
                          {message.content && (
                            <span className="inline-block w-0.5 h-4 bg-current animate-pulse ml-1"></span>
                          )}
                        </>
                      )}
                    </div>
                    <div className="text-xs opacity-70 mt-2">
                      {message.timestamp.toLocaleTimeString()}
                    </div>
                  </CardContent>
                </Card>
                
                {/* Hover menu button */}
                {(hoveredMessageId === message.id || openMenuId === message.id) && !message.isStreaming && (
                  <div className={`absolute top-2 ${message.role === 'user' ? 'left-2' : 'right-2'} z-10`}>
                    <DropdownMenu open={openMenuId === message.id} onOpenChange={(open) => setOpenMenuId(open ? message.id : null)}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-6 w-6 rounded-full ${
                            message.role === 'user' 
                              ? 'text-primary-foreground' 
                              : 'text-muted-foreground'
                          }`}
                          aria-label="更多動作"
                          data-testid={`button-message-menu-${message.id}`}
                        >
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent 
                        align={message.role === 'user' ? 'start' : 'end'}
                        className="w-32"
                        data-testid={`menu-message-actions-${message.id}`}
                      >
                        <DropdownMenuItem 
                          onClick={() => handleEditMessage(message.id)}
                          className="cursor-pointer"
                          data-testid={`button-edit-message-${message.id}`}
                        >
                          <Edit className="h-3 w-3 mr-2" />
                          編輯
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDeleteMessage(message.id)}
                          className="cursor-pointer text-destructive focus:text-destructive"
                          data-testid={`button-delete-message-${message.id}`}
                        >
                          <Trash2 className="h-3 w-3 mr-2" />
                          刪除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
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
            disabled={!input.trim() || isStreaming || createConversationMutation.isPending}
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