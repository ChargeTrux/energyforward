import { useEffect, useState } from "react";
import { Navigate, useParams, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Newspaper,
  FileText,
  BarChart3,
  Banknote,
  Activity,
  MessageSquareLock,
  Megaphone,
  ArrowLeft,
  Send,
} from "lucide-react";

const TITLES: Record<string, string> = {
  investor: "Investor",
};

const DASHBOARD_SECTIONS = [
  { icon: Newspaper, title: "Investor Updates", desc: "Latest letters and milestones from leadership." },
  { icon: FileText, title: "Financial Documents", desc: "Statements, term sheets, and disclosures." },
  { icon: BarChart3, title: "Reports", desc: "Quarterly performance and KPI summaries." },
  { icon: Banknote, title: "Capital Information", desc: "Cap table snapshots and round details." },
  { icon: Activity, title: "Account Activity", desc: "Your recent portal activity and access log." },
  { icon: MessageSquareLock, title: "Secure Messages", desc: "Confidential correspondence with the team." },
  { icon: Megaphone, title: "Announcements", desc: "Company-wide news and time-sensitive notices." },
];

export default function GatedPage() {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const slug = params.slug ?? location.pathname.replace(/^\/+/, "").split("/")[0] ?? "";
  const { user, isAdmin, loading } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [qSubject, setQSubject] = useState("");
  const [qMessage, setQMessage] = useState("");
  const [sending, setSending] = useState(false);

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
    const submitQuestion = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!qSubject.trim() || !qMessage.trim()) return;
      setSending(true);
      const { data, error } = await supabase.functions.invoke("investor-question", {
        body: { subject: qSubject, message: qMessage },
      });
      setSending(false);
      if (error || (data as { error?: string })?.error) {
        toast({
          title: "Failed to send",
          description: error?.message ?? (data as { error?: string }).error,
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Message sent", description: "An administrator will be in touch shortly." });
      setQSubject("");
      setQMessage("");
    };

    return (
      <main className="min-h-screen bg-[#F8FAFC]">
        {isAdmin && (
          <div className="bg-white border-b border-slate-200">
            <div className="container mx-auto px-4 py-3 max-w-6xl flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/admin")}
                className="gap-2 text-[#0F172A]"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Admin Dashboard
              </Button>
              <span className="text-xs uppercase tracking-wider text-slate-500">
                Admin preview
              </span>
            </div>
          </div>
        )}

        {/* Executive header band */}
        <section className="bg-gradient-to-br from-[#0F172A] via-[#0F172A] to-[#1E3A8A] text-white">
          <div className="container mx-auto px-4 py-12 md:py-16 max-w-6xl">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-blue-200/80 mb-3">
              <span className="inline-block w-8 h-px bg-[#10B981]" />
              EnergyForward
            </div>
            <h1 className="text-3xl md:text-5xl font-semibold tracking-tight">Investor Portal</h1>
            <p className="mt-3 text-blue-100/80 max-w-2xl">
              Welcome, {user.email}. Confidential materials, reports, and updates for EnergyForward investors.
            </p>
          </div>
        </section>

        {/* Dashboard grid */}
        <section className="container mx-auto px-4 py-10 md:py-14 max-w-6xl">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {DASHBOARD_SECTIONS.map(({ icon: Icon, title: t, desc }) => (
              <div
                key={t}
                className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-[#2563EB]/40 transition-all"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider font-medium text-[#10B981] bg-[#10B981]/10 px-2 py-1 rounded">
                    Coming soon
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-[#0F172A]">{t}</h3>
                <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-xl border border-slate-200 bg-white p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-[#0F172A]">Investor Support</h3>
              <p className="text-sm text-slate-500 mt-1">
                Questions about your account or materials? Our team is here to help.
              </p>
            </div>
            <a
              href="mailto:support@energyforward.com"
              className="inline-flex items-center justify-center rounded-md bg-[#0F172A] hover:bg-[#1E3A8A] text-white px-5 py-2.5 text-sm font-medium transition-colors"
            >
              Contact support@energyforward.com
            </a>
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 md:p-8">
            <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
              <div>
                <h3 className="text-lg font-semibold text-[#0F172A]">Ask a Question</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Send a confidential message directly to the EnergyForward administrators.
                </p>
              </div>
              <span className="text-[10px] uppercase tracking-wider font-medium text-[#2563EB] bg-[#2563EB]/10 px-2 py-1 rounded">
                Secure
              </span>
            </div>
            <form onSubmit={submitQuestion} className="space-y-4">
              <div>
                <Label htmlFor="q-subject" className="text-[#0F172A]">Subject</Label>
                <Input
                  id="q-subject"
                  value={qSubject}
                  onChange={(e) => setQSubject(e.target.value)}
                  maxLength={200}
                  placeholder="What is this regarding?"
                  required
                />
              </div>
              <div>
                <Label htmlFor="q-message" className="text-[#0F172A]">Message</Label>
                <Textarea
                  id="q-message"
                  value={qMessage}
                  onChange={(e) => setQMessage(e.target.value)}
                  maxLength={5000}
                  rows={6}
                  placeholder="Type your question or request here..."
                  required
                />
                <p className="text-xs text-slate-400 mt-1">{qMessage.length}/5000</p>
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={sending || !qSubject.trim() || !qMessage.trim()}
                  className="bg-[#0F172A] hover:bg-[#1E3A8A] text-white gap-2"
                >
                  <Send className="w-4 h-4" /> {sending ? "Sending…" : "Send to Admin"}
                </Button>
              </div>
            </form>
          </div>
        </section>
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