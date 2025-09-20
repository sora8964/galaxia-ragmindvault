import { CreateItemPage } from "@/components/CreateItemPage";

export function DocumentNew() {
  return (
    <CreateItemPage
      itemType="document"
      title="新增文檔"
      description="建立新的文檔檔案，包含名稱、內容和相關別名"
    />
  );
}