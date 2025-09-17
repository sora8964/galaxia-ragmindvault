import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '../AppSidebar';

export default function AppSidebarExample() {
  const style = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-[600px] w-full">
        <AppSidebar />
        <div className="flex-1 bg-background border-l">
          <div className="p-4 text-muted-foreground">
            Main content area
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}