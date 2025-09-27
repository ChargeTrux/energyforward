import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import energyForwardLogo from "@/assets/energy-forward-logo-new.png";

interface HeaderProps {
  onLoginClick: () => void;
  onLogout: () => void;
  isLoggedIn: boolean;
}

export function Header({ onLoginClick, onLogout, isLoggedIn }: HeaderProps) {
  const navigate = useNavigate();

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
        
        <Button 
          variant="energy" 
          onClick={isLoggedIn ? onLogout : onLoginClick}
          className="px-6"
        >
          {isLoggedIn ? "Sign Out" : "Login"}
        </Button>
      </div>
    </header>
  );
}