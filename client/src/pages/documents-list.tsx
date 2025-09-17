import { useState } from "react";
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
import { Upload, Plus, FileText, Calendar, Search } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import type { Document } from "@shared/schema";

export function DocumentsList() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [newDocumentForm, setNewDocumentForm] = useState({
    name: "",
    content: "",
    aliases: [] as string[]
  });

  // Fetch documents (only type: document)
  const { data: documentsData, isLoading } = useQuery({
    queryKey: ["/api/documents", { type: "document", search: searchQuery }],
    queryFn: async () => {
      const params = new URLSearchParams({ type: "document" });
      if (searchQuery) params.append("search", searchQuery);
      
      const response = await fetch(`/api/documents?${params}`);
      if (!response.ok) throw new Error("Failed to fetch documents");
      return response.json();
    }
  });

  // Create new document mutation
  const createDocumentMutation = useMutation({
    mutationFn: async (data: typeof newDocumentForm) => {
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          type: "document",
          content: data.content,
          aliases: data.aliases,
          isFromOCR: false,
          hasBeenEdited: false,
          needsEmbedding: true
        })
      });
      
      if (!response.ok) throw new Error("Failed to create document");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setIsCreating(false);
      setNewDocumentForm({ name: "", content: "", aliases: [] });
      toast({
        title: "文件已創建",
        description: "新文件已成功創建並正在生成 embedding"
      });
    },
    onError: () => {
      toast({
        title: "創建失敗",
        description: "無法創建文件，請重試",
        variant: "destructive"
      });
    }
  });

  // File upload mutation (PDF/Word)
  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      const reader = new FileReader();
      
      return new Promise((resolve, reject) => {
        reader.onload = async () => {
          try {
            const base64 = reader.result as string;
            const base64Data = base64.split(',')[1]; // Remove data:mime;base64, prefix
            
            const endpoint = file.name.toLowerCase().endsWith('.pdf') 
              ? "/api/documents/pdf-upload"
              : "/api/documents/word-upload";
            
            const response = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                [file.name.toLowerCase().endsWith('.pdf') ? 'pdfBase64' : 'wordBase64']: base64Data,
                filename: file.name,
                name: file.name.replace(/\.[^/.]+$/, "") // Remove extension
              })
            });
            
            if (!response.ok) throw new Error("Upload failed");
            resolve(await response.json());
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setIsUploading(false);
      toast({
        title: "文件已上傳",
        description: `${data.name} 已成功上傳${data.isFromOCR ? '，請編輯後觸發 embedding' : ' 並正在生成 embedding'}`
      });
    },
    onError: () => {
      toast({
        title: "上傳失敗",
        description: "無法上傳文件，請重試",
        variant: "destructive"
      });
      setIsUploading(false);
    }
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['.pdf', '.doc', '.docx'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!allowedTypes.includes(fileExtension)) {
      toast({
        title: "不支援的文件格式",
        description: "請上傳 PDF、DOC 或 DOCX 文件",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    uploadFileMutation.mutate(file);
  };

  const handleMentionAdded = (mention: any, alias?: string) => {
    const mentionText = alias ? `@[${mention.type}:${mention.name}|${alias}]` : `@[${mention.type}:${mention.name}]`;
    setNewDocumentForm(prev => ({
      ...prev,
      content: prev.content + mentionText
    }));
  };

  const documents = documentsData?.documents || [];

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">文件管理</h1>
            <p className="text-muted-foreground">管理和搜索您的文件</p>
          </div>
          <div className="flex gap-2">
            {/* Upload button */}
            <Button
              onClick={() => document.getElementById('file-upload')?.click()}
              disabled={isUploading}
              data-testid="button-upload-file"
            >
              <Upload className="w-4 h-4 mr-2" />
              {isUploading ? "上傳中..." : "上傳文件"}
            </Button>
            <input
              id="file-upload"
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Create new document dialog */}
            <Dialog open={isCreating} onOpenChange={setIsCreating}>
              <DialogTrigger asChild>
                <Button data-testid="button-new-document">
                  <Plus className="w-4 h-4 mr-2" />
                  新增文件
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>新增文件</DialogTitle>
                  <DialogDescription>
                    創建新的文件，可以使用 @ 功能引用其他文件或人員
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="doc-name">文件名稱</Label>
                    <Input
                      id="doc-name"
                      value={newDocumentForm.name}
                      onChange={(e) => setNewDocumentForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="輸入文件名稱"
                      data-testid="input-document-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="doc-content">文件內容</Label>
                    <div className="relative">
                      <Textarea
                        id="doc-content"
                        value={newDocumentForm.content}
                        onChange={(e) => setNewDocumentForm(prev => ({ ...prev, content: e.target.value }))}
                        placeholder="輸入文件內容，可以使用 @ 來引用其他文件或人員"
                        className="min-h-32"
                        data-testid="textarea-document-content"
                      />
                      <SimpleMentionSearch
                        onMentionSelect={handleMentionAdded}
                        className="absolute top-2 right-2"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsCreating(false)}
                      data-testid="button-cancel-create"
                    >
                      取消
                    </Button>
                    <Button
                      onClick={() => createDocumentMutation.mutate(newDocumentForm)}
                      disabled={!newDocumentForm.name.trim() || createDocumentMutation.isPending}
                      data-testid="button-save-create"
                    >
                      {createDocumentMutation.isPending ? "創建中..." : "創建文件"}
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
              placeholder="搜索文件..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-documents"
            />
          </div>
        </div>

        {/* Documents grid */}
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
        ) : documents.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {searchQuery ? "找不到相關文件" : "還沒有文件"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? "嘗試調整搜索條件" : "上傳文件或創建新文件開始使用"}
            </p>
            {!searchQuery && (
              <div className="flex gap-2 justify-center">
                <Button onClick={() => document.getElementById('file-upload')?.click()}>
                  <Upload className="w-4 h-4 mr-2" />
                  上傳文件
                </Button>
                <Button onClick={() => setIsCreating(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  新增文件
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {documents.map((doc: Document) => (
              <Card
                key={doc.id}
                className="hover-elevate cursor-pointer"
                onClick={() => setLocation(`/documents/${doc.id}`)}
                data-testid={`card-document-${doc.id}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base line-clamp-2">{doc.name}</CardTitle>
                    <div className="flex gap-1 ml-2">
                      {doc.isFromOCR && (
                        <Badge variant="secondary" className="text-xs">OCR</Badge>
                      )}
                      {doc.hasEmbedding && (
                        <Badge variant="default" className="text-xs">已嵌入</Badge>
                      )}
                    </div>
                  </div>
                  <CardDescription className="flex items-center gap-2 text-xs">
                    <Calendar className="w-3 h-3" />
                    {new Date(doc.updatedAt).toLocaleDateString('zh-TW')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {doc.content || "沒有內容"}
                  </p>
                  {doc.aliases.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {doc.aliases.slice(0, 3).map((alias, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {alias}
                        </Badge>
                      ))}
                      {doc.aliases.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{doc.aliases.length - 3}
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