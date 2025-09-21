import { useState } from "react";
import { LettersGroupedList } from "@/components/LettersGroupedList";
import { FileUploadFeature } from "@/components/FileUploadFeature";

export function LettersList() {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div 
      className="relative h-full"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
      }}
    >
      <LettersGroupedList />
      
      {/* File upload overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50">
          <FileUploadFeature 
            isDragOver={isDragOver}
            setIsDragOver={setIsDragOver}
            objectType="letter"
          />
        </div>
      )}
    </div>
  );
}