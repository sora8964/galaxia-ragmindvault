import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { SimpleMentionSearch } from "@/components/SimpleMentionSearch";
import { Plus, Calendar, Search, Mail, Eye } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import type { AppObject } from "@shared/schema";

interface LetterForm {
  name: string;
  content: string;
  aliases: string[];
  date?: string | null;
}

interface GroupedLetters {
  [key: string]: AppObject[];
}

export function LettersGroupedList() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newLetterForm, setNewLetterForm] = useState<LetterForm>({
    name: "",
    content: "",
    aliases: [],
    date: null
  });

  // Fetch letters
  const { data: lettersData, isLoading } = useQuery({
    queryKey: ["/api/objects", { type: "letter", search: searchQuery }],
    queryFn: async () => {
      const params = new URLSearchParams({ type: "letter" });
      if (searchQuery) params.append("search", searchQuery);
      
      const response = await fetch(`/api/objects?${params}`);
      if (!response.ok) throw new Error("Failed to fetch letters");
      return response.json();
    }
  });

  // Create new letter mutation
  const createLetterMutation = useMutation({
    mutationFn: async (data: LetterForm) => {
      const response = await fetch("/api/objects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          type: "letter",
          content: data.content,
          aliases: data.aliases,
          date: data.date,
          isFromOCR: false,
          hasBeenEdited: false,
          needsEmbedding: true
        })
      });
      
      if (!response.ok) throw new Error("Failed to create letter");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/objects"] });
      setIsCreating(false);
      setNewLetterForm({ name: "", content: "", aliases: [], date: null });
      toast({
        title: "書信已創建",
        description: "新書信已成功創建並正在生成 embedding"
      });
    },
    onError: () => {
      toast({
        title: "創建失敗",
        description: "無法創建書信，請重試",
        variant: "destructive"
      });
    }
  });

  const handleMentionAdded = (mention: any, alias?: string) => {
    const mentionText = alias ? `@[${mention.type}:${mention.name}|${alias}]` : `@[${mention.type}:${mention.name}]`;
    setNewLetterForm(prev => ({
      ...prev,
      content: prev.content + mentionText
    }));
  };

  const handleLetterClick = (letter: AppObject) => {
    setLocation(`/letters/${letter.id}`);
  };

  // Group letters by month using string manipulation only
  const groupedLetters = useMemo(() => {
    if (!lettersData?.objects) return {};

    const letters = lettersData.objects as AppObject[];
    const groups: GroupedLetters = {};

    letters.forEach((letter) => {
      let groupKey: string;
      
      if (!letter.date || !letter.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        groupKey = "日期未知";
      } else {
        // Extract YYYY-MM from YYYY-MM-DD string and ensure proper padding
        const yearMonth = letter.date.substring(0, 7); // "2025-08"
        const [year, month] = yearMonth.split('-');
        // Ensure month is zero-padded
        const paddedMonth = month.padStart(2, '0');
        groupKey = `${year}年${paddedMonth}月`;
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(letter);
    });

    // Sort letters within each group by date (descending for monthly groups, latest first)
    Object.keys(groups).forEach(groupKey => {
      if (groupKey === "日期未知") {
        // For unknown dates, sort by name
        groups[groupKey].sort((a, b) => a.name.localeCompare(b.name));
      } else {
        // For dated letters, sort by date descending (latest first)
        groups[groupKey].sort((a, b) => {
          if (!a.date && !b.date) return 0;
          if (!a.date) return 1;
          if (!b.date) return -1;
          return b.date.localeCompare(a.date);
        });
      }
    });

    return groups;
  }, [lettersData]);

  // Create sorted group keys: "日期未知" first, then months in descending order
  const sortedGroupKeys = useMemo(() => {
    const keys = Object.keys(groupedLetters);
    const monthKeys = keys.filter(key => key !== "日期未知");
    const unknownKey = keys.find(key => key === "日期未知");

    // Sort month keys by extracting year and month for comparison
    monthKeys.sort((a, b) => {
      // Extract year and month from "2025年08月" format
      const aMatch = a.match(/(\d{4})年(\d{2})月/);
      const bMatch = b.match(/(\d{4})年(\d{2})月/);
      
      if (!aMatch || !bMatch) return 0;
      
      const aYearMonth = `${aMatch[1]}-${aMatch[2]}`;
      const bYearMonth = `${bMatch[1]}-${bMatch[2]}`;
      
      return bYearMonth.localeCompare(aYearMonth); // Descending order
    });

    return unknownKey ? [unknownKey, ...monthKeys] : monthKeys;
  }, [groupedLetters]);

  const totalLetters = lettersData?.objects?.length || 0;

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">書信管理</h1>
            <p className="text-muted-foreground">管理和搜索您的書信</p>
          </div>
          <div className="flex gap-2">
            {/* Create new letter dialog */}
            <Dialog open={isCreating} onOpenChange={setIsCreating}>
              <DialogTrigger asChild>
                <Button data-testid="button-new-letter">
                  <Plus className="w-4 h-4 mr-2" />
                  新增書信
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>新增書信</DialogTitle>
                  <DialogDescription>創建新的書信，可以使用 @ 功能引用其他文件或人員</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="letter-name">書信標題</Label>
                    <Input
                      id="letter-name"
                      value={newLetterForm.name}
                      onChange={(e) => setNewLetterForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="輸入書信標題..."
                      data-testid="input-letter-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="letter-content">書信內容</Label>
                    <div className="relative">
                      <Textarea
                        id="letter-content"
                        value={newLetterForm.content}
                        onChange={(e) => setNewLetterForm(prev => ({ ...prev, content: e.target.value }))}
                        placeholder="輸入書信內容..."
                        className="min-h-32"
                        data-testid="textarea-letter-content"
                      />
                      <SimpleMentionSearch
                        onMentionSelect={handleMentionAdded}
                        className="absolute top-2 right-2"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="letter-date">日期</Label>
                    <Input
                      id="letter-date"
                      type="date"
                      value={newLetterForm.date || ""}
                      onChange={(e) => setNewLetterForm(prev => ({ ...prev, date: e.target.value || null }))}
                      placeholder="YYYY-MM-DD"
                      data-testid="input-letter-date"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsCreating(false)}
                      data-testid="button-cancel-create-letter"
                    >
                      取消
                    </Button>
                    <Button
                      onClick={() => createLetterMutation.mutate(newLetterForm)}
                      disabled={!newLetterForm.name.trim() || createLetterMutation.isPending}
                      data-testid="button-save-create-letter"
                    >
                      {createLetterMutation.isPending ? "創建中..." : "創建書信"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="搜索書信..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-letters"
            />
          </div>
        </div>

        {/* Letters list */}
        {isLoading ? (
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-6 w-32" />
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : totalLetters === 0 ? (
          <div className="text-center py-12">
            <Mail className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {searchQuery ? "找不到相關書信" : "還沒有書信"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? "嘗試調整搜索條件" : "上傳書信檔案或創建新書信開始使用"}
            </p>
            {!searchQuery && (
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="w-4 h-4 mr-2" />
                新增書信
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {sortedGroupKeys.map((groupKey) => (
              <div key={groupKey} className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground border-b pb-2">
                  {groupKey}
                </h2>
                <ul className="space-y-1">
                  {groupedLetters[groupKey].map((letter) => (
                    <li
                      key={letter.id}
                      className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer border border-transparent hover:border-muted-foreground/20 rounded-md transition-all hover-elevate"
                      onClick={() => handleLetterClick(letter)}
                      data-testid={`list-item-letter-${letter.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium text-base truncate">{letter.name}</h3>
                          <div className="flex gap-1 flex-shrink-0">
                            {letter.isFromOCR && (
                              <Badge variant="secondary" className="text-xs">OCR</Badge>
                            )}
                            {letter.hasEmbedding && (
                              <Badge variant="default" className="text-xs">已嵌入</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {letter.date && (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>{letter.date}</span>
                            </div>
                          )}
                          {letter.content && (
                            <p className="truncate flex-1">
                              {letter.content}
                            </p>
                          )}
                        </div>
                        {letter.aliases.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {letter.aliases.slice(0, 3).map((alias, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {alias}
                              </Badge>
                            ))}
                            {letter.aliases.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{letter.aliases.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLetterClick(letter);
                        }}
                        className="ml-4"
                        data-testid={`button-view-details-${letter.id}`}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        查看
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}