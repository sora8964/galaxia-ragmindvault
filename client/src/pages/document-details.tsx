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
import { ArrowLeft, Save, Trash2, FileText, Calendar, Tag } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import type { AppObject } from "@shared/schema";

export function DocumentDetails() {
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

  // Fetch document details
  const { data: document, isLoading, error } = useQuery({
    queryKey: ["/api/objects", id],
    queryFn: async (): Promise<AppObject> => {
      if (!id) throw new Error("No document ID");
      const response = await fetch(`/api/objects/${id}`);
      if (!response.ok) throw new Error("Failed to fetch document");
      return response.json();
    },
    enabled: !!id
  });

  // Initialize edit form when document loads
  useEffect(() => {
    if (document && !isEditing) {
      setEditForm({
        name: document.name,
        content: document.content,
        aliases: document.aliases,
        date: document.date
      });
    }
  }, [document, isEditing]);

  // Update document mutation
  const updateDocumentMutation = useMutation({
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
      
      if (!response.ok) throw new Error("Failed to update document");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/objects", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/objects"] });
      setIsEditing(false);
      toast({
        title: "文件已更新",
        description: "文件已成功更新並觸發重新 embedding"
      });
    },
    onError: () => {
      toast({
        title: "更新失敗",
        description: "無法更新文件，請重試",
        variant: "destructive"
      });
    }
  });

  // Delete document mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/objects/${id}`, {
        method: "DELETE"
      });
      
      if (!response.ok) throw new Error("Failed to delete document");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/objects"] });
      toast({
        title: "文件已刪除",
        description: "文件已成功刪除"
      });
      setLocation("/documents");
    },
    onError: () => {
      toast({
        title: "刪除失敗",
        description: "無法刪除文件，請重試",
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
          <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">找不到文件</h3>
          <p className="text-muted-foreground mb-4">您要查看的文件不存在或已被刪除</p>
          <Button onClick={() => setLocation("/documents")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回文件列表
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

  if (!document || document.type !== "document") {
    return (
      <div className="p-6 h-full flex items-center justify-center">
        <div className="text-center">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">不是文件</h3>
          <p className="text-muted-foreground mb-4">此項目不是文件類型</p>
          <Button onClick={() => setLocation("/documents")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回文件列表
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
              onClick={() => setLocation("/documents")}
              data-testid="button-back-to-documents"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-2xl font-bold">
              {isEditing ? "編輯文件" : document.name}
            </h1>
          </div>
          
          <div className="flex gap-2">
            {!isEditing ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                  data-testid="button-edit-document"
                >
                  編輯
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" data-testid="button-delete-document">
                      <Trash2 className="w-4 h-4 mr-2" />
                      刪除
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>確定要刪除這個文件嗎？</AlertDialogTitle>
                      <AlertDialogDescription>
                        此操作無法撤銷。文件及其所有相關的 chunks 和 embeddings 都將被永久刪除。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteDocumentMutation.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        data-testid="button-confirm-delete"
                      >
                        {deleteDocumentMutation.isPending ? "刪除中..." : "刪除"}
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
                      name: document.name,
                      content: document.content,
                      aliases: document.aliases,
                      date: document.date
                    });
                  }}
                  data-testid="button-cancel-edit"
                >
                  取消
                </Button>
                <Button
                  onClick={() => updateDocumentMutation.mutate(editForm)}
                  disabled={!editForm.name.trim() || updateDocumentMutation.isPending}
                  data-testid="button-save-document"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateDocumentMutation.isPending ? "儲存中..." : "儲存"}
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Document details */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {isEditing ? (
                      <div className="space-y-2">
                        <Label htmlFor="edit-name">文件名稱</Label>
                        <Input
                          id="edit-name"
                          value={editForm.name}
                          onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                          data-testid="input-edit-name"
                        />
                      </div>
                    ) : (
                      <CardTitle className="text-xl">{document.name}</CardTitle>
                    )}
                  </div>
                  
                  <div className="flex gap-1 ml-4">
                    {document.isFromOCR && (
                      <Badge variant="secondary">OCR</Badge>
                    )}
                    {document.hasEmbedding && (
                      <Badge variant="default">已嵌入</Badge>
                    )}
                    {document.needsEmbedding && (
                      <Badge variant="outline">待嵌入</Badge>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    建立：{new Date(document.createdAt).toLocaleDateString('zh-TW')}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    更新：{new Date(document.updatedAt).toLocaleDateString('zh-TW')}
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
                      {document.date ? (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>{document.date}</span>
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
                        placeholder="輸入文件內容，可以使用 @ 來引用其他文件或人員"
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
                      {document.content ? (
                        <pre className="whitespace-pre-wrap font-sans text-sm">
                          {document.content}
                        </pre>
                      ) : (
                        <p className="text-muted-foreground italic">沒有內容</p>
                      )}
                    </div>
                  )}
                </div>

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
                      {document.aliases.length > 0 ? (
                        document.aliases.map((alias: string, index: number) => (
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
              sourceId={document.id} 
              sourceType="document"
            />
          </div>
        </div>
      </div>
    </div>
  );
}