import { RelationshipManagerGeneric } from "./RelationshipManagerGeneric";
import type { DocumentType } from "@shared/schema";

interface RelationshipManagerProps {
  sourceId: string;
  sourceType: DocumentType;
  className?: string;
}

/**
 * Legacy RelationshipManager component that maintains backward compatibility.
 * This is now a wrapper around RelationshipManagerGeneric but provides the same API.
 * 
 * For new implementations, consider using RelationshipManagerGeneric directly
 * for more flexibility and control over relationship types.
 */
export function RelationshipManager({ sourceId, sourceType, className }: RelationshipManagerProps) {
  return (
    <RelationshipManagerGeneric
      sourceId={sourceId}
      sourceType={sourceType}
      className={className}
    />
  );
}