import { BaseItemManager } from "@/components/BaseItemManager";
import { Building } from "lucide-react";

export function OrganizationsList() {
  return (
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
      getIcon={() => <Building className="mx-auto h-12 w-12 text-muted-foreground mb-4" />}
    />
  );
}