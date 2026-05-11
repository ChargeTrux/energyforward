import React, { useState, useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { LoginModal } from "@/components/LoginModal";
import { Home } from "@/pages/Home";
import { Mission } from "@/pages/Mission";
import AdminDashboard from "@/pages/AdminDashboard";
import ResetPassword from "@/pages/ResetPassword";
import GatedPage from "@/pages/GatedPage";
import NotFound from "./pages/NotFound";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { usePageTracking } from "@/hooks/usePageTracking";

const queryClient = new QueryClient();

function AppContent() {
  const [showLogin, setShowLogin] = useState(false);
  const { session, loading, signOut } = useAuth();
  const navigate = useNavigate();
  usePageTracking();
  const prevSession = useRef<boolean>(!!session);
  useEffect(() => {
    if (!loading && session && !prevSession.current) {
      // Check if user must change password (temporary password from invite)
      (async () => {
        const { data } = await supabase
          .from('profiles')
          .select('must_change_password')
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (data?.must_change_password) {
          navigate('/reset-password');
        } else {
          navigate('/mission');
        }
      })();
    }
    prevSession.current = !!session;
  }, [session, loading, navigate]);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Header 
        onLoginClick={() => setShowLogin(true)} 
        onLogout={handleLogout}
        isLoggedIn={!!session}
      />
      <Routes>
        <Route path="/" element={<Home />} />
        {session && <Route path="/mission" element={<Mission onLogout={handleLogout} />} />}
        {session && <Route path="/admin" element={<AdminDashboard />} />}
        {session && <Route path="/p/:slug" element={<GatedPage />} />}
        {session && <Route path="/investor" element={<GatedPage />} />}
        <Route path="/reset-password" element={<ResetPassword />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      
      <LoginModal 
        open={showLogin} 
        onOpenChange={setShowLogin}
      />
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
