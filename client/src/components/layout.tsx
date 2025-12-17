import { Link, useLocation } from "wouter";
import { useApp } from "@/lib/store";
import { 
  LayoutDashboard, 
  PlusCircle, 
  FileText, 
  LogOut, 
  User as UserIcon,
  Settings,
  BarChart2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { currentUser, logout } = useApp();
  const [location] = useLocation();

  if (!currentUser) return <>{children}</>;

  const NavItem = ({ href, icon: Icon, label }: { href: string; icon: any; label: string }) => {
    const isActive = location === href || location.startsWith(href + '/');
    return (
      <Link href={href}>
        <Button
          variant={isActive ? "secondary" : "ghost"}
          className={cn(
            "w-full justify-start gap-3 mb-1", 
            isActive && "bg-sidebar-primary/10 text-sidebar-primary hover:bg-sidebar-primary/20"
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </Button>
      </Link>
    );
  };

  const isAdminOrMgmt = currentUser.role === 'ADMIN' || currentUser.role === 'GM' || currentUser.role === 'AGM';

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col fixed h-full z-10 hidden md:flex">
        <div className="p-4 border-b">
          <img 
            src="/attached_assets/IMG_0336_1765864713224.png" 
            alt="SkyRich Tech Solutions" 
            className="h-12 w-auto object-contain"
          />
          <p className="text-xs text-muted-foreground mt-2">KaizenFlow - Risk Assessment</p>
        </div>

        <div className="flex-1 p-4 overflow-y-auto">
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-muted-foreground mb-3 px-2 uppercase tracking-wider">
              Main
            </h3>
            <NavItem href="/" icon={LayoutDashboard} label="Dashboard" />
            <NavItem href="/requests" icon={FileText} label="All Requests" />
            {currentUser.role === 'INITIATOR' && (
              <NavItem href="/create" icon={PlusCircle} label="New Request" />
            )}
          </div>
          
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground mb-3 px-2 uppercase tracking-wider">
              System
            </h3>
            <NavItem href="/reports" icon={BarChart2} label="Reports" />
            {isAdminOrMgmt && (
              <NavItem href="/settings" icon={Settings} label="Settings" />
            )}
          </div>
        </div>

        <div className="p-4 border-t bg-muted/30">
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="h-9 w-9 border border-border">
              <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${currentUser.first_name || currentUser.username}`} />
              <AvatarFallback>{(currentUser.first_name || currentUser.username || 'U').charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{currentUser.first_name ? `${currentUser.first_name} ${currentUser.last_name || ''}`.trim() : currentUser.username}</p>
              <p className="text-xs text-muted-foreground truncate capitalize">
                {currentUser.role.replace('_', '/')}
              </p>
            </div>
          </div>
          <Button variant="outline" className="w-full justify-start gap-2 text-muted-foreground" onClick={logout}>
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 flex flex-col min-h-screen">
        {/* Mobile Header (Hidden on Desktop) */}
        <header className="md:hidden h-16 border-b flex items-center px-4 bg-card sticky top-0 z-20">
          <img 
            src="/attached_assets/IMG_0336_1765864713224.png" 
            alt="SkyRich Tech Solutions" 
            className="h-8 w-auto object-contain"
          />
        </header>
        
        <div className="flex-1 p-6 md:p-8 max-w-[1600px] mx-auto w-full animate-in fade-in duration-500">
          {children}
        </div>
      </main>
    </div>
  );
}
