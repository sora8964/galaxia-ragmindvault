import { CreateItemPage } from "@/components/CreateItemPage";

export function LogNew() {
  return (
    <CreateItemPage
      itemType="log"
      title="新增日誌"
      description="建立新的日誌檔案，包含名稱、內容和相關別名"
    />
  );
}