import { Mail } from "lucide-react";
import { GroupedItemList } from "./GroupedItemList";

export function LettersGroupedList() {
  return (
    <GroupedItemList
      itemType="letter"
      title="書信管理"
      description="管理和搜索您的書信"
      createButtonText="新增書信"
      emptyStateTitle="還沒有書信"
      emptyStateDescription="上傳書信檔案或創建新書信開始使用"
      dialogTitle="新增書信"
      dialogDescription="創建新的書信，可以使用 @ 功能引用其他文件或人員"
      searchPlaceholder="搜索書信..."
      getIcon={() => <Mail className="mx-auto h-12 w-12 text-muted-foreground mb-4" />}
      showFileUpload={true}
      allowedFileTypes={['.pdf', '.doc', '.docx']}
    />
  );
}