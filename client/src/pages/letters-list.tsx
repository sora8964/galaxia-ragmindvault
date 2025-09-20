import { useState } from "react";
import { BaseItemManager } from "@/components/BaseItemManager";
import { FileUploadFeature } from "@/components/FileUploadFeature";
import { Mail } from "lucide-react";

export function LettersList() {
  const [isDragOver, setIsDragOver] = useState(false);

  const renderAdditionalButtons = () => (
    <FileUploadFeature 
      isDragOver={isDragOver}
      setIsDragOver={setIsDragOver}
      objectType="letter"
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
        itemType="letter"
        title="書信管理"
        description="管理和搜索您的書信"
        apiEndpoint="/api/objects"
        createButtonText="新增書信"
        emptyStateTitle="還沒有書信"
        emptyStateDescription="上傳書信檔案或創建新書信開始使用"
        dialogTitle="新增書信"
        dialogDescription="創建新的書信，可以使用 @ 功能引用其他文件或人員"
        renderAdditionalButtons={renderAdditionalButtons}
        getIcon={() => <Mail className="mx-auto h-12 w-12 text-muted-foreground mb-4" />}
      />
    </div>
  );
}