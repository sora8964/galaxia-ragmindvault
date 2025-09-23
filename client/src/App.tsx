import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeProvider } from "./components/ThemeProvider";
import { ThemeToggle } from "./components/ThemeToggle";
import { AppSidebar } from "./components/AppSidebar";
import { ChatInterface } from "./components/ChatInterface";
import { DocumentEditor } from "./components/DocumentEditor";
import { DocumentsList } from "./pages/documents-list";
import { DocumentDetail } from "./pages/document-detail";
import { LogDetails } from "./pages/log-details";
import { DocumentDetails } from "./pages/document-details";
import { MeetingsList } from "./pages/meetings-list";
import { MeetingDetails } from "./pages/meeting-details";
import { PeopleList } from "./pages/people-list";
import { EntitiesList } from "./pages/entities-list";
import { IssuesList } from "./pages/issues-list";
import { LogsList } from "./pages/logs-list";
import { Settings } from "./components/Settings";
import { EntityNew } from "./pages/entity-new";
import { PersonNew } from "./pages/person-new";
import { DocumentNew } from "./pages/document-new";
import { LetterNew } from "./pages/letter-new";
import { LettersList } from "./pages/letters-list";
import { IssueNew } from "./pages/issue-new";
import { LogNew } from "./pages/log-new";
import { MeetingNew } from "./pages/meeting-new";
import { FunctionCallingTest } from "./pages/function-calling-test";
import { SemanticSearchTest } from "./pages/semantic-search-test";
import NotFound from "@/pages/not-found";
import { useState } from "react";
import { useParams } from "wouter";

// Main content pages
function ConversationsPage() {
  return (
    <div className="h-full">
      <ChatInterface />
    </div>
  );
}

function ConversationDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="h-full">
      <ChatInterface conversationId={id} />
    </div>
  );
}


function DocumentsPage() {
  return <DocumentsList />;
}

function MeetingsPage() {
  return <MeetingsList />;
}

function PeoplePage() {
  return <PeopleList />;
}

function EntitiesPage() {
  return <EntitiesList />;
}

function IssuesPage() {
  return <IssuesList />;
}

function LogsPage() {
  return <LogsList />;
}

function LettersPage() {
  return <LettersList />;
}

function SettingsPage() {
  return <Settings />;
}

function FunctionCallingTestPage() {
  return <FunctionCallingTest />;
}

function SemanticSearchTestPage() {
  return <SemanticSearchTest />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={ConversationsPage} />
      <Route path="/conversations" component={ConversationsPage} />
      <Route path="/conversations/:id" component={ConversationDetailPage} />
      
      {/* New item creation routes */}
      <Route path="/entity/new" component={EntityNew} />
      <Route path="/person/new" component={PersonNew} />
      <Route path="/document/new" component={DocumentNew} />
      <Route path="/letter/new" component={LetterNew} />
      <Route path="/issue/new" component={IssueNew} />
      <Route path="/log/new" component={LogNew} />
      <Route path="/meeting/new" component={MeetingNew} />
      
      {/* List and detail routes */}
      <Route path="/documents" component={DocumentsPage} />
      <Route path="/letters" component={LettersPage} />
      <Route path="/documents/:id" component={DocumentDetails} />
      <Route path="/letters/:id" component={DocumentDetail} />
      <Route path="/meetings" component={MeetingsPage} />
      <Route path="/meetings/:id" component={MeetingDetails} />
      <Route path="/people" component={PeoplePage} />
      <Route path="/people/:id" component={DocumentDetail} />
      <Route path="/persons" component={PeoplePage} />
      <Route path="/persons/:id" component={DocumentDetail} />
      <Route path="/entities" component={EntitiesPage} />
      <Route path="/entities/:id" component={DocumentDetail} />
      <Route path="/issues" component={IssuesPage} />
      <Route path="/issues/:id" component={DocumentDetail} />
      <Route path="/logs" component={LogsPage} />
      <Route path="/logs/:id" component={LogDetails} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/function-calling-test" component={FunctionCallingTestPage} />
      <Route path="/semantic-search-test" component={SemanticSearchTestPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const sidebarStyle = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <ThemeProvider defaultTheme="dark">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SidebarProvider style={sidebarStyle as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1">
                <header className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                  <div className="flex items-center gap-2">
                    <SidebarTrigger data-testid="button-sidebar-toggle" />
                    <h1 className="text-lg font-semibold">AI Context Manager</h1>
                  </div>
                  <div className="flex items-center gap-2">
                    <ThemeToggle />
                  </div>
                </header>
                <main className="flex-1 overflow-y-auto">
                  <Router />
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
