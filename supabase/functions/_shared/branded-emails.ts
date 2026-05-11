// Shared branded email templates for Energy Forward Investor Portal.
// All transactional emails go out through Resend from no-reply@energyforward.com.

export const EF_FROM = "Energy Forward Investor Portal <investor@energyforward.com>";
export const EF_REPLY_TO = "investor@energyforward.com";
export const EF_LOGO_URL = "https://energyforward.com/favicon.png";
export const EF_SITE_URL = "https://energyforward.com";
export const EF_PORTAL_URL = "https://energyforward-launchpad.lovable.app/?login=1";

const NAVY = "#0F172A";
const BLUE = "#2563EB";
const LIGHT = "#F8FAFC";
const TEXT = "#334155";
const MUTED = "#64748B";
const BORDER = "#E2E8F0";

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function shell(opts: {
  preheader: string;
  heading: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  securityNote?: string;
}): string {
  const { preheader, heading, bodyHtml, ctaLabel, ctaUrl, securityNote } = opts;
  const cta = ctaLabel && ctaUrl
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:32px auto;">
         <tr><td align="center" bgcolor="${NAVY}" style="border-radius:8px;">
           <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;background-color:${NAVY};box-shadow:0 4px 12px rgba(15,23,42,0.18);">${ctaLabel}</a>
         </td></tr>
       </table>`
    : "";
  const security = securityNote
    ? `<p style="margin:24px 0 0;padding:14px 16px;background:${LIGHT};border-left:3px solid ${BLUE};border-radius:4px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:${TEXT};">${securityNote}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${LIGHT};font-family:Arial,Helvetica,sans-serif;color:${TEXT};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${LIGHT};padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;border:1px solid ${BORDER};box-shadow:0 6px 24px rgba(15,23,42,0.06);overflow:hidden;">
        <tr><td align="center" style="padding:32px 32px 16px;background:#ffffff;">
          <img src="${EF_LOGO_URL}" alt="Energy Forward" width="56" height="56" style="display:block;border:0;outline:none;text-decoration:none;border-radius:8px;" />
          <div style="margin-top:14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;letter-spacing:2px;color:${BLUE};text-transform:uppercase;font-weight:700;">Investor Portal</div>
        </td></tr>
        <tr><td style="padding:0 32px;"><div style="height:1px;background:${BORDER};"></div></td></tr>
        <tr><td style="padding:28px 32px 8px;">
          <h1 style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:1.3;color:${NAVY};font-weight:700;">${escapeHtml(heading)}</h1>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:${TEXT};">${bodyHtml}</div>
          ${cta}
          ${security}
        </td></tr>
        <tr><td style="padding:24px 32px 8px;"><div style="height:1px;background:${BORDER};"></div></td></tr>
        <tr><td align="center" style="padding:20px 32px 28px;background:#ffffff;">
          <img src="${EF_LOGO_URL}" alt="Energy Forward" width="36" height="36" style="display:block;border:0;border-radius:6px;margin:0 auto 10px;" />
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:${NAVY};">Energy Forward</div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${MUTED};margin-bottom:12px;">Investor Relations</div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.7;color:${MUTED};">
            <a href="${EF_SITE_URL}" style="color:${BLUE};text-decoration:none;">energyforward.com</a> &nbsp;·&nbsp;
            <a href="${EF_PORTAL_URL}" style="color:${BLUE};text-decoration:none;">Investor Portal</a> &nbsp;·&nbsp;
            <a href="mailto:${EF_REPLY_TO}" style="color:${BLUE};text-decoration:none;">${EF_REPLY_TO}</a>
          </div>
          <div style="margin-top:16px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${MUTED};line-height:1.6;">
            This email was sent securely by Energy Forward.<br/>
            Energy Forward will never ask for your password by email.<br/>
            &copy; 2026 Energy Forward. All rights reserved.
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function accessRequestEmail(args: { name: string; requestDate?: string }) {
  const name = escapeHtml(args.name || "Investor");
  const date = escapeHtml(
    args.requestDate ||
      new Date().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" }),
  );
  const body = `
    <p style="margin:0 0 14px;">Dear ${name},</p>
    <p style="margin:0 0 14px;">Thank you for your interest in the <strong>Energy Forward Investor Portal</strong>.</p>
    <p style="margin:0 0 14px;">Our team is currently reviewing your access request and validating the submitted information. We are working to provide you with secure access to investor resources and updates.</p>
    <p style="margin:0 0 14px;">Our team will contact you accordingly once the review process is completed.</p>
    <p style="margin:18px 0 0;font-size:13px;color:${MUTED};">Request received: ${date}</p>
  `;
  return {
    subject: "Your Investor Access Request Is Under Review",
    html: shell({
      preheader: "Your investor access request has been received and is under review.",
      heading: "Your access request is under review",
      bodyHtml: body,
      ctaLabel: "Visit Energy Forward",
      ctaUrl: EF_SITE_URL,
    }),
  };
}

export function welcomeEmail(args: {
  name: string;
  email: string;
  tempPassword: string;
  loginUrl?: string;
}) {
  const name = escapeHtml(args.name || "Investor");
  const email = escapeHtml(args.email);
  const pwd = escapeHtml(args.tempPassword);
  const baseLogin = args.loginUrl || "https://energyforward-launchpad.lovable.app/";
  const sep = baseLogin.includes("?") ? "&" : "?";
  const loginUrl = `${baseLogin}${sep}login=1&email=${encodeURIComponent(args.email)}`;
  const body = `
    <p style="margin:0 0 14px;">Dear ${name},</p>
    <p style="margin:0 0 14px;">Welcome to the <strong>Energy Forward Investor Portal</strong>. Your access has been approved and your account is now active.</p>
    <p style="margin:0 0 10px;">Use the credentials below to sign in for the first time:</p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:6px 0 4px;border:1px solid ${BORDER};border-radius:8px;background:${LIGHT};">
      <tr><td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;">
        <div style="color:${MUTED};text-transform:uppercase;letter-spacing:1px;font-size:11px;font-weight:700;">Email</div>
        <div style="color:${NAVY};font-weight:600;font-size:14px;margin-top:2px;">${email}</div>
        <div style="height:1px;background:${BORDER};margin:12px 0;"></div>
        <div style="color:${MUTED};text-transform:uppercase;letter-spacing:1px;font-size:11px;font-weight:700;">Temporary Password</div>
        <div style="color:${NAVY};font-family:Consolas,Menlo,monospace;font-weight:700;font-size:15px;margin-top:2px;letter-spacing:0.5px;">${pwd}</div>
      </td></tr>
    </table>
  `;
  return {
    subject: "Welcome to the Energy Forward Investor Portal",
    html: shell({
      preheader: "Your investor access has been approved.",
      heading: "Welcome to the Investor Portal",
      bodyHtml: body,
      ctaLabel: "Access Investor Portal",
      ctaUrl: loginUrl,
      securityNote:
        "For your security, please change your password immediately after your first sign-in. Keep your credentials confidential. If you need assistance, contact <a href=\"mailto:" +
        EF_REPLY_TO +
        "\" style=\"color:" +
        BLUE +
        ";\">" +
        EF_REPLY_TO +
        "</a>.",
    }),
  };
}

export function resetEmail(args: {
  name?: string;
  resetUrl: string;
  expirationMinutes?: number;
}) {
  const name = escapeHtml(args.name || "Investor");
  const minutes = args.expirationMinutes ?? 60;
  const body = `
    <p style="margin:0 0 14px;">Dear ${name},</p>
    <p style="margin:0 0 14px;">We received a request to reset the password for your Energy Forward Investor Portal account. Click the button below to set a new password.</p>
    <p style="margin:0 0 14px;color:${MUTED};font-size:13px;">This link will expire in approximately ${minutes} minutes for your security.</p>
  `;
  return {
    subject: "Reset Your Energy Forward Password",
    html: shell({
      preheader: "Reset your Energy Forward Investor Portal password.",
      heading: "Reset your password",
      bodyHtml: body,
      ctaLabel: "Reset Password",
      ctaUrl: args.resetUrl,
      securityNote:
        "If you did not request this password reset, you may safely ignore this email \u2014 your password will remain unchanged. Energy Forward will never ask for your password by email.",
    }),
  };
}

export async function sendBrandedEmail(
  resendApiKey: string,
  args: { to: string | string[]; subject: string; html: string; replyTo?: string },
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: EF_FROM,
        to: Array.isArray(args.to) ? args.to : [args.to],
        subject: args.subject,
        html: args.html,
        reply_to: args.replyTo ?? EF_REPLY_TO,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: `Resend ${res.status}: ${JSON.stringify(data)}` };
    }
    return { ok: true, id: (data as { id?: string }).id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}