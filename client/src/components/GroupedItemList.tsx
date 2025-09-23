import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { SimpleMentionSearch } from "@/components/SimpleMentionSearch";
import { Plus, Calendar, Search, Eye, Upload, FileText, CheckCircle, AlertCircle, Loader2, X } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { getItemTypeDisplayName, getNameFieldLabel, getNameFieldPlaceholder, getContentFieldLabel, getContentFieldPlaceholder } from "@/lib/typeDisplay";
import type { AppObject } from "@shared/schema";
import { hasObjectTypeDateField } from "@shared/schema";

interface ItemForm {
  name: string;
  content: string;
  aliases: string[];
  date?: string | null;
}

interface GroupedItems {
  [key: string]: AppObject[];
}

interface UploadingFile {
  id: string;
  name: string;
  size: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  extractedText?: string;
  error?: string;
}

interface GroupedItemListProps {
  itemType: "document" | "letter" | "log" | "meeting";
  title: string;
  description: string;
  createButtonText: string;
  emptyStateTitle: string;
  emptyStateDescription: string;
  dialogTitle: string;
  dialogDescription: string;
  searchPlaceholder: string;
  getIcon: () => React.ReactNode;
  onItemClick?: (item: AppObject) => void;
  renderAdditionalButtons?: () => React.ReactNode;
  showFileUpload?: boolean;
  allowedFileTypes?: string[];
  uploadEndpoint?: (filename: string) => string;
  uploadDataKey?: (filename: string) => string;
  isDragOver?: boolean;
  setIsDragOver?: (isDragOver: boolean) => void;
}

