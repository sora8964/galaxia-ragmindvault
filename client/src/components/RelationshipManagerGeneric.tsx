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
import { Search, Plus, Trash2, Link, FileText, Calendar, User, Building, AlertTriangle, BookOpen, ArrowRight, ArrowLeft } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import type { AppObject, Relationship, DocumentType } from "@shared/schema";

interface RelationshipManagerGenericProps {
  sourceId: string;
  sourceType: DocumentType;
  className?: string;
}

interface RelationshipWithDocument {
  relationship: Relationship;
  relatedDocument: AppObject;
  direction: "outgoing" | "incoming";
}

interface RelationshipResponse {
  relationships: RelationshipWithDocument[];
  total: number;
}

// Document type labels and icons
const DOCUMENT_TYPE_CONFIG = {
  person: { label: "人員", icon: User, color: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  document: { label: "文件", icon: FileText, color: "bg-green-500/10 text-green-700 dark:text-green-300" },
  organization: { label: "組織", icon: Building, color: "bg-purple-500/10 text-purple-700 dark:text-purple-300" },
  issue: { label: "議題", icon: AlertTriangle, color: "bg-orange-500/10 text-orange-700 dark:text-orange-300" },
  log: { label: "日誌", icon: BookOpen, color: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" },
};

// Common relationship kinds
const RELATION_KINDS = [
  { value: "related", label: "相關" },
  { value: "mentions", label: "提及" },
  { value: "depends_on", label: "依賴於" },
  { value: "contains", label: "包含" },
  { value: "member_of", label: "成員" },
  { value: "assigned_to", label: "指派給" },
  { value: "created_by", label: "創建者" },
  { value: "owned_by", label: "擁有者" },
];

export function RelationshipManagerGeneric({ sourceId, sourceType, className }: RelationshipManagerGenericProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTargetType, setSelectedTargetType] = useState<DocumentType | "">("");
  const [selectedRelationKind, setSelectedRelationKind] = useState("related");

  // Fetch existing relationships
  const { data: relationshipData, isLoading: isLoadingRelationships } = useQuery({
    queryKey: ["/api/objects", sourceId, "relationships"],
    queryFn: async (): Promise<RelationshipResponse> => {
      const response = await fetch(`/api/objects/${sourceId}/relationships?direction=both`);
      if (!response.ok) throw new Error("Failed to fetch relationships");
      return response.json();
    }
  });

  // Search for documents to relate
  const { data: searchData, isLoading: isSearching } = useQuery({
    queryKey: ["/api/objects", { type: selectedTargetType, search: searchQuery }],
    queryFn: async () => {
      if (!searchQuery.trim() || !selectedTargetType) return { documents: [], total: 0 };
      
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
    mutationFn: async ({ targetId, targetType }: { targetId: string; targetType: DocumentType }) => {
      const response = await fetch("/api/relationships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId,
          targetId,
          sourceType,
          targetType,
          relationKind: selectedRelationKind,
          relationshipType: `${sourceType}_to_${targetType}` // For backward compatibility
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
        description: `成功創建${RELATION_KINDS.find(k => k.value === selectedRelationKind)?.label}關聯`
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

  const handleCreateRelation = (targetId: string, targetType: DocumentType) => {
    // Check if already related with the same relationKind
    const isAlreadyRelated = relationshipData?.relationships.some(
      rel => {
        const sameNodes = (rel.relationship.sourceId === sourceId && rel.relationship.targetId === targetId) ||
                         (rel.relationship.targetId === sourceId && rel.relationship.sourceId === targetId);
        const sameKind = rel.relationship.relationKind === selectedRelationKind;
        return sameNodes && sameKind;
      }
    );
    
    if (isAlreadyRelated) {
      const relationLabel = RELATION_KINDS.find(k => k.value === selectedRelationKind)?.label || selectedRelationKind;
      toast({
        title: "已存在關聯",
        description: `「${relationLabel}」關聯已存在於這兩個項目之間`,
        variant: "destructive"
      });
      return;
    }

    createRelationshipMutation.mutate({ targetId, targetType });
  };

  const getTypeIcon = (type: DocumentType) => {
    const Icon = DOCUMENT_TYPE_CONFIG[type].icon;
    return <Icon className="w-4 h-4" />;
  };

  const getTypeColor = (type: DocumentType) => {
    return DOCUMENT_TYPE_CONFIG[type].color;
  };

  const getDirectionIcon = (direction: "outgoing" | "incoming") => {
    return direction === "outgoing" ? 
      <ArrowRight className="w-3 h-3 text-muted-foreground" /> : 
      <ArrowLeft className="w-3 h-3 text-muted-foreground" />;
  };

  const availableDocuments = searchData?.documents?.filter((doc: Document) => 
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
                {relationshipData.relationships.map(({ relationship, relatedDocument, direction }) => (
                  <div 
                    key={relationship.id} 
                    className="flex items-center justify-between p-3 border rounded-lg hover-elevate"
                    data-testid={`related-document-${relatedDocument.id}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getTypeIcon(relatedDocument.type)}
                        <span className="font-medium">{relatedDocument.name}</span>
                        {getDirectionIcon(direction)}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {relatedDocument.date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {relatedDocument.date}
                          </div>
                        )}
                        <Badge variant="outline" className={`text-xs ${getTypeColor(relatedDocument.type)}`}>
                          {DOCUMENT_TYPE_CONFIG[relatedDocument.type].label}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {RELATION_KINDS.find(k => k.value === relationship.relationKind)?.label || relationship.relationKind}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {direction === "outgoing" ? "出站" : "入站"}
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
              <Select value={selectedTargetType} onValueChange={(value: DocumentType | "") => {
                setSelectedTargetType(value);
                setSearchQuery(""); // Clear search when type changes
              }}>
                <SelectTrigger data-testid="select-target-type">
                  <SelectValue placeholder="選擇要關聯的項目類型" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOCUMENT_TYPE_CONFIG).map(([type, config]) => (
                    <SelectItem key={type} value={type}>
                      <div className="flex items-center gap-2">
                        <config.icon className="w-4 h-4" />
                        {config.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Relation kind selector */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">關聯類型</label>
              <Select value={selectedRelationKind} onValueChange={setSelectedRelationKind}>
                <SelectTrigger data-testid="select-relation-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELATION_KINDS.map(kind => (
                    <SelectItem key={kind.value} value={kind.value}>
                      {kind.label}
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
                    placeholder={`搜尋${DOCUMENT_TYPE_CONFIG[selectedTargetType].label}...`}
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
                      availableDocuments.map((doc: Document) => (
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
                                {DOCUMENT_TYPE_CONFIG[doc.type].label}
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
                        沒有找到符合條件的{DOCUMENT_TYPE_CONFIG[selectedTargetType].label}
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