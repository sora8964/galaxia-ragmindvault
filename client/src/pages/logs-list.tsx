import { BaseItemManager } from "@/components/BaseItemManager";
import { Clock } from "lucide-react";
import type { Document } from "@shared/schema";

export function LogsList() {
  const handleItemClick = (item: Document) => {
    // Navigate to log detail page
    window.location.href = `/logs/${item.id}`;
  };

  const getIcon = () => <Clock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />;

  return (
    <BaseItemManager
      itemType="log"
      title="日誌管理"
      description="管理和查看系統日誌、活動記錄和操作日誌"
      apiEndpoint="/api/documents"
      createButtonText="新增日誌"
      emptyStateTitle="尚無日誌記錄"
      emptyStateDescription="開始記錄您的第一個日誌條目"
      dialogTitle="新增日誌"
      dialogDescription="創建新的日誌記錄，包含名稱、內容和日期"
      onItemClick={handleItemClick}
      getIcon={getIcon}
    />
  );
}