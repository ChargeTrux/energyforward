import { useEffect, useState } from "react";
import { Navigate, useParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const TITLES: Record<string, string> = {
  investor: "Investor",
  partners: "Partners",
  documents: "Documents",
};

export default function GatedPage() {
  const params = useParams();
  const location = useLocation();
  const slug = params.slug ?? location.pathname.replace(/^\/+/, "").split("/")[0] ?? "";
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

  if (slug === "investor") {
    return (
      <main className="container mx-auto px-4 py-12 max-w-5xl">
        <h1 className="text-4xl font-bold mb-2 text-primary">Investor Portal</h1>
        <p className="text-muted-foreground mb-8">
          Welcome to the EnergyForward Investor Portal. Confidential materials below.
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-lg border border-border p-6 bg-card">
            <h2 className="text-xl font-semibold mb-2">Company Overview</h2>
            <p className="text-sm text-muted-foreground">
              EnergyForward is moving the world toward clean, distributed energy.
              Detailed company information will appear here.
            </p>
          </div>
          <div className="rounded-lg border border-border p-6 bg-card">
            <h2 className="text-xl font-semibold mb-2">Financials & Reports</h2>
            <p className="text-sm text-muted-foreground">
              Quarterly reports, projections, and pitch decks will be posted here.
            </p>
          </div>
          <div className="rounded-lg border border-border p-6 bg-card">
            <h2 className="text-xl font-semibold mb-2">Investment Opportunities</h2>
            <p className="text-sm text-muted-foreground">
              Current and upcoming funding rounds, terms, and contact details.
            </p>
          </div>
          <div className="rounded-lg border border-border p-6 bg-card">
            <h2 className="text-xl font-semibold mb-2">Contact</h2>
            <p className="text-sm text-muted-foreground">
              For questions, reach out to <a className="underline" href="mailto:arahimi@energyforward.com">arahimi@energyforward.com</a>.
            </p>
          </div>
        </div>
      </main>
    );
  }

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