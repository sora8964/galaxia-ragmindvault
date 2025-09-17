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
import NotFound from "@/pages/not-found";
import { useState } from "react";

// Main content pages
function ConversationsPage() {
  return (
    <div className="h-full">
      <ChatInterface />
    </div>
  );
}


function DocumentsPage() {
  return <DocumentsList />;
}

function SettingsPage() {
  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        <div className="space-y-6">
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-2">Theme</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Toggle theme:</span>
              <ThemeToggle />
            </div>
          </div>
          
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-2">Gemini API</h3>
            <p className="text-sm text-muted-foreground">
              Gemini API configuration will be handled here for function calling and OCR processing.
            </p>
          </div>
          
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold mb-2">Text Embedding</h3>
            <p className="text-sm text-muted-foreground">
              Configure text embedding settings for context completion.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={ConversationsPage} />
      <Route path="/conversations" component={ConversationsPage} />
      <Route path="/documents" component={DocumentsPage} />
      <Route path="/documents/:id" component={DocumentDetail} />
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
