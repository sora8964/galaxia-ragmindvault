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
import { PeopleList } from "./pages/people-list";
import { OrganizationsList } from "./pages/organizations-list";
import { IssuesList } from "./pages/issues-list";
import { LogsList } from "./pages/logs-list";
import { Settings } from "./components/Settings";
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

function PeoplePage() {
  return <PeopleList />;
}

function OrganizationsPage() {
  return <OrganizationsList />;
}

function IssuesPage() {
  return <IssuesList />;
}

function LogsPage() {
  return <LogsList />;
}

function SettingsPage() {
  return <Settings />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={ConversationsPage} />
      <Route path="/conversations" component={ConversationsPage} />
      <Route path="/conversations/:id" component={ConversationDetailPage} />
      <Route path="/documents" component={DocumentsPage} />
      <Route path="/documents/:id" component={DocumentDetails} />
      <Route path="/people" component={PeoplePage} />
      <Route path="/people/:id" component={DocumentDetail} />
      <Route path="/organizations" component={OrganizationsPage} />
      <Route path="/organizations/:id" component={DocumentDetail} />
      <Route path="/issues" component={IssuesPage} />
      <Route path="/issues/:id" component={DocumentDetail} />
      <Route path="/logs" component={LogsPage} />
      <Route path="/logs/:id" component={LogDetails} />
      <Route path="/settings" component={SettingsPage} />
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
                <main className="flex-1 overflow-hidden">
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
