import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { EmailSignupModal } from "@/components/EmailSignupModal";
import { Zap, Target, Clock, Users } from "lucide-react";
export function Home() {
  const [showEmailSignup, setShowEmailSignup] = useState(false);
  const navigate = useNavigate();
  return <main className="min-h-screen">
      {/* Hero Section */}
      <section className="hero-gradient py-20 px-4">
        <div className="container mx-auto text-center max-w-6xl">
          
          
          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
            Bringing tomorrow's{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              ENERGY
            </span>{" "}
            promises{" "}
            <span className="bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
              FORWARD
            </span>{" "}
            to today
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 font-medium">
            Operating in Stealth Mode
          </p>
        </div>
      </section>

      {/* Mission Statement */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <Card className="shadow-card border-0">
            <CardContent className="p-8 md:p-12 text-center">
              <div className="space-y-6">
                <p className="text-lg md:text-xl lg:text-2xl leading-relaxed font-light">
                  We are quietly working to redefine the future of energy, crafting innovative 
                  solutions that will deliver energy to the world in a new and responsible way.
                </p>
                
                <p className="text-lg md:text-xl lg:text-2xl leading-relaxed font-light">
                  Our mission is to accelerate the transition to a sustainable energy future, 
                  pushing boundaries and unlocking new possibilities for a brighter, more 
                  efficient tomorrow. We're innovating at the intersection of advanced 
                  technology and environmental stewardship.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* What We're Building Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <Target className="w-12 h-12 mx-auto mb-4 text-accent" />
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-6">What We're Building</h2>
          </div>
          
          <Card className="shadow-card border-0">
            <CardContent className="p-8 md:p-12">
              <p className="text-lg md:text-xl lg:text-2xl leading-relaxed text-center font-light">
                Behind the scenes, we're meticulously engineering groundbreaking solutions 
                poised to reshape how energy in the world is generated and delivered. Our 
                focus is on intelligent systems and novel technologies that promise 
                unprecedented efficiency and sustainability.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Why Now Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <Clock className="w-12 h-12 mx-auto mb-4 text-accent" />
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-6">Why Now?</h2>
          </div>
          
          <Card className="shadow-card border-0">
            <CardContent className="p-8 md:p-12">
              <p className="text-lg md:text-xl lg:text-2xl leading-relaxed text-center font-light">
                The global energy landscape is at a pivotal moment, demanding urgent innovation. 
                The transition to a sustainable future is not just an opportunity but a necessity. 
                EnergyForward is rising to meet this challenge, accelerating the shift with 
                thoughtful, impactful solutions that can scale today. Why now? Why not?
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Stay Connected Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <Users className="w-12 h-12 mx-auto mb-4 text-accent" />
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-6">Stay Connected</h2>
          </div>
          
          <Card className="shadow-card border-0">
            <CardContent className="p-8 md:p-12 text-center">
              <p className="text-lg md:text-xl lg:text-2xl leading-relaxed mb-8 font-light">
                Be among the first to learn about our progress and discover how we're 
                powering tomorrow. Sign up for exclusive early access and updates.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
                <Button variant="energy" size="lg" onClick={() => navigate('/mission')} className="flex-1">
                  Learn More About Our Mission
                </Button>
                <Button variant="hero" size="lg" onClick={() => setShowEmailSignup(true)} className="flex-1">
                  Sign Up for Updates
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <EmailSignupModal open={showEmailSignup} onOpenChange={setShowEmailSignup} />
    </main>;
}