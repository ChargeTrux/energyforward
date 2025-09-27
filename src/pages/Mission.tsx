import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { 
  Zap, 
  Cog, 
  Lightbulb, 
  Leaf, 
  ArrowLeft,
  Gauge,
  Atom,
  Cpu
} from "lucide-react";

interface MissionProps {
  onLogout: () => void;
}

export function Mission({ onLogout }: MissionProps) {
  const navigate = useNavigate();

  const handleBackToHome = () => {
    onLogout();
    navigate('/');
  };

  const developmentAreas = [
    { icon: Zap, name: "Energy Generation", progress: 75 },
    { icon: Cog, name: "Smart Systems", progress: 60 },
    { icon: Leaf, name: "Sustainability Tech", progress: 85 },
    { icon: Cpu, name: "AI Integration", progress: 70 },
  ];

  return (
    <main className="min-h-screen py-12 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary to-accent rounded-full mb-8 shadow-energy">
            <Atom className="w-10 h-10 text-white" />
          </div>
          
          <h1 className="font-display text-4xl md:text-6xl font-bold mb-6">
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Under Development
            </span>
          </h1>
          
          <h2 className="text-2xl md:text-3xl text-muted-foreground font-medium mb-8">
            Powering the Future - Coming Soon
          </h2>
          
          <p className="text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">
            Our innovative energy solutions are currently in development. We're working 
            tirelessly to bring revolutionary changes to the energy sector.
          </p>
        </div>

        {/* Development Progress */}
        <Card className="shadow-card border-0 mb-12">
          <CardContent className="p-8 md:p-12">
            <div className="text-center mb-8">
              <Lightbulb className="w-12 h-12 mx-auto mb-4 text-accent" />
              <h3 className="text-2xl font-bold mb-4">Development Areas</h3>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              {developmentAreas.map((area, index) => (
                <div key={index} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <area.icon className="w-6 h-6 text-accent" />
                    <span className="font-medium">{area.name}</span>
                  </div>
                  <Progress value={area.progress} className="h-2" />
                  <p className="text-sm text-muted-foreground">{area.progress}% Complete</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Energy Innovation Graphics */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card className="shadow-card border-0 transition-energy hover:shadow-energy">
            <CardContent className="p-6 text-center">
              <Gauge className="w-12 h-12 mx-auto mb-4 text-accent" />
              <h4 className="font-semibold mb-2">Efficiency</h4>
              <p className="text-sm text-muted-foreground">
                Next-gen efficiency systems
              </p>
            </CardContent>
          </Card>
          
          <Card className="shadow-card border-0 transition-energy hover:shadow-energy">
            <CardContent className="p-6 text-center">
              <Leaf className="w-12 h-12 mx-auto mb-4 text-accent" />
              <h4 className="font-semibold mb-2">Sustainability</h4>
              <p className="text-sm text-muted-foreground">
                Environmental stewardship
              </p>
            </CardContent>
          </Card>
          
          <Card className="shadow-card border-0 transition-energy hover:shadow-energy">
            <CardContent className="p-6 text-center">
              <Zap className="w-12 h-12 mx-auto mb-4 text-accent" />
              <h4 className="font-semibold mb-2">Innovation</h4>
              <p className="text-sm text-muted-foreground">
                Revolutionary technology
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Back to Home */}
        <div className="text-center">
          <Button 
            variant="hero" 
            size="lg"
            onClick={handleBackToHome}
            className="inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Home
          </Button>
        </div>
      </div>
    </main>
  );
}