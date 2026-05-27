import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  accessRequestEmail,
  sendBrandedEmail,
  EF_FROM,
  EF_REPLY_TO,
  EF_ADMIN_URL,
} from "../_shared/branded-emails.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_INBOX = "submission@energyforward.com";

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "valid email required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: row, error } = await supabase
      .from("contact_submissions")
      .select("id, full_name, role_position, email, phone, company, interest, message, created_at, timezone")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !row) {
      return new Response(JSON.stringify({ error: "submission not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reject stale notifications (replay protection — only notify for
    // submissions created in the last 10 minutes).
    const createdAt = new Date(row.created_at).getTime();
    if (Date.now() - createdAt > 10 * 60 * 1000) {
      return new Response(JSON.stringify({ error: "submission too old" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "Email provider not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tz =
      (typeof row.timezone === "string" && row.timezone.trim()) ||
      "America/New_York";
    let submittedAt: string;
    try {
      submittedAt = new Date(row.created_at).toLocaleString("en-US", {
        timeZone: tz,
        dateStyle: "full",
        timeStyle: "long",
      });
    } catch {
      submittedAt = new Date(row.created_at).toLocaleString("en-US", {
        timeZone: "America/New_York",
        dateStyle: "full",
        timeStyle: "long",
      });
    }

    const safe = {
      name: escapeHtml(row.full_name || ""),
      role: escapeHtml(row.role_position || "—"),
      email: escapeHtml(row.email || ""),
      phone: escapeHtml(row.phone || "—"),
      company: escapeHtml(row.company || "—"),
      interest: escapeHtml(row.interest || ""),
      message: escapeHtml(row.message || "—"),
    };

    const adminHtml = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;padding:20px;">
        <h1 style="color:#0b1220;border-bottom:2px solid #f5a524;padding-bottom:10px;">
          New Contact Inquiry
        </h1>
        <p style="color:#374151;">A new inquiry has been submitted on the Energy Forward Contact Us page.</p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px;">
          <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-weight:bold;color:#6b7280;width:160px;">Full Name</td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;color:#111827;">${safe.name}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-weight:bold;color:#6b7280;">Role / Position</td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;color:#111827;">${safe.role}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-weight:bold;color:#6b7280;">Email</td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;color:#111827;"><a href="mailto:${safe.email}" style="color:#5fb4a2;">${safe.email}</a></td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-weight:bold;color:#6b7280;">Phone</td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;color:#111827;">${safe.phone}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-weight:bold;color:#6b7280;">Company</td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;color:#111827;">${safe.company}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-weight:bold;color:#6b7280;">Interest</td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;color:#111827;"><strong>${safe.interest}</strong></td></tr>
          <tr><td style="padding:8px 0;font-weight:bold;color:#6b7280;vertical-align:top;">Message</td><td style="padding:8px 0;color:#111827;white-space:pre-wrap;">${safe.message}</td></tr>
        </table>
        <p style="color:#6b7280;font-size:13px;margin-top:24px;">Submitted: ${escapeHtml(submittedAt)}</p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="left" style="margin-top:20px;">
          <tr><td align="center" bgcolor="#5fb4a2" style="border-radius:6px;">
            <a href="${EF_ADMIN_URL}" target="_blank" style="display:inline-block;padding:14px 30px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#0b1220;text-decoration:none;border-radius:6px;background-color:#5fb4a2;">Open Admin Portal</a>
          </td></tr>
        </table>
        <p style="color:#6b7280;font-size:12px;margin-top:16px;clear:both;">Review and grant access in the admin dashboard.</p>
      </div>
    `;

    const adminRes = await sendBrandedEmail(RESEND_API_KEY, {
      to: ADMIN_INBOX,
      subject: `New Contact Inquiry: ${row.full_name} (${row.interest})`,
      html: adminHtml,
      from: EF_FROM,
      replyTo: row.email || EF_REPLY_TO,
    });
    if (!adminRes.ok) console.error("Admin notification failed:", adminRes.error);

    // Send a branded confirmation to the submitter.
    try {
      const tpl = accessRequestEmail({
        name: row.full_name || "",
        requestDate: submittedAt,
      });
      const r = await sendBrandedEmail(RESEND_API_KEY, {
        to: row.email,
        subject: tpl.subject,
        html: tpl.html,
      });
      if (!r.ok) console.error("Submitter confirmation failed:", r.error);
    } catch (e) {
      console.error("Submitter confirmation send error:", (e as Error).message);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});