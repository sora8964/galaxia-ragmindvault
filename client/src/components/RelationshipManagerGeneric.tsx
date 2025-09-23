import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Trash2, Link, FileText, Calendar, User, Users, Building, AlertTriangle, BookOpen } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import type { AppObject, Relationship, ObjectType } from "@shared/schema";
import { getObjectTypeConfig } from "@shared/schema";

interface RelationshipManagerGenericProps {
  sourceId: string;
  sourceType: ObjectType;
  className?: string;
}

interface RelationshipWithDocument {
  relationship: Relationship;
  relatedDocument: AppObject;
}

interface RelationshipResponse {
  relationships: RelationshipWithDocument[];
  total: number;
}

// Object type icons and colors (labels come from single source of truth)
const OBJECT_TYPE_STYLE_CONFIG = {
  person: { icon: User, color: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  document: { icon: FileText, color: "bg-green-500/10 text-green-700 dark:text-green-300" },
  letter: { icon: FileText, color: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300" },
  entity: { icon: Building, color: "bg-purple-500/10 text-purple-700 dark:text-purple-300" },
  issue: { icon: AlertTriangle, color: "bg-orange-500/10 text-orange-700 dark:text-orange-300" },
  log: { icon: BookOpen, color: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" },
  meeting: { icon: Users, color: "bg-teal-500/10 text-teal-700 dark:text-teal-300" },
};

const getTypeLabel = (type: ObjectType) => getObjectTypeConfig(type).chineseName;

// Simplified relationship - only basic "related" type
const RELATION_KINDS = [
  { value: "related", label: "關聯" },
];

export function RelationshipManagerGeneric({ sourceId, sourceType, className }: RelationshipManagerGenericProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTargetType, setSelectedTargetType] = useState<ObjectType | "">("");
  const [selectedRelationKind] = useState("related"); // Fixed to "related" only

  // Fetch existing relationships
  const { data: relationshipData, isLoading: isLoadingRelationships } = useQuery({
    queryKey: ["/api/objects", sourceId, "relationships"],
    queryFn: async (): Promise<RelationshipResponse> => {
      const response = await fetch(`/api/objects/${sourceId}/relationships`);
      if (!response.ok) throw new Error("Failed to fetch relationships");
      return response.json();
    }
  });

  // Search for documents to relate
  const { data: searchData, isLoading: isSearching } = useQuery({
    queryKey: ["/api/objects", { type: selectedTargetType, search: searchQuery }],
    queryFn: async () => {
      if (!searchQuery.trim() || !selectedTargetType) return { objects: [], total: 0 };
      
      const params = new URLSearchParams({ 
        type: selectedTargetType, 
        search: searchQuery.trim() 
      });
      
      const response = await fetch(`/api/objects?${params}`);
      if (!response.ok) throw new Error("Failed to search documents");
      return response.json();
    },
    enabled: !!searchQuery.trim() && !!selectedTargetType
  });

  // Create relationship mutation
  const createRelationshipMutation = useMutation({
    mutationFn: async ({ targetId, targetType }: { targetId: string; targetType: ObjectType }) => {
      const response = await fetch("/api/relationships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId,
          targetId,
          sourceType,
          targetType,
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        // Handle specific error codes with better messages
        if (errorData.errorCode === "DUPLICATE_RELATIONSHIP") {
          throw new Error(errorData.detail || errorData.error || "此關聯已存在");
        }
        throw new Error(errorData.error || "Failed to create relationship");
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate both document-scoped and general relationship queries
      queryClient.invalidateQueries({ queryKey: ["/api/objects", sourceId, "relationships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/relationships"] });
      setSearchQuery("");
      toast({
        title: "關聯已創建",
        description: "成功創建關聯"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "關聯失敗",
        description: error.message || "無法創建關聯，請重試",
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
      // Invalidate both document-scoped and general relationship queries
      queryClient.invalidateQueries({ queryKey: ["/api/objects", sourceId, "relationships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/relationships"] });
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

  const handleCreateRelation = (targetId: string, targetType: ObjectType) => {
    // Check if already related between same nodes
    const isAlreadyRelated = relationshipData?.relationships.some(
      rel => {
        const sameNodes = (rel.relationship.sourceId === sourceId && rel.relationship.targetId === targetId) ||
                         (rel.relationship.targetId === sourceId && rel.relationship.sourceId === targetId);
        // Simplified: only check if nodes are the same (no kind checking)
        return sameNodes;
      }
    );
    
    if (isAlreadyRelated) {
      toast({
        title: "已存在關聯",
        description: "關聯已存在於這兩個項目之間",
        variant: "destructive"
      });
      return;
    }

    createRelationshipMutation.mutate({ targetId, targetType });
  };

  const getTypeIcon = (type: ObjectType) => {
    const Icon = OBJECT_TYPE_STYLE_CONFIG[type].icon;
    return <Icon className="w-4 h-4" />;
  };

  const getTypeColor = (type: ObjectType) => {
    return OBJECT_TYPE_STYLE_CONFIG[type].color;
  };


  const availableDocuments = searchData?.objects?.filter((doc: AppObject) => 
    doc.id !== sourceId && !relationshipData?.relationships.some(rel => 
      rel.relatedDocument.id === doc.id
    )
  ) || [];

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="w-5 h-5" />
            通用關聯管理
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current relationships */}
          <div>
            <h4 className="font-medium mb-3">已建立的關聯</h4>
            {isLoadingRelationships ? (
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
            ) : relationshipData?.relationships && relationshipData.relationships.length > 0 ? (
              <div className="space-y-2">
                {relationshipData.relationships.map(({ relationship, relatedDocument }) => (
                  <div 
                    key={relationship.id} 
                    className="flex items-center justify-between p-3 border rounded-lg hover-elevate"
                    data-testid={`related-document-${relatedDocument.id}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getTypeIcon(relatedDocument.type)}
                        <span className="font-medium">{relatedDocument.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {relatedDocument.date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {relatedDocument.date}
                          </div>
                        )}
                        <Badge variant="outline" className={`text-xs ${getTypeColor(relatedDocument.type)}`}>
                          {getTypeLabel(relatedDocument.type)}
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
                            確定要移除與「{relatedDocument.name}」的關聯嗎？
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel data-testid="button-cancel-delete">取消</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteRelationshipMutation.mutate(relationship.id)}
                            className="bg-destructive hover:bg-destructive/90"
                            data-testid="button-confirm-delete"
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
              <p className="text-sm text-muted-foreground">尚未建立任何關聯</p>
            )}
          </div>

          {/* Add new relationship */}
          <div className="border-t pt-6">
            <h4 className="font-medium mb-3">建立新關聯</h4>
            
            {/* Target type selector */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">關聯目標類型</label>
              <Select value={selectedTargetType} onValueChange={(value: ObjectType | "") => {
                setSelectedTargetType(value);
                setSearchQuery(""); // Clear search when type changes
              }}>
                <SelectTrigger data-testid="select-target-type">
                  <SelectValue placeholder="選擇要關聯的項目類型" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(OBJECT_TYPE_STYLE_CONFIG).map(([type, config]) => (
                    <SelectItem key={type} value={type}>
                      <div className="flex items-center gap-2">
                        <config.icon className="w-4 h-4" />
                        {getTypeLabel(type as ObjectType)}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>


            {/* Search input */}
            {selectedTargetType && (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={`搜尋${getTypeLabel(selectedTargetType)}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-targets"
                  />
                </div>

                {/* Search results */}
                {searchQuery.trim() && (
                  <div className="space-y-2">
                    {isSearching ? (
                      <div className="space-y-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex-1">
                              <Skeleton className="h-4 w-3/4 mb-1" />
                              <Skeleton className="h-3 w-1/2" />
                            </div>
                            <Skeleton className="h-8 w-16" />
                          </div>
                        ))}
                      </div>
                    ) : availableDocuments.length > 0 ? (
                      availableDocuments.map((doc: AppObject) => (
                        <div 
                          key={doc.id} 
                          className="flex items-center justify-between p-3 border rounded-lg hover-elevate"
                          data-testid={`search-result-${doc.id}`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {getTypeIcon(doc.type)}
                              <span className="font-medium">{doc.name}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              {doc.date && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {doc.date}
                                </div>
                              )}
                              <Badge variant="outline" className={`text-xs ${getTypeColor(doc.type)}`}>
                                {getTypeLabel(doc.type)}
                              </Badge>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleCreateRelation(doc.id, doc.type)}
                            disabled={createRelationshipMutation.isPending}
                            data-testid={`button-add-relation-${doc.id}`}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            關聯
                          </Button>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        沒有找到符合條件的{getTypeLabel(selectedTargetType)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}