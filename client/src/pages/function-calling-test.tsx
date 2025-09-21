import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, TestTube } from "lucide-react";

export function FunctionCallingTest() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const testFunctionCall = async () => {
    if (!query.trim()) {
      toast({
        title: "錯誤",
        description: "請輸入測試查詢",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/ai/function-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          conversationId: 'function-test',
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
      
      toast({
        title: "成功",
        description: "Function calling 測試完成",
      });
    } catch (error) {
      console.error('Function calling test failed:', error);
      toast({
        title: "錯誤",
        description: error instanceof Error ? error.message : "Function calling 測試失敗",
        variant: "destructive",
      });
      setResult({ error: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setLoading(false);
    }
  };

  const quickTests = [
    "搜尋包含星河明居的文件",
    "尋找2025年8月的相關文件",
    "搜尋星河明居 2025年8月",
    "創建一個新的書信文件，標題是測試文件",
    "搜尋所有書信類型的文件",
  ];

  return (
    <div className="container mx-auto py-6 space-y-6" data-testid="page-function-calling-test">
      <div className="flex items-center gap-2">
        <TestTube className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Function Calling 測試</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>測試 AI Function Calling</CardTitle>
          <CardDescription>
            測試 Gemini AI 的 Function Calling 功能，包括搜尋文件、創建文件等操作
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="query">測試查詢</Label>
            <Textarea
              id="query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="輸入要測試的查詢，例如：搜尋包含星河明居的文件"
              rows={3}
              data-testid="textarea-test-query"
            />
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={testFunctionCall} 
              disabled={loading}
              data-testid="button-run-test"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  測試中...
                </>
              ) : (
                "執行測試"
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                setQuery("");
                setResult(null);
              }}
              data-testid="button-clear-test"
            >
              清除
            </Button>
          </div>

          <div className="space-y-2">
            <Label>快速測試選項</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {quickTests.map((testQuery, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => setQuery(testQuery)}
                  data-testid={`button-quick-test-${index}`}
                  className="text-left justify-start"
                >
                  {testQuery}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>測試結果</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>回應內容</Label>
                <div 
                  className="p-4 bg-muted rounded-md font-mono text-sm whitespace-pre-wrap overflow-auto max-h-96"
                  data-testid="test-result-display"
                >
                  {JSON.stringify(result, null, 2)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}