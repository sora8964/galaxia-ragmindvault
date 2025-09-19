import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, X } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

interface UploadingFile {
  id: string;
  name: string;
  size: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  extractedText?: string;
  error?: string;
}

interface FileUploadFeatureProps {
  isDragOver: boolean;
  setIsDragOver: (isDragOver: boolean) => void;
}

export function FileUploadFeature({ isDragOver, setIsDragOver }: FileUploadFeatureProps) {
  const { toast } = useToast();
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);

  // Enhanced file upload with progress tracking
  const uploadSingleFile = useCallback(async (file: File, fileId: string) => {
    try {
      // Update status to uploading
      setUploadingFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, status: 'uploading', progress: 30 } : f
      ));

      const reader = new FileReader();
      
      return new Promise((resolve, reject) => {
        reader.onload = async () => {
          try {
            const base64 = reader.result as string;
            const base64Data = base64.split(',')[1];
            
            // Update progress
            setUploadingFiles(prev => prev.map(f => 
              f.id === fileId ? { ...f, progress: 60 } : f
            ));
            
            const endpoint = file.name.toLowerCase().endsWith('.pdf') 
              ? "/api/objects/pdf-upload"
              : "/api/objects/word-upload";
            
            const response = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                [file.name.toLowerCase().endsWith('.pdf') ? 'pdfBase64' : 'wordBase64']: base64Data,
                filename: file.name,
                name: file.name.replace(/\.[^/.]+$/, "")
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
            
            queryClient.invalidateQueries({ queryKey: ["/api/objects"] });
            resolve(data);
          } catch (error) {
            setUploadingFiles(prev => prev.map(f => 
              f.id === fileId ? { 
                ...f, 
                status: 'error', 
                error: error instanceof Error ? error.message : 'Upload failed'
              } : f
            ));
            reject(error);
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    } catch (error) {
      setUploadingFiles(prev => prev.map(f => 
        f.id === fileId ? { 
          ...f, 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Upload failed'
        } : f
      ));
      throw error;
    }
  }, []);

  // Handle multiple files
  const handleFiles = useCallback((files: File[]) => {
    const allowedTypes = ['.pdf', '.doc', '.docx'];
    const validFiles = files.filter(file => {
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      return allowedTypes.includes(fileExtension);
    });

    if (validFiles.length === 0) {
      toast({
        title: "不支援的文件格式",
        description: "請上傳 PDF、DOC 或 DOCX 文件",
        variant: "destructive"
      });
      return;
    }

    // Add files to uploading list
    const newUploadingFiles: UploadingFile[] = validFiles.map(file => ({
      id: Date.now().toString() + Math.random(),
      name: file.name,
      size: file.size,
      status: 'uploading',
      progress: 0,
    }));

    setUploadingFiles(prev => [...prev, ...newUploadingFiles]);

    // Upload each file
    newUploadingFiles.forEach(uploadFile => {
      const originalFile = validFiles.find(f => f.name === uploadFile.name);
      if (originalFile) {
        uploadSingleFile(originalFile, uploadFile.id);
      }
    });
  }, [uploadSingleFile, toast]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, [setIsDragOver]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, [setIsDragOver]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  }, [handleFiles, setIsDragOver]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    handleFiles(files);
    
    // Reset input
    event.target.value = '';
  };

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

  return (
    <>
      {/* Drag overlay */}
      {isDragOver && (
        <div className="fixed inset-0 bg-primary/10 border-2 border-dashed border-primary z-50 flex items-center justify-center">
          <div className="bg-background p-8 rounded-lg shadow-lg text-center">
            <Upload className="h-12 w-12 mx-auto mb-4 text-primary" />
            <p className="text-lg font-medium">拖放文件到這裡上傳</p>
            <p className="text-sm text-muted-foreground">支援 PDF、DOC、DOCX 格式</p>
          </div>
        </div>
      )}

      {/* Upload button */}
      <Button
        onClick={() => document.getElementById('file-upload')?.click()}
        disabled={uploadingFiles.some(f => f.status === 'uploading' || f.status === 'processing')}
        data-testid="button-upload-file"
      >
        <Upload className="w-4 h-4 mr-2" />
        上傳文件
      </Button>
      <input
        id="file-upload"
        type="file"
        accept=".pdf,.doc,.docx"
        multiple
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Uploading files progress */}
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
                  <div className="mt-3 p-3 bg-muted rounded-md">
                    <p className="text-sm text-muted-foreground mb-2">提取的文本預覽:</p>
                    <p className="text-sm">{file.extractedText}</p>
                  </div>
                )}
                
                {file.status === 'error' && file.error && (
                  <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                    <p className="text-sm text-destructive">{file.error}</p>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Drag handlers */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="absolute inset-0 pointer-events-none"
      />
    </>
  );
}