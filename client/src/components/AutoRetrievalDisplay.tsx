import { SearchIcon, FileText, Users, Building, ClipboardList, AlertCircle, Calendar, Briefcase, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Link } from "wouter";
import type { ObjectTypeKey } from "@shared/schema";
import { getObjectTypeLucideIcon, getObjectTypeRoute } from "@shared/schema";

// 圖標組件映射 - 將 schema 中的圖標名稱映射到實際的 React 組件
const iconComponents = {
  User: Users,           // 人員
  FileText: FileText,   // 文件、信件
  Building: Building,   // 實體
  AlertTriangle: AlertCircle,  // 問題
  BookOpen: ClipboardList,     // 日誌
  Users: Calendar       // 會議
} as const;

export interface AutoRetrievalInfo {
  usedDocs: Array<{
    id: string;
    name: string;
    type: 'person' | 'document' | 'letter' | 'entity' | 'issue' | 'log' | 'meeting';
  }>;
  retrievalMetadata: {
    totalDocs: number;
    totalChunks: number;
    estimatedTokens: number;
    processingTimeMs?: number;
  };
  citations?: Array<{
    id: number;
    docId: string;
    docName: string;
    docType: string;
    relevanceScore: number;
  }>;
}

interface AutoRetrievalDisplayProps {
  autoRetrieved: AutoRetrievalInfo | null;
  className?: string;
}

// 使用 schema 中的單一事實來源
const getTypeIcon = (type: string) => {
  const iconName = getObjectTypeLucideIcon(type as ObjectTypeKey);
  return iconComponents[iconName as keyof typeof iconComponents] || Briefcase;
};

const getDetailPath = (type: string): string => {
  return getObjectTypeRoute(type as ObjectTypeKey);
};

export function AutoRetrievalDisplay({ autoRetrieved, className }: AutoRetrievalDisplayProps) {
  const docCount = autoRetrieved?.usedDocs?.length || 0;
  const citations = autoRetrieved?.citations || [];
  const [isExpanded, setIsExpanded] = useState(false);

  if (!autoRetrieved || docCount === 0) {
    return null;
  }

  return (
    <div 
      className={cn(
        "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 rounded-lg border mb-2",
        className
      )}
      data-testid="auto-retrieval-display"
    >
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <SearchIcon className="h-3 w-3 flex-shrink-0 text-blue-600 dark:text-blue-400" />
          <span className="font-medium text-xs text-blue-700 dark:text-blue-300">自動檢索</span>
          <Button
            variant="ghost"
            size="sm"
            className="p-0 h-auto text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-transparent"
            onClick={() => setIsExpanded(!isExpanded)}
            data-testid="button-toggle-retrieval-details"
          >
            檢索了 {docCount} 個相關物件
            {docCount > 0 && (
              isExpanded ? 
                <ChevronUp className="w-3 h-3 ml-1" /> : 
                <ChevronDown className="w-3 h-3 ml-1" />
            )}
          </Button>
          
          {autoRetrieved?.retrievalMetadata?.processingTimeMs && (
            <span className="text-xs text-blue-600 dark:text-blue-400 ml-auto">
              ({autoRetrieved.retrievalMetadata.processingTimeMs}ms)
            </span>
          )}
        </div>
        
        {isExpanded && (
          <div className="flex flex-col gap-1">
            {autoRetrieved.usedDocs.map((doc) => {
              const IconComponent = getTypeIcon(doc.type);
              // Find matching citation for relevance score
              const citation = citations.find(c => c.docId === doc.id);
              const score = citation?.relevanceScore;
              
              return (
                <Link key={doc.id} href={`${getDetailPath(doc.type)}/${doc.id}`}>
                  <Badge 
                    variant="secondary" 
                    className="text-xs h-auto py-1 px-2 justify-start bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700 w-full hover-elevate cursor-pointer"
                    data-testid={`auto-retrieved-doc-${doc.id}`}
                  >
                    <IconComponent className="w-3 h-3 mr-2 flex-shrink-0" />
                    <span className="truncate flex-1">{doc.name}</span>
                    {score && (
                      <span className="ml-2 text-blue-500 flex-shrink-0">
                        {(score * 100).toFixed(0)}%
                      </span>
                    )}
                  </Badge>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}