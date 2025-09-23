import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MentionSearch } from "@/components/MentionSearch";
import { X, Plus, ArrowLeft } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import type { ObjectType, MentionItem } from "@shared/schema";

interface CreateItemForm {
  name: string;
  content: string;
  aliases: string[];
  date?: string | null;
}

interface CreateItemPageProps {
  itemType: ObjectType;
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
  const [mentionPosition, setMentionPosition] = useState<{ x: number; y: number } | null>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // 處理點擊外部關閉 mention 下拉選單
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      // Don't close if clicking inside the mention dropdown or textarea
      if (!target.closest('[data-mention-dropdown]') && !target.closest('textarea')) {
        setMentionPosition(null);
      }
    };

    if (mentionPosition) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [mentionPosition]);

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

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setForm(prev => ({ ...prev, content: value }));

    // Check for @ mention trigger with more flexible conditions
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    
    if (atIndex !== -1) {
      // Check if @ is at start or preceded by whitespace/punctuation (not word characters)
      const charBeforeAt = atIndex === 0 ? '' : textBeforeCursor[atIndex - 1];
      const isValidTrigger = atIndex === 0 || /\s|[^\w]/.test(charBeforeAt);
      
      if (isValidTrigger) {
        const mentionText = textBeforeCursor.slice(atIndex + 1);
        // Allow mention if no space in the token and cursor is right after the potential mention
        if (!mentionText.includes(' ') && cursorPosition === textBeforeCursor.length) {
          setMentionQuery(mentionText);
          
          // Calculate position for mention dropdown (improved positioning)
          if (textareaRef.current) {
            const rect = textareaRef.current.getBoundingClientRect();
            const scrollTop = textareaRef.current.scrollTop;
            // Position dropdown near the textarea, accounting for scroll
            setMentionPosition({
              x: rect.left + 10,
              y: rect.top + 40 - scrollTop
            });
          }
        } else {
          setMentionPosition(null);
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
    const textBeforeCursor = form.content.slice(0, cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    
    const mentionSyntax = `@[${mention.type}:${mention.name}${alias ? `|${alias}` : ''}]`;
    
    const newContent = 
      form.content.slice(0, atIndex) + 
      mentionSyntax + 
      form.content.slice(cursorPosition);
    
    setForm(prev => ({ ...prev, content: newContent }));
    setMentionPosition(null);
    
    // Focus back to textarea
    setTimeout(() => {
      textareaRef.current?.focus();
      const newCursorPos = atIndex + mentionSyntax.length;
      textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // Handle textarea blur to close mention dropdown
  const handleTextareaBlur = (e: React.FocusEvent) => {
    // Small delay to allow clicking on mention dropdown
    setTimeout(() => {
      setMentionPosition(null);
    }, 150);
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
                    ref={textareaRef}
                    id="item-content"
                    value={form.content}
                    onChange={handleContentChange}
                    onBlur={handleTextareaBlur}
                    placeholder={getContentPlaceholder(itemType)}
                    className="min-h-32"
                    data-testid={`textarea-${itemType}-content`}
                    required
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
      
      <MentionSearch
        searchQuery={mentionQuery}
        position={mentionPosition}
        onMentionSelect={handleMentionSelect}
        onClose={() => setMentionPosition(null)}
      />
    </div>
  );
}

// 輔助函數
function getItemTypeLabel(itemType: ObjectType): string {
  const labels = {
    person: "人員",
    document: "文檔",
    entity: "組織",
    issue: "議題",
    log: "日誌",
    meeting: "會議"
  };
  return labels[itemType];
}

function getNameLabel(itemType: ObjectType): string {
  const labels = {
    person: "人員姓名",
    document: "文檔名稱", 
    entity: "組織名稱",
    issue: "議題名稱",
    log: "日誌名稱",
    meeting: "會議名稱"
  };
  return labels[itemType];
}

function getNamePlaceholder(itemType: ObjectType): string {
  const placeholders = {
    person: "輸入人員姓名",
    document: "輸入文檔名稱",
    entity: "輸入組織名稱", 
    issue: "輸入議題名稱",
    log: "輸入日誌名稱",
    meeting: "輸入會議名稱"
  };
  return placeholders[itemType];
}

function getContentLabel(itemType: ObjectType): string {
  const labels = {
    person: "人員描述",
    document: "文檔內容",
    entity: "組織描述", 
    issue: "議題內容",
    log: "日誌內容",
    meeting: "會議內容"
  };
  return labels[itemType];
}

function getContentPlaceholder(itemType: ObjectType): string {
  const placeholders = {
    person: "輸入人員描述，可以使用 @ 來引用其他文檔或人員",
    document: "輸入文檔內容，可以使用 @ 來引用其他文檔或人員",
    entity: "輸入組織描述，可以使用 @ 來引用其他文檔或人員",
    issue: "輸入議題內容，可以使用 @ 來引用其他文檔或人員", 
    log: "輸入日誌內容，可以使用 @ 來引用其他文檔或人員",
    meeting: "輸入會議內容，可以使用 @ 來引用其他文檔或人員"
  };
  return placeholders[itemType];
}

export default CreateItemPage;