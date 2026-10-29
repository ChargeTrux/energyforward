import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Eye, X, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { exitUserPreview, isUserPreview, previewUserId } from "@/lib/admin-preview";
import { canPreviewPage } from "@/lib/preview-policy";
import { Link } from "react-router-dom";

type Profile = { user_id: string; full_name: string | null; email: string; is_active: boolean; is_admin: boolean };
let verifiedProfile: Profile | null = null;

export function usePortalUser() {
  const auth = useAuth();
  const profile = isUserPreview ? verifiedProfile : null;
  const user = useMemo(() => profile && auth.user ? { ...auth.user, id: profile.user_id, email: profile.email, user_metadata: { full_name: profile.full_name } } : auth.user, [profile, auth.user]);
  return profile ? { ...auth, isAdmin: profile.is_admin, user } : auth;
}

export function UserPreviewBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { session, loading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!isUserPreview || loading) return;
    verifiedProfile = null;
    setProfile(null);
    setError(null);
    if (!session) { setError("Sign in as an admin to preview this user."); return; }
    let cancelled = false;
    supabase.functions.invoke("admin-preview", { body: { user_id: previewUserId } }).then(async ({ data, error }) => {
      if (cancelled) return;
      if (error || !data?.profile) {
        const response = (error as { context?: Response } | null)?.context;
        const detail = response ? await response.json().catch(() => ({})) : null;
        setError(detail?.error ?? "Could not start user preview.");
        return;
      }
      if (cancelled) return;
      verifiedProfile = data.profile;
      setProfile(data.profile);
    });
    return () => { cancelled = true; };
  }, [session?.user.id, loading, location.pathname]);
  if (!isUserPreview) return <>{children}</>;
  return <>
    <div className="ef-preview-bar" role="status">
      <div className="flex min-w-0 items-center gap-2"><Eye className="h-5 w-5 shrink-0" /><span className="truncate">View as user{profile ? `: ${profile.full_name || profile.email}` : ""}</span></div>
      <div className="flex shrink-0 items-center gap-2">
        {profile?.is_admin && <Button variant="outline" size="sm" asChild><Link to="/admin"><ShieldCheck className="mr-2 h-4 w-4" />Admin page</Link></Button>}
        <Button variant="outline" size="sm" onClick={exitUserPreview}><X className="mr-2 h-4 w-4" />Exit preview</Button>
      </div>
    </div>
    <div className="ef-preview-content">
      {error ? <div className="min-h-screen grid place-items-center text-destructive" role="alert">{error}</div>
        : !profile ? <div className="min-h-screen grid place-items-center">Loading user preview…</div>
        : !canPreviewPage(location.pathname, profile.is_admin) ? <div className="min-h-screen grid place-items-center">This page is unavailable in user preview.</div>
        : children}
    </div>
  </>;
}