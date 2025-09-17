import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Users, FileText, AtSign } from "lucide-react";
import type { MentionItem } from "@shared/schema";

interface SimpleMentionSearchProps {
  onMentionSelect: (mention: MentionItem, alias?: string) => void;
  className?: string;
}

export function SimpleMentionSearch({ onMentionSelect, className = "" }: SimpleMentionSearchProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: mentions = [], isLoading } = useQuery({
    queryKey: ['/api/mentions', searchQuery],
    enabled: open && searchQuery.length > 0,
    queryFn: async () => {
      const response = await fetch(`/api/mentions?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error('Failed to fetch mention suggestions');
      return await response.json() as MentionItem[];
    }
  });

  const handleSelect = (mention: MentionItem, alias?: string) => {
    onMentionSelect(mention, alias);
    setOpen(false);
    setSearchQuery("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={className}
          data-testid="button-mention-search"
        >
          <AtSign className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <Command>
          <CommandInput
            placeholder="搜索人員或文件..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>
              {isLoading ? "搜索中..." : searchQuery ? "找不到相關項目" : "輸入關鍵字搜索"}
            </CommandEmpty>
            {mentions.length > 0 && (
              <>
                <CommandGroup heading="人員">
                  {mentions
                    .filter(mention => mention.type === "person")
                    .map((mention) => (
                      <CommandItem
                        key={mention.id}
                        onSelect={() => handleSelect(mention)}
                        className="flex items-center gap-2"
                        data-testid={`mention-person-${mention.id}`}
                      >
                        <Users className="h-4 w-4" />
                        <div className="flex-1">
                          <div className="font-medium">{mention.name}</div>
                          {mention.aliases.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {mention.aliases.slice(0, 2).map((alias, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {alias}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                </CommandGroup>
                <CommandGroup heading="文件">
                  {mentions
                    .filter(mention => mention.type === "document")
                    .map((mention) => (
                      <CommandItem
                        key={mention.id}
                        onSelect={() => handleSelect(mention)}
                        className="flex items-center gap-2"
                        data-testid={`mention-document-${mention.id}`}
                      >
                        <FileText className="h-4 w-4" />
                        <div className="flex-1">
                          <div className="font-medium">{mention.name}</div>
                          {mention.aliases.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {mention.aliases.slice(0, 2).map((alias, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {alias}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}