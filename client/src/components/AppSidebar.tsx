import { FileText, MessageSquare, Settings, Plus, Trash2, MoreHorizontal, User } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import type { Conversation } from "@shared/schema";

export function AppSidebar() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  
  // Fetch conversations
  const { data: conversations = [], isLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  // Create new conversation
  const createConversationMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/conversations", { title: "AI Context Manager對話" });
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      navigate(`/conversations/${data.id}`);
    },
    onError: (error) => {
      toast({
        title: "錯誤",
        description: "無法創建新對話",
        variant: "destructive",
      });
    },
  });

  // Delete conversation
  const deleteConversationMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/conversations/${id}`),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      // Only navigate away if we deleted the current conversation
      if (currentConversationId === deletedId) {
        navigate('/conversations');
      }
      toast({
        title: "成功",
        description: "對話已刪除",
      });
    },
    onError: (error) => {
      toast({
        title: "錯誤",
        description: "無法刪除對話",
        variant: "destructive",
      });
    },
  });

  const handleCreateConversation = () => {
    createConversationMutation.mutate();
  };

  const handleDeleteConversation = (conversationId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    deleteConversationMutation.mutate(conversationId);
  };

  // Get current conversation ID from URL
  const currentConversationId = location.match(/^\/conversations\/([^\/]+)/)?.[1];

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-primary" />
          <span className="font-semibold text-sidebar-foreground">AI Context Manager</span>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="px-2">
        {/* New Conversation Button */}
        <div className="px-2 pb-2">
          <Button 
            onClick={handleCreateConversation}
            disabled={createConversationMutation.isPending}
            className="w-full justify-start gap-2"
            variant="outline"
            data-testid="button-new-conversation"
          >
            <Plus className="h-4 w-4" />
            新對話
          </Button>
        </div>

        {/* Recent Conversations */}
        <SidebarGroup>
          <SidebarGroupLabel>最近對話</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {isLoading ? (
                <div className="px-2 py-4 text-sm text-muted-foreground">載入中...</div>
              ) : conversations.length === 0 ? (
                <div className="px-2 py-4 text-sm text-muted-foreground">尚無對話</div>
              ) : (
                conversations.map((conversation) => (
                  <SidebarMenuItem key={conversation.id}>
                    <div className="group relative">
                      <SidebarMenuButton 
                        asChild 
                        data-testid={`link-conversation-${conversation.id}`}
                        className={currentConversationId === conversation.id ? "bg-sidebar-accent" : ""}
                      >
                        <Link href={`/conversations/${conversation.id}`}>
                          <MessageSquare className="h-4 w-4" />
                          <span className="truncate flex-1">{conversation.title}</span>
                        </Link>
                      </SidebarMenuButton>
                      
                      {/* Delete button */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 h-6 w-6"
                            data-testid={`button-conversation-menu-${conversation.id}`}
                          >
                            <MoreHorizontal className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => handleDeleteConversation(conversation.id, e)}
                            className="text-destructive"
                            data-testid={`button-delete-conversation-${conversation.id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            刪除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>導航</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild data-testid="link-documents">
                  <Link href="/documents">
                    <FileText className="h-4 w-4" />
                    <span>文件</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild data-testid="link-people">
                  <Link href="/people">
                    <User className="h-4 w-4" />
                    <span>人員</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild data-testid="link-settings">
                  <Link href="/settings">
                    <Settings className="h-4 w-4" />
                    <span>設定</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}