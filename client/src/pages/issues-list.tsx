import { BaseItemManager } from "@/components/BaseItemManager";
import { AlertTriangle } from "lucide-react";
import type { Document } from "@shared/schema";

export function IssuesList() {
  const handleItemClick = (item: Document) => {
    // Navigate to issue detail page
    window.location.href = `/issues/${item.id}`;
  };

  const getIcon = () => <AlertTriangle className="h-4 w-4" />;

  return (
    <BaseItemManager
      itemType="issue"
      title="事件管理"
      description="管理和追蹤系統事件、故障和問題報告"
      apiEndpoint="/api/documents"
      createButtonText="新增事件"
      emptyStateTitle="尚無事件記錄"
      emptyStateDescription="開始記錄您的第一個事件或問題"
      dialogTitle="新增事件"
      dialogDescription="創建新的事件記錄，包含名稱、內容和相關別名"
      onItemClick={handleItemClick}
      getIcon={getIcon}
    />
  );
}