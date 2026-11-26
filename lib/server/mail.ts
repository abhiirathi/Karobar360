// Sends the sign-in link. Uses the mailbox set in config (a Gmail address with an app password).
import nodemailer from "nodemailer";
import { config } from "./config";

export async function sendMagicLink(to: string, link: string, code: string): Promise<{ ok: boolean; reason?: string }> {
  const c = await config();
  if (!c.smtpUser || !c.smtpPass) {
    if (process.env.K360_LOCAL === "1") { console.log(`[magic link for ${to}] code ${code} ${link}`); return { ok: true }; }
    return { ok: false, reason: "not_configured" };
  }
  const t = nodemailer.createTransport({ host: c.smtpHost, port: 465, secure: true, auth: { user: c.smtpUser, pass: c.smtpPass } });
  const text = `Sign in to Karobar360\n\nYour code: ${code}\n\nOr open this link to sign in. Both work for 20 minutes.\n\n${link}\n\nIf you did not ask for this, you can ignore this email.`;
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:460px;margin:0 auto;padding:32px 24px;color:#1c1917">
<div style="font-weight:700;font-size:18px;letter-spacing:-0.01em">Karobar360</div>
<h1 style="font-size:22px;margin:28px 0 8px;letter-spacing:-0.02em">Sign in to your workspace</h1>
<p style="margin:0 0 20px;color:#57534e;line-height:1.5">Tap the button to sign in. Using the Karobar360 app? Type this code there instead. Both work for 20 minutes.</p>
<div style="font-size:30px;font-weight:700;letter-spacing:0.3em;font-family:ui-monospace,Menlo,monospace;margin:0 0 24px">${code}</div>
<a href="${link}" style="display:inline-block;background:#1c1917;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">Sign in</a>
<p style="margin:28px 0 0;font-size:13px;color:#78716c;line-height:1.5">Button not working? Copy this into your browser:<br><span style="word-break:break-all">${link}</span></p>
<p style="margin:20px 0 0;font-size:13px;color:#a8a29e">If you did not ask for this, ignore this email.</p></div>`;
  try {
    await t.sendMail({ from: c.smtpFrom || `Karobar360 <${c.smtpUser}>`, to, subject: `${code} is your Karobar360 sign-in code`, text, html });
    return { ok: true };
  } catch (e) {
    console.error("mail", e);
    return { ok: false, reason: "send_failed" };
  }
}

/** Tells a new team member they can sign in, and with which email. */
export async function sendInvite(to: string, opts: { name: string; company: string; by: string; url: string }): Promise<boolean> {
  const c = await config();
  if (!c.smtpUser || !c.smtpPass) return false;
  const t = nodemailer.createTransport({ host: c.smtpHost, port: 465, secure: true, auth: { user: c.smtpUser, pass: c.smtpPass } });
  const esc = (x: string) => x.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
  const text = `Hi ${opts.name},\n\n${opts.by} added you to ${opts.company} on Karobar360.\n\nOpen ${opts.url} and sign in with Google or an email link, using this email address: ${to}\n\nYou can also install the app from that page.`;
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:460px;margin:0 auto;padding:32px 24px;color:#1c1917">
<div style="font-weight:700;font-size:18px">Karobar360</div>
<h1 style="font-size:22px;margin:28px 0 8px;letter-spacing:-0.02em">You have been added to ${esc(opts.company)}</h1>
<p style="margin:0 0 24px;color:#57534e;line-height:1.5">${esc(opts.by)} gave you access. Sign in with Google or an email link using <b>${esc(to)}</b>. No password needed.</p>
<a href="${opts.url}" style="display:inline-block;background:#1c1917;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">Open Karobar360</a></div>`;
  try {
    await t.sendMail({ from: c.smtpFrom || `Karobar360 <${c.smtpUser}>`, to, subject: `${opts.by} added you to ${opts.company} on Karobar360`, text, html });
    return true;
  } catch (e) {
    console.error("invite", e);
    return false;
  }
}
