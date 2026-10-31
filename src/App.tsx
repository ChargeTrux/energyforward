import React, { useState, useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { Header } from "@/components/Header";
import { LoginModal } from "@/components/LoginModal";
import { Home } from "@/pages/Home";
import { LandingStealth, CustomerPortal, InvestorPortal, ContactPage } from "@/pages/ef/EFFrame";
import AdminDashboard from "@/pages/AdminDashboard";
import ResetPassword from "@/pages/ResetPassword";
import ProjectRun from "./pages/ProjectRun";
import PortalWelcome from "./pages/PortalWelcome";
import DocumentsPage from "./pages/DocumentsPage";
import InvestorVideos from "@/pages/InvestorVideos";
import NotFound from "./pages/NotFound";
import SharePage from "./pages/SharePage";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { usePageTracking } from "@/hooks/usePageTracking";
import { supabase } from "@/integrations/supabase/client";
import { UserPreviewBoundary } from "@/components/admin/UserPreviewBoundary";
import { fetchDirectLinks } from "@/components/PortalNav";
import { exitUserPreview, isUserPreview } from "@/lib/admin-preview";

const queryClient = new QueryClient();

/** True when a person without a portal role still has individual materials or active direct links. */
async function hasAnyMaterial(userId: string) {
  const head = { count: 'exact' as const, head: true };
  const [d, v, p, links] = await Promise.all([
    supabase.from('investor_profile_access').select('id', head).eq('user_id', userId),
    supabase.from('investor_video_access').select('id', head).eq('user_id', userId),
    supabase.from('project_page_access').select('id', head).eq('user_id', userId),
    fetchDirectLinks(null).catch(() => []),
  ]);
  return !!(d.count || v.count || p.count || links.length);
}

function SignOutRoute({ onLogout }: { onLogout: () => Promise<void> | void }) {
  useEffect(() => {
    if (isUserPreview) { exitUserPreview(); return; }
    (async () => {
      await onLogout();
    })();
  }, [onLogout]);
  return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Signing out…
    </div>
  );
}

function AppContent() {
  const [showLogin, setShowLogin] = useState(false);
  const [prefillEmail, setPrefillEmail] = useState<string | undefined>(undefined);
  const { session, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  usePageTracking();
  useEffect(() => {
    if (isUserPreview) return;
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (hashParams.get("type") === "recovery" && window.location.pathname !== "/reset-password") {
      navigate(`/reset-password${window.location.hash}`, { replace: true });
    }
  }, [navigate]);
  // Auto-open login modal when arriving from email CTA: ?login=1&email=...
  useEffect(() => {
    if (isUserPreview) return;
    if (loading) return;
    const params = new URLSearchParams(location.search);
    const linkEmail = params.get("email")?.trim().toLowerCase();
    if (params.get("login") === "1" && session && linkEmail && session.user.email?.toLowerCase() !== linkEmail) {
      // Invite link for a different person: sign out current account and show sign-in.
      supabase.auth.signOut();
      return;
    }
    if (params.get("login") === "1" && session) {
      // Already signed in: skip the modal and go straight to their portal.
      (async () => {
        const { data, error } = await supabase.from('user_roles').select('role').eq('user_id', session.user.id);
        if (error) {
          // Stale/expired saved sign-in — clear it so the sign-in window shows.
          await supabase.auth.signOut();
          return;
        }
        const roles = new Set((data ?? []).map((r) => r.role as string));
        const onVideos = location.pathname === '/investor/videos';
        if (roles.has('admin')) navigate('/admin', { replace: true });
        else if (roles.has('investor')) navigate(onVideos ? '/investor/videos' : '/investor', { replace: true });
        else if (roles.has('project')) navigate('/investor/welcome', { replace: true });
        else if (roles.has('video')) navigate(onVideos ? '/investor/videos' : '/investor/welcome', { replace: true });
        else if (roles.has('customer')) navigate('/customer', { replace: true });
        else {
          if (await hasAnyMaterial(session.user.id)) navigate('/investor/welcome', { replace: true });
          else await supabase.auth.signOut();
        } // no portal access: let them sign in with another account
      })();
      return;
    }
    if (params.get("login") === "1" && !session) {
      const em = params.get("email") ?? undefined;
      setPrefillEmail(em);
      setShowLogin(true);
      params.delete("login");
      params.delete("email");
      const qs = params.toString();
      navigate(location.pathname + (qs ? `?${qs}` : ""), { replace: true });
    }
  }, [loading, session, location.search, location.pathname, navigate]);
  const prevSession = useRef<boolean>(!!session);
  const initialised = useRef(false);
  useEffect(() => {
    if (isUserPreview) return;
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const searchParams = new URLSearchParams(window.location.search);
    const isPublicSiteRequest = window.location.pathname === "/" && searchParams.get("public") === "1";
    const isPasswordRecovery =
      window.location.pathname === "/reset-password" ||
      hashParams.get("type") === "recovery" ||
      searchParams.get("type") === "recovery";

    if (!loading && isPublicSiteRequest) {
      prevSession.current = !!session;
      searchParams.delete("public");
      const qs = searchParams.toString();
      window.history.replaceState({}, "", `/${qs ? `?${qs}` : ""}${window.location.hash}`);
      return;
    }

    if (loading) return;
    if (!initialised.current) {
      // First resolved auth state (existing session restored) — not a fresh login.
      initialised.current = true;
      prevSession.current = !!session;
      return;
    }
    if (session && !prevSession.current) {
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
        const currentVideoUrl = window.location.pathname === '/investor/videos'
          ? `${window.location.pathname}${window.location.search}`
          : '/investor/videos';
        if (roles.has('admin')) navigate('/admin');
        else if (roles.has('investor')) navigate(window.location.pathname === '/investor/videos' ? currentVideoUrl : '/investor');
        else if (roles.has('project')) navigate('/investor/welcome');
        else if (roles.has('video')) navigate(window.location.pathname === '/investor/videos' ? currentVideoUrl : '/investor/welcome');
        else if (roles.has('customer')) navigate('/customer');
        else {
          navigate((await hasAnyMaterial(session.user.id)) ? '/investor/welcome' : '/');
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

  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  const isEFRoute =
    path === "/" ||
    path === "/customer" ||
    path === "/investor" ||
    path === "/investor/videos" ||
    path === "/investor/project" ||
    path === "/investor/welcome" ||
    path === "/investor/documents" ||
    path === "/contact" ||
    path === "/admin" ||
    path === "/reset-password" ||
    path.startsWith("/share/");

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
        <Route path="/investor/videos" element={<InvestorVideos />} />
        <Route path="/investor/project" element={<ProjectRun />} />
        <Route path="/investor/welcome" element={<PortalWelcome />} />
        <Route path="/investor/documents" element={<DocumentsPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/home-v1" element={<Home />} />
        <Route path="/signout" element={<SignOutRoute onLogout={handleLogout} />} />
        {session && <Route path="/admin" element={<AdminDashboard />} />}
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/share/:slug" element={<SharePage />} />
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
          <UserPreviewBoundary><AppContent /></UserPreviewBoundary>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
