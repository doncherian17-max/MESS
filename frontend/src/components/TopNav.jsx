import { useAuth } from "@/context/AuthContext";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { UtensilsCrossed, LogOut } from "lucide-react";

export default function TopNav() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const onAdmin = loc.pathname.startsWith("/admin");

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
        <Link to="/" data-testid="brand-link" className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center">
            <UtensilsCrossed className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">MessBook</span>
        </Link>

        <div className="flex items-center gap-3">
          {user?.role === "admin" && (
            <div className="hidden md:flex items-center gap-1 rounded-full bg-muted p-1">
              <Link to="/admin" data-testid="nav-admin"
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors duration-200 ${onAdmin ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                Admin
              </Link>
              <Link to="/dashboard" data-testid="nav-dashboard"
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors duration-200 ${!onAdmin ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                My Meals
              </Link>
            </div>
          )}
          <div className="hidden sm:flex flex-col items-end mr-2">
            <span className="text-sm font-semibold leading-tight" data-testid="nav-user-name">{user?.name}</span>
            <span className="text-xs text-muted-foreground font-mono-plex" data-testid="nav-user-emp">#{user?.employee_number}</span>
          </div>
          <Button variant="outline" size="sm" onClick={logout} data-testid="logout-button"
            className="rounded-full">
            <LogOut className="h-3.5 w-3.5 mr-1.5" /> Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
