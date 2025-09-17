import { DocumentEditor } from '../DocumentEditor';

export default function DocumentEditorExample() {
  const handleSave = (document: any) => {
    console.log('Document saved:', document);
  };

  const handleCancel = () => {
    console.log('Edit cancelled');
  };

  const mockDocument = {
    id: '1',
    name: '習近平',
    type: 'person' as const,
    content: '中華人民共和國國家主席，中國共產黨中央委員會總書記。',
    aliases: ['習總書記', '習主席', '國家主席']
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <DocumentEditor
        document={mockDocument}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </div>
  );
}