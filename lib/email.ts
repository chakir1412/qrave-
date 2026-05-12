import { Resend } from "resend";

const FROM = "Qrave <info@qrave.menu>";
const ADMIN_INBOX = "info@qrave.menu";

let cached: Resend | null | undefined;

function getResend(): Resend | null {
  if (cached !== undefined) return cached;
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    console.warn("[email] RESEND_API_KEY fehlt — Mails werden nicht gesendet.");
    cached = null;
    return null;
  }
  cached = new Resend(key);
  return cached;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type NewRegistrationData = {
  restaurantId: string;
  restaurantName: string;
  slug: string;
  ownerEmail: string;
  adresse: string | null;
  telefon: string | null;
  restaurantTyp: string | null;
  publishUrl: string; // mit Admin-Token, fertig zum Klicken
};

/** Notification an info@qrave.menu wenn sich ein neues Restaurant registriert. */
export async function sendRegistrationNotification(data: NewRegistrationData): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: auto; color: #1a1916;">
      <h1 style="font-size: 20px; margin: 0 0 16px;">Neues Restaurant registriert</h1>
      <p style="margin: 0 0 20px; color: #555;">Folgendes Restaurant hat sich gerade selbst registriert und wartet auf Freischaltung.</p>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr><td style="padding: 8px 0; color: #777; width: 140px;">Name</td><td style="padding: 8px 0; font-weight: 600;">${escapeHtml(data.restaurantName)}</td></tr>
        <tr><td style="padding: 8px 0; color: #777;">Slug</td><td style="padding: 8px 0;"><code>${escapeHtml(data.slug)}</code></td></tr>
        <tr><td style="padding: 8px 0; color: #777;">Typ</td><td style="padding: 8px 0;">${escapeHtml(data.restaurantTyp ?? "—")}</td></tr>
        <tr><td style="padding: 8px 0; color: #777;">E-Mail</td><td style="padding: 8px 0;">${escapeHtml(data.ownerEmail)}</td></tr>
        <tr><td style="padding: 8px 0; color: #777;">Adresse</td><td style="padding: 8px 0;">${escapeHtml(data.adresse ?? "—")}</td></tr>
        <tr><td style="padding: 8px 0; color: #777;">Telefon</td><td style="padding: 8px 0;">${escapeHtml(data.telefon ?? "—")}</td></tr>
        <tr><td style="padding: 8px 0; color: #777;">Restaurant-ID</td><td style="padding: 8px 0;"><code>${escapeHtml(data.restaurantId)}</code></td></tr>
      </table>

      <a href="${data.publishUrl}" style="display: inline-block; background: #c9a84c; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Restaurant freischalten</a>

      <p style="margin: 24px 0 0; font-size: 12px; color: #999;">Der Link enthält ein einmaliges Admin-Token und setzt direkt published=true.</p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: FROM,
      to: ADMIN_INBOX,
      subject: `🆕 Neues Restaurant: ${data.restaurantName}`,
      html,
    });
  } catch (e) {
    console.error("[email] sendRegistrationNotification:", e);
  }
}

export type PublishConfirmationData = {
  restaurantName: string;
  slug: string;
  ownerEmail: string;
};

/** Bestätigung an den Wirt nach Admin-Freischaltung. */
export async function sendPublishConfirmation(data: PublishConfirmationData): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const url = `https://qrave.menu/${data.slug}`;
  const dashboardUrl = "https://qrave.menu/dashboard";

  const html = `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: auto; color: #1a1916;">
      <h1 style="font-size: 22px; margin: 0 0 12px;">Deine Speisekarte ist live!</h1>
      <p style="margin: 0 0 20px; color: #555; font-size: 15px;">
        Hallo, deine digitale Speisekarte für <strong>${escapeHtml(data.restaurantName)}</strong> ist soeben freigeschaltet worden.
      </p>

      <div style="background: #f5f4f0; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px;">
        <p style="margin: 0 0 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #999;">Deine Speisekarte</p>
        <a href="${url}" style="font-size: 16px; font-weight: 600; color: #c9a84c; text-decoration: none;">${escapeHtml(url)}</a>
      </div>

      <p style="margin: 0 0 12px; font-size: 14px; color: #555;">
        Du kannst deine Karte jederzeit über das Dashboard bearbeiten:
      </p>
      <a href="${dashboardUrl}" style="display: inline-block; background: #1a1916; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Zum Dashboard</a>

      <p style="margin: 32px 0 0; font-size: 12px; color: #999; border-top: 1px solid #e8e4dc; padding-top: 16px;">
        Bei Fragen einfach auf diese Mail antworten — wir helfen gerne.<br>
        Qrave · Digitale Speisekarten
      </p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: FROM,
      to: data.ownerEmail,
      subject: `Deine Speisekarte ist live — ${data.restaurantName}`,
      html,
    });
  } catch (e) {
    console.error("[email] sendPublishConfirmation:", e);
  }
}
