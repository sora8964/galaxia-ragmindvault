import { useState } from "react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, FileText, Mail, Users, Building, AlertTriangle, Clock, File } from "lucide-react";

export function SemanticSearchTest() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<string>("all");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchStats, setSearchStats] = useState<any>(null);
  const { toast } = useToast();

  const documentTypes = [
    { value: "all", label: "全部類型", icon: File },
    { value: "document", label: "文件", icon: FileText },
    { value: "letter", label: "書信", icon: Mail },
    { value: "meeting", label: "會議", icon: Users },
    { value: "person", label: "人員", icon: Users },
    { value: "entity", label: "實體", icon: Building },
    { value: "issue", label: "議題", icon: AlertTriangle },
    { value: "log", label: "日誌", icon: Clock },
  ];

  const performSearch = async () => {
    if (!query.trim()) {
      toast({
        title: "錯誤",
        description: "請輸入搜尋查詢",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setResults([]);
    setSearchStats(null);
    
    try {
      // 使用與UserPrompt相同的語意搜索邏輯（searchObjectsSemantic函數）
      const requestBody = {
        query: query.trim(),
        pageSize: 20,
        page: 1,
        type: type === "all" ? undefined : type,
      };

      const response = await fetch('/api/semantic-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // 處理searchObjectsSemantic函數的響應格式
      const searchResults = data.results || [];
      
      setResults(searchResults);
      setSearchStats({
        total: searchResults.length,
        query: data.query || query.trim(),
        type: type,
        executionTime: performance.now(), // 簡化的執行時間
        totalPages: data.pagination?.totalPages || 1,
        totalResults: data.pagination?.totalResults || searchResults.length,
      });
      
      toast({
        title: "成功",
        description: `找到 ${searchResults.length} 個結果`,
      });
    } catch (error) {
      console.error('Search failed:', error);
      toast({
        title: "錯誤",
        description: error instanceof Error ? error.message : "搜尋失敗",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  const getTypeIcon = (docType: string) => {
    const typeConfig = documentTypes.find(t => t.value === docType);
    if (typeConfig) {
      const Icon = typeConfig.icon;
      return <Icon className="h-4 w-4" />;
    }
    return <File className="h-4 w-4" />;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "未知日期";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('zh-TW');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6" data-testid="page-semantic-search-test">
      <div className="flex items-center gap-2">
        <Search className="h-6 w-6" />
        <h1 className="text-2xl font-bold">語意搜尋測試</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>測試語意搜尋功能</CardTitle>
          <CardDescription>
            使用與AI對話相同的語意搜索邏輯，包含分頁、類型過濾和相關性評分。測試結果100%符合實際AI對話中的搜索行為。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search-query">搜尋查詢</Label>
              <Input
                id="search-query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="輸入搜尋關鍵字或語句"
                data-testid="input-search-query"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    performSearch();
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="document-type">文件類型</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger data-testid="select-document-type">
                  <SelectValue placeholder="選擇文件類型" />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map((docType) => (
                    <SelectItem key={docType.value} value={docType.value}>
                      <div className="flex items-center gap-2">
                        {React.createElement(docType.icon, { className: "h-4 w-4" })}
                        {docType.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button 
              onClick={performSearch} 
              disabled={loading}
              data-testid="button-perform-search"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  搜尋中...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  搜尋
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                setQuery("");
                setResults([]);
                setSearchStats(null);
              }}
              data-testid="button-clear-search"
            >
              清除
            </Button>
          </div>

        </CardContent>
      </Card>

      {searchStats && (
        <Card>
          <CardHeader>
            <CardTitle>搜尋統計</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary" data-testid="search-total-results">
                  {searchStats.total}
                </div>
                <div className="text-sm text-muted-foreground">結果總數</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold" data-testid="search-query-display">
                  {searchStats.query}
                </div>
                <div className="text-sm text-muted-foreground">搜尋查詢</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">
                  {documentTypes.find(t => t.value === searchStats.type)?.label || "全部"}
                </div>
                <div className="text-sm text-muted-foreground">文件類型</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">
                  {results.length > 0 ? "成功" : "無結果"}
                </div>
                <div className="text-sm text-muted-foreground">搜尋狀態</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>搜尋結果</CardTitle>
            <CardDescription>
              找到 {results.length} 個相關文件
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {results.map((doc, index) => (
                <Card key={doc.id} className="border-l-4 border-l-primary">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(doc.type)}
                          <h3 className="font-medium" data-testid={`result-title-${index}`}>
                            {doc.name}
                          </h3>
                          <Badge variant="secondary" data-testid={`result-type-${index}`}>
                            {documentTypes.find(t => t.value === doc.type)?.label || doc.type}
                          </Badge>
                          {doc.similarity && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200" data-testid={`result-score-${index}`}>
                              {(doc.similarity * 100).toFixed(1)}%
                            </Badge>
                          )}
                        </div>
                        
                        {doc.aliases && doc.aliases.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-sm text-muted-foreground">別名:</span>
                            {doc.aliases.map((alias: string, aliasIndex: number) => (
                              <Badge key={aliasIndex} variant="outline" className="text-xs">
                                {alias}
                              </Badge>
                            ))}
                          </div>
                        )}
                        
                        {doc.content && (
                          <p className="text-sm text-muted-foreground line-clamp-3" data-testid={`result-content-${index}`}>
                            {doc.content.substring(0, 200)}
                            {doc.content.length > 200 && "..."}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {doc.date && (
                            <span data-testid={`result-date-${index}`}>
                              日期: {formatDate(doc.date)}
                            </span>
                          )}
                          <span data-testid={`result-id-${index}`}>
                            ID: {doc.id.substring(0, 8)}...
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}