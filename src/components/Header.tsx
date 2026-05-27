import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ShieldCheck, Home as HomeIcon } from "lucide-react";

interface HeaderProps {
  onLoginClick: () => void;
  onLogout: () => void;
  isLoggedIn: boolean;
}

export function Header({ onLoginClick, onLogout, isLoggedIn }: HeaderProps) {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  return (
    <header className="w-full bg-background/95 backdrop-blur-sm border-b border-border shadow-card sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div
          className="cursor-pointer transition-energy hover:scale-105"
          onClick={() => navigate('/')}
        >
          <span
            className="text-xl font-bold tracking-tight"
            style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
          >
            energyforward<span className="text-[var(--ef-amber)]">.</span>
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {isLoggedIn && (
            <Button variant="outline" onClick={() => navigate('/')} className="gap-1">
              <HomeIcon className="w-4 h-4" /> Home
            </Button>
          )}
          {isLoggedIn && isAdmin && (
            <Button variant="outline" onClick={() => navigate('/admin')} className="gap-1">
              <ShieldCheck className="w-4 h-4" /> Admin
            </Button>
          )}
          <Button
            variant="energy"
            onClick={isLoggedIn ? onLogout : onLoginClick}
            className="px-6"
          >
            {isLoggedIn ? "Sign Out" : "Login"}
          </Button>
        </div>
      </div>
    </header>
  );
}
