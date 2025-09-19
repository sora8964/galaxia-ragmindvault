import { FileText, MessageSquare, Settings, Plus, Trash2, MoreHorizontal, User, Building, AlertTriangle, Clock, Edit2 } from "lucide-react";
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
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import type { Conversation } from "@shared/schema";

export function AppSidebar() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const { isMobile, setOpenMobile } = useSidebar();
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [editingConversation, setEditingConversation] = useState<{id: string, title: string} | null>(null);
  const [newTitle, setNewTitle] = useState("");
  
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

  // Rename conversation
  const renameConversationMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => 
      apiRequest("PUT", `/api/conversations/${id}`, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setIsRenameDialogOpen(false);
      setEditingConversation(null);
      setNewTitle("");
      toast({
        title: "成功",
        description: "對話已重命名",
      });
    },
    onError: (error) => {
      toast({
        title: "錯誤",
        description: "無法重命名對話",
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

  const handleRenameConversation = (conversation: { id: string; title: string }, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setEditingConversation(conversation);
    setNewTitle(conversation.title);
    setIsRenameDialogOpen(true);
  };

  const handleDeleteConversation = (conversationId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    deleteConversationMutation.mutate(conversationId);
  };

  const handleConfirmRename = () => {
    if (editingConversation && newTitle.trim()) {
      renameConversationMutation.mutate({
        id: editingConversation.id,
        title: newTitle.trim(),
      });
    }
  };

  const handleCancelRename = () => {
    setIsRenameDialogOpen(false);
    setEditingConversation(null);
    setNewTitle("");
  };

  // Get current conversation ID from URL
  const currentConversationId = location.match(/^\/conversations\/([^\/]+)/)?.[1];

  // Handle navigation and close sidebar on mobile
  const handleNavigation = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

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
                        <Link href={`/conversations/${conversation.id}`} onClick={handleNavigation}>
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
                            onClick={(e) => handleRenameConversation(conversation, e)}
                            data-testid={`button-rename-conversation-${conversation.id}`}
                          >
                            <Edit2 className="h-4 w-4 mr-2" />
                            重命名
                          </DropdownMenuItem>
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
                  <Link href="/documents" onClick={handleNavigation}>
                    <FileText className="h-4 w-4" />
                    <span>文件</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild data-testid="link-people">
                  <Link href="/people" onClick={handleNavigation}>
                    <User className="h-4 w-4" />
                    <span>人員</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild data-testid="link-organizations">
                  <Link href="/organizations" onClick={handleNavigation}>
                    <Building className="h-4 w-4" />
                    <span>組織</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild data-testid="link-issues">
                  <Link href="/issues" onClick={handleNavigation}>
                    <AlertTriangle className="h-4 w-4" />
                    <span>議題</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild data-testid="link-logs">
                  <Link href="/logs" onClick={handleNavigation}>
                    <Clock className="h-4 w-4" />
                    <span>日誌</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild data-testid="link-settings">
                  <Link href="/settings" onClick={handleNavigation}>
                    <Settings className="h-4 w-4" />
                    <span>設定</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      {/* Rename Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>重命名對話</DialogTitle>
            <DialogDescription>
              為對話輸入新的標題
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right">
                標題
              </Label>
              <Input
                id="title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleConfirmRename();
                  }
                  if (e.key === 'Escape') {
                    handleCancelRename();
                  }
                }}
                className="col-span-3"
                placeholder="輸入對話標題"
                data-testid="input-conversation-title"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelRename}
              data-testid="button-cancel-rename"
            >
              取消
            </Button>
            <Button
              onClick={handleConfirmRename}
              disabled={!newTitle.trim() || renameConversationMutation.isPending}
              data-testid="button-confirm-rename"
            >
              {renameConversationMutation.isPending ? "重命名中..." : "確認"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}