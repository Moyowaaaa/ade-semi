// Central place for every environment variable the mailer needs.
// Files under api/_lib are not routed by Vercel (underscore prefix).

function str(name, fallbacks = []) {
  const keys = [name, ...fallbacks];
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim()) return value.trim();
  }
  return "";
}

function int(name, fallback) {
  const raw = process.env[name];
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  supabaseUrl: str("SUPABASE_URL", ["VITE_SUPABASE_URL"]),
  supabaseServiceRoleKey: str("SUPABASE_SERVICE_ROLE_KEY"),

  resendApiKey: str("RESEND_API_KEY"),
  mailFrom: str("MAIL_FROM") || "Semilore & Adeoluwa <onboarding@resend.dev>",
  mailReplyTo: str("MAIL_REPLY_TO"),

  adminToken: str("ADMIN_API_TOKEN"),
  cronSecret: str("CRON_SECRET"),
  unsubscribeSecret: str("UNSUBSCRIBE_SECRET"),

  siteUrl: (str("PUBLIC_SITE_URL") || "https://example.com").replace(/\/+$/, ""),

  // Resend accepts up to 100 emails per batch call; 20–30 keeps each
  // request small enough to retry cheaply.
  batchSize: Math.min(100, Math.max(1, int("MAIL_BATCH_SIZE", 25))),
  // Resend's default limit is 10 requests/second per team. One batch call
  // every 600ms is ~1.7 req/s, comfortably inside that.
  batchDelayMs: Math.max(0, int("MAIL_BATCH_DELAY_MS", 600)),
  // Stop and report progress before the platform kills the function.
  maxRunMs: Math.max(5_000, int("MAIL_MAX_RUN_MS", 240_000)),
  maxAttempts: Math.max(1, int("MAIL_MAX_ATTEMPTS", 3)),

  weddingDate: str("WEDDING_DATE") || "August 15, 2026",
  coupleNames: str("COUPLE_NAMES") || "Semilore & Adeoluwa",

  // Wedding invitation attached to every campaign email (PNG/PDF URL).
  // Resend's batch API can't send attachments, so the mailer falls back
  // to individual sends when this is set.
  mailAttachmentUrl:
    str("MAIL_ATTACHMENT_URL") ||
    "https://res.cloudinary.com/dgnm4sny4/image/upload/v1785861240/SATURDAY_mye3v3.png",
  mailAttachmentFilename:
    str("MAIL_ATTACHMENT_FILENAME") || "Wedding-Invitation.png",
};

/**
 * Throws a descriptive error listing every missing variable at once,
 * instead of failing on whichever one happens to be read first.
 */
export function assertMailerEnv() {
  const missing = [];
  if (!config.supabaseUrl) missing.push("SUPABASE_URL (or VITE_SUPABASE_URL)");
  if (!config.supabaseServiceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!config.resendApiKey) missing.push("RESEND_API_KEY");
  if (!config.adminToken) missing.push("ADMIN_API_TOKEN");
  if (!config.unsubscribeSecret) missing.push("UNSUBSCRIBE_SECRET");

  if (missing.length) {
    throw Object.assign(
      new Error(`Missing environment variables: ${missing.join(", ")}`),
      { statusCode: 500, code: "missing_env" },
    );
  }
}
