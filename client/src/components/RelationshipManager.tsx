import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Trash2, Link, FileText, Calendar } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import type { Document, Relationship } from "@shared/schema";

interface RelationshipManagerProps {
  sourceId: string;
  sourceType: "document" | "person" | "organization" | "issue" | "log";
  className?: string;
}

interface RelatedIssueResponse {
  document: Document;
  relatedIssues: Array<{
    relationship: Relationship;
    issue: Document;
  }>;
  total: number;
}

export function RelationshipManager({ sourceId, sourceType, className }: RelationshipManagerProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch related issues
  const { data: relatedData, isLoading: isLoadingRelated } = useQuery({
    queryKey: ["/api/documents", sourceId, "related-issues"],
    queryFn: async (): Promise<RelatedIssueResponse> => {
      const response = await fetch(`/api/documents/${sourceId}/related-issues`);
      if (!response.ok) throw new Error("Failed to fetch related issues");
      return response.json();
    }
  });

  // Search for issues to relate
  const { data: searchData, isLoading: isSearching } = useQuery({
    queryKey: ["/api/documents", { type: "issue", search: searchQuery }],
    queryFn: async () => {
      if (!searchQuery.trim()) return { documents: [], total: 0 };
      
      const params = new URLSearchParams({ 
        type: "issue", 
        search: searchQuery.trim() 
      });
      
      const response = await fetch(`/api/documents?${params}`);
      if (!response.ok) throw new Error("Failed to search issues");
      return response.json();
    },
    enabled: !!searchQuery.trim()
  });

  // Create relationship mutation
  const createRelationshipMutation = useMutation({
    mutationFn: async (issueId: string) => {
      const response = await fetch("/api/relationships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId,
          targetId: issueId,
          relationshipType: `${sourceType}_to_issue`
        })
      });
      
      if (!response.ok) throw new Error("Failed to create relationship");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", sourceId, "related-issues"] });
      toast({
        title: "關聯已創建",
        description: "成功關聯到議題"
      });
    },
    onError: () => {
      toast({
        title: "關聯失敗",
        description: "無法創建關聯，請重試",
        variant: "destructive"
      });
    }
  });

  // Delete relationship mutation
  const deleteRelationshipMutation = useMutation({
    mutationFn: async (relationshipId: string) => {
      const response = await fetch(`/api/relationships/${relationshipId}`, {
        method: "DELETE"
      });
      
      if (!response.ok) throw new Error("Failed to delete relationship");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", sourceId, "related-issues"] });
      toast({
        title: "關聯已刪除",
        description: "成功移除關聯"
      });
    },
    onError: () => {
      toast({
        title: "刪除失敗",
        description: "無法刪除關聯，請重試",
        variant: "destructive"
      });
    }
  });

  const handleCreateRelation = (issueId: string) => {
    // Check if already related
    const isAlreadyRelated = relatedData?.relatedIssues.some(
      rel => rel.issue.id === issueId
    );
    
    if (isAlreadyRelated) {
      toast({
        title: "已存在關聯",
        description: "此議題已經與當前項目關聯",
        variant: "destructive"
      });
      return;
    }

    createRelationshipMutation.mutate(issueId);
  };

  const availableIssues = searchData?.documents?.filter((issue: Document) => 
    !relatedData?.relatedIssues.some(rel => rel.issue.id === issue.id)
  ) || [];

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="w-5 h-5" />
            關聯議題
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current relationships */}
          <div>
            <h4 className="font-medium mb-3">已關聯的議題</h4>
            {isLoadingRelated ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <Skeleton className="h-4 w-3/4 mb-1" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-8 w-8" />
                  </div>
                ))}
              </div>
            ) : relatedData?.relatedIssues && relatedData.relatedIssues.length > 0 ? (
              <div className="space-y-2">
                {relatedData.relatedIssues.map(({ relationship, issue }) => (
                  <div 
                    key={relationship.id} 
                    className="flex items-center justify-between p-3 border rounded-lg hover-elevate"
                    data-testid={`related-issue-${issue.id}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{issue.name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {issue.date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {issue.date}
                          </div>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {relationship.relationshipType}
                        </Badge>
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`button-delete-relation-${relationship.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>移除關聯</AlertDialogTitle>
                          <AlertDialogDescription>
                            確定要移除與議題「{issue.name}」的關聯嗎？
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteRelationshipMutation.mutate(relationship.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            移除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Link className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>尚未關聯任何議題</p>
              </div>
            )}
          </div>

          {/* Search and add new relationships */}
          <div>
            <h4 className="font-medium mb-3">關聯新議題</h4>
            <div className="space-y-4">
              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="搜尋議題..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-issues"
                />
              </div>

              {/* Search results */}
              {searchQuery.trim() && (
                <div>
                  {isSearching ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex-1">
                            <Skeleton className="h-4 w-3/4 mb-1" />
                            <Skeleton className="h-3 w-1/2" />
                          </div>
                          <Skeleton className="h-8 w-20" />
                        </div>
                      ))}
                    </div>
                  ) : availableIssues.length > 0 ? (
                    <div className="space-y-2">
                      {availableIssues.map((issue: Document) => (
                        <div 
                          key={issue.id} 
                          className="flex items-center justify-between p-3 border rounded-lg hover-elevate"
                          data-testid={`search-result-${issue.id}`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <FileText className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium">{issue.name}</span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              {issue.date && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {issue.date}
                                </div>
                              )}
                              <p className="line-clamp-1">{issue.content}</p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleCreateRelation(issue.id)}
                            disabled={createRelationshipMutation.isPending}
                            data-testid={`button-add-relation-${issue.id}`}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            關聯
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : searchData && searchData.documents ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>找不到相關議題</p>
                      <p className="text-sm">或所有相關議題都已關聯</p>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}