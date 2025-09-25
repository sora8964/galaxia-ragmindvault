import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { ObjectType, getObjectTypeRoute, getObjectTypeCreateRoute, OBJECT_TYPES } from '@shared/schema';

// @mention 代碼的正則表達式
// 匹配格式：@[type:name] 或 @[type:name|displayName]
const MENTION_REGEX = /@\[(\w+):([^\]|]+)(?:\|([^\]]+))?\]/g;

interface MentionData {
  type: ObjectType;
  name: string;
  displayName?: string;
  exists: boolean;
  id?: string;
}

interface MentionLinkProps {
  mention: MentionData;
  className?: string;
  isAIResponse?: boolean; // 是否為AI回覆，如果是，則不存在的對象只顯示純文字
}

// 檢查物件是否存在的 hook
function useObjectExists(type: ObjectType, name: string) {
  return useQuery({
    queryKey: ['object-exists', type, name],
    queryFn: async () => {
      const response = await fetch(`/api/objects?type=${type}&name=${encodeURIComponent(name)}`);
      const data = await response.json();
      const found = data.objects?.find((obj: any) => obj.name === name && obj.type === type);
      return {
        exists: !!found,
        id: found?.id
      };
    },
    enabled: !!type && !!name,
    staleTime: 30000, // 30秒內不重新檢查
  });
}

// 單個 @mention 超連結組件
function MentionLink({ mention, className, isAIResponse }: MentionLinkProps) {
  const { data: objectData, isLoading } = useObjectExists(mention.type, mention.name);
  const exists = objectData?.exists ?? false;
  const objectId = objectData?.id;

  const displayText = mention.displayName || mention.name;

  // 如果是AI回覆且對象不存在，只顯示純文字（包括載入中狀態）
  if (isAIResponse && (!exists || isLoading)) {
    return (
      <span 
        className={className}
        data-testid={`mention-text-${mention.type}-${mention.name}`}
      >
        {displayText}
      </span>
    );
  }

  // 根據是否存在選擇不同樣式
  const linkClass = cn(
    'underline transition-colors cursor-pointer',
    exists 
      ? 'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300'
      : 'text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300',
    isLoading && 'opacity-50',
    className
  );

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (exists && objectId) {
      // 跳轉到物件詳細頁面
      const detailPath = getDetailPath(mention.type);
      window.location.href = `${detailPath}/${objectId}`;
    } else {
      // 跳轉到新增頁面並自動填入名稱
      const createPath = getCreatePath(mention.type);
      window.location.href = `${createPath}?name=${encodeURIComponent(mention.name)}`;
    }
  };

  return (
    <span
      className={linkClass}
      onClick={handleClick}
      title={exists ? `檢視 ${mention.name}` : `創建 ${mention.name}`}
      data-testid={`mention-link-${mention.type}-${mention.name}`}
    >
      {displayText}
    </span>
  );
}

// 獲取創建頁面的路徑
function getCreatePath(type: ObjectType): string {
  return getObjectTypeCreateRoute(type);
}

// 獲取詳細頁面的路徑（複數形式）
function getDetailPath(type: ObjectType): string {
  return getObjectTypeRoute(type);
}

// 驗證文檔類型
function isValidObjectType(type: string): type is ObjectType {
  return OBJECT_TYPES.includes(type as ObjectType);
}

// 解析文本中的 @mention 代碼
function parseMentions(text: string): (string | MentionData)[] {
  const parts: (string | MentionData)[] = [];
  let lastIndex = 0;
  
  let match;
  MENTION_REGEX.lastIndex = 0; // 重置正則表達式狀態
  
  while ((match = MENTION_REGEX.exec(text)) !== null) {
    // 添加 @mention 前的文字
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    
    const [fullMatch, type, name, displayName] = match;
    
    // 驗證類型
    if (isValidObjectType(type)) {
      parts.push({
        type,
        name: name.trim(),
        displayName: displayName?.trim(),
        exists: false, // 會在 MentionLink 中檢查
      });
    } else {
      // 如果類型無效，直接添加原文
      parts.push(fullMatch);
    }
    
    lastIndex = match.index + fullMatch.length;
  }
  
  // 添加剩餘的文字
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  return parts;
}

interface MentionParserProps {
  text: string;
  className?: string;
  isAIResponse?: boolean; // 是否為AI回覆，如果是，則不存在的對象只顯示純文字
}

// 主要的 MentionParser 組件
export function MentionParser({ text, className, isAIResponse }: MentionParserProps) {
  const parts = parseMentions(text);
  
  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (typeof part === 'string') {
          return <span key={index}>{part}</span>;
        } else {
          return (
            <MentionLink
              key={`${index}-${part.type}-${part.name}`}
              mention={part}
              isAIResponse={isAIResponse}
            />
          );
        }
      })}
    </span>
  );
}

export default MentionParser;