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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  Activity,
  UserPlus,
  ShieldCheck,
  MoreHorizontal,
  Copy,
} from "lucide-react";

interface ProfileRow {
  user_id: string;
  full_name: string | null;
  email: string;
  is_active: boolean;
  created_at: string;
  is_admin?: boolean;
  is_investor?: boolean;
}

interface SessionRow {
  id: string;
  user_id: string;
  login_at: string;
  logout_at: string | null;
  duration_seconds: number | null;
}

interface PageViewRow {
  user_id: string;
  session_id: string | null;
  path: string;
  duration_seconds: number | null;
}

interface ActivityRow {
  key: string;
  full_name: string | null;
  email: string;
  role: string;
  login_at: string;
  logout_at: string | null;
  duration_seconds: number | null;
  path: string;
  page_seconds: number;
}

export default function AdminDashboard() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [recentLoginCount, setRecentLoginCount] = useState(0);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"user" | "admin" | "investor">("investor");
  const [busy, setBusy] = useState(false);
  const [tempCred, setTempCred] = useState<{ email: string; password: string } | null>(null);

  useEffect(() => {
    if (!loading && !isAdmin) navigate("/");
  }, [loading, isAdmin, navigate]);

  const load = async () => {
    const [{ data: profs }, { data: roles }, { data: sess }, { data: views }] =
      await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
        supabase
          .from("login_sessions")
          .select("*")
          .order("login_at", { ascending: false })
          .limit(200),
        supabase.from("page_views").select("user_id, session_id, path, duration_seconds"),
      ]);

    const adminSet = new Set(
      (roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id),
    );
    const investorSet = new Set(
      (roles ?? []).filter((r) => r.role === "investor").map((r) => r.user_id),
    );
    const profileMap = new Map(
      (profs ?? []).map((p) => [p.user_id, p as ProfileRow]),
    );
    setProfiles(
      (profs ?? []).map((p) => ({
        ...(p as ProfileRow),
        is_admin: adminSet.has(p.user_id),
        is_investor: investorSet.has(p.user_id),
      })),
    );
    setRecentLoginCount((sess ?? []).length);

    // Build merged activity rows: one row per session+page (or one row per session if no pages)
    const viewsBySession = new Map<string, PageViewRow[]>();
    (views ?? []).forEach((v) => {
      if (!v.session_id) return;
      const arr = viewsBySession.get(v.session_id) ?? [];
      arr.push(v as PageViewRow);
      viewsBySession.set(v.session_id, arr);
    });

    const rows: ActivityRow[] = [];
    (sess ?? []).forEach((s) => {
      const prof = profileMap.get(s.user_id);
      const role = adminSet.has(s.user_id)
        ? "Admin"
        : investorSet.has(s.user_id)
        ? "Investor"
        : "User";
      const sessionViews = viewsBySession.get(s.id) ?? [];
      if (sessionViews.length === 0) {
        rows.push({
          key: s.id,
          full_name: prof?.full_name ?? null,
          email: prof?.email ?? "—",
          role,
          login_at: s.login_at,
          logout_at: s.logout_at,
          duration_seconds: s.duration_seconds,
          path: "—",
          page_seconds: 0,
        });
      } else {
        // Aggregate per path within this session
        const byPath = new Map<string, number>();
        sessionViews.forEach((v) =>
          byPath.set(v.path, (byPath.get(v.path) ?? 0) + (v.duration_seconds ?? 0)),
        );
        Array.from(byPath.entries())
          .sort((a, b) => b[1] - a[1])
          .forEach(([path, secs], i) => {
            rows.push({
              key: `${s.id}-${path}`,
              full_name: prof?.full_name ?? null,
              email: prof?.email ?? "—",
              role,
              login_at: s.login_at,
              logout_at: s.logout_at,
              duration_seconds: s.duration_seconds,
              path,
              page_seconds: secs,
            });
          });
      }
    });
    setActivity(rows);
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
      return null;
    }
    toast({ title: "Done" });
    await load();
    return data;
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    const data = (await callAdmin("invite", {
      email: inviteEmail,
      full_name: inviteName,
      role: inviteRole,
    })) as { temp_password?: string } | null;
    if (data?.temp_password) {
      setTempCred({ email: inviteEmail, password: data.temp_password });
      setInviteEmail("");
      setInviteName("");
    }
  };

  const handleSetPassword = async (user_id: string, email: string) => {
    const password = window.prompt(`Enter new password for ${email} (min 8 chars):`);
    if (!password) return;
    if (password.length < 8) {
      toast({
        title: "Password too short",
        description: "Min 8 characters",
        variant: "destructive",
      });
      return;
    }
    await callAdmin("set_password", { user_id, password });
  };

  const handleDelete = async (user_id: string, email: string) => {
    if (!window.confirm(`Permanently delete ${email}? This cannot be undone.`)) return;
    await callAdmin("delete_user", { user_id });
  };

  const formatDuration = (s: number | null | undefined) => {
    if (!s) return "—";
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec}s`;
  };

  const copyCred = async () => {
    if (!tempCred) return;
    await navigator.clipboard.writeText(
      `Email: ${tempCred.email}\nTemporary password: ${tempCred.password}`,
    );
    toast({ title: "Copied to clipboard" });
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
            <p className="text-3xl font-bold">{recentLoginCount}</p>
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
          <form
            onSubmit={handleInvite}
            className="grid md:grid-cols-12 gap-3 items-end"
          >
            <div className="md:col-span-3">
              <Label htmlFor="iname">Full Name</Label>
              <Input
                id="iname"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Jane Doe"
              />
            </div>
            <div className="md:col-span-4">
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
            <div className="md:col-span-3">
              <Label htmlFor="irole">Role</Label>
              <Select
                value={inviteRole}
                onValueChange={(v) => setInviteRole(v as typeof inviteRole)}
              >
                <SelectTrigger id="irole">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="investor">Investor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={busy} variant="energy" className="w-full">
                Create & Invite
              </Button>
            </div>
          </form>
          <p className="text-xs text-muted-foreground mt-3">
            A temporary password will be generated. The user will be required to
            change it on first sign-in.
          </p>
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
                <TableHead className="min-w-[180px]">Name</TableHead>
                <TableHead className="min-w-[220px]">Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => (
                <TableRow key={p.user_id}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {p.full_name || "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{p.email}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {p.is_admin && <Badge variant="default">Admin</Badge>}
                      {p.is_investor && <Badge variant="secondary">Investor</Badge>}
                      {!p.is_admin && !p.is_investor && (
                        <Badge variant="outline">User</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.is_active ? "default" : "destructive"}>
                      {p.is_active ? "Active" : "Disabled"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline" disabled={busy}>
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 bg-background">
                        <DropdownMenuLabel>Roles</DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() =>
                            callAdmin("set_role", {
                              user_id: p.user_id,
                              make_admin: !p.is_admin,
                            })
                          }
                        >
                          {p.is_admin ? "Remove Admin" : "Make Admin"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            callAdmin("set_investor", {
                              user_id: p.user_id,
                              make_investor: !p.is_investor,
                            })
                          }
                        >
                          {p.is_investor ? "Remove Investor" : "Make Investor"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Account</DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() =>
                            callAdmin("set_active", {
                              user_id: p.user_id,
                              is_active: !p.is_active,
                            })
                          }
                        >
                          {p.is_active ? "Deactivate" : "Activate"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => callAdmin("send_reset", { email: p.email })}
                        >
                          Send Reset Email
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleSetPassword(p.user_id, p.email)}
                        >
                          Set Password
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(p.user_id, p.email)}
                        >
                          Delete User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
            <Activity className="w-5 h-5" /> Login Activity & Time Spent
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Login</TableHead>
                <TableHead>Logout</TableHead>
                <TableHead>Session Duration</TableHead>
                <TableHead>Page</TableHead>
                <TableHead className="text-right">Time on Page</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activity.map((r) => (
                <TableRow key={r.key}>
                  <TableCell>{r.full_name || "—"}</TableCell>
                  <TableCell>{r.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        r.role === "Admin"
                          ? "default"
                          : r.role === "Investor"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {r.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {new Date(r.login_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.logout_at ? new Date(r.logout_at).toLocaleString() : "Active"}
                  </TableCell>
                  <TableCell>{formatDuration(r.duration_seconds)}</TableCell>
                  <TableCell>
                    <code className="text-xs">{r.path}</code>
                  </TableCell>
                  <TableCell className="text-right">
                    {r.page_seconds ? formatDuration(r.page_seconds) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!tempCred} onOpenChange={(o) => !o && setTempCred(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>User created — share these credentials</DialogTitle>
            <DialogDescription>
              The user must change this password on first sign-in. This password
              will not be shown again.
            </DialogDescription>
          </DialogHeader>
          {tempCred && (
            <div className="space-y-2">
              <div>
                <Label className="text-xs">Email</Label>
                <Input readOnly value={tempCred.email} />
              </div>
              <div>
                <Label className="text-xs">Temporary Password</Label>
                <Input readOnly value={tempCred.password} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={copyCred}>
              <Copy className="w-4 h-4 mr-1" /> Copy
            </Button>
            <Button onClick={() => setTempCred(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
