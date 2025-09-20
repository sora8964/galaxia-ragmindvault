import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { SimpleMentionSearch } from "@/components/SimpleMentionSearch";
import { X, Plus, ArrowLeft } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import type { DocumentType } from "@shared/schema";

interface CreateItemForm {
  name: string;
  content: string;
  aliases: string[];
  date?: string | null;
}

interface CreateItemPageProps {
  itemType: DocumentType;
  title: string;
  description: string;
}

export function CreateItemPage({ itemType, title, description }: CreateItemPageProps) {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [form, setForm] = useState<CreateItemForm>({
    name: "",
    content: "",
    aliases: [],
    date: null
  });

  // 從 URL 參數中獲取預填充的名稱
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const nameFromUrl = urlParams.get('name');
    if (nameFromUrl) {
      setForm(prev => ({
        ...prev,
        name: decodeURIComponent(nameFromUrl)
      }));
    }
  }, []);

  // 創建項目的 mutation
  const createItemMutation = useMutation({
    mutationFn: async (data: CreateItemForm) => {
      const response = await fetch("/api/objects", {
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
    onSuccess: (data) => {
      toast({
        title: "創建成功",
        description: `${getItemTypeLabel(itemType)} "${form.name}" 已成功創建`,
      });
      
      // 重置表單
      setForm({
        name: "",
        content: "",
        aliases: [],
        date: null
      });
      
      // 使緩存失效
      queryClient.invalidateQueries({ queryKey: ["/api/objects"] });
      
      // 跳轉到新創建的項目詳情頁面
      setLocation(`/${itemType}/${data.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "創建失敗",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.content.trim()) {
      toast({
        title: "表單不完整",
        description: "請填寫名稱和內容",
        variant: "destructive"
      });
      return;
    }
    createItemMutation.mutate(form);
  };

  const handleAddAlias = (alias: string) => {
    if (alias.trim() && !form.aliases.includes(alias.trim())) {
      setForm(prev => ({
        ...prev,
        aliases: [...prev.aliases, alias.trim()]
      }));
    }
  };

  const handleRemoveAlias = (aliasToRemove: string) => {
    setForm(prev => ({
      ...prev,
      aliases: prev.aliases.filter(alias => alias !== aliasToRemove)
    }));
  };

  const handleBack = () => {
    setLocation(`/${itemType}s`);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleBack}
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回列表
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-muted-foreground">{description}</p>
          </div>
        </div>

        {/* 創建表單 */}
        <Card>
          <CardHeader>
            <CardTitle>新增 {getItemTypeLabel(itemType)}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 名稱欄位 */}
              <div>
                <Label htmlFor="item-name">
                  {getNameLabel(itemType)} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="item-name"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={getNamePlaceholder(itemType)}
                  data-testid={`input-${itemType}-name`}
                  required
                />
              </div>

              {/* 日期欄位（僅文檔類型） */}
              {itemType === "document" && (
                <div>
                  <Label htmlFor="item-date">文檔日期</Label>
                  <Input
                    id="item-date"
                    type="date"
                    value={form.date || ""}
                    onChange={(e) => setForm(prev => ({ ...prev, date: e.target.value || null }))}
                    data-testid="input-document-date"
                  />
                </div>
              )}

              {/* 內容欄位 */}
              <div>
                <Label htmlFor="item-content">
                  {getContentLabel(itemType)} <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Textarea
                    id="item-content"
                    value={form.content}
                    onChange={(e) => setForm(prev => ({ ...prev, content: e.target.value }))}
                    placeholder={getContentPlaceholder(itemType)}
                    className="min-h-32"
                    data-testid={`textarea-${itemType}-content`}
                    required
                  />
                  <SimpleMentionSearch
                    onMentionSelect={(mention, alias) => {
                      const displayName = alias || mention.name;
                      const mentionText = `@[${mention.type}:${mention.name}${alias ? '|' + alias : ''}]`;
                      setForm(prev => ({ ...prev, content: prev.content + mentionText }));
                    }}
                    className="absolute bottom-2 right-2"
                  />
                </div>
              </div>

              {/* 別名欄位 */}
              <div>
                <Label htmlFor="aliases-input">別名 (可選)</Label>
                <div className="space-y-2">
                  {form.aliases.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {form.aliases.map((alias, index) => (
                        <Badge key={index} variant="secondary" className="text-sm">
                          {alias}
                          <X
                            className="w-3 h-3 ml-1 cursor-pointer hover:text-destructive"
                            onClick={() => handleRemoveAlias(alias)}
                          />
                        </Badge>
                      ))}
                    </div>
                  )}
                  <Input
                    id="aliases-input"
                    placeholder="輸入別名並按 Enter 添加"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const target = e.target as HTMLInputElement;
                        handleAddAlias(target.value);
                        target.value = "";
                      }
                    }}
                    data-testid="input-aliases"
                  />
                  <p className="text-xs text-muted-foreground">按 Enter 鍵添加別名</p>
                </div>
              </div>

              {/* 提交按鈕 */}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={createItemMutation.isPending}
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  disabled={createItemMutation.isPending || !form.name.trim() || !form.content.trim()}
                  data-testid={`button-create-${itemType}`}
                >
                  {createItemMutation.isPending && (
                    <div className="w-4 h-4 border border-current border-t-transparent rounded-full animate-spin mr-2" />
                  )}
                  <Plus className="w-4 h-4 mr-2" />
                  {createItemMutation.isPending ? '創建中...' : `創建 ${getItemTypeLabel(itemType)}`}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// 輔助函數
function getItemTypeLabel(itemType: DocumentType): string {
  const labels = {
    person: "人員",
    document: "文檔",
    organization: "組織",
    issue: "議題",
    log: "日誌",
    meeting: "會議"
  };
  return labels[itemType];
}

function getNameLabel(itemType: DocumentType): string {
  const labels = {
    person: "人員姓名",
    document: "文檔名稱", 
    organization: "組織名稱",
    issue: "議題名稱",
    log: "日誌名稱",
    meeting: "會議名稱"
  };
  return labels[itemType];
}

function getNamePlaceholder(itemType: DocumentType): string {
  const placeholders = {
    person: "輸入人員姓名",
    document: "輸入文檔名稱",
    organization: "輸入組織名稱", 
    issue: "輸入議題名稱",
    log: "輸入日誌名稱",
    meeting: "輸入會議名稱"
  };
  return placeholders[itemType];
}

function getContentLabel(itemType: DocumentType): string {
  const labels = {
    person: "人員描述",
    document: "文檔內容",
    organization: "組織描述", 
    issue: "議題內容",
    log: "日誌內容",
    meeting: "會議內容"
  };
  return labels[itemType];
}

function getContentPlaceholder(itemType: DocumentType): string {
  const placeholders = {
    person: "輸入人員描述，可以使用 @ 來引用其他文檔或人員",
    document: "輸入文檔內容，可以使用 @ 來引用其他文檔或人員",
    organization: "輸入組織描述，可以使用 @ 來引用其他文檔或人員",
    issue: "輸入議題內容，可以使用 @ 來引用其他文檔或人員", 
    log: "輸入日誌內容，可以使用 @ 來引用其他文檔或人員",
    meeting: "輸入會議內容，可以使用 @ 來引用其他文檔或人員"
  };
  return placeholders[itemType];
}

export default CreateItemPage;