import { CreateItemPage } from "@/components/CreateItemPage";

export function MeetingNew() {
  return (
    <CreateItemPage
      itemType="meeting"
      title="新增會議"
      description="建立新的會議檔案，包含名稱、內容和相關別名"
    />
  );
}