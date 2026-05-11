import { type ComponentProps, useEffect, useMemo, useState } from "react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  Activity,
  UserPlus,
  ShieldCheck,
  MoreHorizontal,
  Copy,
  Search,
  CalendarDays,
  Pencil,
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

interface SignupRow {
  id: string;
  name: string;
  email: string;
  created_at: string;
  service_type: string | null;
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
  role: "Admin" | "Investor" | "No portal role";
  login_at: string;
  logout_at: string | null;
  duration_seconds: number | null;
  path: string;
  page_seconds: number;
}

type PortalRole = "admin" | "investor";
type ActivityPreset = "all" | "7" | "10" | "custom";
type BadgeVariant = ComponentProps<typeof Badge>["variant"];

type UserListRow = {
  key: string;
  source: "account" | "signup";
  user_id?: string;
  full_name: string | null;
  email: string;
  created_at: string;
  is_active?: boolean;
  is_admin?: boolean;
  is_investor?: boolean;
};

const getRoleLabel = (user: Pick<ProfileRow, "is_admin" | "is_investor">): ActivityRow["role"] => {
  if (user.is_admin) return "Admin";
  if (user.is_investor) return "Investor";
  return "No portal role";
};

const getRoleBadgeVariant = (role: string): BadgeVariant => {
  if (role === "Admin") return "roleAdmin";
  if (role === "Investor") return "roleInvestor";
  return "outline";
};

