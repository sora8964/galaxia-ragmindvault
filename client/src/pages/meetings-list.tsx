import { useState } from "react";
import { BaseItemManager } from "@/components/BaseItemManager";
import { FileUploadFeature } from "@/components/FileUploadFeature";
import { Button } from "@/components/ui/button";
import { Users, Upload } from "lucide-react";

export function MeetingsList() {
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
        itemType="meeting"
        title="會議記錄"
        description="管理和搜索您的會議記錄"
        apiEndpoint="/api/objects"
        createButtonText="新增會議記錄"
        emptyStateTitle="還沒有會議記錄"
        emptyStateDescription="上傳會議記錄或創建新會議記錄開始使用"
        dialogTitle="新增會議記錄"
        dialogDescription="創建新的會議記錄，可以使用 @ 功能引用其他文件或人員"
        renderAdditionalButtons={renderAdditionalButtons}
        getIcon={() => <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />}
      />
    </div>
  );
}