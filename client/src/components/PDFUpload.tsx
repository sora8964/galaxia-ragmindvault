import { useState, useCallback } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  extractedText?: string;
}

export function PDFUpload() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.type === 'application/pdf'
    );
    
    handleFiles(droppedFiles);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    handleFiles(selectedFiles);
  }, []);

  const handleFiles = useCallback((newFiles: File[]) => {
    console.log('Files uploaded:', newFiles.map(f => f.name));
    
    const uploadFiles: UploadedFile[] = newFiles.map(file => ({
      id: Date.now().toString() + Math.random(),
      name: file.name,
      size: file.size,
      status: 'uploading',
      progress: 0,
    }));
    
    setFiles(prev => [...prev, ...uploadFiles]);
    
    // Simulate upload and OCR processing
    uploadFiles.forEach((file) => {
      simulateUpload(file.id);
    });
  }, []);

  const simulateUpload = useCallback((fileId: string) => {
    // Simulate upload progress
    let progress = 0;
    const uploadInterval = setInterval(() => {
      progress += 10;
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, progress } : f
      ));
      
      if (progress >= 100) {
        clearInterval(uploadInterval);
        // Switch to processing
        setFiles(prev => prev.map(f => 
          f.id === fileId ? { ...f, status: 'processing', progress: 0 } : f
        ));
        
        // Simulate OCR processing
        setTimeout(() => {
          setFiles(prev => prev.map(f => 
            f.id === fileId ? { 
              ...f, 
              status: 'completed', 
              progress: 100,
              extractedText: '這是從PDF文件的OCR轉換結果。在實際應用中，這裡會顯示由Gemini AI提取的文本內容。'
            } : f
          ));
        }, 2000);
      }
    }, 200);
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: UploadedFile['status']) => {
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

  const getStatusText = (status: UploadedFile['status']) => {
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

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card className={`transition-colors ${
        isDragOver ? 'border-primary bg-primary/5' : 'border-dashed'
      }`}>
        <CardContent className="p-8">
          <div
            className="flex flex-col items-center justify-center space-y-4 text-center"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="p-4 rounded-full bg-muted">
              <Upload className="h-8 w-8 text-muted-foreground" />
            </div>
            
            <div>
              <h3 className="text-lg font-semibold">Upload PDF Files</h3>
              <p className="text-sm text-muted-foreground mt-1">
                拖放 PDF 文件到這裡，或點擊選擇文件
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                onClick={() => document.getElementById('file-input')?.click()}
                data-testid="button-select-files"
              >
                選擇文件
              </Button>
              <input
                id="file-input"
                type="file"
                accept=".pdf"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                data-testid="input-file-upload"
              />
            </div>
            
            <p className="text-xs text-muted-foreground">
              支持 PDF 格式，最大 10MB
            </p>
          </div>
        </CardContent>
      </Card>

      {/* File List */}
      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              文件列表 ({files.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {files.map((file) => (
              <div key={file.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="h-5 w-5 text-red-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate" data-testid={`file-name-${file.id}`}>
                        {file.name}
                      </p>
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
                  </div>
                </div>
                
                {(file.status === 'uploading' || file.status === 'processing') && (
                  <Progress value={file.progress} className="h-2" />
                )}
                
                {file.status === 'completed' && file.extractedText && (
                  <div className="mt-3 p-3 bg-muted rounded-md">
                    <p className="text-sm text-muted-foreground mb-2">提取的文本預覽:</p>
                    <p className="text-sm">{file.extractedText}</p>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="mt-2"
                      onClick={() => console.log('Create document from', file.name)}
                      data-testid={`button-create-document-${file.id}`}
                    >
                      建立文件
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}