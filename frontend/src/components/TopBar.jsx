import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import ChangePasswordDialog from "@/components/ChangePasswordDialog";
import { UtensilsCrossed, LogOut, ShieldCheck, User, ChefHat, Sun, Moon, KeyRound, ChevronDown } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";

const roleIcon = (role) => role === "admin" ? ShieldCheck : role === "chef" ? ChefHat : User;
const roleLabel = (role) => role === "admin" ? "Admin Console" : role === "chef" ? "Chef Kitchen" : "Employee";

export default function TopBar() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const nav = useNavigate();
  const [openPw, setOpenPw] = useState(false);

  const RoleIcon = roleIcon(user?.role);
  const onLogout = () => { logout(); nav("/login", { replace: true }); };

  const home = user?.role === "admin" ? "/admin" : user?.role === "chef" ? "/chef" : "/dashboard";

  return (
    <>
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-4 flex items-center justify-between gap-4">
          <Link to={home} className="flex items-center gap-3" data-testid="topbar-logo">
            <div
              className="h-9 w-9 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "#e11d48" }}
            >
              <UtensilsCrossed className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div
                className="font-display font-extrabold tracking-tight text-lg"
                style={{ color: "#e11d48" }}
              >
                SUPER MILER
              </div>
              <div className="overline text-muted-foreground -mt-0.5">{roleLabel(user?.role)}</div>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              data-testid="theme-toggle-button"
              className="h-9 w-9 rounded-full"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-testid="user-menu-button" className="rounded-full h-9 gap-2">
                  <RoleIcon className="h-3.5 w-3.5 text-primary" />
                  <span className="hidden md:inline font-medium">{user?.name}</span>
                  <span className="text-muted-foreground font-mono-plex text-xs hidden md:inline">#{user?.employee_number}</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56" data-testid="user-menu">
                <DropdownMenuLabel>
                  <div className="text-sm font-semibold">{user?.name}</div>
                  <div className="text-xs text-muted-foreground font-mono-plex">#{user?.employee_number}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setOpenPw(true)} data-testid="change-password-menu-item">
                  <KeyRound className="h-4 w-4 mr-2" /> Change password
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout} data-testid="logout-menu-item" className="text-destructive">
                  <LogOut className="h-4 w-4 mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <ChangePasswordDialog open={openPw} onOpenChange={setOpenPw} />
    </>
  );
}
