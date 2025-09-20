import { CreateItemPage } from "@/components/CreateItemPage";

export function OrganizationNew() {
  return (
    <CreateItemPage
      itemType="organization"
      title="新增組織"
      description="建立新的組織檔案，包含名稱、描述和相關別名"
    />
  );
}