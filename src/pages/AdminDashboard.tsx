import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Users, Activity, UserPlus, ShieldCheck, Power } from "lucide-react";

interface ProfileRow {
  user_id: string;
  full_name: string | null;
  email: string;
  is_active: boolean;
  created_at: string;
  is_admin?: boolean;
}

interface SessionRow {
  id: string;
  user_id: string;
  login_at: string;
  logout_at: string | null;
  duration_seconds: number | null;
  email?: string;
  full_name?: string | null;
  total_page_seconds?: number;
}

export default function AdminDashboard() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !isAdmin) navigate("/");
  }, [loading, isAdmin, navigate]);

  const load = async () => {
    const [{ data: profs }, { data: roles }, { data: sess }, { data: views }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
      supabase
        .from("login_sessions")
        .select("*")
        .order("login_at", { ascending: false })
        .limit(200),
      supabase.from("page_views").select("session_id, duration_seconds"),
    ]);

    const adminSet = new Set(
      (roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id),
    );
    const profileMap = new Map(
      (profs ?? []).map((p) => [p.user_id, p as ProfileRow]),
    );
    setProfiles(
      (profs ?? []).map((p) => ({ ...(p as ProfileRow), is_admin: adminSet.has(p.user_id) })),
    );

    const pageTotals = new Map<string, number>();
    (views ?? []).forEach((v) => {
      if (!v.session_id) return;
      pageTotals.set(v.session_id, (pageTotals.get(v.session_id) ?? 0) + (v.duration_seconds ?? 0));
    });
    setSessions(
      (sess ?? []).map((s) => ({
        ...(s as SessionRow),
        email: profileMap.get(s.user_id)?.email,
        full_name: profileMap.get(s.user_id)?.full_name,
        total_page_seconds: pageTotals.get(s.id) ?? 0,
      })),
    );
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  const callAdmin = async (action: string, payload: Record<string, unknown>) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action, ...payload },
    });
    setBusy(false);
    if (error || (data && (data as { error?: string }).error)) {
      toast({
        title: "Action failed",
        description: error?.message ?? (data as { error?: string }).error,
        variant: "destructive",
      });
      return false;
    }
    toast({ title: "Done" });
    await load();
    return true;
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    const ok = await callAdmin("invite", { email: inviteEmail, full_name: inviteName });
    if (ok) {
      setInviteEmail("");
      setInviteName("");
    }
  };

  const formatDuration = (s: number | null | undefined) => {
    if (!s) return "—";
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec}s`;
  };

  if (loading) return <div className="p-12 text-center">Loading…</div>;
  if (!isAdmin) return null;

  return (
    <main className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <ShieldCheck className="w-8 h-8 text-primary" /> Admin Dashboard
        </h1>
        <p className="text-muted-foreground">Manage users and view activity</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4" /> Total Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{profiles.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> Admins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{profiles.filter((p) => p.is_admin).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4" /> Logins (recent)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{sessions.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" /> Invite New User
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="grid md:grid-cols-3 gap-3 items-end">
            <div>
              <Label htmlFor="iname">Full Name</Label>
              <Input
                id="iname"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <Label htmlFor="iemail">Email</Label>
              <Input
                id="iemail"
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <Button type="submit" disabled={busy} variant="energy">
              Send Invite
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => (
                <TableRow key={p.user_id}>
                  <TableCell>{p.full_name || "—"}</TableCell>
                  <TableCell>{p.email}</TableCell>
                  <TableCell>
                    <Badge variant={p.is_admin ? "default" : "secondary"}>
                      {p.is_admin ? "Admin" : "User"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.is_active ? "default" : "destructive"}>
                      {p.is_active ? "Active" : "Disabled"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        callAdmin("set_role", {
                          user_id: p.user_id,
                          make_admin: !p.is_admin,
                        })
                      }
                    >
                      {p.is_admin ? "Remove Admin" : "Make Admin"}
                    </Button>
                    <Button
                      size="sm"
                      variant={p.is_active ? "destructive" : "outline"}
                      disabled={busy}
                      onClick={() =>
                        callAdmin("set_active", {
                          user_id: p.user_id,
                          is_active: !p.is_active,
                        })
                      }
                    >
                      <Power className="w-3 h-3 mr-1" />
                      {p.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" /> Login Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Login</TableHead>
                <TableHead>Logout</TableHead>
                <TableHead>Session Duration</TableHead>
                <TableHead>Time on Pages</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.full_name || "—"}</TableCell>
                  <TableCell>{s.email || "—"}</TableCell>
                  <TableCell>{new Date(s.login_at).toLocaleString()}</TableCell>
                  <TableCell>
                    {s.logout_at ? new Date(s.logout_at).toLocaleString() : "Active"}
                  </TableCell>
                  <TableCell>{formatDuration(s.duration_seconds)}</TableCell>
                  <TableCell>{formatDuration(s.total_page_seconds)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}