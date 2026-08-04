import { requireCronOrAdmin } from "../_lib/auth.js";
import { assertMailerEnv } from "../_lib/config.js";
import { findResumableCampaigns, processCampaign } from "../_lib/campaigns.js";
import { sendJson, withErrorHandling } from "../_lib/http.js";

export const config = { maxDuration: 300 };

// Safety net: picks up any campaign that still has pending recipients, e.g.
// one that paused on a Resend daily quota. Wired to a daily Vercel cron, and
// also callable by hand with the admin token.
export default withErrorHandling(async (req, res) => {
  requireCronOrAdmin(req);
  assertMailerEnv();

  const campaigns = await findResumableCampaigns(3);
  const results = [];

  for (const campaign of campaigns) {
    try {
      // Split the run budget across the campaigns we found.
      const result = await processCampaign(campaign.campaign_id, {
        maxRunMs: Math.floor(200_000 / campaigns.length),
      });
      results.push({ campaignId: campaign.campaign_id, ...result, progress: undefined });
    } catch (error) {
      console.error("[mailer] resume failed:", campaign.campaign_id, error);
      results.push({ campaignId: campaign.campaign_id, error: error.message });
    }
  }

  return sendJson(res, 200, { resumed: results.length, results });
});
