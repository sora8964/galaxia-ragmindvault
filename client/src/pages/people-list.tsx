import { BaseItemManager } from "@/components/BaseItemManager";
import { User } from "lucide-react";

export function PeopleList() {
  return (
    <BaseItemManager
      itemType="person"
      title="人員管理"
      description="管理和搜索您的人員資料"
      apiEndpoint="/api/objects"
      createButtonText="新增人員"
      emptyStateTitle="還沒有人員"
      emptyStateDescription="創建新人員檔案開始使用"
      dialogTitle="新增人員"
      dialogDescription="創建新的人員檔案，可以使用 @ 功能引用其他文件或人員"
      getIcon={() => <User className="mx-auto h-12 w-12 text-muted-foreground mb-4" />}
    />
  );
}