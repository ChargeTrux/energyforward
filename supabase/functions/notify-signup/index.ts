import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// HTML escape function to prevent XSS/injection attacks
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Input validation
function validateInput(name: unknown, email: unknown): { valid: boolean; error?: string; name?: string; email?: string } {
  if (typeof name !== "string" || typeof email !== "string") {
    return { valid: false, error: "Invalid input types" };
  }

  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();

  // Name validation
  if (!trimmedName || trimmedName.length < 1 || trimmedName.length > 100) {
    return { valid: false, error: "Name must be between 1 and 100 characters" };
  }

  // Email validation - basic regex check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!trimmedEmail || !emailRegex.test(trimmedEmail) || trimmedEmail.length > 255) {
    return { valid: false, error: "Invalid email format" };
  }

  return { valid: true, name: trimmedName, email: trimmedEmail };
}

const handler = async (req: Request): Promise<Response> => {
  console.log("notify-signup function called");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  try {
    const body = await req.json();
    const validation = validateInput(body.name, body.email);

    if (!validation.valid) {
      console.error("Validation failed:", validation.error);
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { name, email } = validation;
    console.log(`Processing signup notification for: ${name} (${email})`);

    // Verify the signup exists in the database (prevents abuse - only sends if record exists)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: signupRecord, error: dbError } = await supabase
      .from("email_signups")
      .select("id, created_at")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (dbError || !signupRecord) {
      console.error("Signup not found in database:", dbError?.message);
      return new Response(
        JSON.stringify({ error: "Signup record not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if signup was created within the last 5 minutes (prevents replay attacks)
    const signupTime = new Date(signupRecord.created_at).getTime();
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (now - signupTime > fiveMinutes) {
      console.error("Signup record is too old");
      return new Response(
        JSON.stringify({ error: "Signup notification window expired" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const submittedAt = new Date(signupRecord.created_at).toLocaleString("en-US", {
      timeZone: "America/New_York",
      dateStyle: "full",
      timeStyle: "long",
    });

    // Escape user inputs before inserting into HTML
    const safeName = escapeHtml(name!);
    const safeEmail = escapeHtml(email!);

    // Look up admin emails dynamically so notifications go to portal admins
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminUserIds = (adminRoles ?? []).map((r: { user_id: string }) => r.user_id);
    let adminEmails: string[] = [];
    if (adminUserIds.length > 0) {
      const { data: adminProfiles } = await supabase
        .from("profiles")
        .select("email")
        .in("user_id", adminUserIds);
      adminEmails = (adminProfiles ?? [])
        .map((p: { email: string }) => p.email)
        .filter((e: string) => !!e);
    }
    if (adminEmails.length === 0) {
      adminEmails = ["arahimi@energyforward.com"];
    }

    const emailResponse = await resend.emails.send({
      from: "Energy Forward <onboarding@resend.dev>",
      to: adminEmails,
      subject: `New Signup: ${safeName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; border-bottom: 2px solid #10b981; padding-bottom: 10px;">
            New User Signup
          </h1>
          
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #374151; margin-top: 0;">Submission Details</h2>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">Full Name:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #111827;">${safeName}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">Email:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #111827;">
                  <a href="mailto:${safeEmail}" style="color: #10b981;">${safeEmail}</a>
                </td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #6b7280;">Submitted At:</td>
                <td style="padding: 10px 0; color: #111827;">${submittedAt}</td>
              </tr>
            </table>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            This is an automated notification from the Energy Forward website.
          </p>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, message: "Notification sent" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in notify-signup function:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send notification" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);