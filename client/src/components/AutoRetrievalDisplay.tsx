import { SearchIcon, FileText, Users, Building, ClipboardList, AlertCircle, Calendar, Briefcase, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Link } from "wouter";

export interface AutoRetrievalInfo {
  usedDocs: Array<{
    id: string;
    name: string;
    type: 'person' | 'document' | 'letter' | 'entity' | 'issue' | 'log' | 'meeting';
  }>;
  retrievalMetadata: {
    totalDocs: number;
    totalChunks: number;
    strategy: string;
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

function getTypeIcon(type: string) {
  switch (type) {
    case 'person': return Users;
    case 'document': return FileText;
    case 'letter': return FileText;
    case 'entity': return Building;
    case 'issue': return AlertCircle;
    case 'log': return ClipboardList;
    case 'meeting': return Calendar;
    default: return Briefcase;
  }
}

function getTypeName(type: string) {
  const typeNames = {
    'person': '人員',
    'document': '文件',
    'letter': '信件',
    'entity': '實體',
    'issue': '問題',
    'log': '記錄',
    'meeting': '會議'
  };
  return typeNames[type as keyof typeof typeNames] || type;
}

function getDetailPath(type: string): string {
  const typeMap: Record<string, string> = {
    'person': '/people',
    'document': '/documents',
    'letter': '/letters',
    'entity': '/entities',
    'issue': '/issues',
    'log': '/logs',
    'meeting': '/meetings'
  };
  return typeMap[type] || '/objects';
}

export function AutoRetrievalDisplay({ autoRetrieved, className }: AutoRetrievalDisplayProps) {
  const docCount = autoRetrieved?.usedDocs?.length || 0;
  const citations = autoRetrieved?.citations || [];
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div 
      className={cn(
        "flex flex-col gap-2 px-3 py-2 rounded-lg border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200",
        className
      )}
      data-testid="auto-retrieval-display"
    >
      <div className="flex items-center gap-2">
        <SearchIcon className="w-4 h-4" />
        <Button
          variant="ghost"
          size="sm"
          className="p-0 h-auto text-sm font-medium text-blue-800 dark:text-blue-200 hover:bg-transparent"
          onClick={() => setIsExpanded(!isExpanded)}
          data-testid="button-toggle-retrieval-details"
        >
          自動檢索了 {docCount} 個相關物件
          {docCount > 0 && (
            isExpanded ? 
              <ChevronUp className="w-4 h-4 ml-1" /> : 
              <ChevronDown className="w-4 h-4 ml-1" />
          )}
        </Button>
        
        {autoRetrieved?.retrievalMetadata?.processingTimeMs && (
          <span className="text-xs text-blue-600 dark:text-blue-400">
            ({autoRetrieved.retrievalMetadata.processingTimeMs}ms)
          </span>
        )}
      </div>
      
      {docCount > 0 && autoRetrieved && isExpanded && (
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
  );
}