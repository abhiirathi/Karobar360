// Sends a notification email about a request from a customer.
// With RESEND_API_KEY set it uses Resend; otherwise FormSubmit (free, no key). FormSubmit sends one
// "Activate form" email to the address the first time; after that click, every request arrives.
const TO = process.env.NOTIFY_EMAIL || "iamabhirathi@gmail.com";

export async function notify(opts: { subject: string; fields: Record<string, string>; replyTo?: string; origin: string }): Promise<boolean> {
  const lines = Object.entries(opts.fields).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
  try {
    if (process.env.RESEND_API_KEY) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: process.env.RESEND_FROM || "Karobar360 <onboarding@resend.dev>", to: [TO], subject: opts.subject, text: lines.join("\n"), ...(opts.replyTo ? { reply_to: opts.replyTo } : {}) }),
      });
      return r.ok;
    }
    const r = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(TO)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Origin: opts.origin, Referer: `${opts.origin}/contact` },
      body: JSON.stringify({ _subject: opts.subject, _template: "table", _captcha: "false", ...(opts.replyTo ? { _replyto: opts.replyTo } : {}), ...opts.fields }),
    });
    const j = await r.json().catch(() => ({}));
    return r.ok && String((j as { success?: unknown }).success) !== "false";
  } catch {
    return false;
  }
}
