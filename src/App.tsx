import React, { useState, useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { LoginModal } from "@/components/LoginModal";
import { Home } from "@/pages/Home";
import { LandingStealth, CustomerPortal, InvestorPortal, ContactPage } from "@/pages/ef/EFFrame";
import AdminDashboard from "@/pages/AdminDashboard";
import ResetPassword from "@/pages/ResetPassword";
import GatedPage from "@/pages/GatedPage";
import NotFound from "./pages/NotFound";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { usePageTracking } from "@/hooks/usePageTracking";
import { supabase } from "@/integrations/supabase/client";

const queryClient = new QueryClient();

function AppContent() {
  const [showLogin, setShowLogin] = useState(false);
  const [prefillEmail, setPrefillEmail] = useState<string | undefined>(undefined);
  const { session, loading, signOut } = useAuth();
  const navigate = useNavigate();
  usePageTracking();
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (hashParams.get("type") === "recovery" && window.location.pathname !== "/reset-password") {
      navigate(`/reset-password${window.location.hash}`, { replace: true });
    }
  }, [navigate]);
  // Auto-open login modal when arriving from email CTA: ?login=1&email=...
  useEffect(() => {
    if (loading) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("login") === "1" && !session) {
      const em = params.get("email") ?? undefined;
      setPrefillEmail(em);
      setShowLogin(true);
      params.delete("login");
      params.delete("email");
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
  }, [loading, session]);
  const prevSession = useRef<boolean>(!!session);
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const searchParams = new URLSearchParams(window.location.search);
    const isPasswordRecovery =
      window.location.pathname === "/reset-password" ||
      hashParams.get("type") === "recovery" ||
      searchParams.get("type") === "recovery";

    if (!loading && session && !prevSession.current) {
      if (isPasswordRecovery) {
        prevSession.current = !!session;
        return;
      }
      // Check if user must change password (temporary password from invite)
      (async () => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('must_change_password')
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (profile?.must_change_password) {
          navigate('/reset-password');
          return;
        }
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id);
        const roles = new Set((rolesData ?? []).map((r) => r.role as string));
        if (roles.has('admin')) navigate('/admin');
        else if (roles.has('investor')) navigate('/investor');
        else if (roles.has('customer')) navigate('/customer');
        else navigate('/');
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

  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  const isEFRoute =
    path === "/" ||
    path === "/customer" ||
    path === "/investor" ||
    path === "/contact" ||
    path === "/admin" ||
    path === "/reset-password";

  return (
    <>
      {!isEFRoute && (
        <Header
          onLoginClick={() => setShowLogin(true)}
          onLogout={handleLogout}
          isLoggedIn={!!session}
        />
      )}
      <Routes>
        <Route path="/" element={<LandingStealth />} />
        <Route path="/customer" element={<CustomerPortal />} />
        <Route path="/investor" element={<InvestorPortal />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/home-v1" element={<Home />} />
        <Route path="/signout" element={<SignOutRoute onLogout={handleLogout} />} />
        {session && <Route path="/admin" element={<AdminDashboard />} />}
        {session && <Route path="/p/:slug" element={<GatedPage />} />}
        <Route path="/reset-password" element={<ResetPassword />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      
      <LoginModal 
        open={showLogin} 
        onOpenChange={setShowLogin}
        defaultEmail={prefillEmail}
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
