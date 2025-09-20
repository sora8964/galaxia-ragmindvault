import { CreateItemPage } from "@/components/CreateItemPage";

export function IssueNew() {
  return (
    <CreateItemPage
      itemType="issue"
      title="新增議題"
      description="建立新的議題檔案，包含名稱、內容和相關別名"
    />
  );
}