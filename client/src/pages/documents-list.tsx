import { useState } from "react";
import { BaseItemManager } from "@/components/BaseItemManager";
import { FileUploadFeature } from "@/components/FileUploadFeature";
import { Button } from "@/components/ui/button";
import { FileText, Upload } from "lucide-react";

export function DocumentsList() {
  const [isDragOver, setIsDragOver] = useState(false);

  const renderAdditionalButtons = () => (
    <FileUploadFeature 
      isDragOver={isDragOver}
      setIsDragOver={setIsDragOver}
    />
  );

  return (
    <div 
      className="relative h-full"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
      }}
    >
      <BaseItemManager
        itemType="document"
        title="文件管理"
        description="管理和搜索您的文件"
        apiEndpoint="/api/documents"
        createButtonText="新增文件"
        emptyStateTitle="還沒有文件"
        emptyStateDescription="上傳文件或創建新文件開始使用"
        dialogTitle="新增文件"
        dialogDescription="創建新的文件，可以使用 @ 功能引用其他文件或人員"
        renderAdditionalButtons={renderAdditionalButtons}
        getIcon={() => <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />}
      />
    </div>
  );
}