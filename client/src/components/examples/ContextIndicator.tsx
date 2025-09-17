import { ContextIndicator } from '../ContextIndicator';

export default function ContextIndicatorExample() {
  const mockContexts = [
    { id: '1', name: '習近平', type: 'person' as const },
    { id: '2', name: '項目計劃書', type: 'document' as const },
    { id: '3', name: '技術文檔', type: 'document' as const },
  ];

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold">Context Indicators</h3>
      <ContextIndicator contexts={mockContexts} />
    </div>
  );
}