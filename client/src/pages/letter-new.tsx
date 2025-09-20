import { CreateItemPage } from "@/components/CreateItemPage";

export function LetterNew() {
  return (
    <CreateItemPage
      itemType="letter"
      title="新增書信"
      description="建立新的書信檔案，包含名稱、內容和相關別名"
    />
  );
}