export default function AdminDashboard() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [signups, setSignups] = useState<SignupRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [recentLoginCount, setRecentLoginCount] = useState(0);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<PortalRole>("investor");
  const [busy, setBusy] = useState(false);
  const [tempCred, setTempCred] = useState<{ email: string; password: string } | null>(null);
  const [pendingAdminUser, setPendingAdminUser] = useState<UserListRow | null>(null);
  const [confirmAdminInvite, setConfirmAdminInvite] = useState(false);
  const [activityPreset, setActivityPreset] = useState<ActivityPreset>("7");
  const [activitySearch, setActivitySearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [editNameUser, setEditNameUser] = useState<UserListRow | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [pendingDeleteSignup, setPendingDeleteSignup] = useState<UserListRow | null>(null);

  useEffect(() => {
    if (!loading && !isAdmin) navigate("/");
  }, [loading, isAdmin, navigate]);

  const load = async () => {
    const [{ data: profs }, { data: roles }, { data: sess }, { data: views }, { data: signupRows }] =
      await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
        supabase
          .from("login_sessions")
          .select("*")
          .order("login_at", { ascending: false })
          .limit(1000),
        supabase.from("page_views").select("user_id, session_id, path, duration_seconds"),
        supabase.from("email_signups").select("id, name, email, created_at, service_type").order("created_at", { ascending: false }),
      ]);

    const adminSet = new Set(
      (roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id),
    );
    const investorSet = new Set(
      (roles ?? []).filter((r) => r.role === "investor").map((r) => r.user_id),
    );
    const enrichedProfiles = (profs ?? []).map((p) => ({
      ...(p as ProfileRow),
      is_admin: adminSet.has(p.user_id),
      is_investor: investorSet.has(p.user_id),
    }));
    const profileMap = new Map(enrichedProfiles.map((p) => [p.user_id, p]));

    setProfiles(enrichedProfiles);
    setSignups((signupRows ?? []) as SignupRow[]);
    setRecentLoginCount((sess ?? []).length);

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
      const role = prof ? getRoleLabel(prof) : "No portal role";
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
        const byPath = new Map<string, number>();
        sessionViews.forEach((v) =>
          byPath.set(v.path, (byPath.get(v.path) ?? 0) + (v.duration_seconds ?? 0)),
        );
        Array.from(byPath.entries())
          .sort((a, b) => b[1] - a[1])
          .forEach(([path, secs]) => {
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

  const userRows = useMemo<UserListRow[]>(() => {
    const accountEmails = new Set(profiles.map((p) => p.email.toLowerCase()));
    const accountRows: UserListRow[] = profiles.map((p) => ({
      key: `account-${p.user_id}`,
      source: "account",
      user_id: p.user_id,
      full_name: p.full_name,
      email: p.email,
      created_at: p.created_at,
      is_active: p.is_active,
      is_admin: p.is_admin,
      is_investor: p.is_investor,
    }));
    const signupRows: UserListRow[] = signups
      .filter((s) => !accountEmails.has(s.email.toLowerCase()))
      .map((s) => ({
        key: `signup-${s.id}`,
        source: "signup",
        full_name: s.name,
        email: s.email,
        created_at: s.created_at,
        is_admin: false,
        is_investor: false,
      }));
    return [...accountRows, ...signupRows];
  }, [profiles, signups]);

  const filteredActivity = useMemo(() => {
    const search = activitySearch.trim().toLowerCase();
    const now = Date.now();
    const fromTs =
      activityPreset === "7"
        ? now - 7 * 24 * 60 * 60 * 1000
        : activityPreset === "10"
        ? now - 10 * 24 * 60 * 60 * 1000
        : activityPreset === "custom" && fromDate
        ? new Date(`${fromDate}T00:00:00`).getTime()
        : null;
    const toTs =
      activityPreset === "custom" && toDate
        ? new Date(`${toDate}T23:59:59`).getTime()
        : null;

    return activity.filter((row) => {
      const loginTs = new Date(row.login_at).getTime();
      if (fromTs && loginTs < fromTs) return false;
      if (toTs && loginTs > toTs) return false;
      if (!search) return true;
      return [row.full_name ?? "", row.email, row.role, row.path]
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }, [activity, activityPreset, activitySearch, fromDate, toDate]);

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

  const createInvite = async (role: PortalRole, email = inviteEmail, fullName = inviteName) => {
    if (!email) return;
    const data = (await callAdmin("invite", {
      email,
      full_name: fullName,
      role,
    })) as { temp_password?: string } | null;
    if (data?.temp_password) {
      setTempCred({ email, password: data.temp_password });
      setInviteEmail("");
      setInviteName("");
      setInviteRole("investor");
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    if (inviteRole === "admin") {
      setConfirmAdminInvite(true);
      return;
    }
    await createInvite("investor");
  };

  const handleSignupInvite = async (row: UserListRow) => {
    const data = (await callAdmin("invite", {
      email: row.email,
      full_name: row.full_name ?? "",
      role: "investor",
    })) as { temp_password?: string } | null;
    if (data?.temp_password) {
      setTempCred({ email: row.email, password: data.temp_password });
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

  const openEditName = (row: UserListRow) => {
    setEditNameUser(row);
    setEditNameValue(row.full_name ?? "");
  };

  const submitEditName = async () => {
    if (!editNameUser?.user_id) return;
    await callAdmin("update_name", {
      user_id: editNameUser.user_id,
      full_name: editNameValue,
    });
    setEditNameUser(null);
  };

  const handleDeleteSignup = async (row: UserListRow) => {
    await callAdmin("delete_signup", { email: row.email });
    setPendingDeleteSignup(null);
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
        <p className="text-muted-foreground">Manage investors, admins, website signups, and portal activity</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4" /> Total Contacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{userRows.length}</p>
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
              <Activity className="w-4 h-4" /> Logins Tracked
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
                onValueChange={(v) => setInviteRole(v as PortalRole)}
              >
                <SelectTrigger id="irole">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="investor">Investor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
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
          <CardTitle>
            Users & Website Signups{" "}
            <span className="text-sm font-normal text-muted-foreground">
              ({userRows.length} total · scroll to see more)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <div className="max-h-[32rem] overflow-auto always-scrollbar">
              <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead className="min-w-[220px]">Name</TableHead>
                <TableHead className="min-w-[260px]">Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {userRows.map((row) => {
                const role = getRoleLabel(row);
                void role;
                return (
                  <TableRow key={row.key}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {row.full_name || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{row.email}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {row.is_admin && <Badge variant="roleAdmin">Admin</Badge>}
                        {row.is_investor && <Badge variant="roleInvestor">Investor</Badge>}
                        {!row.is_admin && !row.is_investor && (
                          <Badge variant="outline">No portal role</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {row.source === "signup" ? (
                        <Badge variant="secondary">Website signup</Badge>
                      ) : (
                        <Badge variant={row.is_active ? "default" : "destructive"}>
                          {row.is_active ? "Active" : "Disabled"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline" disabled={busy} aria-label={`Actions for ${row.email}`}>
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52 bg-background">
                          {row.source === "signup" ? (
                            <>
                              <DropdownMenuLabel>Website signup</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => handleSignupInvite(row)}>
                                Invite as Investor
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setPendingDeleteSignup(row)}
                              >
                                Remove Signup
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <>
                              <DropdownMenuLabel>Roles</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => openEditName(row)}>
                                <Pencil className="w-3.5 h-3.5 mr-2" /> Edit Name
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() =>
                                  row.is_admin
                                    ? callAdmin("set_role", {
                                        user_id: row.user_id,
                                        make_admin: false,
                                      })
                                    : setPendingAdminUser(row)
                                }
                              >
                                {row.is_admin ? "Remove Admin" : "Make Admin"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  callAdmin("set_investor", {
                                    user_id: row.user_id,
                                    make_investor: !row.is_investor,
                                  })
                                }
                              >
                                {row.is_investor ? "Remove Investor" : "Make Investor"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel>Account</DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() =>
                                  callAdmin("set_active", {
                                    user_id: row.user_id,
                                    is_active: !row.is_active,
                                  })
                                }
                              >
                                {row.is_active ? "Deactivate" : "Activate"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => callAdmin("send_reset", { email: row.email })}
                              >
                                Send Reset Email
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => row.user_id && handleSetPassword(row.user_id, row.email)}
                              >
                                Set Password
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => row.user_id && handleDelete(row.user_id, row.email)}
                              >
                                Delete User
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" /> Login Activity & Time Spent
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px_180px_180px] items-end">
            <div>
              <Label htmlFor="activity-search" className="flex items-center gap-2">
                <Search className="h-4 w-4" /> Search user, email, role, or page
              </Label>
              <Input
                id="activity-search"
                value={activitySearch}
                onChange={(e) => setActivitySearch(e.target.value)}
                placeholder="Search activity"
              />
            </div>
            <div>
              <Label htmlFor="activity-range" className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" /> Date Range
              </Label>
              <Select value={activityPreset} onValueChange={(v) => setActivityPreset(v as ActivityPreset)}>
                <SelectTrigger id="activity-range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="10">Last 10 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="custom">Custom range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="from-date">From</Label>
              <Input
                id="from-date"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                disabled={activityPreset !== "custom"}
              />
            </div>
            <div>
              <Label htmlFor="to-date">To</Label>
              <Input
                id="to-date"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                disabled={activityPreset !== "custom"}
              />
            </div>
          </div>

          <div className="rounded-md border overflow-hidden">
            <div className="max-h-[34rem] overflow-auto always-scrollbar">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead className="min-w-[180px]">Name</TableHead>
                    <TableHead className="min-w-[240px]">Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Login</TableHead>
                    <TableHead>Logout</TableHead>
                    <TableHead>Session Duration</TableHead>
                    <TableHead className="min-w-[180px]">Page</TableHead>
                    <TableHead className="text-right">Time on Page</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredActivity.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell className="whitespace-nowrap">{r.full_name || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.email}</TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(r.role)}>{r.role}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {new Date(r.login_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {r.logout_at ? new Date(r.logout_at).toLocaleString() : "Active"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDuration(r.duration_seconds)}</TableCell>
                      <TableCell>
                        <code className="text-xs">{r.path}</code>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {r.page_seconds ? formatDuration(r.page_seconds) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredActivity.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                        No activity matches the selected filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!pendingAdminUser} onOpenChange={(open) => !open && setPendingAdminUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to make them admin?</AlertDialogTitle>
            <AlertDialogDescription>
              Admins can manage users, roles, reset emails, and view all portal activity. Only grant this to trusted team members.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!pendingAdminUser?.user_id) return;
                await callAdmin("set_role", {
                  user_id: pendingAdminUser.user_id,
                  make_admin: true,
                });
                setPendingAdminUser(null);
              }}
            >
              Make Admin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmAdminInvite} onOpenChange={setConfirmAdminInvite}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to invite an admin?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a new admin account with full dashboard access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setConfirmAdminInvite(false);
                await createInvite("admin");
              }}
            >
              Invite Admin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
