import { MentionSearch } from '../MentionSearch';

export default function MentionSearchExample() {
  const handleMentionSelect = (mention: any, alias?: string) => {
    console.log('Selected mention:', mention, alias);
  };

  return (
    <div className="relative h-[400px] p-4">
      <p className="text-muted-foreground mb-4">
        This shows the @mention dropdown interface
      </p>
      <MentionSearch
        searchQuery="習"
        position={{ x: 20, y: 80 }}
        onMentionSelect={handleMentionSelect}
        onClose={() => console.log('Mention search closed')}
      />
    </div>
  );
}