import { CreateItemPage } from "@/components/CreateItemPage";

export function EntityNew() {
  return (
    <CreateItemPage
      itemType="entity"
      title="新增實體"
      description="建立新的實體檔案，包含名稱、描述和相關別名"
    />
  );
}