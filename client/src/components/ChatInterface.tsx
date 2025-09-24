import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Send, Bot, User, Sparkles, Brain, Settings, MoreVertical, Edit, Trash2, Check, X, Loader2, RefreshCw, Square, Search, FileText, User as UserIcon, Building, AlertTriangle, BookOpen, Users, ChevronDown, ChevronUp, AtSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MentionSearch } from "./MentionSearch";
import { ContextIndicator } from "./ContextIndicator";
import { AutoRetrievalDisplay } from "./AutoRetrievalDisplay";
import { MentionParser } from "./MentionParser";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "wouter";
import type { MentionItem, Message, Conversation, AppConfig } from "@shared/schema";

// Search Objects Results Display Component
function SearchObjectsResultsDisplay({ result }: { result: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  try {
    const parsedResult = JSON.parse(result);
    const { results = [], pagination, message } = parsedResult;
    const resultCount = results.length;
    
    if (resultCount === 0) {
      return (
        <div className="mt-1 text-xs text-muted-foreground">
          找到 0 個結果
        </div>
      );
    }
    
    const getTypeIcon = (type: string) => {
      switch (type) {
        case 'person': return UserIcon;
        case 'document': return FileText;
        case 'letter': return FileText;
        case 'entity': return Building;
        case 'issue': return AlertTriangle;
        case 'log': return BookOpen;
        case 'meeting': return Users;
        default: return FileText;
      }
    };
    
    const getTypeName = (type: string) => {
      switch (type) {
        case 'person': return '人員';
        case 'document': return '文件';
        case 'letter': return '信件';
        case 'entity': return '實體';
        case 'issue': return '議題';
        case 'log': return '日誌';
        case 'meeting': return '會議';
        default: return '項目';
      }
    };
    
    const getDetailPath = (type: string): string => {
      const typeMap: Record<string, string> = {
        'person': '/people',
        'document': '/documents',
        'letter': '/letters',
        'entity': '/entities',
        'issue': '/issues',
        'log': '/logs',
        'meeting': '/meetings'
      };
      return typeMap[type] || '/objects';
    };
    
    return (
      <div className="mt-2">
        <div className="flex items-center gap-2 mb-2">
          <Button
            variant="ghost"
            size="sm"
            className="p-0 h-auto text-xs font-medium text-muted-foreground hover:bg-transparent"
            onClick={() => setIsExpanded(!isExpanded)}
            data-testid="button-toggle-search-results"
          >
            搜尋結果 ({resultCount} 個)
            {isExpanded ? 
              <ChevronUp className="w-3 h-3 ml-1" /> : 
              <ChevronDown className="w-3 h-3 ml-1" />
            }
          </Button>
          
          {pagination && (
            <span className="text-xs text-muted-foreground">
              第 {pagination.page} 頁，共 {pagination.totalPages} 頁
            </span>
          )}
        </div>
        
        {isExpanded && (
          <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
            {results.map((item: any) => {
              const IconComponent = getTypeIcon(item.type);
              const similarity = item.similarity ? (item.similarity * 100).toFixed(0) : null;
              
              return (
                <Link key={item.id} href={`${getDetailPath(item.type)}/${item.id}`}>
                  <Badge 
                    variant="secondary" 
                    className="text-xs h-auto py-2 px-3 justify-start bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700 w-full hover-elevate cursor-pointer"
                    data-testid={`search-result-${item.id}`}
                  >
                    <IconComponent className="w-3 h-3 mr-2 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{item.name}</div>
                      {item.snippet && (
                        <div className="text-xs text-blue-600 dark:text-blue-400 truncate mt-1">
                          {item.snippet}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-blue-500">
                          {getTypeName(item.type)}
                        </span>
                        {item.date && (
                          <span className="text-xs text-blue-500">
                            {item.date}
                          </span>
                        )}
                        {similarity && (
                          <span className="text-xs text-blue-500">
                            相似度: {similarity}%
                          </span>
                        )}
                      </div>
                    </div>
                  </Badge>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  } catch (error) {
    // Fallback for non-JSON results
    return (
      <div className="mt-1 text-xs text-muted-foreground">
        {(() => {
          try {
            const countMatch = result.match(/Found (\d+) objects?/);
            if (countMatch) {
              return `找到 ${countMatch[1]} 個結果`;
            }
            if (result.includes('No objects found')) {
              return '找到 0 個結果';
            }
            return '搜索完成';
          } catch (error) {
            return '搜索完成';
          }
        })()}
      </div>
    );
  }
}

// Function Call Display Component
function FunctionCallDisplay({ functionCall }: { functionCall: { name: string; arguments: any; result?: any } }) {
  const getDisplayInfo = (fc: { name: string; arguments: any; result?: any }) => {
    switch (fc.name) {
      case 'searchObjects':
        const pageInfo = fc.arguments?.page ? ` (第${fc.arguments.page}頁)` : '';
        const pageSizeInfo = fc.arguments?.pageSize ? ` (每頁${fc.arguments.pageSize}項)` : '';
        return {
          icon: Search,
          text: `語意搜尋「${fc.arguments?.query || ''}」${fc.arguments?.type ? ` (類型: ${fc.arguments.type})` : ''}${pageInfo}${pageSizeInfo}`,
          color: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
        };
      case 'getObjectDetails':
        const id = String(fc.arguments?.documentId ?? fc.arguments?.id ?? fc.arguments?.objectId ?? '');
        // Extract readable name from id if it contains a colon (type:name format)
        const display = id.includes(':') ? id.split(':').slice(1).join(':') : (fc.arguments?.name ?? id);
        const displayName = display || fc.result?.name || '未知文件';
        return {
          icon: FileText,
          text: `查看文件詳情：${displayName}`,
          color: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
        };
      case 'createObject':
        return {
          icon: getTypeIcon(fc.arguments?.type),
          text: `建立新${getTypeName(fc.arguments?.type)}「${fc.arguments?.name || ''}」`,
          color: "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800"
        };
      case 'findRelevantExcerpts':
        return {
          icon: Search,
          text: `智能檢索「${fc.arguments?.query || ''}」的相關片段`,
          color: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800"
        };
      case 'updateObject':
        return {
          icon: Edit,
          text: `更新${getTypeName(fc.arguments?.type)}內容`,
          color: "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800"
        };
      default:
        return {
          icon: Settings,
          text: fc.name,
          color: "bg-gray-50 dark:bg-gray-950/30 border-gray-200 dark:border-gray-800"
        };
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'person': return UserIcon;
      case 'document': return FileText;
      case 'letter': return FileText;
      case 'entity': return Building;
      case 'issue': return AlertTriangle;
      case 'log': return BookOpen;
      case 'meeting': return Users;
      default: return FileText;
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'person': return '人員';
      case 'document': return '文件';
      case 'letter': return '信件';
      case 'entity': return '實體';
      case 'issue': return '議題';
      case 'log': return '日誌';
      case 'meeting': return '會議';
      default: return '項目';
    }
  };

  const displayInfo = getDisplayInfo(functionCall);
  const IconComponent = displayInfo.icon;

  return (
    <Card className={`${displayInfo.color} transition-all duration-200`}>
      <CardContent className="p-2">
        <div className="flex items-center gap-2 text-xs">
          <IconComponent className="h-3 w-3 flex-shrink-0" />
          <span className="font-medium flex-1">{displayInfo.text}</span>
          {functionCall.result && (
            <Badge variant="secondary" className="text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300">
              完成
            </Badge>
          )}
        </div>
        {functionCall.name === 'searchObjects' && functionCall.result && (
          <SearchObjectsResultsDisplay result={functionCall.result} />
        )}
      </CardContent>
    </Card>
  );
}

// Thinking Display Component with interleaved function calls
function ThinkingDisplay({ thinking, functionCalls }: { thinking: string; functionCalls?: Array<{name: string; arguments: any; result?: any}> }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!thinking || thinking.trim() === '') {
    return null;
  }

  const isLong = thinking.length > 200;
  const hasFunctionCalls = functionCalls && functionCalls.length > 0;

  // Parse thinking content to separate initial thinking from post-function-call thinking
  const thinkingParts = thinking.split('\n\n--- After Function Call Analysis ---\n');
  const initialThinking = thinkingParts[0] || '';
  const postFunctionThinking = thinkingParts[1] || '';

  return (
    <Card className="bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800 mb-2">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Brain className="h-3 w-3 flex-shrink-0 text-indigo-600 dark:text-indigo-400" />
          <span className="font-medium text-xs text-indigo-700 dark:text-indigo-300">AI 思考過程</span>
          <Badge variant="secondary" className="text-xs bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
            Thinking
          </Badge>
          {hasFunctionCalls && (
            <Badge variant="secondary" className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
              {functionCalls.length} 個函數調用
            </Badge>
          )}
          {(isLong || hasFunctionCalls) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-6 px-2 text-xs text-indigo-600 dark:text-indigo-400 ml-auto"
              data-testid="button-toggle-thinking"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  收起
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  展開思考
                </>
              )}
            </Button>
          )}
        </div>
        {isExpanded && (
          <div className="space-y-3">
            {/* Initial thinking */}
            {initialThinking && (
              <div className="text-xs text-indigo-600 dark:text-indigo-300 whitespace-pre-wrap">
                {initialThinking}
              </div>
            )}
            
            {/* Function calls */}
            {hasFunctionCalls && (
              <div className="space-y-2">
                {functionCalls.map((functionCall, index) => (
                  <div key={index} className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Settings className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                      <span className="font-medium text-xs text-blue-700 dark:text-blue-300">
                        {functionCall.name}
                      </span>
                      <Badge variant="secondary" className="text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300">
                        完成
                      </Badge>
                    </div>
                    {functionCall.name === 'searchObjects' && functionCall.result && (
                      <SearchObjectsResultsDisplay result={functionCall.result} />
                    )}
                    {functionCall.name !== 'searchObjects' && functionCall.result && (
                      <div className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                        <div className="font-medium">結果:</div>
                        <div className="whitespace-pre-wrap bg-white dark:bg-blue-950/50 rounded p-2 mt-1">
                          {functionCall.result}
                        </div>

                      </div>
                    )}

                  </div>
                ))}
              </div>
            )}
            
            {/* Post-function-call thinking */}
            {postFunctionThinking && (
              <div className="text-xs text-indigo-600 dark:text-indigo-300 whitespace-pre-wrap border-t border-indigo-200 dark:border-indigo-700 pt-3">
                {postFunctionThinking}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface StreamMessage {
  id: string;
  content: {
    text?: string;
    objects?: string[];
    metadata?: any;
    name?: string;
    arguments?: any;
    result?: any;
    functionCalls?: Array<{name: string; arguments: any; result?: any}>;
  };
  role: 'user' | 'assistant' | 'system';
  type: 'prompt' | 'auto_retrieval_context_object' | 'mention_context_object' | 'response' | 'thinking' | 'function_call';
  conversationGroupId?: string;
  timestamp: string;
  isStreaming?: boolean;
}

interface ChatInterfaceProps {
  conversationId?: string;
}

// Helper function to convert database message to StreamMessage
const convertDbMessageToStreamMessage = (dbMessage: any): StreamMessage => {
  return {
    id: dbMessage.id,
    content: typeof dbMessage.content === 'string' 
      ? { text: dbMessage.content }
      : {
          ...dbMessage.content,
          functionCalls: dbMessage.content?.functionCalls || undefined
        },
    role: dbMessage.role,
    type: dbMessage.type || 'prompt',
    conversationGroupId: dbMessage.conversationGroupId,
    timestamp: dbMessage.createdAt,
    isStreaming: false
  };
};

export function ChatInterface({ conversationId }: ChatInterfaceProps) {
  // Separate state for local messages and database messages
  const [localMessages, setLocalMessages] = useState<StreamMessage[]>([]);
  const [databaseMessages, setDatabaseMessages] = useState<StreamMessage[]>([]);
  const [input, setInput] = useState('');
  const [contextObjectIds, setContextObjectIds] = useState<string[]>([]);
  const [mentionPosition, setMentionPosition] = useState<{ x: number; y: number } | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(conversationId || null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<string>('');
  const [deleteConfirmMessageId, setDeleteConfirmMessageId] = useState<string | null>(null);
  const [regeneratingMessageId, setRegeneratingMessageId] = useState<string | null>(null);
  const [autoRetrievalEnabled, setAutoRetrievalEnabled] = useState<boolean>(true); // 本地自動檢索開關
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query settings to determine if auto-retrieval UI should be shown
  const { data: appConfig } = useQuery<AppConfig>({
    queryKey: ['/api/settings'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/settings');
      return response.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Only show auto-retrieval checkbox if global setting is enabled
  const showAutoRetrievalControl = appConfig?.retrieval?.autoRag === true;

  // Update currentConversationId when conversationId prop changes
  useEffect(() => {
    setCurrentConversationId(conversationId || null);
    // Clear local messages when switching conversations
    setLocalMessages([]);
    setDatabaseMessages([]);
  }, [conversationId]);



  // Get conversation data
  const { data: conversation } = useQuery<Conversation>({
    queryKey: ['/api/conversations', currentConversationId],
    enabled: !!currentConversationId,
  });

  // Load conversation messages
  const { data: conversationMessages = [] } = useQuery<Message[]>({
    queryKey: ['/api/conversations', currentConversationId, 'messages'],
    enabled: !!currentConversationId,
    staleTime: 0, // Force fresh data
    gcTime: 0, // Disable caching (replaces cacheTime in v5)
  });


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
    return merged.sort((a, b) => {
      return a.timestamp.localeCompare(b.timestamp);
    });
  };

  // Helper function to create grouped messages from consecutive messages of the same type
  const createGroupedMessage = (group: StreamMessage[]): StreamMessage | null => {
    if (group.length === 0) return null;
    
    const firstMsg = group[0];
    const msgType = firstMsg.type;
    const groupId = `grouped-${msgType}-${firstMsg.timestamp.replace(/[^0-9]/g, '')}`;
    
    if (msgType === 'thinking') {
      // Combine thinking texts
      const combinedText = group.map(m => m.content.text).join('');
      return {
        id: groupId,
        content: { text: combinedText },
        role: 'assistant',
        type: 'thinking',
        conversationGroupId: firstMsg.conversationGroupId,
        timestamp: firstMsg.timestamp,
        isStreaming: false
      };
    } else if (msgType === 'response') {
      // Combine response texts
      const combinedText = group.map(m => m.content.text).join('');
      return {
        id: groupId,
        content: { text: combinedText },
        role: 'assistant',
        type: 'response',
        conversationGroupId: firstMsg.conversationGroupId,
        timestamp: firstMsg.timestamp,
        isStreaming: false
      };
    } else if (msgType === 'function_call') {
      // For function calls, return individual messages (don't combine)
      return firstMsg;
    }
    
    return null;
  };

  // Compute the final messages to display with grouped thinking and function calls
  const messages = useMemo(() => {
    const convertedDbMessages = conversationMessages.map(convertDbMessageToStreamMessage);
    const allMessages = mergeMessages(convertedDbMessages, localMessages);
    
    // Group consecutive messages of the same type based on created_at order
    const groupedMessages: StreamMessage[] = [];
    let currentGroup: StreamMessage[] = [];
    let currentType = '';
    
    for (const message of allMessages) {
      // Check if this message should be grouped (thinking, response, function_call)
      if (message.type === 'thinking' || message.type === 'response' || message.type === 'function_call') {
        if (message.type !== currentType) {
          // Type changed, finish current group and start new one
          if (currentGroup.length > 0) {
            const groupedMessage = createGroupedMessage(currentGroup);
            if (groupedMessage) {
              groupedMessages.push(groupedMessage);
            }
          }
          currentType = message.type;
          currentGroup = [message];
        } else {
          // Same type, add to current group
          currentGroup.push(message);
        }
      } else {
        // Non-groupable message, finish current group and add message directly
        if (currentGroup.length > 0) {
          const groupedMessage = createGroupedMessage(currentGroup);
          if (groupedMessage) {
            groupedMessages.push(groupedMessage);
          }
          currentGroup = [];
          currentType = '';
        }
        groupedMessages.push(message);
      }
    }
    
    // Process the last group
    if (currentGroup.length > 0) {
      const groupedMessage = createGroupedMessage(currentGroup);
      if (groupedMessage) {
        groupedMessages.push(groupedMessage);
      }
    }
    
    return groupedMessages;
  }, [conversationMessages, localMessages, createGroupedMessage]);

  // Check if we should show the regenerate button
  const shouldShowRegenerateButton = useMemo(() => {
    if (isStreaming || messages.length === 0) {
      return false;
    }
    
    // Show if the last message is from a user
    const lastMessage = messages[messages.length - 1];
    return lastMessage && lastMessage.role === 'user';
  }, [messages, isStreaming]);

  // Create a Set of persistent message IDs for edit permission checking
  const persistedMessageIds = useMemo(() => 
    new Set(conversationMessages.map(msg => msg.id)), 
    [conversationMessages]
  );

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

  // Delete message mutation
  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      if (!currentConversationId) {
        throw new Error('No conversation ID available');
      }
      return apiRequest('DELETE', `/api/conversations/${currentConversationId}/messages/${messageId}`);
    },
    onSuccess: () => {
      // Close confirmation dialog and menu
      setDeleteConfirmMessageId(null);
      setOpenMenuId(null);
      
      // Invalidate and refetch messages
      queryClient.invalidateQueries({ 
        queryKey: ['/api/conversations', currentConversationId, 'messages'] 
      });
      // 新增：刷新對話列表
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      
      toast({
        title: '成功',
        description: '消息已刪除',
      });
    },
    onError: (error) => {
      console.error('Failed to delete message:', error);
      toast({
        title: '錯誤',
        description: '刪除消息失敗，請再試一次',
        variant: 'destructive'
      });
    }
  });

  // Edit message mutation with auto-regeneration
  const editMessageMutation = useMutation<
    { editedMessageId: string; [key: string]: any },
    Error,
    { messageId: string; content: string }
  >({
    mutationFn: async ({ messageId, content }: { messageId: string; content: string }) => {
      if (!currentConversationId) {
        throw new Error('No conversation ID available');
      }
      const response = await apiRequest("PATCH", `/api/conversations/${currentConversationId}/messages/${messageId}`, {
        content: content.trim()
      });
      const json = await response.json();
      return { ...json, editedMessageId: messageId };
    },
    onSuccess: async (data) => {
      const { editedMessageId } = data;
      
      // Exit edit mode
      setEditingMessageId(null);
      setEditedContent('');
      setOpenMenuId(null);
      
      // Invalidate and wait for cache refresh
      await queryClient.invalidateQueries({ 
        queryKey: ['/api/conversations', currentConversationId, 'messages'] 
      });
      
      toast({
        title: '成功',
        description: '消息已更新',
      });
      
      try {
        // Get the latest messages from database to ensure freshness
        const latestMessages = await queryClient.fetchQuery({
          queryKey: ['/api/conversations', currentConversationId, 'messages']
        }) as Message[];
        
        if (!latestMessages || latestMessages.length === 0) {
          console.warn('No messages available for regeneration');
          return;
        }
        
        // Convert to stream messages for processing
        const latestStreamMessages: StreamMessage[] = latestMessages.map(convertDbMessageToStreamMessage);
        
        // Find the edited message index
        const editedIndex = latestStreamMessages.findIndex(m => m.id === editedMessageId);
        
        if (editedIndex === -1) {
          console.warn('Edited message not found in latest messages');
          return;
        }
        
        // Only regenerate if the edited message was a user message
        const editedMessage = latestStreamMessages[editedIndex];
        if (editedMessage.role !== 'user') {
          console.log('Not regenerating - edited message is not a user message');
          return;
        }
        
        // Slice history up to and including the edited message
        const historySlice = latestStreamMessages.slice(0, editedIndex + 1);
        
        // Extract context objects from the edited message (if available)
        const contextObjectIds: string[] = [];
        // For now, we don't extract context from edited messages in the new structure
        // This can be enhanced later if needed
        
        // Auto-regenerate AI response after user message edit - apply dual control mechanism
        console.log('Starting automatic regeneration after edit...');
        const success = await startAssistantStream({
          historyMessages: historySlice,
          contextObjectIds,
          conversationId: currentConversationId!,
          enableAutoRetrieval: autoRetrievalEnabled && (appConfig?.retrieval?.autoRag === true)
        });
        
        if (!success) {
          toast({
            title: '自動重新生成失敗',
            description: '您可以手動點擊重新生成按鈕',
            variant: 'default'
          });
        }
      } catch (regenerationError) {
        console.error('Error during automatic regeneration:', regenerationError);
        toast({
          title: '自動重新生成失敗',
          description: '您可以手動點擊重新生成按鈕',
          variant: 'default'
        });
      }
    },
    onError: (error) => {
      console.error('Failed to edit message:', error);
      toast({
        title: '錯誤',
        description: '更新消息失敗，請再試一次',
        variant: 'destructive'
      });
    }
  });

  // Delete messages after specific message mutation (for regenerate functionality)
  const deleteMessagesAfterMutation = useMutation({
    mutationFn: async ({ conversationId, messageId }: { conversationId: string; messageId: string }) => {
      return apiRequest('DELETE', `/api/conversations/${conversationId}/messages/${messageId}/after`);
    },
    onSuccess: () => {
      // Invalidate and refetch messages
      queryClient.invalidateQueries({ 
        queryKey: ['/api/conversations', currentConversationId, 'messages'] 
      });
      // Refresh conversation list
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    },
    onError: (error) => {
      console.error('Failed to delete messages after specified message:', error);
      setRegeneratingMessageId(null);
      toast({
        title: '錯誤',
        description: '刪除後續消息失敗，請再試一次',
        variant: 'destructive'
      });
    }
  });

  // Convert database messages to stream messages without overriding local state
  useEffect(() => {
    if (conversationMessages.length > 0) {
      setDatabaseMessages(conversationMessages.map(convertDbMessageToStreamMessage));
    } else if (currentConversationId && databaseMessages.length === 0 && localMessages.length === 0) {
      // Add welcome message for new conversations only if no messages exist
      setDatabaseMessages([{
        id: 'welcome',
        content: { text: '你好！我是AI Context Manager。我可以幫助你管理文件、處理PDF並進行智能對話。你可以使用@提及功能來引用你的文件。' },
        role: 'assistant',
        type: 'response',
        timestamp: new Date().toISOString(),
        isStreaming: false,
      }]);
    }
  }, [conversationMessages, currentConversationId, databaseMessages.length, localMessages.length]);

  // Auto-scroll only during AI generation (streaming)
  useEffect(() => {
    if (isStreaming) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isStreaming]);

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
    
    // Add object ID to context
    if (!contextObjectIds.includes(mention.id)) {
      setContextObjectIds(prev => [...prev, mention.id]);
    }
    
    textareaRef.current?.focus();
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isStreaming) return;

    // Create conversation if none exists
    let activeConversationId = currentConversationId;
    if (!activeConversationId) {
      try {
        const newConversation = await createConversationMutation.mutateAsync();
        activeConversationId = newConversation.id;
      } catch (error) {
        console.error('Failed to create conversation:', error);
        return;
      }
    }

    if (!activeConversationId) {
      console.error('Still no conversation ID after creation attempt');
      return;
    }

    const messageContent = input;
    const currentContextIds = [...contextObjectIds];
    setInput('');
    setContextObjectIds([]);

    try {
      // Save user message to backend first
      await apiRequest("POST", `/api/conversations/${activeConversationId}/messages`, {
        role: 'user',
        type: 'prompt',
        content: { text: messageContent },
        autoRetrievalEnabled: autoRetrievalEnabled && (appConfig?.retrieval?.autoRag === true)
      });

      // Wait for the database to be updated and query to refresh
      await queryClient.invalidateQueries({ 
        queryKey: ['/api/conversations', activeConversationId, 'messages'] 
      });

      // Get updated messages from database
      const updatedMessages = await queryClient.fetchQuery({
        queryKey: ['/api/conversations', activeConversationId, 'messages']
      });

      // Start streaming AI response using the updated messages
      const allMessages = (updatedMessages as Message[]).map(convertDbMessageToStreamMessage);
      const success = await startAssistantStream({
        historyMessages: allMessages,
        contextObjectIds: currentContextIds,
        conversationId: activeConversationId,
        enableAutoRetrieval: autoRetrievalEnabled && (appConfig?.retrieval?.autoRag === true)
      });
      
      if (!success) {
        toast({
          title: '錯誤',
          description: 'AI回應生成失敗，請再試一次',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
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

  // Extract streaming logic into reusable function
  const startAssistantStream = useCallback(async ({ 
    historyMessages, 
    contextObjectIds = [], 
    conversationId,
    enableAutoRetrieval = true
  }: {
    historyMessages: StreamMessage[];
    contextObjectIds: string[];
    conversationId: string;
    enableAutoRetrieval?: boolean;
  }) => {
    if (isStreaming || !conversationId) {
      console.warn('Cannot start stream: already streaming or no conversation ID');
      return false;
    }

    try {
      // Set streaming state
      setIsStreaming(true);
      const assistantMessageId = `assistant-${Date.now()}`;
      setStreamingMessageId(assistantMessageId);

      // Add empty assistant message for streaming
      // Use a timestamp that ensures it appears after the last user message
      const lastUserMessage = historyMessages.filter(msg => msg.role === 'user').pop();
      const baseTimestamp = lastUserMessage ? lastUserMessage.timestamp : new Date().toISOString();
      const assistantTimestamp = new Date(new Date(baseTimestamp).getTime() + 1).toISOString();
      
      const assistantMessage: StreamMessage = {
        id: assistantMessageId,
        content: { text: '' },
        role: 'assistant',
        type: 'response',
        timestamp: assistantTimestamp,
        isStreaming: true,
      };
      setLocalMessages(prev => [...prev, assistantMessage]);

      // Prepare messages for AI
      const chatMessages = historyMessages.map(msg => ({
        role: msg.role,
        content: msg.content.text || ''
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
          contextObjectIds,
          conversationId,
          autoRetrievalEnabled: enableAutoRetrieval
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
          
          // Process complete lines - handle CRLF and empty lines
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || ''; // Keep incomplete line in buffer
          
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue; // Skip empty lines
            
            if (trimmedLine.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'token') {
                  // Update streaming message content immediately for better UX
                  setLocalMessages(prev => prev.map(msg => 
                    msg.id === assistantMessageId 
                      ? { 
                          ...msg, 
                          content: { 
                            ...msg.content, 
                            text: (msg.content.text || '') + data.content 
                          }
                        }
                      : msg
                  ));
                } else if (data.type === 'thinking') {
                  // Update thinking content immediately
                  setLocalMessages(prev => prev.map(msg => 
                    msg.id === assistantMessageId 
                      ? { 
                          ...msg, 
                          content: { 
                            ...msg.content, 
                            text: data.content 
                          },
                          type: 'thinking'
                        }
                      : msg
                  ));
                } else if (data.type === 'function_call') {
                  // Update function call content immediately
                  setLocalMessages(prev => prev.map(msg => 
                    msg.id === assistantMessageId 
                      ? { 
                          ...msg, 
                          content: {
                            ...msg.content,
                            name: data.content.name,
                            arguments: data.content.arguments,
                            result: data.content.result
                          },
                          type: 'function_call'
                        }
                      : msg
                  ));
                } else if (data.type === 'complete') {
                  // Mark as complete
                  setLocalMessages(prev => prev.map(msg => 
                    msg.id === assistantMessageId 
                      ? { ...msg, isStreaming: false }
                      : msg
                  ));
                  setIsStreaming(false);
                  setStreamingMessageId(null);
                  abortControllerRef.current = null;
                  
                  // Clear local messages after DB refresh to prevent flicker
                  // Wait for queries to invalidate and refresh first
                  const clearLocalMessages = async () => {
                    await Promise.all([
                      queryClient.invalidateQueries({ 
                        queryKey: ['/api/conversations', conversationId, 'messages'] 
                      }),
                      queryClient.invalidateQueries({
                        queryKey: ['/api/conversations']
                      })
                    ]);
                    setLocalMessages([]);
                  };
                  clearLocalMessages();
                  
                  return true; // Success
                } else if (data.type === 'error') {
                  throw new Error(data.content);
                }
              } catch (parseError) {
                console.error('Error parsing streaming data:', parseError);
              }
            } else if (trimmedLine.startsWith('event: ')) {
              // Handle event lines if needed in the future
              console.debug('Received event:', trimmedLine.slice(7));
            }
          }
        }
      }
      return true;
    } catch (error) {
      console.error('Error in streaming:', error);
      setIsStreaming(false);
      setStreamingMessageId(null);
      
      // Clean up abort controller
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // Remove the empty assistant message on error
      setLocalMessages(prev => prev.filter(msg => !msg.isStreaming));
      
      // Show error toast
      toast({
        title: '錯誤',
        description: '生成回應失敗，請再試一次',
        variant: 'destructive'
      });
      
      return false; // Failure
    }
  }, [isStreaming, setLocalMessages, queryClient, toast]);

  // Event handlers for message actions
  const handleEditMessage = (messageId: string) => {
    // Find the message to edit
    const messageToEdit = messages.find(msg => msg.id === messageId);
    if (!messageToEdit) return;
    
    // Don't allow editing streaming messages
    if (messageToEdit.isStreaming) {
      toast({
        title: '無法編輯',
        description: '無法編輯正在接收的消息',
        variant: 'destructive'
      });
      return;
    }
    
    // Enter edit mode
    setEditingMessageId(messageId);
    setEditedContent(messageToEdit.content.text || '');
    setOpenMenuId(null);
    
    // Focus the edit textarea after state update
    setTimeout(() => {
      editTextareaRef.current?.focus();
    }, 0);
  };

  const handleSaveEdit = () => {
    if (!editingMessageId || !editedContent.trim()) {
      toast({
        title: '錯誤',
        description: '消息內容不能為空',
        variant: 'destructive'
      });
      return;
    }
    
    editMessageMutation.mutate({
      messageId: editingMessageId,
      content: editedContent.trim()
    });
  };

  // Manual regeneration function
  const handleManualRegenerate = async () => {
    if (!currentConversationId || isStreaming) {
      return;
    }

    try {
      // Get the latest messages from database to ensure freshness
      const latestMessages = await queryClient.fetchQuery({
        queryKey: ['/api/conversations', currentConversationId, 'messages']
      }) as Message[];
      
      if (!latestMessages || latestMessages.length === 0) {
        toast({
          title: '無法重新生成',
          description: '沒有可用的對話歷史',
          variant: 'destructive'
        });
        return;
      }
      
      // Convert to stream messages
      const streamMessages: StreamMessage[] = latestMessages.map(convertDbMessageToStreamMessage);
      
      // Find the last user message and extract context
      let lastUserMessageIndex = -1;
      let contextObjectIds: string[] = [];
      
      for (let i = streamMessages.length - 1; i >= 0; i--) {
          if (streamMessages[i].role === 'user') {
            lastUserMessageIndex = i;
            // For now, we don't extract context objects in the new structure
            // This can be enhanced later if needed
            contextObjectIds = [];
            break;
          }
      }
      
      if (lastUserMessageIndex === -1) {
        toast({
          title: '無法重新生成',
          description: '沒有找到用戶消息',
          variant: 'destructive'
        });
        return;
      }
      
      // Use all messages up to and including the last user message
      const historyForRegeneration = streamMessages.slice(0, lastUserMessageIndex + 1);
      
      const success = await startAssistantStream({
        historyMessages: historyForRegeneration,
        contextObjectIds,
        conversationId: currentConversationId,
        enableAutoRetrieval: autoRetrievalEnabled && (appConfig?.retrieval?.autoRag === true) // 手動重新生成時套用雙重控制機制
      });
      
      if (!success) {
        toast({
          title: '重新生成失敗',
          description: '請檢查網絡連接後再試',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Manual regeneration error:', error);
      toast({
        title: '重新生成失敗',
        description: '請檢查網絡連接後再試',
        variant: 'destructive'
      });
    }
  };

  // Stop generation function
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
      setStreamingMessageId(null);
      
      // Clean up any streaming messages
      setLocalMessages(prev => prev.filter(msg => !msg.isStreaming));
      
      toast({
        title: '已停止生成',
        description: 'AI回應生成已中止',
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditedContent('');
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSaveEdit();
    }
  };

  const handleDeleteMessage = (messageId: string) => {
    // 防禦性檢查
    if (!persistedMessageIds.has(messageId)) {
      console.warn('Attempted to delete non-persisted message:', messageId);
      return;
    }
    
    // Find the message to check if it can be deleted
    const messageToDelete = messages.find(msg => msg.id === messageId);
    if (!messageToDelete) return;
    
    // Don't allow deleting streaming messages
    if (messageToDelete.isStreaming) {
      toast({
        title: '無法刪除',
        description: '無法刪除正在接收的消息',
        variant: 'destructive'
      });
      return;
    }
    
    // Show confirmation dialog
    setDeleteConfirmMessageId(messageId);
    setOpenMenuId(null);
  };

  const confirmDelete = () => {
    if (deleteConfirmMessageId) {
      deleteMessageMutation.mutate(deleteConfirmMessageId);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmMessageId(null);
  };

  // Handle regenerate from user message
  const handleRegenerateFromUser = async (messageId: string) => {
    if (!currentConversationId || regeneratingMessageId || isStreaming) return;
    
    // Find the user message
    const userMessage = messages.find(msg => msg.id === messageId);
    if (!userMessage || userMessage.role !== 'user') {
      toast({
        title: '錯誤',
        description: '只能從用戶消息重新生成',
        variant: 'destructive'
      });
      return;
    }
    
    setRegeneratingMessageId(messageId);
    setOpenMenuId(null);
    
    try {
      // Delete all messages after this user message
      await deleteMessagesAfterMutation.mutateAsync({
        conversationId: currentConversationId,
        messageId
      });
      
      // Wait for the cache to update
      await queryClient.invalidateQueries({ 
        queryKey: ['/api/conversations', currentConversationId, 'messages'] 
      });
      
      // Reprocess the user message to recreate context messages (mention_context_object, etc.)
      await apiRequest("POST", `/api/conversations/${currentConversationId}/reprocess-message`, {
        messageId,
        autoRetrievalEnabled: autoRetrievalEnabled && (appConfig?.retrieval?.autoRag === true)
      });
      
      // Wait for the cache to update again to include the new context messages
      await queryClient.invalidateQueries({ 
        queryKey: ['/api/conversations', currentConversationId, 'messages'] 
      });
      
      // Get updated messages and regenerate
      const updatedMessages = await queryClient.fetchQuery({
        queryKey: ['/api/conversations', currentConversationId, 'messages']
      });
      
      const formattedMessages: StreamMessage[] = (updatedMessages as Message[]).map(convertDbMessageToStreamMessage);
      
      // Extract context objects from the user message
      // For now, we don't extract context objects in the new structure
      const contextObjectIds: string[] = [];
      
      // Regenerate AI response - apply dual control mechanism
      const success = await startAssistantStream({
        historyMessages: formattedMessages,
        contextObjectIds,
        conversationId: currentConversationId,
        enableAutoRetrieval: autoRetrievalEnabled && (appConfig?.retrieval?.autoRag === true) // 從用戶消息重新生成時套用雙重控制機制
      });
      
      if (success) {
        toast({
          title: '成功',
          description: 'AI回應已重新生成',
        });
      }
    } catch (error) {
      console.error('Failed to regenerate from user message:', error);
      toast({
        title: '錯誤',
        description: '重新生成失敗，請再試一次',
        variant: 'destructive'
      });
    } finally {
      setRegeneratingMessageId(null);
    }
  };

  // Handle regenerate from assistant message
  const handleRegenerateFromAssistant = async (messageId: string) => {
    if (!currentConversationId || regeneratingMessageId || isStreaming) return;
    
    // Find the assistant message
    const assistantMessage = messages.find(msg => msg.id === messageId);
    if (!assistantMessage || assistantMessage.role !== 'assistant') {
      toast({
        title: '錯誤',
        description: '只能從AI消息重新生成',
        variant: 'destructive'
      });
      return;
    }
    
    setRegeneratingMessageId(messageId);
    setOpenMenuId(null);
    
    try {
      // First delete the assistant message itself and all messages after it
      await deleteMessageMutation.mutateAsync(messageId);
      
      // Wait for the cache to update
      await queryClient.invalidateQueries({ 
        queryKey: ['/api/conversations', currentConversationId, 'messages'] 
      });
      
      // Get updated messages
      const updatedMessages = await queryClient.fetchQuery({
        queryKey: ['/api/conversations', currentConversationId, 'messages']
      });
      
      const formattedMessages: StreamMessage[] = (updatedMessages as Message[]).map(convertDbMessageToStreamMessage);
      
      // Find the last user message in the updated conversation
      const lastUserMessageIndex = formattedMessages.map(m => m.role).lastIndexOf('user');
      
      if (lastUserMessageIndex === -1) {
        toast({
          title: '錯誤',
          description: '沒有找到用戶消息進行重新生成',
          variant: 'destructive'
        });
        return;
      }
      
      // Get messages up to and including the last user message
      const historyForRegeneration = formattedMessages.slice(0, lastUserMessageIndex + 1);
      const lastUserMessage = historyForRegeneration[lastUserMessageIndex];
      
        // Extract context objects from the last user message
        // For now, we don't extract context objects in the new structure
        const contextObjectIds: string[] = [];
      
      // Regenerate AI response - no auto retrieval needed for AI response regeneration
      const success = await startAssistantStream({
        historyMessages: historyForRegeneration,
        contextObjectIds,
        conversationId: currentConversationId,
        enableAutoRetrieval: false // AI Response 重新生成時不需要自動檢索
      });
      
      if (success) {
        toast({
          title: '成功',
          description: 'AI回應已重新生成',
        });
      }
    } catch (error) {
      console.error('Failed to regenerate from assistant message:', error);
      toast({
        title: '錯誤',
        description: '重新生成失敗，請再試一次',
        variant: 'destructive'
      });
    } finally {
      setRegeneratingMessageId(null);
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
              {/* Thinking display */}
              {message.type === 'thinking' && (
                <ThinkingDisplay 
                  thinking={message.content.text || ''} 
                  functionCalls={message.content.functionCalls}
                />
              )}

              {/* Function calls */}
              {message.type === 'function_call' && (
                <FunctionCallDisplay functionCall={{
                  name: message.content.name || '',
                  arguments: message.content.arguments || {},
                  result: message.content.result
                }} />
              )}

              {/* Context messages - show as subtle indicators */}
              {message.type === 'auto_retrieval_context_object' && (
                <div className="mb-2 p-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                    <Search className="h-3 w-3" />
                    <span>自動檢索了 {message.content.objects?.length || 0} 個相關文件</span>
                  </div>
                </div>
              )}

              {message.type === 'mention_context_object' && (
                <div className="mb-2 p-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                    <AtSign className="h-3 w-3" />
                    <span>引用了 {message.content.objects?.length || 0} 個提及的對象</span>
                  </div>
                </div>
              )}

              {/* Only show main message bubble for prompt and response types */}
              {(message.type === 'prompt' || message.type === 'response') && (
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
                    {editingMessageId === message.id ? (
                      // Edit mode UI
                      <div className="space-y-3" data-testid={`edit-form-${message.id}`}>
                        <Textarea
                          ref={editTextareaRef}
                          value={editedContent}
                          onChange={(e) => setEditedContent(e.target.value)}
                          onKeyDown={handleEditKeyDown}
                          className="min-h-[60px] resize-none border-0 text-sm"
                          placeholder="編輯消息內容... (Esc取消, Ctrl+Enter保存)"
                          data-testid={`textarea-edit-message-${message.id}`}
                          disabled={editMessageMutation.isPending}
                        />
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCancelEdit}
                            disabled={editMessageMutation.isPending || isStreaming}
                            data-testid={`button-cancel-edit-${message.id}`}
                          >
                            <X className="h-3 w-3 mr-1" />
                            取消
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSaveEdit}
                            disabled={editMessageMutation.isPending || !editedContent.trim() || isStreaming}
                            data-testid={`button-save-edit-${message.id}`}
                          >
                            {editMessageMutation.isPending ? (
                              <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin mr-1" />
                            ) : (
                              <Check className="h-3 w-3 mr-1" />
                            )}
                            {editMessageMutation.isPending ? '更新中...' : '保存'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // Normal display mode
                      <>
                        <div className="text-sm whitespace-pre-wrap">
                          <MentionParser 
                            text={message.content.text || ''} 
                            isAIResponse={message.role === 'assistant'} 
                          />
                          {message.isStreaming && (
                            <>
                              {!message.content.text && (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <div className="flex space-x-1">
                                    <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="w-2 h-2 bg-current rounded-full animate-bounce"></div>
                                  </div>
                                  <span className="text-xs ml-2">思考中...</span>
                                </div>
                              )}
                              {message.content.text && (
                                <span className="inline-block w-0.5 h-4 bg-current animate-pulse ml-1"></span>
                              )}
                            </>
                          )}
                        </div>
                        {message.timestamp && (
                          <div className="text-xs opacity-70 mt-2">
                            {new Date(message.timestamp).toLocaleTimeString('zh-TW', { hour12: true })}
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
                
                {/* Hover menu button */}
                {(hoveredMessageId === message.id || openMenuId === message.id) && 
                 persistedMessageIds.has(message.id) && 
                 !message.isStreaming && 
                 editingMessageId !== message.id && (
                  <div className="absolute top-2 right-2 z-10">
                    <DropdownMenu open={openMenuId === message.id} onOpenChange={(open) => setOpenMenuId(open ? message.id : null)}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-6 w-6 rounded-full ${
                            message.role === 'user' 
                              ? 'text-primary-foreground hover:bg-primary-foreground/20' 
                              : 'text-muted-foreground hover:bg-muted'
                          }`}
                          aria-label="更多動作"
                          data-testid={`button-message-menu-${message.id}`}
                        >
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent 
                        align="end"
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
                          onClick={() => {
                            if (message.role === 'user') {
                              handleRegenerateFromUser(message.id);
                            } else if (message.role === 'assistant') {
                              handleRegenerateFromAssistant(message.id);
                            }
                          }}
                          className="cursor-pointer"
                          disabled={regeneratingMessageId !== null || isStreaming}
                          data-testid={`button-regenerate-message-${message.id}`}
                        >
                          {regeneratingMessageId === message.id ? (
                            <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3 w-3 mr-2" />
                          )}
                          重新生成
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
              )}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmMessageId} onOpenChange={(open) => !open && cancelDelete()}>
        <AlertDialogContent data-testid="dialog-delete-message-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除消息</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>您確定要刪除這條消息嗎？這個動作無法撤回。</p>
              {(() => {
                const messageToDelete = deleteConfirmMessageId ? messages.find(msg => msg.id === deleteConfirmMessageId) : null;
                const shouldShowCascadeWarning = messageToDelete?.role === 'user';
                if (shouldShowCascadeWarning) {
                  return (
                    <p className="text-amber-600 dark:text-amber-400 font-medium">
                      ⚠️ 刪除用戶消息將會同時刪除後續的AI回應，因為它們需要重新生成。
                    </p>
                  );
                }
                return null;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={cancelDelete}
              disabled={deleteMessageMutation.isPending}
              data-testid="button-cancel-delete"
            >
              取消
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              disabled={deleteMessageMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMessageMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {deleteMessageMutation.isPending ? '刪除中...' : '確認刪除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Input Area */}
      <div className="border-t p-4">
        {/* Regeneration/Stop buttons */}
        {(shouldShowRegenerateButton || isStreaming) && (
          <div className="mb-3 flex justify-center">
            {isStreaming ? (
              <Button
                onClick={handleStopGeneration}
                variant="outline"
                size="sm"
                className="gap-2"
                data-testid="button-stop-generation"
              >
                <Square className="h-3 w-3" />
                停止生成
              </Button>
            ) : shouldShowRegenerateButton ? (
              <Button
                onClick={handleManualRegenerate}
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={isStreaming || editMessageMutation.isPending}
                data-testid="button-regenerate-response"
              >
                <RefreshCw className="h-3 w-3" />
                重新生成
              </Button>
            ) : null}
          </div>
        )}
        
        {/* Context indicators */}
        {contextObjectIds.length > 0 && (
          <div className="mb-3">
            <div className="text-xs text-muted-foreground mb-2">Context objects:</div>
            <div className="flex flex-wrap gap-2">
              {contextObjectIds.map((objId) => (
                <Badge 
                  key={objId} 
                  variant="secondary" 
                  className="text-xs"
                >
                  Object #{objId.slice(-4)}
                  <button
                    onClick={() => setContextObjectIds(prev => prev.filter(id => id !== objId))}
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
            {(isStreaming && !streamingMessageId) ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        {/* Auto-retrieval checkbox - only show if global setting is enabled */}
        {showAutoRetrievalControl && (
          <div className="mt-3 flex items-center space-x-2">
            <Checkbox
              id="auto-retrieval-enabled"
              checked={autoRetrievalEnabled}
              onCheckedChange={(checked) => setAutoRetrievalEnabled(!!checked)}
              data-testid="checkbox-auto-retrieval"
            />
            <label
              htmlFor="auto-retrieval-enabled"
              className="text-sm text-muted-foreground cursor-pointer select-none"
            >
              自動檢索相關物件
            </label>
          </div>
        )}
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
