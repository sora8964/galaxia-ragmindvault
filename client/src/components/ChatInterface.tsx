import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MentionSearch } from "./MentionSearch";
import { ContextIndicator } from "./ContextIndicator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { MentionItem } from "@shared/schema";

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  contextUsed?: Array<{ id: string; name: string; type: 'person' | 'document' }>;
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [contextDocumentIds, setContextDocumentIds] = useState<string[]>([]);
  const [mentionPosition, setMentionPosition] = useState<{ x: number; y: number } | null>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Create a conversation on component mount
  const { data: conversation } = useQuery({
    queryKey: ['/api/conversations', 'default'],
    queryFn: async () => {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'AI Context Manager對話' })
      });
      if (!response.ok) throw new Error('Failed to create conversation');
      return response.json();
    }
  });

  // Load conversation messages
  const { data: conversationMessages = [] } = useQuery({
    queryKey: ['/api/conversations', conversation?.id, 'messages'],
    enabled: !!conversation?.id,
    queryFn: async () => {
      const response = await fetch(`/api/conversations/${conversation.id}/messages`);
      if (!response.ok) throw new Error('Failed to load messages');
      return response.json();
    }
  });

  // Chat mutation with function calling
  const chatMutation = useMutation({
    mutationFn: async ({ messages, contextDocumentIds }: { messages: any[], contextDocumentIds: string[] }) => {
      const response = await fetch('/api/chat/functions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, contextDocumentIds })
      });
      if (!response.ok) throw new Error('Failed to send message');
      return response.json();
    },
    onSuccess: (data) => {
      const assistantMessage: Message = {
        id: `msg-${Date.now()}`,
        content: data.response,
        role: 'assistant',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    },
    onError: (error) => {
      toast({
        title: '錯誤',
        description: '送出訊息失敗，請再試一次',
        variant: 'destructive'
      });
      console.error('Chat error:', error);
    }
  });

  // Update messages when conversation messages load
  useEffect(() => {
    if (conversationMessages.length > 0) {
      const formattedMessages = conversationMessages.map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        role: msg.role,
        timestamp: new Date(msg.createdAt),
      }));
      setMessages(formattedMessages);
    } else if (conversation?.id && messages.length === 0) {
      // Add welcome message for new conversations only if no messages exist
      setMessages([{
        id: 'welcome',
        content: '你好！我是AI Context Manager。我可以幫助你管理文件、處理PDF並進行智能對話。你可以使用@提及功能來引用你的文件。',
        role: 'assistant',
        timestamp: new Date(),
      }]);
    }
  }, [conversationMessages, conversation?.id, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    if (!input.trim() || chatMutation.isPending || !conversation?.id) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const messageContent = input;
    const currentContextIds = [...contextDocumentIds];
    setInput('');
    setContextDocumentIds([]);

    console.log('Message sent:', messageContent);

    // Save user message to backend and get AI response
    try {
      // Save user message
      await fetch(`/api/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'user',
          content: messageContent,
          contextDocuments: currentContextIds
        })
      });

      // Get AI response
      const chatMessages = [...messages, userMessage].map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      chatMutation.mutate({
        messages: chatMessages,
        contextDocumentIds: currentContextIds
      });
    } catch (error) {
      toast({
        title: '錯誤',
        description: '送出訊息失敗',
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
              {message.contextUsed && message.contextUsed.length > 0 && (
                <ContextIndicator contexts={message.contextUsed} className="mb-2" />
              )}
              
              <Card className={`${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card'}`}>
                <CardContent className="p-3">
                  <div className="text-sm whitespace-pre-wrap">{message.content}</div>
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
        
        {chatMutation.isPending && (
          <div className="flex gap-3 justify-start">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary-foreground animate-pulse" />
              </div>
            </div>
            <Card className="bg-card">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span>AI正在思考...</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
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
          />
          <Button
            onClick={handleSendMessage}
            disabled={!input.trim() || chatMutation.isPending}
            size="icon"
            className="absolute right-2 bottom-2 h-8 w-8"
            data-testid="button-send-message"
          >
            {chatMutation.isPending ? (
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