import { requireAdmin } from "../_lib/auth.js";
import { assertMailerEnv } from "../_lib/config.js";
import { processCampaign } from "../_lib/campaigns.js";
import {
  badRequest,
  methodNotAllowed,
  readJsonBody,
  sendJson,
  withErrorHandling,
} from "../_lib/http.js";

// Give the function room to push many batches in one invocation. It still
// stops on its own time budget (MAIL_MAX_RUN_MS) and reports what is left.
export const config = { maxDuration: 300 };

// POST /api/campaigns/send
// Body: { campaignId, batchSize?, maxRunMs? }
//
// Idempotent and resumable: call it again to continue an unfinished campaign.
export default withErrorHandling(async (req, res) => {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  requireAdmin(req);
  assertMailerEnv();

  const { campaignId, batchSize, maxRunMs } = readJsonBody(req);
  if (!campaignId) throw badRequest("`campaignId` is required.");

  const result = await processCampaign(campaignId, { batchSize, maxRunMs });
  return sendJson(res, 200, result);
});
