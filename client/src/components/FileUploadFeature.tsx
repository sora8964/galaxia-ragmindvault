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
  objectType?: "document" | "meeting";
}

export function FileUploadFeature({ isDragOver, setIsDragOver, objectType = "document" }: FileUploadFeatureProps) {
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
                name: file.name.replace(/\.[^/.]+$/, ""),
                objectType
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
  }, [objectType]);

  // Handle multiple files
  const handleFiles = useCallback((files: File[]) => {
    const allowedTypes = ['.pdf', '.doc', '.docx'];
    const validFiles = files.filter(file => {
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      return allowedTypes.includes(fileExtension);
    });

    const invalidFiles = files.filter(file => {
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      return !allowedTypes.includes(fileExtension);
    });

    // Add invalid files as error entries for inline feedback
    if (invalidFiles.length > 0) {
      const errorFiles: UploadingFile[] = invalidFiles.map(file => ({
        id: Date.now().toString() + Math.random(),
        name: file.name,
        size: file.size,
        status: 'error',
        progress: 0,
        error: '不支援的文件格式。請上傳 PDF、DOC 或 DOCX 文件。'
      }));
      
      setUploadingFiles(prev => [...prev, ...errorFiles]);
    }

    if (validFiles.length === 0 && invalidFiles.length > 0) {
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
  }, [uploadSingleFile]);

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
    <div className="relative">
      {/* Upload button and input */}
      <div className="flex flex-col gap-4">
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

        {/* Uploading files progress - positioned right after upload button */}
        {uploadingFiles.length > 0 && (
          <Card className="w-full max-w-2xl">
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
      </div>

      {/* Drag overlay - now constrained to component container */}
      {isDragOver && (
        <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary z-10 flex items-center justify-center rounded-lg min-h-[200px]">
          <div className="bg-background p-6 rounded-lg shadow-lg text-center">
            <Upload className="h-10 w-10 mx-auto mb-3 text-primary" />
            <p className="font-medium">拖放文件到這裡上傳</p>
            <p className="text-sm text-muted-foreground mt-1">支援 PDF、DOC、DOCX 格式</p>
          </div>
        </div>
      )}

      {/* Drag handlers */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="absolute inset-0 pointer-events-none"
      />
    </div>
  );
}