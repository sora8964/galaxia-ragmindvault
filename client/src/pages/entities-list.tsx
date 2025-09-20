import { BaseItemManager } from "@/components/BaseItemManager";
import { Building } from "lucide-react";

export function EntitiesList() {
  return (
    <BaseItemManager
      itemType="entity"
      title="實體管理"
      description="管理實體資料，包含基本資訊、描述和別名設定"
      apiEndpoint="/api/objects"
      createButtonText="新增實體"
      emptyStateTitle="尚無實體資料"
      emptyStateDescription="開始建立您的第一個實體檔案"
      dialogTitle="新增實體"
      dialogDescription="建立新的實體檔案，包含名稱、描述和相關別名"
      getIcon={() => <Building className="mx-auto h-12 w-12 text-muted-foreground mb-4" />}
    />
  );
}