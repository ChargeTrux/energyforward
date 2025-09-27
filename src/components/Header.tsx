import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import energyForwardLogo from "@/assets/energy-forward-logo.png";

interface HeaderProps {
  onLoginClick: () => void;
}

export function Header({ onLoginClick }: HeaderProps) {
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
          onClick={onLoginClick}
          className="px-6"
        >
          Login
        </Button>
      </div>
    </header>
  );
}