import { config } from "./config.js";

// Personalization tokens available inside a campaign body and subject.
// Values are HTML-escaped before substitution so a guest's name can never
// break the layout or inject markup.
export const TEMPLATE_TOKENS = ["name", "first_name", "email"];

// Figma email design assets (Cloudinary)
const ASSETS = {
  logo: "https://res.cloudinary.com/dgnm4sny4/image/upload/v1785858147/wedding_Logo_m8urkt.png",
  illustration:
    "https://res.cloudinary.com/dgnm4sny4/image/upload/v1785858147/Illustration_k4vmrn.png",
  // Corner florals — a_hflip mirrors each bouquet (email-safe; no CSS transform)
  flowerLeft:
    "https://res.cloudinary.com/dgnm4sny4/image/upload/a_hflip/v1785858147/flowers_left_qtbaju.png",
  flowerRight:
    "https://res.cloudinary.com/dgnm4sny4/image/upload/a_hflip/v1785858148/flowers_right_k0inuy.png",
};

// Figma: email design 10348:5096
const COLORS = {
  peach: "#f8ece7",
  burgundy: "#7a0005",
  black: "#000000",
  page: "#f5f0ec",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function tokenValues(recipient) {
  const name = (recipient?.name || "").trim();
  return {
    name: name || "friend",
    first_name: name ? name.split(/\s+/)[0] : "friend",
    email: recipient?.email || "",
  };
}

/** Replaces {{token}} / {{ token }} occurrences. Unknown tokens are left alone. */
export function applyTokens(input, recipient, { escape = true } = {}) {
  const values = tokenValues(recipient);
  return String(input ?? "").replace(/\{\{\s*(\w+)\s*\}\}/g, (match, token) => {
    const key = token.toLowerCase();
    if (!(key in values)) return match;
    return escape ? escapeHtml(values[key]) : values[key];
  });
}

/** Rough HTML → text conversion for the plain-text alternative part. */
function htmlToText(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h1|h2|h3|li|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

/**
 * Default body copy from the Figma email design.
 * Campaigns can still override with bodyHtml / bodyText.
 */
export function defaultReminderBody() {
  // Exact copy / grouping from Figma node 10348:5294
  const base =
    "font-size:18px;line-height:30px;color:#000000;";
  return [
    `<p style="margin:0;${base}">Hi {{first_name}}<br><br>We hope you're doing well! Our wedding day is just around the corner, and we're so excited to celebrate this special occasion with you.</p>`,
    `<p style="margin:30px 0 0;${base}">This is a friendly reminder that the big day is fast approaching.</p>`,
    `<p style="margin:30px 0 0;${base}">We can't wait to share this unforgettable day with our family and friends. Thank you for being part of our journey—we're looking forward to celebrating together!</p>`,
    `<p style="margin:30px 0 0;${base}">You can find the invite for the day attached to this mail.<br><br>With love,<br>Adeoluwa and Semilore</p>`,
  ].join("\n");
}

/**
 * Wraps the campaign body in the Figma wedding email shell and returns both
 * MIME parts. `bodyHtml` is authored by the couple and may contain tokens.
 */
export function renderCampaignEmail({
  heading,
  preheader,
  bodyHtml,
  recipient,
  unsubscribeUrl,
}) {
  const body = applyTokens(bodyHtml || defaultReminderBody(), recipient);
  const rawHeadline = applyTokens(heading || "It's Almost Time", recipient, {
    escape: false,
  }).trim();
  const headline = escapeHtml(rawHeadline);
  const preview = escapeHtml(
    applyTokens(
      preheader ||
        "Our wedding day is just around the corner — we can't wait to celebrate with you.",
      recipient,
      { escape: false },
    ),
  );
  const couple = escapeHtml(config.coupleNames);

  // Split headline for the two-line script look when using the default.
  const isDefaultHeadline =
    rawHeadline === "It's Almost Time" || rawHeadline === "It’s Almost Time";
  const headlineHtml = isDefaultHeadline
    ? "It's Almost<br />Time"
    : headline;

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<title>${headline}</title>
<!--[if mso]>
<noscript>
<xml>
  <o:OfficeDocumentSettings>
    <o:PixelsPerInch>96</o:PixelsPerInch>
  </o:OfficeDocumentSettings>
</xml>
</noscript>
<![endif]-->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Inter:wght@400&display=swap" rel="stylesheet">
<style type="text/css">
  html, body { margin: 0 !important; padding: 0 !important; height: 100% !important; width: 100% !important; }
  * { -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt !important; mso-table-rspace: 0pt !important; border-collapse: collapse !important; }
  img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; display: block; }
  a { text-decoration: underline; }
  .headline {
    font-family: 'Caveat', 'Segoe Script', 'Brush Script MT', cursive !important;
    font-weight: 700 !important;
    font-size: 50px !important;
    line-height: 65px !important;
    color: ${COLORS.burgundy} !important;
  }
  .body-copy, .body-copy p {
    font-family: Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif !important;
    font-size: 18px !important;
    line-height: 30px !important;
    color: ${COLORS.black} !important;
  }
  @media only screen and (max-width: 640px) {
    .email-card { width: 100% !important; max-width: 100% !important; border-radius: 16px !important; }
    .headline { font-size: 40px !important; line-height: 52px !important; }
    .header-pad { padding: 20px 16px 0 16px !important; }
    .body-pad { padding: 28px 20px 36px 20px !important; }
    .illu { width: 170px !important; height: auto !important; }
    .logo { width: 72px !important; height: auto !important; }
    .flower { width: 160px !important; height: auto !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${COLORS.page};width:100%;">
  ${
    preview
      ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;color:transparent;">${preview}</div>`
      : ""
  }
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.page};padding:32px 12px;">
    <tr>
      <td align="center" style="padding:0;">
        <!--[if mso]>
        <table role="presentation" width="612" cellpadding="0" cellspacing="0" border="0"><tr><td>
        <![endif]-->
        <table role="presentation" class="email-card" width="612" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:612px;background:#ffffff;border-radius:24px;overflow:hidden;">
          <!-- HEADER: peach band, logo + script + illustration (Figma 307px) -->
          <tr>
            <td class="header-pad" bgcolor="${COLORS.peach}" style="background:${COLORS.peach};padding:26px 12px 0 20px;border-radius:24px 24px 0 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="top" width="340" style="width:340px;vertical-align:top;">
                    <img class="logo" src="${ASSETS.logo}" width="92" height="93" alt="${couple}" style="display:block;width:92px;height:93px;border:0;" />
                    <div class="headline" style="font-family:'Caveat','Segoe Script','Brush Script MT',cursive;font-weight:700;font-size:50px;line-height:65px;color:${COLORS.burgundy};margin:24px 0 28px;padding:0;max-width:341px;">
                      ${headlineHtml}
                    </div>
                  </td>
                  <td valign="bottom" align="right" style="vertical-align:bottom;text-align:right;padding:0;">
                    <img class="illu" src="${ASSETS.illustration}" width="239" height="224" alt="" style="display:block;width:239px;max-width:100%;height:auto;margin:0 0 -8px auto;border:0;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- BODY: white, Inter 18/30, ~34px side padding (544 content on 612) -->
          <tr>
            <td class="body-pad body-copy" bgcolor="#ffffff" style="background:#ffffff;padding:38px 34px 56px 34px;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:18px;line-height:30px;color:${COLORS.black};">
              ${body}
            </td>
          </tr>

          <!-- FOOTER: peach + corner florals (overhang into body) -->
          <tr>
            <td bgcolor="${COLORS.peach}" style="background:${COLORS.peach};padding:0;border-radius:0 0 24px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="bottom" align="left" width="50%" style="vertical-align:bottom;text-align:left;padding:0;line-height:0;">
                    <img class="flower" src="${ASSETS.flowerLeft}" width="280" alt="" style="display:block;width:280px;max-width:100%;height:auto;margin:-90px 0 -18px -12px;border:0;" />
                  </td>
                  <td valign="bottom" align="right" width="50%" style="vertical-align:bottom;text-align:right;padding:0;line-height:0;">
                    <img class="flower" src="${ASSETS.flowerRight}" width="280" alt="" style="display:block;width:280px;max-width:100%;height:auto;margin:-90px -18px -18px auto;border:0;" />
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding:0 24px 14px;font-family:Inter,Arial,sans-serif;font-size:11px;line-height:16px;color:#a89484;">
                    <a href="${unsubscribeUrl}" style="color:#a89484;text-decoration:underline;">Unsubscribe</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    "It's Almost Time",
    "",
    htmlToText(body),
    "",
    "—",
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join("\n");

  return { html, text };
}

/**
 * Accepts either HTML or plain text from the caller. Plain text is converted
 * into paragraphs so the couple can just type a message without markup.
 * Empty input → Figma default reminder copy.
 */
export function normalizeBody({ bodyHtml, bodyText }) {
  if (bodyHtml && bodyHtml.trim()) return bodyHtml.trim();
  if (bodyText && bodyText.trim()) {
    return bodyText
      .trim()
      .split(/\n{2,}/)
      .map(
        (paragraph) =>
          `<p style="margin:0 0 30px;font-size:18px;line-height:30px;color:#000000;">${escapeHtml(paragraph.trim()).replace(/\n/g, "<br>")}</p>`,
      )
      .join("\n");
  }
  return defaultReminderBody();
}
