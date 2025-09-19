import { useState } from "react";
import { BaseItemManager } from "@/components/BaseItemManager";
import { FileUploadFeature } from "@/components/FileUploadFeature";
import { Building } from "lucide-react";
import type { AppObject } from "@shared/schema";

export function OrganizationsList() {
  const [isDragOver, setIsDragOver] = useState(false);

  const renderAdditionalButtons = () => {
    return (
      <FileUploadFeature 
        isDragOver={isDragOver}
        setIsDragOver={setIsDragOver}
      />
    );
  };

  const getIcon = () => <Building className="h-4 w-4" />;

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
        itemType="organization"
        title="組織管理"
        description="管理組織資料，包含基本資訊、描述和別名設定"
        apiEndpoint="/api/objects"
        createButtonText="新增組織"
        emptyStateTitle="尚無組織資料"
        emptyStateDescription="開始建立您的第一個組織檔案"
        dialogTitle="新增組織"
        dialogDescription="建立新的組織檔案，包含名稱、描述和相關別名"
        renderAdditionalButtons={renderAdditionalButtons}
        getIcon={getIcon}
      />
    </div>
  );
}