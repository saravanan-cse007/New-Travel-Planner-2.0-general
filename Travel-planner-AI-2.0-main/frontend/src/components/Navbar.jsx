import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { Plane, LogOut, LayoutDashboard, User, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Navbar() {
  const { token, user, logout } = useAuthStore();
  const loc = useLocation();
  const nav = useNavigate();
  const onAuth = ["/login", "/signup"].includes(loc.pathname);
  if (onAuth) return null;

  return (
    <header className="glass-header sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
        <Link to={token ? "/dashboard" : "/"} data-testid="nav-logo" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg btn-primary flex items-center justify-center">
            <Plane className="w-4 h-4 text-white" />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight">Travel Planner AI</span>
        </Link>

        <nav className="flex items-center gap-2">
          {token ? (
            <>
              <Link to="/dashboard" data-testid="nav-dashboard">
                <Button variant="ghost" className="text-white/80 hover:text-white hover:bg-white/5">
                  <LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard
                </Button>
              </Link>
              <Link to="/planner" data-testid="nav-new-trip">
                <Button className="btn-primary text-white border-0 rounded-full px-5">
                  <Sparkles className="w-4 h-4 mr-2" /> New Trip
                </Button>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" data-testid="nav-user-menu" className="rounded-full bg-white/5 border border-white/10 hover:bg-white/10">
                    <User className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="glass-strong border-white/10 text-white">
                  <DropdownMenuLabel className="text-white/60">{user?.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem onClick={() => nav("/profile")} data-testid="nav-profile" className="cursor-pointer">
                    <User className="w-4 h-4 mr-2" /> Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { logout(); nav("/"); }} data-testid="nav-logout" className="cursor-pointer text-fuchsia-400">
                    <LogOut className="w-4 h-4 mr-2" /> Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Link to="/login"><Button data-testid="nav-login" variant="ghost" className="text-white/80 hover:text-white hover:bg-white/5">Sign in</Button></Link>
              <Link to="/signup"><Button data-testid="nav-signup" className="btn-primary text-white border-0 rounded-full px-5">Get Started</Button></Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
