import { useState } from "react";
import { GroupedItemList } from "@/components/GroupedItemList";
import { FileText } from "lucide-react";

export function DocumentsList() {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div 
      className="relative h-full"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
      }}
    >
      <GroupedItemList
        itemType="document"
        title="文件管理"
        description="管理和搜索您的文件"
        createButtonText="新增文件"
        emptyStateTitle="還沒有文件"
        emptyStateDescription="上傳文件或創建新文件開始使用"
        dialogTitle="新增文件"
        dialogDescription="創建新的文件，可以使用 @ 功能引用其他文件或人員"
        searchPlaceholder="搜索文件..."
        getIcon={() => <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />}
        showFileUpload={true}
        allowedFileTypes={['.pdf', '.doc', '.docx']}
        isDragOver={isDragOver}
        setIsDragOver={setIsDragOver}
      />
    </div>
  );
}