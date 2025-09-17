import { useState, useRef } from "react";
import { Save, Edit3, FileText, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MentionSearch } from "./MentionSearch";
import { useToast } from "@/hooks/use-toast";

interface DocumentData {
  id?: string;
  name: string;
  type: 'person' | 'document';
  content: string;
  aliases: string[];
}

interface MentionItem {
  id: string;
  name: string;
  type: 'person' | 'document';
  aliases?: string[];
}

interface DocumentEditorProps {
  document?: DocumentData;
  onSave: (document: DocumentData) => void;
  onCancel: () => void;
}

export function DocumentEditor({ document, onSave, onCancel }: DocumentEditorProps) {
  const [formData, setFormData] = useState<DocumentData>({
    name: document?.name || '',
    type: document?.type || 'document',
    content: document?.content || '',
    aliases: document?.aliases || [],
    ...document
  });
  const [newAlias, setNewAlias] = useState('');
  const [mentionPosition, setMentionPosition] = useState<{ x: number; y: number } | null>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, content: value }));

    // Check for @ mention trigger
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    
    if (atIndex !== -1 && (atIndex === 0 || textBeforeCursor[atIndex - 1] === ' ')) {
      const mentionText = textBeforeCursor.slice(atIndex + 1);
      if (!mentionText.includes(' ')) {
        setMentionQuery(mentionText);
        
        if (textareaRef.current) {
          const rect = textareaRef.current.getBoundingClientRect();
          setMentionPosition({
            x: rect.left,
            y: rect.bottom
          });
        }
      } else {
        setMentionPosition(null);
      }
    } else {
      setMentionPosition(null);
    }
  };

  const handleMentionSelect = (mention: MentionItem, alias?: string) => {
    const cursorPosition = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = formData.content.slice(0, cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    
    const mentionSyntax = `@[${mention.type}:${mention.name}${alias ? `|${alias}` : ''}]`;
    
    const newContent = 
      formData.content.slice(0, atIndex) + 
      mentionSyntax + 
      formData.content.slice(cursorPosition);
    
    setFormData(prev => ({ ...prev, content: newContent }));
    setMentionPosition(null);
    textareaRef.current?.focus();
  };

  const handleAddAlias = () => {
    if (newAlias.trim() && !formData.aliases.includes(newAlias.trim())) {
      setFormData(prev => ({
        ...prev,
        aliases: [...prev.aliases, newAlias.trim()]
      }));
      setNewAlias('');
      console.log('Added alias:', newAlias.trim());
    }
  };

  const handleRemoveAlias = (aliasToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      aliases: prev.aliases.filter(alias => alias !== aliasToRemove)
    }));
    console.log('Removed alias:', aliasToRemove);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "錯誤",
        description: "請輸入文件名稱",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    console.log('Saving document:', formData);
    
    // Simulate save operation
    setTimeout(() => {
      onSave(formData);
      setIsSaving(false);
      toast({
        title: "成功",
        description: `${formData.type === 'person' ? '人物' : '文件'} "${formData.name}" 已保存`,
      });
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Edit3 className="h-5 w-5" />
            {document ? '編輯文件' : '新建文件'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">名稱 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="輸入文件名稱"
                data-testid="input-document-name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="type">類型</Label>
              <select
                id="type"
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as 'person' | 'document' }))}
                className="w-full p-2 border rounded-md bg-background text-foreground"
                data-testid="select-document-type"
              >
                <option value="document">文件</option>
                <option value="person">人物</option>
              </select>
            </div>
          </div>

          {/* Aliases */}
          <div className="space-y-2">
            <Label>別名</Label>
            <div className="flex gap-2">
              <Input
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
                placeholder="添加別名..."
                onKeyDown={(e) => e.key === 'Enter' && handleAddAlias()}
                data-testid="input-new-alias"
              />
              <Button 
                onClick={handleAddAlias} 
                variant="outline"
                data-testid="button-add-alias"
              >
                添加
              </Button>
            </div>
            
            {formData.aliases.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.aliases.map((alias, index) => (
                  <Badge 
                    key={index} 
                    variant="secondary" 
                    className="flex items-center gap-1"
                    data-testid={`alias-badge-${index}`}
                  >
                    <span>{alias}</span>
                    <button 
                      onClick={() => handleRemoveAlias(alias)}
                      className="ml-1 text-xs hover:text-destructive"
                      data-testid={`button-remove-alias-${index}`}
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="content">內容</Label>
            <div className="relative">
              <Textarea
                ref={textareaRef}
                id="content"
                value={formData.content}
                onChange={handleContentChange}
                placeholder="輸入文件內容... 使用 @ 來提及其他文件"
                className="min-h-[200px] resize-y"
                data-testid="textarea-document-content"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              支持 @mention 語法：@[type:name] 或 @[type:name|alias]
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button 
          variant="outline" 
          onClick={onCancel}
          data-testid="button-cancel-edit"
        >
          取消
        </Button>
        <Button 
          onClick={handleSave}
          disabled={isSaving || !formData.name.trim()}
          data-testid="button-save-document"
        >
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              保存中...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              保存
            </>
          )}
        </Button>
      </div>

      {/* Mention Search */}
      <MentionSearch
        searchQuery={mentionQuery}
        position={mentionPosition}
        onMentionSelect={handleMentionSelect}
        onClose={() => setMentionPosition(null)}
      />
    </div>
  );
}