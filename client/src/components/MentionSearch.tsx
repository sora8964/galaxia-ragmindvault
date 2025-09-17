import { useState, useRef, useEffect } from "react";
import { FileText, Users, Search } from "lucide-react";
import { Card } from "@/components/ui/card";

interface MentionItem {
  id: string;
  name: string;
  type: 'person' | 'document';
  aliases?: string[];
}

interface MentionSearchProps {
  onMentionSelect: (mention: MentionItem, alias?: string) => void;
  searchQuery: string;
  position: { x: number; y: number } | null;
  onClose: () => void;
}

// TODO: Remove mock data when implementing real backend
const mockMentions: MentionItem[] = [
  { 
    id: '1', 
    name: '習近平', 
    type: 'person', 
    aliases: ['習總書記', '習主席', '國家主席']
  },
  { 
    id: '2', 
    name: '項目計劃書', 
    type: 'document', 
    aliases: ['計劃書', '項目文檔']
  },
  { 
    id: '3', 
    name: '技術文檔', 
    type: 'document', 
    aliases: ['技術規範', '開發文檔']
  },
  { 
    id: '4', 
    name: '李克強', 
    type: 'person', 
    aliases: ['李總理', '李克強總理']
  },
];

export function MentionSearch({ onMentionSelect, searchQuery, position, onClose }: MentionSearchProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredMentions = mockMentions.filter(mention => {
    const searchLower = searchQuery.toLowerCase();
    const nameMatch = mention.name.toLowerCase().includes(searchLower);
    const aliasMatch = mention.aliases?.some(alias => 
      alias.toLowerCase().includes(searchLower)
    );
    return nameMatch || aliasMatch;
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

  if (!position || filteredMentions.length === 0) {
    return null;
  }

  const handleMentionClick = (mention: MentionItem, alias?: string) => {
    console.log('Mention selected:', mention.name, alias);
    onMentionSelect(mention, alias);
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
    >
      <div className="p-2">
        <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
          <Search className="h-3 w-3" />
          <span>Search for @mentions</span>
        </div>
        
        <div className="space-y-1 mt-2">
          {filteredMentions.map((mention, index) => (
            <div key={mention.id}>
              <button
                className={`w-full flex items-center gap-2 p-2 rounded-md text-left hover-elevate ${
                  index === selectedIndex ? 'bg-accent text-accent-foreground' : ''
                }`}
                onClick={() => handleMentionClick(mention, mention.aliases?.[0])}
                data-testid={`mention-item-${mention.id}`}
              >
                {mention.type === 'person' ? (
                  <Users className="h-4 w-4 text-chart-1" />
                ) : (
                  <FileText className="h-4 w-4 text-chart-2" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{mention.name}</div>
                  {mention.aliases && mention.aliases.length > 0 && (
                    <div className="text-xs text-muted-foreground truncate">
                      {mention.aliases.join(', ')}
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground capitalize">
                  {mention.type}
                </div>
              </button>
              
              {mention.aliases && mention.aliases.map((alias, aliasIndex) => (
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