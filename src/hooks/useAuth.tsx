import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  sessionId: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  isAdmin: false,
  loading: true,
  sessionId: null,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        // Defer DB calls
        setTimeout(async () => {
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", newSession.user.id);
          setIsAdmin(!!roles?.some((r) => r.role === "admin"));

          if (event === "SIGNED_IN") {
            const { data: ls } = await supabase
              .from("login_sessions")
              .insert({ user_id: newSession.user.id })
              .select("id")
              .single();
            if (ls) {
              setSessionId(ls.id);
              localStorage.setItem("login_session_id", ls.id);
            }
          } else if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
            const stored = localStorage.getItem("login_session_id");
            if (stored) setSessionId(stored);
          }
        }, 0);
      } else {
        setIsAdmin(false);
        setSessionId(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      const stored = localStorage.getItem("login_session_id");
      if (stored) setSessionId(stored);
      if (existing?.user) {
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", existing.user.id)
          .then(({ data }) => setIsAdmin(!!data?.some((r) => r.role === "admin")));
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    const sid = localStorage.getItem("login_session_id");
    if (sid && session?.user) {
      const loginAt = await supabase
        .from("login_sessions")
        .select("login_at")
        .eq("id", sid)
        .single();
      const duration = loginAt.data
        ? Math.floor((Date.now() - new Date(loginAt.data.login_at).getTime()) / 1000)
        : null;
      await supabase
        .from("login_sessions")
        .update({ logout_at: new Date().toISOString(), duration_seconds: duration })
        .eq("id", sid);
    }
    localStorage.removeItem("login_session_id");
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, isAdmin, loading, sessionId, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);