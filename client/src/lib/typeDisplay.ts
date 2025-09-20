/**
 * Shared utility for consistent type display name mapping
 * Ensures all components use the same Chinese display names for object types
 */

export type ObjectType = "document" | "letter" | "person" | "entity" | "issue" | "log" | "meeting";

/**
 * Get Chinese display name for item types
 */
export const getItemTypeDisplayName = (type: ObjectType | string): string => {
  const typeMap: Record<string, string> = {
    "document": "文件",
    "letter": "書信", 
    "person": "人員",
    "entity": "實體",
    "issue": "議題",
    "log": "日誌",
    "meeting": "會議"
  };
  return typeMap[type] || "項目";
};

/**
 * Get Chinese display name for upload context (slightly different wording)
 */
export const getUploadTypeDisplayName = (type: ObjectType | string): string => {
  const typeMap: Record<string, string> = {
    "document": "文件",
    "letter": "書信",
    "meeting": "會議紀錄"
  };
  return typeMap[type] || "文件";
};

/**
 * Get Chinese label for name field (e.g., "文件名稱", "書信標題")
 */
export const getNameFieldLabel = (type: ObjectType | string): string => {
  const typeMap: Record<string, string> = {
    "document": "文件名稱",
    "letter": "書信標題", 
    "person": "人員姓名",
    "entity": "實體名稱",
    "issue": "議題名稱",
    "log": "日誌名稱",
    "meeting": "會議名稱"
  };
  return typeMap[type] || "名稱";
};

/**
 * Get Chinese placeholder for name field
 */
export const getNameFieldPlaceholder = (type: ObjectType | string): string => {
  const typeMap: Record<string, string> = {
    "document": "輸入文件名稱",
    "letter": "輸入書信標題",
    "person": "輸入人員姓名", 
    "entity": "輸入實體名稱",
    "issue": "輸入議題名稱",
    "log": "輸入日誌名稱",
    "meeting": "輸入會議名稱"
  };
  return typeMap[type] || "輸入名稱";
};

/**
 * Get Chinese label for content field
 */
export const getContentFieldLabel = (type: ObjectType | string): string => {
  const typeMap: Record<string, string> = {
    "document": "內容",
    "letter": "書信內容",
    "person": "描述", 
    "entity": "描述",
    "issue": "內容",
    "log": "內容",
    "meeting": "會議內容"
  };
  return typeMap[type] || "內容";
};

/**
 * Get Chinese placeholder for content field
 */
export const getContentFieldPlaceholder = (type: ObjectType | string): string => {
  const typeMap: Record<string, string> = {
    "document": "輸入文件內容，可以使用 @ 來引用其他文件或人員",
    "letter": "輸入書信內容，可以使用 @ 來引用其他文件或人員",
    "person": "輸入人員描述，可以使用 @ 來引用其他文件或人員",
    "entity": "輸入實體描述，可以使用 @ 來引用其他文件或人員", 
    "issue": "輸入議題內容，可以使用 @ 來引用其他文件或人員",
    "log": "輸入日誌內容，可以使用 @ 來引用其他文件或人員",
    "meeting": "輸入會議內容，可以使用 @ 來引用其他文件或人員"
  };
  return typeMap[type] || "輸入內容，可以使用 @ 來引用其他文件或人員";
};