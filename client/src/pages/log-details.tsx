import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { SimpleMentionSearch } from "@/components/SimpleMentionSearch";
import { RelationshipManagerGeneric } from "@/components/RelationshipManagerGeneric";
import { ArrowLeft, Save, Trash2, FileText, Calendar, Tag, BookOpen, File, Download } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import type { AppObject } from "@shared/schema";

export function LogDetails() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    content: "",
    aliases: [] as string[],
    date: null as string | null
  });

  // Fetch log details
  const { data: log, isLoading, error } = useQuery({
    queryKey: ["/api/objects", id],
    queryFn: async (): Promise<AppObject> => {
      if (!id) throw new Error("No log ID");
      const response = await fetch(`/api/objects/${id}`);
      if (!response.ok) throw new Error("Failed to fetch log");
      return response.json();
    },
    enabled: !!id
  });

  // Initialize edit form when log loads
  useEffect(() => {
    if (log && !isEditing) {
      setEditForm({
        name: log.name,
        content: log.content,
        aliases: log.aliases,
        date: log.date
      });
    }
  }, [log, isEditing]);

  // Update log mutation
  const updateLogMutation = useMutation({
    mutationFn: async (data: typeof editForm) => {
      const response = await fetch(`/api/objects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          content: data.content,
          aliases: data.aliases,
          date: data.date,
          hasBeenEdited: true
        })
      });
      
      if (!response.ok) throw new Error("Failed to update log");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/objects", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/objects"] });
      setIsEditing(false);
      toast({
        title: "日誌已更新",
        description: "日誌已成功更新並觸發重新 embedding"
      });
    },
    onError: () => {
      toast({
        title: "更新失敗",
        description: "無法更新日誌，請重試",
        variant: "destructive"
      });
    }
  });

  // Delete log mutation
  const deleteLogMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/objects/${id}`, {
        method: "DELETE"
      });
      
      if (!response.ok) throw new Error("Failed to delete log");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/objects"] });
      toast({
        title: "日誌已刪除",
        description: "日誌已成功刪除"
      });
      setLocation("/logs");
    },
    onError: () => {
      toast({
        title: "刪除失敗",
        description: "無法刪除日誌，請重試",
        variant: "destructive"
      });
    }
  });

  const handleMentionAdded = (mention: any, alias?: string) => {
    const mentionText = alias ? `@[${mention.type}:${mention.name}|${alias}]` : `@[${mention.type}:${mention.name}]`;
    setEditForm(prev => ({
      ...prev,
      content: prev.content + mentionText
    }));
  };

  const handleAddAlias = () => {
    setEditForm(prev => ({
      ...prev,
      aliases: [...prev.aliases, ""]
    }));
  };

  const handleRemoveAlias = (index: number) => {
    setEditForm(prev => ({
      ...prev,
      aliases: prev.aliases.filter((_, i) => i !== index)
    }));
  };

  const handleAliasChange = (index: number, value: string) => {
    setEditForm(prev => ({
      ...prev,
      aliases: prev.aliases.map((alias, i) => i === index ? value : alias)
    }));
  };

  if (error) {
    return (
      <div className="p-6 h-full flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">找不到日誌</h3>
          <p className="text-muted-foreground mb-4">您要查看的日誌不存在或已被刪除</p>
          <Button onClick={() => setLocation("/logs")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回日誌列表
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 h-full overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 mb-6">
            <Skeleton className="h-6 w-6" />
            <Skeleton className="h-8 w-48" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-32 w-full" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="lg:col-span-1">
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!log || log.type !== "log") {
    return (
      <div className="p-6 h-full flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">不是日誌</h3>
          <p className="text-muted-foreground mb-4">此項目不是日誌類型</p>
          <Button onClick={() => setLocation("/logs")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回日誌列表
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/logs")}
              data-testid="button-back-to-logs"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-2xl font-bold">
              {isEditing ? "編輯日誌" : log.name}
            </h1>
          </div>
          
          <div className="flex gap-2">
            {!isEditing ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                  data-testid="button-edit-log"
                >
                  編輯
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" data-testid="button-delete-log">
                      <Trash2 className="w-4 h-4 mr-2" />
                      刪除
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>確定要刪除這個日誌嗎？</AlertDialogTitle>
                      <AlertDialogDescription>
                        此操作無法撤銷。日誌及其所有相關的 chunks 和 embeddings 都將被永久刪除。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteLogMutation.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        data-testid="button-confirm-delete"
                      >
                        {deleteLogMutation.isPending ? "刪除中..." : "刪除"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setEditForm({
                      name: log.name,
                      content: log.content,
                      aliases: log.aliases,
                      date: log.date
                    });
                  }}
                  data-testid="button-cancel-edit"
                >
                  取消
                </Button>
                <Button
                  onClick={() => updateLogMutation.mutate(editForm)}
                  disabled={!editForm.name.trim() || updateLogMutation.isPending}
                  data-testid="button-save-log"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateLogMutation.isPending ? "儲存中..." : "儲存"}
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Log details */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {isEditing ? (
                      <div className="space-y-2">
                        <Label htmlFor="edit-name">日誌名稱</Label>
                        <Input
                          id="edit-name"
                          value={editForm.name}
                          onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                          data-testid="input-edit-name"
                        />
                      </div>
                    ) : (
                      <CardTitle className="text-xl">{log.name}</CardTitle>
                    )}
                  </div>
                  
                  <div className="flex gap-1 ml-4">
                    {log.isFromOCR && (
                      <Badge variant="secondary">OCR</Badge>
                    )}
                    {log.hasEmbedding && (
                      <Badge variant="default">已嵌入</Badge>
                    )}
                    {log.needsEmbedding && (
                      <Badge variant="outline">待嵌入</Badge>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    建立：{new Date(log.createdAt).toLocaleDateString('zh-TW')}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    更新：{new Date(log.updatedAt).toLocaleDateString('zh-TW')}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {/* Date field */}
                <div>
                  <Label className="text-base font-medium">日期</Label>
                  {isEditing ? (
                    <Input
                      type="date"
                      value={editForm.date || ""}
                      onChange={(e) => setEditForm(prev => ({ ...prev, date: e.target.value || null }))}
                      className="mt-2"
                      data-testid="input-edit-date"
                    />
                  ) : (
                    <div className="mt-2">
                      {log.date ? (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>{log.date}</span>
                        </div>
                      ) : (
                        <p className="text-muted-foreground italic">沒有設定日期</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div>
                  <Label className="text-base font-medium">內容</Label>
                  {isEditing ? (
                    <div className="relative mt-2">
                      <Textarea
                        value={editForm.content}
                        onChange={(e) => setEditForm(prev => ({ ...prev, content: e.target.value }))}
                        placeholder="輸入日誌內容，可以使用 @ 來引用其他文件或人員"
                        className="min-h-40"
                        data-testid="textarea-edit-content"
                      />
                      <SimpleMentionSearch
                        onMentionSelect={handleMentionAdded}
                        className="absolute top-2 right-2"
                      />
                    </div>
                  ) : (
                    <div className="mt-2 p-4 bg-muted/50 rounded-lg">
                      {log.content ? (
                        <pre className="whitespace-pre-wrap font-sans text-sm">
                          {log.content}
                        </pre>
                      ) : (
                        <p className="text-muted-foreground italic">沒有內容</p>
                      )}
                    </div>
                  )}
                </div>

                {/* File attachment */}
                {log.hasFile && (
                  <div>
                    <Label className="text-base font-medium flex items-center gap-2">
                      <File className="w-4 h-4" />
                      附件檔案
                    </Label>
                    <div className="mt-2 p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="font-medium">
                            {log.originalFileName || '未知檔案'}
                          </p>
                          <div className="text-sm text-muted-foreground space-y-1">
                            {log.fileSize && (
                              <p>檔案大小: {(log.fileSize / 1024 / 1024).toFixed(2)} MB</p>
                            )}
                            {log.mimeType && (
                              <p>檔案類型: {log.mimeType}</p>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              const response = await fetch(`/api/objects/${log.id}/download`);
                              if (!response.ok) {
                                throw new Error('下載失敗');
                              }
                              
                              // Get filename from response headers or use original filename
                              const contentDisposition = response.headers.get('content-disposition');
                              let filename = log.originalFileName || `${log.name}.pdf`;
                              if (contentDisposition) {
                                const matches = contentDisposition.match(/filename="?([^"]+)"?/);
                                if (matches) filename = matches[1];
                              }
                              
                              // Create blob and download
                              const blob = await response.blob();
                              const url = window.URL.createObjectURL(blob);
                              const a = window.document.createElement('a');
                              a.style.display = 'none';
                              a.href = url;
                              a.download = filename;
                              window.document.body.appendChild(a);
                              a.click();
                              window.URL.revokeObjectURL(url);
                              window.document.body.removeChild(a);
                              
                              toast({
                                title: "下載完成",
                                description: `檔案 ${filename} 已開始下載`
                              });
                            } catch (error) {
                              console.error('Download error:', error);
                              toast({
                                title: "下載失敗",
                                description: "無法下載檔案，請重試",
                                variant: "destructive"
                              });
                            }
                          }}
                          data-testid="button-download-file"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          下載
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Aliases */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-base font-medium flex items-center gap-2">
                      <Tag className="w-4 h-4" />
                      別名
                    </Label>
                    {isEditing && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddAlias}
                        data-testid="button-add-alias"
                      >
                        新增別名
                      </Button>
                    )}
                  </div>
                  
                  {isEditing ? (
                    <div className="space-y-2">
                      {editForm.aliases.map((alias, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            value={alias}
                            onChange={(e) => handleAliasChange(index, e.target.value)}
                            placeholder="輸入別名"
                            data-testid={`input-alias-${index}`}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveAlias(index)}
                            data-testid={`button-remove-alias-${index}`}
                          >
                            移除
                          </Button>
                        </div>
                      ))}
                      {editForm.aliases.length === 0 && (
                        <p className="text-muted-foreground text-sm">沒有別名</p>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {log.aliases.length > 0 ? (
                        log.aliases.map((alias: string, index: number) => (
                          <Badge key={index} variant="outline">
                            {alias}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-muted-foreground text-sm">沒有別名</p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Relationship management */}
          <div className="lg:col-span-1">
            <RelationshipManagerGeneric 
              sourceId={log.id} 
              sourceType="log"
            />
          </div>
        </div>
      </div>
    </div>
  );
}