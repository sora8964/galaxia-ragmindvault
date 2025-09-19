import { BaseItemManager } from "@/components/BaseItemManager";
import { AlertTriangle } from "lucide-react";
import type { AppObject } from "@shared/schema";

export function IssuesList() {
  const getIcon = () => <AlertTriangle className="h-4 w-4" />;

  return (
    <BaseItemManager
      itemType="issue"
      title="議題管理"
      description="管理和追蹤系統議題、故障和問題報告"
      apiEndpoint="/api/objects"
      createButtonText="新增議題"
      emptyStateTitle="尚無議題記錄"
      emptyStateDescription="開始記錄您的第一個議題或問題"
      dialogTitle="新增議題"
      dialogDescription="創建新的議題記錄，包含名稱、內容和相關別名"
      getIcon={getIcon}
    />
  );
}