import { CreateItemPage } from "@/components/CreateItemPage";

export function PersonNew() {
  return (
    <CreateItemPage
      itemType="person"
      title="新增人員"
      description="建立新的人員檔案，包含姓名、描述和相關別名"
    />
  );
}