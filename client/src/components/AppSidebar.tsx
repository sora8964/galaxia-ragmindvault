import { FileText, Users, MessageSquare, Upload, Settings, Search, Plus } from "lucide-react";
import { Link } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface DocumentItem {
  id: string;
  name: string;
  type: 'person' | 'document';
  lastModified: string;
}

// TODO: Remove mock data when implementing real backend
const mockDocuments: DocumentItem[] = [
  { id: '1', name: '習近平', type: 'person', lastModified: '2024-01-15' },
  { id: '2', name: '項目計劃書', type: 'document', lastModified: '2024-01-14' },
  { id: '3', name: '技術文檔', type: 'document', lastModified: '2024-01-13' },
  { id: '4', name: '李克強', type: 'person', lastModified: '2024-01-12' },
];

export function AppSidebar() {
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDocs = mockDocuments.filter(doc => 
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDocumentSelect = (docId: string) => {
    console.log('Document selected:', docId);
    setSelectedDoc(docId);
  };

  const handleNewDocument = () => {
    console.log('New document button triggered');
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-primary" />
          <span className="font-semibold text-sidebar-foreground">AI Context Manager</span>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild data-testid="link-conversations">
                  <Link href="/conversations">
                    <MessageSquare className="h-4 w-4" />
                    <span>Conversations</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild data-testid="link-documents">
                  <Link href="/documents">
                    <FileText className="h-4 w-4" />
                    <span>文件</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild data-testid="link-settings">
                  <Link href="/settings">
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <div className="flex items-center justify-between px-2">
            <SidebarGroupLabel>Documents</SidebarGroupLabel>
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-6 w-6"
              onClick={handleNewDocument}
              data-testid="button-new-document"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          
          <div className="px-2 pb-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-2 py-1.5 text-sm bg-sidebar-accent text-sidebar-accent-foreground rounded-md border border-sidebar-border focus:outline-none focus:ring-1 focus:ring-ring"
                data-testid="input-search-documents"
              />
            </div>
          </div>
          
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredDocs.map((doc) => (
                <SidebarMenuItem key={doc.id}>
                  <SidebarMenuButton
                    onClick={() => handleDocumentSelect(doc.id)}
                    className={selectedDoc === doc.id ? "bg-sidebar-accent" : ""}
                    data-testid={`link-document-${doc.id}`}
                  >
                    {doc.type === 'person' ? (
                      <Users className="h-4 w-4" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    <div className="flex flex-col items-start">
                      <span className="text-sm">{doc.name}</span>
                      <span className="text-xs text-muted-foreground">{doc.lastModified}</span>
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="p-4">
        <div className="text-xs text-muted-foreground text-center">
          {filteredDocs.length} documents
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}