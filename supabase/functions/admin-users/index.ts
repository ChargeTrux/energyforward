import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  welcomeEmail,
  resetEmail,
  sendBrandedEmail,
  EF_PORTAL_URL,
} from "../_shared/branded-emails.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const APP_ORIGIN = "https://energyforward-launchpad.lovable.app";
const getResetRedirectUrl = () => `${APP_ORIGIN}/reset-password`;

// Readable temporary password: no look-alike characters (0/O, 1/l/I), grouped
// like "Kp7m-Rx4t-Wq9h" so it can be typed or copied without mistakes.
const TEMP_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const makeTempPassword = (): string => {
  const pick = () => {
    const b = new Uint8Array(1);
    while (true) {
      crypto.getRandomValues(b);
      if (b[0] < 220) return TEMP_ALPHABET[b[0] % TEMP_ALPHABET.length];
    }
  };
  while (true) {
    const groups = [0, 1, 2].map(() => Array.from({ length: 4 }, pick).join(""));
    const pwd = groups.join("-");
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && /[2-9]/.test(pwd)) return pwd;
  }
};

const forceEnergyForwardResetUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("redirect_to", getResetRedirectUrl());
    return parsed.toString();
  } catch {
    return url;
  }
};

// Link straight to our own reset page with the token; the page verifies it on load.
// Avoids the auth server's fallback redirect and email scanners consuming the token.
const directResetUrl = (hashed: string | undefined, fallback: string): string => {
  if (!hashed) return forceEnergyForwardResetUrl(fallback);
  const u = new URL(RESET_BASE());
  u.searchParams.set("token_hash", hashed);
  u.searchParams.set("type", "recovery");
  return u.toString();
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is an admin
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Missing auth" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const isAdmin = !!roles?.some((r: { role: string }) => r.role === "admin");
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    const { action } = body;

    if (action === "invite") {
      const { email, full_name, role, roles, investor_profile_ids, investor_video_ids, app_origin } = body;
      const sendEmail = body.send_email !== false;
      if (!email || typeof email !== "string") return json({ error: "Invalid email" }, 400);

      // Generate a strong temporary password
      const tempPassword = makeTempPassword();

      let newUserId: string | undefined;
      let userAlreadyExisted = false;
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: full_name ?? "" },
      });
      if (error) {
        // If the user already exists, look them up and proceed by adding
        // the requested roles + sending a password-reset welcome instead
        // of failing the whole invite.
        const msg = (error.message || "").toLowerCase();
        const alreadyExists =
          msg.includes("already") ||
          msg.includes("registered") ||
          msg.includes("exists") ||
          msg.includes("duplicate");
        if (!alreadyExists) return json({ error: error.message }, 400);
        userAlreadyExisted = true;
        // Find existing user id via profiles, fall back to listUsers.
        const { data: prof } = await admin
          .from("profiles")
          .select("user_id")
          .eq("email", email)
          .maybeSingle();
        newUserId = (prof as { user_id?: string } | null)?.user_id;
        if (!newUserId) {
          const { data: list } = await admin.auth.admin.listUsers({
            page: 1,
            perPage: 200,
          });
          newUserId = list?.users?.find(
            (u) => (u.email || "").toLowerCase() === email.toLowerCase(),
          )?.id;
        }
        if (!newUserId) return json({ error: error.message }, 400);
        // Make the temp password in the welcome email actually work.
        const { error: pwErr } = await admin.auth.admin.updateUserById(newUserId, {
          password: tempPassword,
          ban_duration: "none",
        });
        if (pwErr) return json({ error: pwErr.message }, 400);
      } else {
        newUserId = data.user?.id;
      }
      if (!newUserId) return json({ error: "User creation failed" }, 500);

      // Ensure profile + must_change_password flag
      await admin.from("profiles").upsert(
        {
          user_id: newUserId,
          email,
          full_name: full_name ?? "",
          must_change_password: true,
          is_active: true,
        },
        { onConflict: "user_id" },
      );

      // Assign role if requested
      if (role === "admin" || role === "investor") {
        await admin
          .from("user_roles")
          .upsert({ user_id: newUserId, role }, { onConflict: "user_id,role" });
      }
      // Multi-role invitations define exact portal access. Preserve admin,
      // but remove portal roles that were not selected when re-inviting an
      // existing account.
      if (Array.isArray(roles)) {
        const valid = (roles as unknown[]).filter(
          (r): r is "admin" | "investor" | "customer" | "video" =>
            r === "admin" || r === "investor" || r === "customer" || r === "video",
        );
        const portalRoles = ["investor", "customer", "video"] as const;
        const rolesToRemove = portalRoles.filter((portalRole) => !valid.includes(portalRole));
        if (rolesToRemove.length > 0) {
          await admin
            .from("user_roles")
            .delete()
            .eq("user_id", newUserId)
            .in("role", rolesToRemove);
        }
        for (const r of valid) {
          await admin
            .from("user_roles")
            .upsert({ user_id: newUserId, role: r }, { onConflict: "user_id,role" });
        }
      }

      if (Array.isArray(investor_video_ids)) {
        const videoIds = (investor_video_ids as unknown[]).filter((v): v is string => typeof v === "string");
        for (const fileId of videoIds) {
          await admin.from("investor_video_access").upsert(
            { user_id: newUserId, file_id: fileId },
            { onConflict: "user_id,file_id" },
          );
        }
      }

      // Investor document profiles (Profile A / B / C → Google Drive folders)
      let grantedProfiles:
        | { name: string; description: string | null; drive_url: string | null }[]
        | null = null;
      if (Array.isArray(investor_profile_ids) && investor_profile_ids.length > 0) {
        const ids = (investor_profile_ids as unknown[]).filter(
          (v): v is string => typeof v === "string",
        );
        if (ids.length) {
          for (const pid of ids) {
            await admin
              .from("investor_profile_access")
              .upsert(
                { user_id: newUserId, profile_id: pid },
                { onConflict: "user_id,profile_id" },
              );
          }
          const { data: profRows } = await admin
            .from("investor_profiles")
            .select("name, description, drive_url")
            .in("id", ids)
            .order("sort_order");
          grantedProfiles = (profRows ?? []) as typeof grantedProfiles;
        }
      }

      // Send branded welcome email with credentials.
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (RESEND_API_KEY && sendEmail) {
        const portals: string[] = [];
        if (role === "investor" || (Array.isArray(roles) && roles.includes("investor"))) portals.push("Investor");
        if (Array.isArray(roles) && roles.includes("video")) portals.push("Video");
        if (Array.isArray(roles) && roles.includes("customer")) portals.push("Customer");
        const requestOrigin = (() => {
          const raw = typeof app_origin === "string" ? app_origin : req.headers.get("origin");
          try {
            const parsed = new URL(raw ?? EF_PORTAL_URL);
            return `${parsed.protocol}//${parsed.host}`;
          } catch {
            return new URL(EF_PORTAL_URL).origin;
          }
        })();
        const loginParams = `?login=1&email=${encodeURIComponent(email)}`;
        const loginDestination = portals.includes("Video") && !portals.includes("Investor")
          ? `${requestOrigin}/investor/videos${loginParams}`
          : `${requestOrigin}/${loginParams}`;
        if (false) {
          // (disabled) Existing user — send a password reset link instead of a temp password.
          try {
            const { data: linkData } = await admin.auth.admin.generateLink({
              type: "recovery",
              email,
              options: { redirectTo: getResetRedirectUrl() },
            });
            const actionLink =
              (linkData?.properties as { action_link?: string } | undefined)?.action_link;
            if (actionLink) {
              const tpl = resetEmail({
                name: full_name ?? "",
                resetUrl: directResetUrl((linkData?.properties as { hashed_token?: string } | undefined)?.hashed_token, actionLink),
                expirationMinutes: 60,
                portals,
                investorProfiles: grantedProfiles,
              });
              const r = await sendBrandedEmail(RESEND_API_KEY, {
                to: email,
                subject: "Your Energy Forward Access Has Been Updated",
                html: tpl.html,
                from: tpl.from,
                replyTo: tpl.replyTo,
              });
              if (!r.ok) console.error("Reset email failed:", r.error);
            }
          } catch (e) {
            console.error("Generate reset link failed:", (e as Error).message);
          }
        } else {
          const tpl = welcomeEmail({
            name: full_name ?? "",
            email,
            tempPassword,
            loginUrl: loginDestination,
            portals,
            investorProfiles: grantedProfiles,
          });
          const r = await sendBrandedEmail(RESEND_API_KEY, {
            to: email,
            subject: tpl.subject,
            html: tpl.html,
            from: tpl.from,
            replyTo: tpl.replyTo,
          });
          if (!r.ok) console.error("Welcome email failed:", r.error);
          else await admin.from("profiles").update({ invite_sent_at: new Date().toISOString() }).eq("user_id", newUserId);
        }
      }

      return json({
        ok: true,
        user_id: newUserId,
        temp_password: tempPassword,
        email_sent: !!(RESEND_API_KEY && sendEmail),
        already_existed: userAlreadyExisted,
      });
    }

    if (action === "bulk_import") {
      // Create accounts in bulk from an uploaded list. No emails are sent —
      // the admin assigns access and invites each person individually later.
      const { people } = body;
      if (!Array.isArray(people) || people.length === 0) {
        return json({ error: "Missing people list" }, 400);
      }
      if (people.length > 200) return json({ error: "Maximum 200 people per import" }, 400);

      const results: { email: string; ok: boolean; message: string }[] = [];
      for (const raw of people as unknown[]) {
        const p = raw as { email?: unknown; full_name?: unknown };
        const email = typeof p.email === "string" ? p.email.trim() : "";
        const fullName = typeof p.full_name === "string" ? p.full_name.trim().slice(0, 200) : "";
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          results.push({ email: email || "(missing)", ok: false, message: "Invalid email" });
          continue;
        }
        const tempPassword = makeTempPassword();
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        });
        let userId = data.user?.id;
        if (error) {
          const msg = (error.message || "").toLowerCase();
          const alreadyExists =
            msg.includes("already") || msg.includes("registered") ||
            msg.includes("exists") || msg.includes("duplicate");
          if (!alreadyExists) {
            results.push({ email, ok: false, message: error.message });
            continue;
          }
          const { data: prof } = await admin
            .from("profiles")
            .select("user_id")
            .eq("email", email)
            .maybeSingle();
          userId = (prof as { user_id?: string } | null)?.user_id;
          if (!userId) {
            const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
            userId = list?.users?.find(
              (u) => (u.email || "").toLowerCase() === email.toLowerCase(),
            )?.id;
          }
          if (!userId) {
            results.push({ email, ok: false, message: "Already exists, could not look up" });
            continue;
          }
          results.push({ email, ok: true, message: "Already existed — added to list" });
        } else {
          results.push({ email, ok: true, message: "Created" });
        }
        await admin.from("profiles").upsert(
          {
            user_id: userId,
            email,
            full_name: fullName,
            must_change_password: true,
            is_active: true,
          },
          { onConflict: "user_id" },
        );
      }
      const created = results.filter((r) => r.ok).length;
      return json({ ok: true, imported: created, total: results.length, results });
    }

    if (action === "send_welcome") {
      // First-time invite for existing (e.g. bulk-imported) accounts:
      // sets a fresh temporary password and emails the branded welcome.
      const { user_ids, app_origin } = body;
      if (!Array.isArray(user_ids) || user_ids.length === 0) return json({ error: "Missing user_ids" }, 400);
      if (user_ids.length > 200) return json({ error: "Maximum 200 at once" }, 400);
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (!RESEND_API_KEY) return json({ error: "Email provider not configured" }, 500);
      const origin = (() => {
        const raw = typeof app_origin === "string" ? app_origin : req.headers.get("origin");
        try { const p = new URL(raw ?? EF_PORTAL_URL); return `${p.protocol}//${p.host}`; }
        catch { return new URL(EF_PORTAL_URL).origin; }
      })();
      const results: { user_id: string; email?: string; ok: boolean; message: string }[] = [];
      for (const uid of user_ids as unknown[]) {
        if (typeof uid !== "string") continue;
        const { data: prof } = await admin.from("profiles").select("email, full_name").eq("user_id", uid).maybeSingle();
        const email = (prof as { email?: string } | null)?.email;
        if (!email) { results.push({ user_id: uid, ok: false, message: "No profile" }); continue; }
        const fullName = (prof as { full_name?: string | null }).full_name ?? "";
        const { data: roleRows } = await admin.from("user_roles").select("role").eq("user_id", uid);
        const portals: string[] = [];
        for (const r of (roleRows ?? []) as Array<{ role: string }>) {
          if (r.role === "investor") portals.push("Investor");
          if (r.role === "video") portals.push("Video");
          if (r.role === "customer") portals.push("Customer");
        }
        const { data: accessRows } = await admin.from("investor_profile_access").select("profile_id").eq("user_id", uid);
        const pids = ((accessRows ?? []) as Array<{ profile_id: string }>).map((a) => a.profile_id);
        let grantedProfiles: { name: string; description: string | null; drive_url: string | null }[] | null = null;
        if (pids.length) {
          const { data: pr } = await admin.from("investor_profiles").select("name, description, drive_url").in("id", pids).order("sort_order");
          grantedProfiles = (pr ?? []) as typeof grantedProfiles;
        }
        const tempPassword = makeTempPassword();
        const { error: pwErr } = await admin.auth.admin.updateUserById(uid, { password: tempPassword, ban_duration: "none" });
        if (pwErr) { results.push({ user_id: uid, email, ok: false, message: pwErr.message }); continue; }
        await admin.from("profiles").update({ must_change_password: true }).eq("user_id", uid);
        const loginParams = `?login=1&email=${encodeURIComponent(email)}`;
        const loginUrl = portals.includes("Video") && !portals.includes("Investor")
          ? `${origin}/investor/videos${loginParams}`
          : `${origin}/${loginParams}`;
        const tpl = welcomeEmail({ name: fullName, email, tempPassword, loginUrl, portals, investorProfiles: grantedProfiles });
        const r = await sendBrandedEmail(RESEND_API_KEY, { to: email, subject: tpl.subject, html: tpl.html, from: tpl.from, replyTo: tpl.replyTo });
        if (r.ok) await admin.from("profiles").update({ invite_sent_at: new Date().toISOString(), is_active: true }).eq("user_id", uid);
        results.push({ user_id: uid, email, ok: r.ok, message: r.ok ? "Invite sent" : String(r.error) });
      }
      const sent = results.filter((r) => r.ok).length;
      return json({ ok: true, sent, total: results.length, results });
    }

    if (action === "set_role") {
      const { user_id, make_admin } = body;
      if (!user_id) return json({ error: "Missing user_id" }, 400);
      if (make_admin) {
        const { error } = await admin
          .from("user_roles")
          .upsert({ user_id, role: "admin" }, { onConflict: "user_id,role" });
        if (error) return json({ error: error.message }, 400);
      } else {
        const { error } = await admin
          .from("user_roles")
          .delete()
          .eq("user_id", user_id)
          .eq("role", "admin");
        if (error) return json({ error: error.message }, 400);
      }
      return json({ ok: true });
    }

    if (action === "set_investor") {
      const { user_id, make_investor } = body;
      if (!user_id) return json({ error: "Missing user_id" }, 400);
      if (make_investor) {
        const { error } = await admin
          .from("user_roles")
          .upsert({ user_id, role: "investor" }, { onConflict: "user_id,role" });
        if (error) return json({ error: error.message }, 400);
      } else {
        const { error } = await admin
          .from("user_roles")
          .delete()
          .eq("user_id", user_id)
          .eq("role", "investor");
        if (error) return json({ error: error.message }, 400);
      }
      return json({ ok: true });
    }

    if (action === "set_customer") {
      const { user_id, make_customer } = body;
      if (!user_id) return json({ error: "Missing user_id" }, 400);
      if (make_customer) {
        const { error } = await admin
          .from("user_roles")
          .upsert({ user_id, role: "customer" }, { onConflict: "user_id,role" });
        if (error) return json({ error: error.message }, 400);
      } else {
        const { error } = await admin
          .from("user_roles")
          .delete()
          .eq("user_id", user_id)
          .eq("role", "customer");
        if (error) return json({ error: error.message }, 400);
      }
      return json({ ok: true });
    }

    if (action === "set_video") {
      const { user_id, make_video } = body;
      if (!user_id) return json({ error: "Missing user_id" }, 400);
      const query = make_video
        ? admin.from("user_roles").upsert({ user_id, role: "video" }, { onConflict: "user_id,role" })
        : admin.from("user_roles").delete().eq("user_id", user_id).eq("role", "video");
      const { error } = await query;
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "send_reset") {
      const { email } = body;
      if (!email) return json({ error: "Missing email" }, 400);
      // Always use the production app URL — never the caller's origin
      // (which may be localhost or a preview URL when admins reset from dev).
      const redirectTo = getResetRedirectUrl();
      // Generate the recovery link without triggering Supabase's default email.
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo },
      });
      if (linkErr) return json({ error: linkErr.message }, 400);
      const actionLink =
        (linkData?.properties as { action_link?: string } | undefined)?.action_link;
      if (!actionLink) return json({ error: "Could not generate reset link" }, 500);

      // Look up profile name for personalization.
      const { data: prof } = await admin
        .from("profiles")
        .select("full_name")
        .eq("email", email)
        .maybeSingle();

      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (!RESEND_API_KEY) return json({ error: "Email provider not configured" }, 500);
      // Look up the recipient's portals so the reset email uses the right
      // sender + footer contact (customer@ vs investor@).
      const userPortals: string[] = [];
      try {
        const { data: profRow } = await admin
          .from("profiles")
          .select("user_id")
          .eq("email", email)
          .maybeSingle();
        const uid = (profRow as { user_id?: string } | null)?.user_id;
        if (uid) {
          const { data: roleRows } = await admin
            .from("user_roles")
            .select("role")
            .eq("user_id", uid);
          for (const row of (roleRows ?? []) as Array<{ role: string }>) {
            if (row.role === "investor") userPortals.push("Investor");
            if (row.role === "video") userPortals.push("Video");
            if (row.role === "customer") userPortals.push("Customer");
          }
        }
      } catch (_) { /* fall back to default investor branding */ }
      const tpl = resetEmail({
        name: (prof?.full_name as string | null) ?? "Investor",
        resetUrl: directResetUrl((linkData?.properties as { hashed_token?: string } | undefined)?.hashed_token, actionLink),
        expirationMinutes: 60,
        portals: userPortals,
      });
      const r = await sendBrandedEmail(RESEND_API_KEY, {
        to: email,
        subject: tpl.subject,
        html: tpl.html,
        from: tpl.from,
        replyTo: tpl.replyTo,
      });
      if (!r.ok) return json({ error: r.error }, 502);
      return json({ ok: true });
    }

    if (action === "set_password") {
      const { user_id, password } = body;
      if (!user_id || !password || typeof password !== "string" || password.length < 8) {
        return json({ error: "user_id and password (min 8 chars) required" }, 400);
      }
      const { error } = await admin.auth.admin.updateUserById(user_id, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "delete_user") {
      const { user_id } = body;
      if (!user_id) return json({ error: "Missing user_id" }, 400);
      if (user_id === userData.user.id) return json({ error: "Cannot delete yourself" }, 400);
      // Remove related rows first — some foreign keys don't cascade, which
      // would make the auth delete fail with a database error.
      const relatedTables = [
        "page_views",
        "login_sessions",
        "investor_video_access",
        "investor_profile_access",
        "page_access",
        "user_roles",
        "profiles",
      ];
      for (const table of relatedTables) {
        const { error: delErr } = await admin.from(table).delete().eq("user_id", user_id);
        if (delErr) console.error(`Cleanup ${table} failed:`, delErr.message);
      }
      const { data: target } = await admin.auth.admin.getUserById(user_id);
      const targetEmail = target?.user?.email;
      const { error } = await admin.auth.admin.deleteUser(user_id);
      if (error && !/not.?found/i.test(error.message)) return json({ error: error.message }, 400);
      if (targetEmail) {
        await admin.from("profiles").delete().ilike("email", targetEmail);
        // Remove any leftover duplicate account with the same email
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        for (const u of list?.users ?? []) {
          if ((u.email || "").toLowerCase() === targetEmail.toLowerCase()) {
            for (const t of relatedTables) await admin.from(t).delete().eq("user_id", u.id);
            await admin.auth.admin.deleteUser(u.id);
          }
        }
      }
      const { data: still } = await admin.auth.admin.getUserById(user_id);
      if (still?.user) return json({ error: "Account could not be fully removed — please try again" }, 500);
      return json({ ok: true });
    }

    if (action === "update_name") {
      const { user_id, full_name } = body;
      if (!user_id || typeof full_name !== "string") {
        return json({ error: "user_id and full_name required" }, 400);
      }
      const trimmed = full_name.trim().slice(0, 200);
      const { error: pErr } = await admin
        .from("profiles")
        .update({ full_name: trimmed })
        .eq("user_id", user_id);
      if (pErr) return json({ error: pErr.message }, 400);
      await admin.auth.admin.updateUserById(user_id, {
        user_metadata: { full_name: trimmed },
      });
      return json({ ok: true });
    }

    if (action === "delete_signup") {
      const { email } = body;
      if (!email || typeof email !== "string") return json({ error: "Missing email" }, 400);
      const { error } = await admin
        .from("email_signups")
        .delete()
        .eq("email", email);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "set_active") {
      const { user_id, is_active } = body;
      if (!user_id) return json({ error: "Missing user_id" }, 400);
      const { error: pErr } = await admin
        .from("profiles")
        .update({ is_active })
        .eq("user_id", user_id);
      if (pErr) return json({ error: pErr.message }, 400);
      // Ban / unban via auth admin
      const { error: bErr } = await admin.auth.admin.updateUserById(user_id, {
        ban_duration: is_active ? "none" : "876000h",
      });
      if (bErr) return json({ error: bErr.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});