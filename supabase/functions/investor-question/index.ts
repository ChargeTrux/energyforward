import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM = "EnergyForward Investor <investor@energyforward.com>";
const FALLBACK_ADMIN = "arahimi@energyforward.com";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const subjectRaw = typeof body.subject === "string" ? body.subject.trim() : "";
    const messageRaw = typeof body.message === "string" ? body.message.trim() : "";
    if (!subjectRaw || subjectRaw.length > 200) {
      return new Response(JSON.stringify({ error: "Subject is required (max 200 chars)" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if (!messageRaw || messageRaw.length > 5000) {
      return new Response(JSON.stringify({ error: "Message is required (max 5000 chars)" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Look up sender's profile name
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", user.id)
      .maybeSingle();
    const senderName = profile?.full_name || user.email || "Investor";
    const senderEmail = profile?.email || user.email || "";

    // Look up admin recipients
    const { data: roles } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminIds = (roles ?? []).map((r: { user_id: string }) => r.user_id);
    let adminEmails: string[] = [];
    if (adminIds.length > 0) {
      const { data: adminProfiles } = await admin
        .from("profiles")
        .select("email")
        .in("user_id", adminIds);
      adminEmails = (adminProfiles ?? [])
        .map((p: { email: string }) => p.email)
        .filter(Boolean);
    }
    if (adminEmails.length === 0) adminEmails = [FALLBACK_ADMIN];

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const safeSubject = escapeHtml(subjectRaw);
    const safeMessage = escapeHtml(messageRaw).replace(/\n/g, "<br>");
    const safeName = escapeHtml(senderName);
    const safeEmail = escapeHtml(senderEmail);
    const submittedAt = new Date().toLocaleString("en-US", {
      timeZone: "America/New_York",
      dateStyle: "full",
      timeStyle: "long",
    });

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#ffffff;color:#0F172A;">
        <div style="border-bottom:3px solid #2563EB;padding-bottom:12px;margin-bottom:20px;">
          <h1 style="margin:0;font-size:20px;color:#0F172A;">New Investor Question</h1>
          <p style="margin:4px 0 0;font-size:12px;color:#64748B;">EnergyForward Investor Portal</p>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:8px 0;color:#64748B;width:120px;">From:</td><td style="padding:8px 0;color:#0F172A;"><strong>${safeName}</strong></td></tr>
          <tr><td style="padding:8px 0;color:#64748B;">Email:</td><td style="padding:8px 0;"><a href="mailto:${safeEmail}" style="color:#2563EB;">${safeEmail}</a></td></tr>
          <tr><td style="padding:8px 0;color:#64748B;">Submitted:</td><td style="padding:8px 0;color:#0F172A;">${submittedAt}</td></tr>
          <tr><td style="padding:8px 0;color:#64748B;">Subject:</td><td style="padding:8px 0;color:#0F172A;"><strong>${safeSubject}</strong></td></tr>
        </table>
        <div style="margin-top:20px;padding:16px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;">
          <p style="margin:0 0 8px;font-size:12px;color:#64748B;text-transform:uppercase;letter-spacing:0.05em;">Message</p>
          <div style="font-size:14px;color:#0F172A;line-height:1.6;">${safeMessage}</div>
        </div>
        <p style="margin-top:24px;font-size:12px;color:#94A3B8;">
          Reply directly to this email to respond to ${safeName}.
        </p>
      </div>
    `;

    const result = await resend.emails.send({
      from: FROM,
      to: adminEmails,
      reply_to: senderEmail || undefined,
      subject: `[Investor Question] ${subjectRaw}`,
      html,
    });

    if ((result as any).error) {
      console.error("Resend error:", (result as any).error);
      return new Response(JSON.stringify({ error: "Email failed to send" }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e) {
    console.error("investor-question error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});