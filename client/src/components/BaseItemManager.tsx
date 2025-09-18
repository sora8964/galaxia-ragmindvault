import { useState, useCallback, ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { SimpleMentionSearch } from "@/components/SimpleMentionSearch";
import { Plus, Calendar, Search, FileText, User } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import type { Document } from "@shared/schema";

interface BaseItemForm {
  name: string;
  content: string;
  aliases: string[];
  date?: string | null; // For document type only
}

interface BaseItemManagerProps {
  itemType: "document" | "person" | "organization" | "issue" | "log";
  title: string;
  description: string;
  apiEndpoint: string;
  createButtonText: string;
  emptyStateTitle: string;
  emptyStateDescription: string;
  dialogTitle: string;
  dialogDescription: string;
  renderAdditionalButtons?: () => ReactNode;
  onItemClick?: (item: Document) => void;
  getIcon?: () => ReactNode;
}

export function BaseItemManager({
  itemType,
  title,
  description,
  apiEndpoint,
  createButtonText,
  emptyStateTitle,
  emptyStateDescription,
  dialogTitle,
  dialogDescription,
  renderAdditionalButtons,
  onItemClick,
  getIcon
}: BaseItemManagerProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newItemForm, setNewItemForm] = useState<BaseItemForm>({
    name: "",
    content: "",
    aliases: [],
    date: null
  });

  // Fetch items
  const { data: itemsData, isLoading } = useQuery({
    queryKey: [apiEndpoint, { type: itemType, search: searchQuery }],
    queryFn: async () => {
      const params = new URLSearchParams({ type: itemType });
      if (searchQuery) params.append("search", searchQuery);
      
      const response = await fetch(`${apiEndpoint}?${params}`);
      if (!response.ok) throw new Error(`Failed to fetch ${itemType}s`);
      return response.json();
    }
  });

  // Create new item mutation
  const createItemMutation = useMutation({
    mutationFn: async (data: BaseItemForm) => {
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          type: itemType,
          content: data.content,
          aliases: data.aliases,
          date: data.date,
          isFromOCR: false,
          hasBeenEdited: false,
          needsEmbedding: true
        })
      });
      
      if (!response.ok) throw new Error(`Failed to create ${itemType}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiEndpoint] });
      setIsCreating(false);
      setNewItemForm({ name: "", content: "", aliases: [], date: null });
      toast({
        title: `${itemType === "document" ? "文件" : itemType === "person" ? "人員" : itemType === "organization" ? "組織" : itemType === "issue" ? "議題" : "日誌"}已創建`,
        description: `新${itemType === "document" ? "文件" : itemType === "person" ? "人員" : itemType === "organization" ? "組織" : itemType === "issue" ? "議題" : "日誌"}已成功創建並正在生成 embedding`
      });
    },
    onError: () => {
      toast({
        title: "創建失敗",
        description: `無法創建${itemType === "document" ? "文件" : itemType === "person" ? "人員" : itemType === "organization" ? "組織" : itemType === "issue" ? "議題" : "日誌"}，請重試`,
        variant: "destructive"
      });
    }
  });

  const handleMentionAdded = (mention: any, alias?: string) => {
    const mentionText = alias ? `@[${mention.type}:${mention.name}|${alias}]` : `@[${mention.type}:${mention.name}]`;
    setNewItemForm(prev => ({
      ...prev,
      content: prev.content + mentionText
    }));
  };

  const handleItemClick = (item: Document) => {
    if (onItemClick) {
      onItemClick(item);
    } else {
      const routePath = itemType === "document" ? "/documents" : itemType === "person" ? "/people" : itemType === "organization" ? "/organizations" : itemType === "issue" ? "/issues" : "/logs";
      setLocation(`${routePath}/${item.id}`);
    }
  };

  const defaultIcon = itemType === "document" ? <FileText className="w-4 h-4" /> : <User className="w-4 h-4" />;
  const icon = getIcon ? getIcon() : defaultIcon;

  const items = itemsData?.documents || [];

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-muted-foreground">{description}</p>
          </div>
          <div className="flex gap-2">
            {/* Additional buttons (like upload for documents) */}
            {renderAdditionalButtons?.()}

            {/* Create new item dialog */}
            <Dialog open={isCreating} onOpenChange={setIsCreating}>
              <DialogTrigger asChild>
                <Button data-testid={`button-new-${itemType}`}>
                  <Plus className="w-4 h-4 mr-2" />
                  {createButtonText}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{dialogTitle}</DialogTitle>
                  <DialogDescription>{dialogDescription}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="item-name">
                      {itemType === "document" ? "文件名稱" : 
                       itemType === "person" ? "人員姓名" : 
                       itemType === "organization" ? "組織名稱" : 
                       itemType === "issue" ? "議題名稱" : "日誌名稱"}
                    </Label>
                    <Input
                      id="item-name"
                      value={newItemForm.name}
                      onChange={(e) => setNewItemForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder={itemType === "document" ? "輸入文件名稱" : 
                                  itemType === "person" ? "輸入人員姓名" : 
                                  itemType === "organization" ? "輸入組織名稱" : 
                                  itemType === "issue" ? "輸入議題名稱" : "輸入日誌名稱"}
                      data-testid={`input-${itemType}-name`}
                    />
                  </div>
                  <div>
                    <Label htmlFor="item-content">
                      {itemType === "document" ? "文件內容" : 
                       itemType === "person" ? "人員描述" : 
                       itemType === "organization" ? "組織描述" : 
                       itemType === "issue" ? "議題內容" : "日誌內容"}
                    </Label>
                    <div className="relative">
                      <Textarea
                        id="item-content"
                        value={newItemForm.content}
                        onChange={(e) => setNewItemForm(prev => ({ ...prev, content: e.target.value }))}
                        placeholder={itemType === "document" ? "輸入文件內容，可以使用 @ 來引用其他文件或人員" : 
                                    itemType === "person" ? "輸入人員描述，可以使用 @ 來引用其他文件或人員" : 
                                    itemType === "organization" ? "輸入組織描述，可以使用 @ 來引用其他文件或人員" : 
                                    itemType === "issue" ? "輸入議題內容，可以使用 @ 來引用其他文件或人員" : 
                                    "輸入日誌內容，可以使用 @ 來引用其他文件或人員"}
                        className="min-h-32"
                        data-testid={`textarea-${itemType}-content`}
                      />
                      <SimpleMentionSearch
                        onMentionSelect={handleMentionAdded}
                        className="absolute top-2 right-2"
                      />
                    </div>
                  </div>
                  {(itemType === "document" || itemType === "log") && (
                    <div>
                      <Label htmlFor="item-date">日期</Label>
                      <Input
                        id="item-date"
                        type="date"
                        value={newItemForm.date || ""}
                        onChange={(e) => setNewItemForm(prev => ({ ...prev, date: e.target.value || null }))}
                        placeholder="YYYY-MM-DD"
                        data-testid={`input-${itemType}-date`}
                      />
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsCreating(false)}
                      data-testid={`button-cancel-create-${itemType}`}
                    >
                      取消
                    </Button>
                    <Button
                      onClick={() => createItemMutation.mutate(newItemForm)}
                      disabled={!newItemForm.name.trim() || createItemMutation.isPending}
                      data-testid={`button-save-create-${itemType}`}
                    >
                      {createItemMutation.isPending ? "創建中..." : 
                       `創建${itemType === "document" ? "文件" : 
                               itemType === "person" ? "人員" : 
                               itemType === "organization" ? "組織" : 
                               itemType === "issue" ? "議題" : "日誌"}`}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder={`搜索${itemType === "document" ? "文件" : 
                                        itemType === "person" ? "人員" : 
                                        itemType === "organization" ? "組織" : 
                                        itemType === "issue" ? "議題" : "日誌"}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid={`input-search-${itemType}s`}
            />
          </div>
        </div>

        {/* Items grid */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            {icon}
            <h3 className="text-lg font-medium mb-2">
              {searchQuery ? `找不到相關${itemType === "document" ? "文件" : 
                                                      itemType === "person" ? "人員" : 
                                                      itemType === "organization" ? "組織" : 
                                                      itemType === "issue" ? "議題" : "日誌"}` : emptyStateTitle}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? "嘗試調整搜索條件" : emptyStateDescription}
            </p>
            {!searchQuery && (
              <div className="flex gap-2 justify-center">
                {renderAdditionalButtons?.()}
                <Button onClick={() => setIsCreating(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  {createButtonText}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items.map((item: Document) => (
              <Card
                key={item.id}
                className="hover-elevate cursor-pointer"
                onClick={() => handleItemClick(item)}
                data-testid={`card-${itemType}-${item.id}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base line-clamp-2">{item.name}</CardTitle>
                    <div className="flex gap-1 ml-2">
                      {item.isFromOCR && (
                        <Badge variant="secondary" className="text-xs">OCR</Badge>
                      )}
                      {item.hasEmbedding && (
                        <Badge variant="default" className="text-xs">已嵌入</Badge>
                      )}
                    </div>
                  </div>
                  <CardDescription className="flex items-center gap-2 text-xs">
                    {(item.type === "document" || item.type === "log") && item.date ? (
                      <>
                        <Calendar className="w-3 h-3" />
                        {item.date}
                      </>
                    ) : (
                      <span className="h-4"></span> // Empty space to maintain layout
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {item.content || "沒有內容"}
                  </p>
                  {item.aliases.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {item.aliases.slice(0, 3).map((alias, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {alias}
                        </Badge>
                      ))}
                      {item.aliases.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{item.aliases.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}