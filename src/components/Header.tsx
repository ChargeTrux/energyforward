import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import energyForwardLogo from "@/assets/energy-forward-logo-new.png";
import { useAuth } from "@/hooks/useAuth";
import { ShieldCheck, Home as HomeIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface HeaderProps {
  onLoginClick: () => void;
  onLogout: () => void;
  isLoggedIn: boolean;
}

export function Header({ onLoginClick, onLogout, isLoggedIn }: HeaderProps) {
  const navigate = useNavigate();
  const { isAdmin, user } = useAuth();
  const [pages, setPages] = useState<{ slug: string; title: string }[]>([]);

  useEffect(() => {
    if (!user) {
      setPages([]);
      return;
    }
    (async () => {
      const { data: allPages } = await supabase.from("pages").select("slug, title").order("title");
      if (isAdmin) {
        setPages(allPages ?? []);
        return;
      }
      const { data: access } = await supabase
        .from("page_access")
        .select("page_slug")
        .eq("user_id", user.id);
      const allowed = new Set((access ?? []).map((a) => a.page_slug));
      setPages((allPages ?? []).filter((p) => allowed.has(p.slug)));
    })();
  }, [user, isAdmin]);

  return (
    <header className="w-full bg-background/95 backdrop-blur-sm border-b border-border shadow-card sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div 
          className="cursor-pointer transition-energy hover:scale-105"
          onClick={() => navigate('/')}
        >
          <img 
            src={energyForwardLogo} 
            alt="EnergyForward Logo" 
            className="h-12 w-auto"
          />
        </div>
        
        <div className="flex items-center gap-2">
          {isLoggedIn && pages.map((p) => (
            <Button
              key={p.slug}
              variant="ghost"
              onClick={() => navigate(`/p/${p.slug}`)}
              className="hidden md:inline-flex"
            >
              {p.title}
            </Button>
          ))}
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