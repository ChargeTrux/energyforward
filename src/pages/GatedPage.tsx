import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const TITLES: Record<string, string> = {
  investor: "Investor",
  partners: "Partners",
  documents: "Documents",
};

export default function GatedPage() {
  const { slug = "" } = useParams();
  const { user, isAdmin, loading } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    if (isAdmin) {
      setAllowed(true);
      return;
    }
    supabase
      .from("page_access")
      .select("page_slug")
      .eq("user_id", user.id)
      .eq("page_slug", slug)
      .maybeSingle()
      .then(({ data }) => setAllowed(!!data));
  }, [user, isAdmin, slug]);

  if (loading || allowed === null) {
    return <div className="p-12 text-center text-muted-foreground">Loading…</div>;
  }
  if (!user) return <Navigate to="/" replace />;
  if (!allowed) {
    return (
      <main className="container mx-auto px-4 py-16 max-w-2xl text-center">
        <h1 className="text-3xl font-bold mb-3">Access Restricted</h1>
        <p className="text-muted-foreground">
          You don't have permission to view this page. Please contact an administrator.
        </p>
      </main>
    );
  }

  const title = TITLES[slug] ?? slug;
  return (
    <main className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-4xl font-bold mb-4 text-primary">{title}</h1>
      <p className="text-muted-foreground mb-8">
        Welcome to the {title} page. Content coming soon.
      </p>
      <div className="rounded-lg border border-border p-8 bg-card">
        <p>This is a private page. Only users granted access by an admin can see it.</p>
      </div>
    </main>
  );
}