export function GroupedItemList({
  itemType,
  title,
  description,
  createButtonText,
  emptyStateTitle,
  emptyStateDescription,
  dialogTitle,
  dialogDescription,
  searchPlaceholder,
  getIcon,
  onItemClick,
  renderAdditionalButtons,
  showFileUpload = false,
  allowedFileTypes = ['.pdf', '.doc', '.docx'],
  uploadEndpoint = (filename) => filename.toLowerCase().endsWith('.pdf') ? "/api/objects/pdf-upload" : "/api/objects/word-upload",
  uploadDataKey = (filename) => filename.toLowerCase().endsWith('.pdf') ? 'pdfBase64' : 'wordBase64',
  isDragOver = false,
  setIsDragOver
}: GroupedItemListProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newItemForm, setNewItemForm] = useState<ItemForm>({
    name: "",
    content: "",
    aliases: [],
    date: null
  });
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!showFileUpload) return;
    
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Validate file types
    const validFiles = files.filter(file => {
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      return allowedFileTypes.includes(fileExtension);
    });

    const invalidFiles = files.filter(file => {
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      return !allowedFileTypes.includes(fileExtension);
    });

    if (invalidFiles.length > 0) {
      toast({
        title: "文件類型不支援",
        description: `不支援的文件: ${invalidFiles.map(f => f.name).join(', ')}。僅支援 ${allowedFileTypes.join('、')} 格式。`,
        variant: "destructive",
      });
    }

    if (validFiles.length === 0) {
      event.target.value = '';
      return;
    }

    // Add files to uploading state
    const newUploadingFiles = validFiles.map(file => ({
      id: Date.now().toString() + Math.random().toString(36),
      name: file.name,
      size: file.size,
      status: 'uploading' as const,
      progress: 10,
    }));

    setUploadingFiles(prev => [...prev, ...newUploadingFiles]);

    // Upload each valid file
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      const fileId = newUploadingFiles[i].id;
      
      try {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            // Update progress to reading complete
            setUploadingFiles(prev => prev.map(f => 
              f.id === fileId ? { ...f, progress: 30 } : f
            ));

            const base64 = reader.result as string;
            const base64Data = base64.split(',')[1];
            
            // Update progress to uploading
            setUploadingFiles(prev => prev.map(f => 
              f.id === fileId ? { ...f, progress: 60 } : f
            ));
            
            const endpoint = uploadEndpoint(file.name);
            const dataKey = uploadDataKey(file.name);
            
            const response = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                [dataKey]: base64Data,
                filename: file.name,
                name: file.name.replace(/\.[^/.]+$/, ""),
                objectType: itemType
              })
            });
            
            if (!response.ok) throw new Error("Upload failed");
            
            // Update to processing
            setUploadingFiles(prev => prev.map(f => 
              f.id === fileId ? { ...f, status: 'processing', progress: 80 } : f
            ));
            
            const data = await response.json();
            
            // Complete
            setUploadingFiles(prev => prev.map(f => 
              f.id === fileId ? { 
                ...f, 
                status: 'completed', 
                progress: 100,
                extractedText: data.isFromOCR ? data.content?.substring(0, 200) + '...' : undefined
              } : f
            ));
            
            // Refresh the items list
            queryClient.invalidateQueries({ queryKey: ["/api/objects"] });
            
          } catch (error) {
            setUploadingFiles(prev => prev.map(f => 
              f.id === fileId ? { 
                ...f, 
                status: 'error', 
                error: error instanceof Error ? error.message : '上傳失敗'
              } : f
            ));
          }
        };
        reader.onerror = () => {
          setUploadingFiles(prev => prev.map(f => 
            f.id === fileId ? { 
              ...f, 
              status: 'error', 
              error: '文件讀取失敗'
            } : f
          ));
        };
        reader.readAsDataURL(file);
      } catch (error) {
        setUploadingFiles(prev => prev.map(f => 
          f.id === fileId ? { 
            ...f, 
            status: 'error', 
            error: '文件處理失敗'
          } : f
        ));
      }
    }

    // Reset input
    event.target.value = '';
  };

  // Helper functions for upload progress display
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: UploadingFile['status']) => {
    switch (status) {
      case 'uploading':
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusText = (status: UploadingFile['status']) => {
    switch (status) {
      case 'uploading':
        return '上傳中...';
      case 'processing':
        return 'OCR處理中...';
      case 'completed':
        return '完成';
      case 'error':
        return '錯誤';
    }
  };

  const removeUploadingFile = (fileId: string) => {
    setUploadingFiles(prev => prev.filter(f => f.id !== fileId));
  };

  // Fetch items
  const { data: itemsData, isLoading } = useQuery({
    queryKey: ["/api/objects", { type: itemType, search: searchQuery }],
    queryFn: async () => {
      const params = new URLSearchParams({ type: itemType });
      if (searchQuery) params.append("search", searchQuery);
      
      const response = await fetch(`/api/objects?${params}`);
      if (!response.ok) throw new Error(`Failed to fetch ${itemType}s`);
      return response.json();
    }
  });

  // Create new item mutation
  const createItemMutation = useMutation({
    mutationFn: async (data: ItemForm) => {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/objects"] });
      setIsCreating(false);
      setNewItemForm({ name: "", content: "", aliases: [], date: null });
      toast({
        title: `${getItemTypeDisplayName(itemType)}已創建`,
        description: `新${getItemTypeDisplayName(itemType)}已成功創建並正在生成 embedding`
      });
    },
    onError: () => {
      toast({
        title: "創建失敗",
        description: `無法創建${getItemTypeDisplayName(itemType)}，請重試`,
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

  const handleItemClick = (item: AppObject) => {
    if (onItemClick) {
      onItemClick(item);
    } else {
      const routePath = itemType === "document" ? "/documents" : 
                        itemType === "letter" ? "/letters" :
                        itemType === "log" ? "/logs" : "/meetings";
      setLocation(`${routePath}/${item.id}`);
    }
  };

  // Group items by month using string manipulation only
  const groupedItems = useMemo(() => {
    if (!itemsData?.objects) return {};

    const items = itemsData.objects as AppObject[];
    const groups: GroupedItems = {};

    items.forEach((item) => {
      let groupKey: string;
      
      if (!item.date || !item.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        groupKey = "日期未知";
      } else {
        // Extract YYYY-MM from YYYY-MM-DD string and ensure proper padding
        const yearMonth = item.date.substring(0, 7); // "2025-08"
        const [year, month] = yearMonth.split('-');
        // Ensure month is zero-padded
        const paddedMonth = month.padStart(2, '0');
        groupKey = `${year}年${paddedMonth}月`;
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
    });

    // Sort items within each group by date (descending for monthly groups, latest first)
    Object.keys(groups).forEach(groupKey => {
      if (groupKey === "日期未知") {
        // For unknown dates, sort by name
        groups[groupKey].sort((a, b) => a.name.localeCompare(b.name));
      } else {
        // For dated items, sort by date descending (latest first)
        groups[groupKey].sort((a, b) => {
          if (!a.date && !b.date) return 0;
          if (!a.date) return 1;
          if (!b.date) return -1;
          return b.date.localeCompare(a.date);
        });
      }
    });

    return groups;
  }, [itemsData]);

  // Create sorted group keys: "日期未知" first, then months in descending order
  const sortedGroupKeys = useMemo(() => {
    const keys = Object.keys(groupedItems);
    const monthKeys = keys.filter(key => key !== "日期未知");
    const unknownKey = keys.find(key => key === "日期未知");

    // Sort month keys by extracting year and month for comparison
    monthKeys.sort((a, b) => {
      // Extract year and month from "2025年08月" format
      const aMatch = a.match(/(\d{4})年(\d{2})月/);
      const bMatch = b.match(/(\d{4})年(\d{2})月/);
      
      if (!aMatch || !bMatch) return 0;
      
      const aYearMonth = `${aMatch[1]}-${aMatch[2]}`;
      const bYearMonth = `${bMatch[1]}-${bMatch[2]}`;
      
      return bYearMonth.localeCompare(aYearMonth); // Descending order
    });

    return unknownKey ? [unknownKey, ...monthKeys] : monthKeys;
  }, [groupedItems]);

  const totalItems = itemsData?.objects?.length || 0;

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-muted-foreground">{description}</p>
          </div>
          <div className="flex gap-2">
            {/* Upload button */}
            {showFileUpload && (
              <>
                <Button
                  onClick={() => document.getElementById(`${itemType}-file-upload`)?.click()}
                  disabled={uploadingFiles.some(f => f.status === 'uploading' || f.status === 'processing')}
                  data-testid={`button-upload-${itemType}`}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  上傳{getItemTypeDisplayName(itemType)}
                </Button>
                <input
                  id={`${itemType}-file-upload`}
                  type="file"
                  accept={allowedFileTypes.join(',')}
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </>
            )}

            {/* Additional buttons */}
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
                    <Label htmlFor="item-name">{getNameFieldLabel(itemType)}</Label>
                    <Input
                      id="item-name"
                      value={newItemForm.name}
                      onChange={(e) => setNewItemForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder={getNameFieldPlaceholder(itemType)}
                      data-testid={`input-${itemType}-name`}
                    />
                  </div>
                  <div>
                    <Label htmlFor="item-content">{getContentFieldLabel(itemType)}</Label>
                    <div className="relative">
                      <Textarea
                        id="item-content"
                        value={newItemForm.content}
                        onChange={(e) => setNewItemForm(prev => ({ ...prev, content: e.target.value }))}
                        placeholder={getContentFieldPlaceholder(itemType)}
                        className="min-h-32"
                        data-testid={`textarea-${itemType}-content`}
                      />
                      <SimpleMentionSearch
                        onMentionSelect={handleMentionAdded}
                        className="absolute top-2 right-2"
                      />
                    </div>
                  </div>
                  {hasObjectTypeDateField(itemType) && (
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
                      {createItemMutation.isPending ? "創建中..." : `創建${getItemTypeDisplayName(itemType)}`}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Upload progress display */}
        {uploadingFiles.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Upload className="h-5 w-5" />
                上傳進度 ({uploadingFiles.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {uploadingFiles.map((file) => (
                <div key={file.id} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{file.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="flex items-center gap-1">
                        {getStatusIcon(file.status)}
                        <span>{getStatusText(file.status)}</span>
                      </Badge>
                      {(file.status === 'completed' || file.status === 'error') && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeUploadingFile(file.id)}
                          data-testid={`button-remove-upload-${file.id}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {(file.status === 'uploading' || file.status === 'processing') && (
                    <Progress value={file.progress} className="h-2" />
                  )}
                  
                  {file.status === 'completed' && file.extractedText && (
                    <div className="mt-3 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-md">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <p className="text-sm font-medium text-green-800 dark:text-green-200">上傳成功！</p>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">提取的文本預覽:</p>
                      <p className="text-sm">{file.extractedText}</p>
                    </div>
                  )}
                  
                  {file.status === 'completed' && !file.extractedText && (
                    <div className="mt-3 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-md">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <p className="text-sm font-medium text-green-800 dark:text-green-200">文件上傳成功！</p>
                      </div>
                    </div>
                  )}
                  
                  {file.status === 'error' && file.error && (
                    <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-destructive" />
                        <p className="text-sm text-destructive font-medium">上傳失敗</p>
                      </div>
                      <p className="text-sm text-destructive mt-1">{file.error}</p>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid={`input-search-${itemType}s`}
            />
          </div>
        </div>

        {/* Items list */}
        {isLoading ? (
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-6 w-32" />
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : totalItems === 0 ? (
          <div className="text-center py-12">
            {getIcon()}
            <h3 className="text-lg font-medium mb-2">
              {searchQuery ? `找不到相關${getItemTypeDisplayName(itemType)}` : emptyStateTitle}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? "嘗試調整搜索條件" : emptyStateDescription}
            </p>
            {!searchQuery && (
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="w-4 h-4 mr-2" />
                {createButtonText}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {sortedGroupKeys.map((groupKey) => (
              <div key={groupKey} className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground border-b pb-2">
                  {groupKey}
                </h2>
                <ul className="space-y-1">
                  {groupedItems[groupKey].map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer border border-transparent hover:border-muted-foreground/20 rounded-md transition-all hover-elevate"
                      onClick={() => handleItemClick(item)}
                      data-testid={`list-item-${itemType}-${item.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium text-base truncate">{item.name}</h3>
                          <div className="flex gap-1 flex-shrink-0">
                            {item.isFromOCR && (
                              <Badge variant="secondary" className="text-xs">OCR</Badge>
                            )}
                            {item.hasEmbedding && (
                              <Badge variant="default" className="text-xs">已嵌入</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {item.date && (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>{item.date}</span>
                            </div>
                          )}
                          {item.content && (
                            <p className="truncate flex-1">
                              {item.content}
                            </p>
                          )}
                        </div>
                        {item.aliases.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
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
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleItemClick(item);
                        }}
                        className="ml-4"
                        data-testid={`button-view-details-${item.id}`}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        查看
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
