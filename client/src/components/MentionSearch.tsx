import { useState, useRef, useEffect } from "react";
import { FileText, Users, Search, Building, ClipboardList, NotebookPen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";

import type { MentionItem } from "@shared/schema";

interface MentionSearchProps {
  onMentionSelect: (mention: MentionItem, alias?: string) => void;
  searchQuery: string;
  position: { x: number; y: number } | null;
  onClose: () => void;
}

export function MentionSearch({ onMentionSelect, searchQuery, position, onClose }: MentionSearchProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: filteredMentions = [], isLoading } = useQuery({
    queryKey: ['/api/mentions', searchQuery],
    enabled: !!searchQuery && searchQuery.length > 0,
    queryFn: async () => {
      const response = await fetch(`/api/mentions?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error('Failed to fetch mention suggestions');
      return await response.json() as MentionItem[];
    }
  });

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!position) return;
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < filteredMentions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : filteredMentions.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredMentions[selectedIndex]) {
            const mention = filteredMentions[selectedIndex];
            onMentionSelect(mention, mention.aliases?.[0]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, filteredMentions, onMentionSelect, onClose, position]);

  if (!position || (!isLoading && filteredMentions.length === 0)) {
    return null;
  }

  const handleMentionClick = (mention: MentionItem, alias?: string) => {
    console.log('Mention selected:', mention.name, alias);
    onMentionSelect(mention, alias);
  };

  const getTypeIcon = (type: MentionItem['type']) => {
    switch (type) {
      case 'person':
        return <Users className="h-4 w-4 text-chart-1" />;
      case 'document':
        return <FileText className="h-4 w-4 text-chart-2" />;
      case 'organization':
        return <Building className="h-4 w-4 text-chart-3" />;
      case 'issue':
        return <ClipboardList className="h-4 w-4 text-chart-4" />;
      case 'log':
        return <NotebookPen className="h-4 w-4 text-chart-5" />;
      case 'meeting':
        return <Users className="h-4 w-4 text-purple-500" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTypeDisplayName = (type: MentionItem['type']) => {
    switch (type) {
      case 'person':
        return '人員';
      case 'document':
        return '文檔';
      case 'organization':
        return '組織';
      case 'issue':
        return '問題';
      case 'log':
        return '日誌';
      case 'meeting':
        return '會議';
      default:
        return type;
    }
  };

  return (
    <Card 
      ref={containerRef}
      className="absolute z-50 w-72 max-h-64 overflow-y-auto border shadow-lg bg-popover"
      style={{
        left: position.x,
        top: position.y + 20,
      }}
      data-testid="mention-search-dropdown"
      data-mention-dropdown
    >
      <div className="p-2">
        <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
          <Search className="h-3 w-3" />
          <span>Search for @mentions</span>
        </div>
        
        <div className="space-y-1 mt-2">
          {isLoading ? (
            <div className="p-3 text-sm text-muted-foreground flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              搜尋中...
            </div>
          ) : filteredMentions.map((mention, index) => (
            <div key={mention.id}>
              <button
                className={`w-full flex items-center gap-2 p-2 rounded-md text-left hover-elevate ${
                  index === selectedIndex ? 'bg-accent text-accent-foreground' : ''
                }`}
                onClick={() => handleMentionClick(mention, mention.aliases?.[0])}
                data-testid={`mention-item-${mention.id}`}
              >
                {getTypeIcon(mention.type)}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{mention.name}</div>
                  {mention.aliases && mention.aliases.length > 0 && (
                    <div className="text-xs text-muted-foreground truncate">
                      {mention.aliases.join(', ')}
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {getTypeDisplayName(mention.type)}
                </div>
              </button>
              
              {mention.aliases && mention.aliases.length > 0 && mention.aliases.map((alias, aliasIndex) => (
                <button
                  key={`${mention.id}-${aliasIndex}`}
                  className={`w-full flex items-center gap-2 p-2 pl-8 rounded-md text-left hover-elevate ${
                    index === selectedIndex ? 'bg-accent text-accent-foreground' : ''
                  }`}
                  onClick={() => handleMentionClick(mention, alias)}
                  data-testid={`mention-alias-${mention.id}-${aliasIndex}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{alias}</div>
                    <div className="text-xs text-muted-foreground truncate">Alias for {mention.name}</div>
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}