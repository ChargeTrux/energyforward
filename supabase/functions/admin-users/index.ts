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

const forceEnergyForwardResetUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("redirect_to", getResetRedirectUrl());
    return parsed.toString();
  } catch {
    return url;
  }
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
      const { email, full_name, role, roles } = body;
      if (!email || typeof email !== "string") return json({ error: "Invalid email" }, 400);

      // Generate a strong temporary password
      const bytes = new Uint8Array(12);
      crypto.getRandomValues(bytes);
      const tempPassword =
        Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("") + "A1!";

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
          must_change_password: !userAlreadyExisted,
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
      // Optional multi-role assignment (customer + investor portals)
      if (Array.isArray(roles)) {
        const valid = (roles as unknown[]).filter(
          (r): r is "admin" | "investor" | "customer" =>
            r === "admin" || r === "investor" || r === "customer",
        );
        for (const r of valid) {
          await admin
            .from("user_roles")
            .upsert({ user_id: newUserId, role: r }, { onConflict: "user_id,role" });
        }
      }

      // Send branded welcome email with credentials.
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (RESEND_API_KEY) {
        const portals: string[] = [];
        if (role === "investor" || (Array.isArray(roles) && roles.includes("investor"))) portals.push("Investor");
        if (Array.isArray(roles) && roles.includes("customer")) portals.push("Customer");
        if (userAlreadyExisted) {
          // Existing user — send a password reset link instead of a temp password.
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
                resetUrl: forceEnergyForwardResetUrl(actionLink),
                expirationMinutes: 60,
                portals,
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
            loginUrl: EF_PORTAL_URL,
            portals,
          });
          const r = await sendBrandedEmail(RESEND_API_KEY, {
            to: email,
            subject: tpl.subject,
            html: tpl.html,
            from: tpl.from,
            replyTo: tpl.replyTo,
          });
          if (!r.ok) console.error("Welcome email failed:", r.error);
        }
      }

      return json({
        ok: true,
        user_id: newUserId,
        temp_password: userAlreadyExisted ? null : tempPassword,
        already_existed: userAlreadyExisted,
      });
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
            if (row.role === "customer") userPortals.push("Customer");
          }
        }
      } catch (_) { /* fall back to default investor branding */ }
      const tpl = resetEmail({
        name: (prof?.full_name as string | null) ?? "Investor",
        resetUrl: forceEnergyForwardResetUrl(actionLink),
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
      const { error } = await admin.auth.admin.deleteUser(user_id);
      if (error) return json({ error: error.message }, 400);
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