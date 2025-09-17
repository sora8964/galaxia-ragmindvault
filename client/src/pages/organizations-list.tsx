import { BaseItemManager } from "@/components/BaseItemManager";
import { FileUploadFeature } from "@/components/FileUploadFeature";
import { Building } from "lucide-react";
import type { Document } from "@shared/schema";

export function OrganizationsList() {
  const handleItemClick = (item: Document) => {
    // Navigate to organization detail page
    window.location.href = `/organizations/${item.id}`;
  };

  const renderAdditionalButtons = () => {
    return (
      <FileUploadFeature 
        itemType="organization"
        onUploadSuccess={(document) => {
          console.log('Organization document uploaded:', document);
          // The list will be refreshed automatically through React Query cache invalidation
        }}
      />
    );
  };

  const getIcon = () => <Building className="h-4 w-4" />;

  return (
    <BaseItemManager
      itemType="organization"
      title="組織管理"
      description="管理組織資料，包含基本資訊、描述和別名設定"
      apiEndpoint="/api/documents"
      createButtonText="新增組織"
      emptyStateTitle="尚無組織資料"
      emptyStateDescription="開始建立您的第一個組織檔案"
      dialogTitle="新增組織"
      dialogDescription="建立新的組織檔案，包含名稱、描述和相關別名"
      renderAdditionalButtons={renderAdditionalButtons}
      onItemClick={handleItemClick}
      getIcon={getIcon}
    />
  );
}