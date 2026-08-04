import { requireAdmin } from "../_lib/auth.js";
import {
  getCampaignProgress,
  listCampaigns,
  setCampaignStatus,
} from "../_lib/campaigns.js";
import { getSupabaseAdmin, unwrap } from "../_lib/supabase.js";
import {
  badRequest,
  methodNotAllowed,
  readJsonBody,
  sendJson,
  withErrorHandling,
} from "../_lib/http.js";

// GET  /api/campaigns/status                        → recent campaigns
// GET  /api/campaigns/status?id=<uuid>              → one campaign's progress
// GET  /api/campaigns/status?id=<uuid>&failures=1   → plus failed recipients
// POST /api/campaigns/status { campaignId, status } → queued | paused | canceled
export default withErrorHandling(async (req, res) => {
  requireAdmin(req);

  if (req.method === "POST") {
    const { campaignId, status } = readJsonBody(req);
    if (!campaignId) throw badRequest("`campaignId` is required.");
    const progress = await setCampaignStatus(campaignId, status);
    return sendJson(res, 200, { progress });
  }

  if (req.method !== "GET") return methodNotAllowed(res, ["GET", "POST"]);

  const id = req.query?.id;
  if (!id) {
    return sendJson(res, 200, { campaigns: await listCampaigns(req.query?.limit) });
  }

  const progress = await getCampaignProgress(id);
  const payload = { progress };

  if (req.query?.failures) {
    payload.failures = unwrap(
      await getSupabaseAdmin()
        .from("email_recipients")
        .select("email, name, error, attempts")
        .eq("campaign_id", id)
        .eq("status", "failed")
        .limit(200),
      "Failed to load failures",
    );
  }

  return sendJson(res, 200, payload);
});
