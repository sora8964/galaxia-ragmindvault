import { FileText, Users, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ContextItem {
  id: string;
  name: string;
  type: 'person' | 'document';
}

interface ContextIndicatorProps {
  contexts: ContextItem[];
  className?: string;
}

export function ContextIndicator({ contexts, className }: ContextIndicatorProps) {
  if (contexts.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Sparkles className="h-3 w-3" />
        <span>自動補全Context:</span>
      </div>
      
      {contexts.map((context) => (
        <Badge
          key={context.id}
          variant="secondary"
          className="text-xs flex items-center gap-1"
          data-testid={`context-badge-${context.id}`}
        >
          {context.type === 'person' ? (
            <Users className="h-3 w-3" />
          ) : (
            <FileText className="h-3 w-3" />
          )}
          <span>{context.name}</span>
        </Badge>
      ))}
    </div>
  );
}