import { SearchIcon, FileText, Users, Building, ClipboardList, AlertCircle, Calendar, Briefcase } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

export function AutoRetrievalDisplay({ autoRetrieved, className }: AutoRetrievalDisplayProps) {
  const docCount = autoRetrieved?.usedDocs?.length || 0;
  const citations = autoRetrieved?.citations || [];

  return (
    <div 
      className={cn(
        "inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200",
        className
      )}
      data-testid="auto-retrieval-display"
    >
      <SearchIcon className="w-4 h-4" />
      <span className="text-sm font-medium">
        自動檢索了 {docCount} 個相關文件
      </span>
      
      {docCount > 0 && (
        <div className="flex items-center gap-1">
          {autoRetrieved.usedDocs.slice(0, 3).map((doc) => {
            const IconComponent = getTypeIcon(doc.type);
            // Find matching citation for relevance score
            const citation = citations.find(c => c.docId === doc.id);
            const score = citation?.relevanceScore;
            
            return (
              <Badge 
                key={doc.id} 
                variant="secondary" 
                className="text-xs h-6 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700"
                data-testid={`auto-retrieved-doc-${doc.id}`}
              >
                <IconComponent className="w-3 h-3 mr-1" />
                {doc.name.length > 15 ? `${doc.name.substring(0, 15)}...` : doc.name}
                {score && (
                  <span className="ml-1 text-blue-500">
                    {(score * 100).toFixed(0)}%
                  </span>
                )}
              </Badge>
            );
          })}
          
          {autoRetrieved.usedDocs.length > 3 && (
            <Badge 
              variant="secondary" 
              className="text-xs h-6 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700"
              data-testid="auto-retrieved-more-count"
            >
              +{autoRetrieved.usedDocs.length - 3}
            </Badge>
          )}
        </div>
      )}
      
      {autoRetrieved?.retrievalMetadata?.processingTimeMs && (
        <span className="text-xs text-blue-600 dark:text-blue-400 ml-2">
          ({autoRetrieved.retrievalMetadata.processingTimeMs}ms)
        </span>
      )}
    </div>
  );
}