import { requireAdmin } from "../_lib/auth.js";
import { assertMailerEnv } from "../_lib/config.js";
import { createCampaign } from "../_lib/campaigns.js";
import {
  methodNotAllowed,
  readJsonBody,
  sendJson,
  withErrorHandling,
} from "../_lib/http.js";

// POST /api/campaigns/create
// Body: { name, subject, heading?, preheader?, bodyText? | bodyHtml?,
//         audience?: { attending: "yes"|"no"|"all", extraEmails?: [] },
//         batchSize?, status?: "draft"|"queued" }
export default withErrorHandling(async (req, res) => {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  requireAdmin(req);
  assertMailerEnv();

  const body = readJsonBody(req);
  const { campaign, recipientCount, skipped } = await createCampaign(body);

  return sendJson(res, 201, {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      subject: campaign.subject,
      status: campaign.status,
      batchSize: campaign.batch_size,
    },
    recipientCount,
    skipped: {
      invalid: skipped.invalid.length,
      unsubscribed: skipped.unsubscribed.length,
      duplicates: skipped.duplicates,
    },
    next: `POST /api/campaigns/send with { "campaignId": "${campaign.id}" }`,
  });
});
