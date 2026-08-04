import { getSupabaseAdmin } from "./_lib/supabase.js";
import { verifyUnsubscribeToken } from "./_lib/unsubscribe.js";
import { config } from "./_lib/config.js";

// Public endpoint — no admin token. The signed `token` is the authorization:
// it proves we generated the link, so one guest cannot unsubscribe another.
//
// GET  → used when a guest clicks the footer link (returns a page)
// POST → used by Gmail/Outlook one-click unsubscribe (RFC 8058)

function page({ title, message, ok = true }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         background:#faf8f5; font-family:Georgia,'Times New Roman',serif; color:#6b5a50; padding:24px; }
  .card { max-width:460px; background:#fff; border-radius:8px; padding:44px 36px; text-align:center;
          box-shadow:0 2px 24px rgba(0,0,0,0.06); }
  h1 { margin:0 0 14px; font-size:24px; font-weight:400; color:${ok ? "#5a3e36" : "#a5544c"}; }
  p { margin:0 0 10px; font-size:15px; line-height:1.8; }
  .mark { font-size:34px; margin-bottom:14px; }
  .small { font-size:12px; color:#b0a090; margin-top:22px; }
  a { color:#8b6f66; }
</style>
</head>
<body>
  <div class="card">
    <div class="mark">${ok ? "🌸" : "⚠️"}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <p class="small">${config.coupleNames} &middot; ${config.weddingDate}<br>
      <a href="${config.siteUrl}">Back to the website</a></p>
  </div>
</body>
</html>`;
}

function html(res, statusCode, body) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(statusCode).send(body);
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return html(
      res,
      405,
      page({ title: "Not allowed", message: "Unsupported request.", ok: false }),
    );
  }

  const token = req.query?.token || req.body?.token;
  const email = verifyUnsubscribeToken(token);

  if (!email) {
    return html(
      res,
      400,
      page({
        title: "This link isn't valid",
        message:
          "The unsubscribe link is incomplete or has been altered. Please reply to our email and we'll remove you right away.",
        ok: false,
      }),
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("email_unsubscribes")
      .upsert({ email, reason: "one-click" }, { onConflict: "email" });
    if (error) throw new Error(error.message);
  } catch (error) {
    console.error("[mailer] unsubscribe failed:", error);
    return html(
      res,
      500,
      page({
        title: "Something went wrong",
        message:
          "We couldn't record your request just now. Please try again in a moment, or reply to our email.",
        ok: false,
      }),
    );
  }

  // One-click clients only need a 200; a body is harmless.
  return html(
    res,
    200,
    page({
      title: "You've been unsubscribed",
      message: `<strong>${email}</strong> will no longer receive wedding emails from us. If this was a mistake, just reply to any earlier email and we'll add you back.`,
    }),
  );
}
