import { requireAdmin } from "../_lib/auth.js";
import { assertMailerEnv, config as appConfig } from "../_lib/config.js";
import { buildAudience } from "../_lib/campaigns.js";
import { campaignAttachments, getResend } from "../_lib/mailer.js";
import { normalizeBody, renderCampaignEmail, applyTokens } from "../_lib/template.js";
import { isValidEmail, normalizeEmail, unsubscribeUrl } from "../_lib/unsubscribe.js";
import {
  badRequest,
  methodNotAllowed,
  readJsonBody,
  sendJson,
  withErrorHandling,
} from "../_lib/http.js";

// POST /api/campaigns/preview
//
// Two jobs, both meant to be used before a real send:
//   { subject, bodyText, to: "you@example.com" } → sends one real test email
//   { subject, bodyText }                        → returns the rendered HTML
//   { audience: {...}, audienceOnly: true }      → counts who would receive it
export default withErrorHandling(async (req, res) => {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  requireAdmin(req);

  const body = readJsonBody(req);

  if (body.audienceOnly) {
    assertMailerEnv();
    const { recipients, skipped } = await buildAudience(body.audience || {});
    return sendJson(res, 200, {
      total: recipients.length,
      sample: recipients.slice(0, 10),
      skipped: {
        invalid: skipped.invalid.length,
        unsubscribed: skipped.unsubscribed.length,
        duplicates: skipped.duplicates,
      },
    });
  }

  const bodyHtml = normalizeBody(body);
  if (!bodyHtml) throw badRequest("Provide `bodyHtml` or `bodyText`.");
  if (!body.subject) throw badRequest("`subject` is required.");

  const recipient = {
    email: normalizeEmail(body.to || "preview@example.com"),
    name: body.name || "Guest Name",
  };

  const rendered = renderCampaignEmail({
    heading: body.heading,
    preheader: body.preheader,
    bodyHtml,
    recipient,
    unsubscribeUrl: unsubscribeUrl(recipient.email),
  });
  const subject = applyTokens(body.subject, recipient, { escape: false });

  if (!body.to) {
    return sendJson(res, 200, { subject, html: rendered.html, text: rendered.text });
  }

  if (!isValidEmail(recipient.email)) throw badRequest("`to` is not a valid email.");
  assertMailerEnv();

  const message = {
    from: appConfig.mailFrom,
    to: [recipient.email],
    subject: `[TEST] ${subject}`,
    html: rendered.html,
    text: rendered.text,
  };
  if (appConfig.mailReplyTo) message.replyTo = appConfig.mailReplyTo;
  const attachments = campaignAttachments();
  if (attachments) message.attachments = attachments;

  const { data, error } = await getResend().emails.send(message);
  if (error) {
    throw Object.assign(new Error(error.message), {
      statusCode: 502,
      code: error.name,
    });
  }

  return sendJson(res, 200, { sentTo: recipient.email, resendId: data?.id, subject });
});
