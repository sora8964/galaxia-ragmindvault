import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, TestTube, Search, FileText, Plus, Edit, Lightbulb, Hash, BookOpen } from "lucide-react";

export function FunctionCallingTest() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeFunction, setActiveFunction] = useState("");
  const { toast } = useToast();

  // Form states for different functions
  const [searchForm, setSearchForm] = useState({
    query: "",
    type: "",
    limit: 5
  });

  const [detailsForm, setDetailsForm] = useState({
    documentId: ""
  });

  const [createForm, setCreateForm] = useState({
    name: "",
    type: "document",
    content: "",
    aliases: ""
  });

  const [updateForm, setUpdateForm] = useState({
    documentId: "",
    name: "",
    content: "",
    aliases: ""
  });

  const [similarForm, setSimilarForm] = useState({
    text: "",
    limit: 5,
    threshold: 0.7
  });

  const [mentionsForm, setMentionsForm] = useState({
    text: ""
  });

  const [excerptsForm, setExcerptsForm] = useState({
    query: "",
    documentId: "",
    type: "",
    maxExcerpts: 5,
    contextWindow: 400
  });

  const testFunction = async (functionName: string, args: any) => {
    setLoading(true);
    setActiveFunction(functionName);
    
    try {
      const response = await fetch(`/api/ai/function-call/${functionName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(args),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.text();
      setResult({
        function: functionName,
        args: args,
        result: data
      });
      
      toast({
        title: "成功",
        description: `${functionName} 測試完成`,
      });
    } catch (error) {
      console.error(`${functionName} test failed:`, error);
      toast({
        title: "錯誤",
        description: error instanceof Error ? error.message : `${functionName} 測試失敗`,
        variant: "destructive",
      });
      setResult({ 
        function: functionName,
        args: args,
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    } finally {
      setLoading(false);
      setActiveFunction("");
    }
  };

  const documentTypes = [
    { value: "person", label: "人員" },
    { value: "document", label: "文件" },
    { value: "letter", label: "書信" },
    { value: "entity", label: "實體" },
    { value: "issue", label: "議題" },
    { value: "log", label: "日誌" },
    { value: "meeting", label: "會議" },
  ];

  return (
    <div className="container mx-auto py-6 space-y-6" data-testid="page-function-calling-test">
      <div className="flex items-center gap-2">
        <TestTube className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Function Calling 測試</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AI Function Calling 直接測試</CardTitle>
          <CardDescription>
            直接測試每個 Function Calling 功能，無需自然語言查詢
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="search" className="space-y-4">
            <TabsList className="grid grid-cols-7 w-full">
              <TabsTrigger value="search" className="flex items-center gap-1">
                <Search className="h-4 w-4" />
                搜尋
              </TabsTrigger>
              <TabsTrigger value="details" className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                詳情
              </TabsTrigger>
              <TabsTrigger value="create" className="flex items-center gap-1">
                <Plus className="h-4 w-4" />
                創建
              </TabsTrigger>
              <TabsTrigger value="update" className="flex items-center gap-1">
                <Edit className="h-4 w-4" />
                更新
              </TabsTrigger>
              <TabsTrigger value="similar" className="flex items-center gap-1">
                <Lightbulb className="h-4 w-4" />
                相似
              </TabsTrigger>
              <TabsTrigger value="mentions" className="flex items-center gap-1">
                <Hash className="h-4 w-4" />
                提及
              </TabsTrigger>
              <TabsTrigger value="excerpts" className="flex items-center gap-1">
                <BookOpen className="h-4 w-4" />
                摘錄
              </TabsTrigger>
            </TabsList>

            {/* searchDocuments */}
            <TabsContent value="search" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>searchDocuments - 關鍵字搜尋</CardTitle>
                  <CardDescription>搜尋文件、人員、書信、實體、議題、日誌和會議</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>搜尋關鍵字 *</Label>
                      <Input
                        value={searchForm.query}
                        onChange={(e) => setSearchForm({...searchForm, query: e.target.value})}
                        placeholder="例如：星河明居"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>文件類型</Label>
                      <Select value={searchForm.type} onValueChange={(value) => setSearchForm({...searchForm, type: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="選擇類型（可選）" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">全部類型</SelectItem>
                          {documentTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>結果數量</Label>
                      <Input
                        type="number"
                        value={searchForm.limit}
                        onChange={(e) => setSearchForm({...searchForm, limit: parseInt(e.target.value) || 5})}
                        min="1"
                        max="20"
                      />
                    </div>
                  </div>
                  <Button 
                    onClick={() => testFunction("searchDocuments", searchForm)}
                    disabled={loading || !searchForm.query.trim()}
                  >
                    {loading && activeFunction === "searchDocuments" ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />測試中...</>
                    ) : (
                      <>搜尋文件</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* getDocumentDetails */}
            <TabsContent value="details" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>getDocumentDetails - 獲取文件詳情</CardTitle>
                  <CardDescription>取得特定文件的完整內容和詳細資訊</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>文件 ID *</Label>
                    <Input
                      value={detailsForm.documentId}
                      onChange={(e) => setDetailsForm({...detailsForm, documentId: e.target.value})}
                      placeholder="輸入文件ID"
                    />
                  </div>
                  <Button 
                    onClick={() => testFunction("getDocumentDetails", detailsForm)}
                    disabled={loading || !detailsForm.documentId.trim()}
                  >
                    {loading && activeFunction === "getDocumentDetails" ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />測試中...</>
                    ) : (
                      <>獲取詳情</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* createDocument */}
            <TabsContent value="create" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>createDocument - 創建文件</CardTitle>
                  <CardDescription>創建新的文件、人員檔案、書信等</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>標題/名稱 *</Label>
                      <Input
                        value={createForm.name}
                        onChange={(e) => setCreateForm({...createForm, name: e.target.value})}
                        placeholder="文件標題"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>類型 *</Label>
                      <Select value={createForm.type} onValueChange={(value) => setCreateForm({...createForm, type: value})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {documentTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>內容 *</Label>
                    <Textarea
                      value={createForm.content}
                      onChange={(e) => setCreateForm({...createForm, content: e.target.value})}
                      placeholder="輸入內容"
                      rows={4}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>別名（用逗號分隔）</Label>
                    <Input
                      value={createForm.aliases}
                      onChange={(e) => setCreateForm({...createForm, aliases: e.target.value})}
                      placeholder="別名1, 別名2"
                    />
                  </div>
                  <Button 
                    onClick={() => testFunction("createDocument", {
                      ...createForm,
                      aliases: createForm.aliases ? createForm.aliases.split(',').map(a => a.trim()) : []
                    })}
                    disabled={loading || !createForm.name.trim() || !createForm.content.trim()}
                  >
                    {loading && activeFunction === "createDocument" ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />創建中...</>
                    ) : (
                      <>創建文件</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* updateDocument */}
            <TabsContent value="update" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>updateDocument - 更新文件</CardTitle>
                  <CardDescription>更新現有文件的標題、內容或別名</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>文件 ID *</Label>
                    <Input
                      value={updateForm.documentId}
                      onChange={(e) => setUpdateForm({...updateForm, documentId: e.target.value})}
                      placeholder="要更新的文件ID"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label>新標題（可選）</Label>
                      <Input
                        value={updateForm.name}
                        onChange={(e) => setUpdateForm({...updateForm, name: e.target.value})}
                        placeholder="留空表示不修改"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>新內容（可選）</Label>
                      <Textarea
                        value={updateForm.content}
                        onChange={(e) => setUpdateForm({...updateForm, content: e.target.value})}
                        placeholder="留空表示不修改"
                        rows={4}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>新別名（可選，用逗號分隔）</Label>
                      <Input
                        value={updateForm.aliases}
                        onChange={(e) => setUpdateForm({...updateForm, aliases: e.target.value})}
                        placeholder="留空表示不修改"
                      />
                    </div>
                  </div>
                  <Button 
                    onClick={() => {
                      const updateData: any = { documentId: updateForm.documentId };
                      if (updateForm.name.trim()) updateData.name = updateForm.name;
                      if (updateForm.content.trim()) updateData.content = updateForm.content;
                      if (updateForm.aliases.trim()) updateData.aliases = updateForm.aliases.split(',').map(a => a.trim());
                      testFunction("updateDocument", updateData);
                    }}
                    disabled={loading || !updateForm.documentId.trim()}
                  >
                    {loading && activeFunction === "updateDocument" ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />更新中...</>
                    ) : (
                      <>更新文件</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* findSimilarDocuments */}
            <TabsContent value="similar" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>findSimilarDocuments - 語意相似搜尋</CardTitle>
                  <CardDescription>使用向量相似度找到語意相近的文件</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>參考文字 *</Label>
                    <Textarea
                      value={similarForm.text}
                      onChange={(e) => setSimilarForm({...similarForm, text: e.target.value})}
                      placeholder="輸入要尋找相似內容的文字"
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>結果數量</Label>
                      <Input
                        type="number"
                        value={similarForm.limit}
                        onChange={(e) => setSimilarForm({...similarForm, limit: parseInt(e.target.value) || 5})}
                        min="1"
                        max="20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>相似度門檻 (0-1)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={similarForm.threshold}
                        onChange={(e) => setSimilarForm({...similarForm, threshold: parseFloat(e.target.value) || 0.7})}
                        min="0"
                        max="1"
                      />
                    </div>
                  </div>
                  <Button 
                    onClick={() => testFunction("findSimilarDocuments", similarForm)}
                    disabled={loading || !similarForm.text.trim()}
                  >
                    {loading && activeFunction === "findSimilarDocuments" ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />搜尋中...</>
                    ) : (
                      <>尋找相似文件</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* parseMentions */}
            <TabsContent value="mentions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>parseMentions - @提及解析</CardTitle>
                  <CardDescription>解析文本中的@提及標記並驗證對應文件</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>包含@提及的文字 *</Label>
                    <Textarea
                      value={mentionsForm.text}
                      onChange={(e) => setMentionsForm({...mentionsForm, text: e.target.value})}
                      placeholder="例如：請參考 @[person:張三] 和 @[document:項目計劃書] 的內容"
                      rows={4}
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    格式：@[類型:名稱] 或 @[類型:名稱|別名]<br/>
                    類型：person, document, letter, entity, issue, log, meeting
                  </div>
                  <Button 
                    onClick={() => testFunction("parseMentions", mentionsForm)}
                    disabled={loading || !mentionsForm.text.trim()}
                  >
                    {loading && activeFunction === "parseMentions" ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />解析中...</>
                    ) : (
                      <>解析提及</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* findRelevantExcerpts */}
            <TabsContent value="excerpts" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>findRelevantExcerpts - 智能摘錄檢索</CardTitle>
                  <CardDescription>從文件中找到與查詢相關的摘錄片段</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>查詢問題 *</Label>
                      <Textarea
                        value={excerptsForm.query}
                        onChange={(e) => setExcerptsForm({...excerptsForm, query: e.target.value})}
                        placeholder="你想找什麼內容？"
                        rows={3}
                      />
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>特定文件ID（可選）</Label>
                        <Input
                          value={excerptsForm.documentId}
                          onChange={(e) => setExcerptsForm({...excerptsForm, documentId: e.target.value})}
                          placeholder="留空搜尋所有文件"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>文件類型（可選）</Label>
                        <Select value={excerptsForm.type} onValueChange={(value) => setExcerptsForm({...excerptsForm, type: value})}>
                          <SelectTrigger>
                            <SelectValue placeholder="選擇類型" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">全部類型</SelectItem>
                            {documentTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>最大摘錄數量</Label>
                      <Input
                        type="number"
                        value={excerptsForm.maxExcerpts}
                        onChange={(e) => setExcerptsForm({...excerptsForm, maxExcerpts: parseInt(e.target.value) || 5})}
                        min="1"
                        max="10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>上下文窗口大小</Label>
                      <Input
                        type="number"
                        value={excerptsForm.contextWindow}
                        onChange={(e) => setExcerptsForm({...excerptsForm, contextWindow: parseInt(e.target.value) || 400})}
                        min="100"
                        max="1000"
                        step="100"
                      />
                    </div>
                  </div>
                  <Button 
                    onClick={() => testFunction("findRelevantExcerpts", excerptsForm)}
                    disabled={loading || !excerptsForm.query.trim()}
                  >
                    {loading && activeFunction === "findRelevantExcerpts" ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />檢索中...</>
                    ) : (
                      <>檢索摘錄</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex gap-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => setResult(null)}
            >
              清除結果
            </Button>
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
              {result.error ? (
                <div className="space-y-2">
                  <Label className="text-destructive">錯誤</Label>
                  <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
                    {result.error}
                  </div>
                  <div className="space-y-2">
                    <Label>調用參數</Label>
                    <div className="p-4 bg-muted rounded-md font-mono text-sm whitespace-pre-wrap overflow-auto max-h-40">
                      {JSON.stringify(result.args, null, 2)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="px-2 py-1 bg-primary text-primary-foreground rounded-md text-sm font-medium">
                      {result.function}
                    </div>
                    <span className="text-sm text-muted-foreground">函數調用成功</span>
                  </div>
                  <div className="space-y-2">
                    <Label>調用參數</Label>
                    <div className="p-4 bg-muted rounded-md font-mono text-sm whitespace-pre-wrap overflow-auto max-h-40">
                      {JSON.stringify(result.args, null, 2)}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>返回結果</Label>
                    <div 
                      className="p-4 bg-muted rounded-md text-sm whitespace-pre-wrap overflow-auto max-h-96"
                      data-testid="test-result-display"
                    >
                      {result.result}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}