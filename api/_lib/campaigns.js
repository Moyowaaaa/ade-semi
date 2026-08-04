import { createHash } from "node:crypto";
import { config } from "./config.js";
import { getSupabaseAdmin, unwrap } from "./supabase.js";
import {
  campaignAttachments,
  isQuotaError,
  sendEmailBatch,
  sleep,
} from "./mailer.js";
import { normalizeBody, renderCampaignEmail, applyTokens } from "./template.js";
import { isValidEmail, normalizeEmail, unsubscribeUrl } from "./unsubscribe.js";
import { badRequest, notFound } from "./http.js";

const PAGE_SIZE = 1000; // supabase-js caps a single select at 1000 rows.

/** Reads every row of a table in pages so large guest lists aren't truncated. */
async function selectAll(buildQuery) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const page = unwrap(
      await buildQuery().range(from, from + PAGE_SIZE - 1),
      "Failed to read rows",
    );
    rows.push(...(page || []));
    if (!page || page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function getUnsubscribed() {
  const supabase = getSupabaseAdmin();
  const rows = await selectAll(() =>
    supabase.from("email_unsubscribes").select("email"),
  );
  return new Set(rows.map((row) => normalizeEmail(row.email)));
}

/**
 * Builds the recipient list from public.rsvps (default).
 *
 * `attending`: "yes" | "no" | "all" (default "all")
 * `extraEmails`: addresses to include on top of the RSVP list
 * `testEmails`: when set, ONLY these are used (optional dry-run override)
 *
 * Guest names come from rsvps.name; the email greets with first name
 * via the {{first_name}} token (first word of that name).
 */
export async function buildAudience(audience = {}) {
  const { attending = "all", extraEmails = [], testEmails = [] } = audience;

  if (!["yes", "no", "all"].includes(attending)) {
    throw badRequest('audience.attending must be "yes", "no" or "all".');
  }

  const collected = [];

  if (testEmails.length) {
    for (const email of testEmails) collected.push({ email, name: null });
  } else {
    const supabase = getSupabaseAdmin();
    const rsvps = await selectAll(() => {
      let query = supabase
        .from("rsvps")
        .select("name, email, attending, created_at")
        .order("created_at", { ascending: true });
      if (attending !== "all") query = query.eq("attending", attending);
      return query;
    });
    for (const row of rsvps)
      collected.push({ email: row.email, name: row.name });
    for (const email of extraEmails) collected.push({ email, name: null });
  }

  const unsubscribed = testEmails.length ? new Set() : await getUnsubscribed();

  const byEmail = new Map();
  const skipped = { invalid: [], unsubscribed: [], duplicates: 0 };

  for (const entry of collected) {
    const email = normalizeEmail(entry.email);
    if (!isValidEmail(email)) {
      if (email) skipped.invalid.push(email);
      continue;
    }
    if (unsubscribed.has(email)) {
      skipped.unsubscribed.push(email);
      continue;
    }
    if (byEmail.has(email)) {
      // Same guest RSVP'd twice — keep the first name we saw.
      skipped.duplicates += 1;
      if (!byEmail.get(email).name && entry.name) {
        byEmail.get(email).name = entry.name?.trim() || null;
      }
      continue;
    }
    byEmail.set(email, { email, name: entry.name?.trim() || null });
  }

  return { recipients: [...byEmail.values()], skipped };
}

/** Creates the campaign and snapshots its audience into email_recipients. */
export async function createCampaign(input) {
  const {
    name,
    subject,
    heading = null,
    preheader = null,
    bodyHtml,
    bodyText,
    audience = {},
    batchSize = config.batchSize,
    status = "draft",
  } = input || {};

  if (!name || !String(name).trim()) throw badRequest("`name` is required.");
  if (!subject || !String(subject).trim())
    throw badRequest("`subject` is required.");

  const body = normalizeBody({ bodyHtml, bodyText });
  if (!body) throw badRequest("Provide `bodyHtml` or `bodyText`.");

  if (!["draft", "queued"].includes(status)) {
    throw badRequest('`status` must be "draft" or "queued".');
  }
  const size = Number(batchSize);
  if (!Number.isFinite(size) || size < 1 || size > 100) {
    throw badRequest("`batchSize` must be between 1 and 100.");
  }

  const { recipients, skipped } = await buildAudience(audience);
  if (!recipients.length) {
    throw badRequest(
      "No valid recipients matched this audience.",
      "empty_audience",
    );
  }

  const supabase = getSupabaseAdmin();
  const campaign = unwrap(
    await supabase
      .from("email_campaigns")
      .insert({
        name: String(name).trim(),
        subject: String(subject).trim(),
        heading: heading ? String(heading).trim() : null,
        preheader: preheader ? String(preheader).trim() : null,
        body_html: body,
        audience,
        batch_size: size,
        status,
      })
      .select()
      .single(),
    "Failed to create campaign",
  );

  // Chunked so a large guest list doesn't exceed request size limits.
  for (let i = 0; i < recipients.length; i += 500) {
    const chunk = recipients.slice(i, i + 500).map((r) => ({
      campaign_id: campaign.id,
      email: r.email,
      name: r.name,
    }));
    unwrap(
      await supabase.from("email_recipients").insert(chunk),
      "Failed to queue recipients",
    );
  }

  return { campaign, recipientCount: recipients.length, skipped };
}

export async function getCampaign(campaignId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("email_campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();
  if (error) {
    throw Object.assign(
      new Error(`Failed to load campaign: ${error.message}`),
      {
        statusCode: 500,
      },
    );
  }
  if (!data) throw notFound(`Campaign ${campaignId} was not found.`);
  return data;
}

export async function getCampaignProgress(campaignId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("email_campaign_progress")
    .select("*")
    .eq("campaign_id", campaignId)
    .maybeSingle();
  if (error) {
    throw Object.assign(
      new Error(`Failed to load progress: ${error.message}`),
      {
        statusCode: 500,
      },
    );
  }
  if (!data) throw notFound(`Campaign ${campaignId} was not found.`);
  return data;
}

export async function listCampaigns(limit = 20) {
  const supabase = getSupabaseAdmin();
  return unwrap(
    await supabase
      .from("email_campaign_progress")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(Math.min(100, Math.max(1, Number(limit) || 20))),
    "Failed to list campaigns",
  );
}

async function updateCampaign(campaignId, patch) {
  const supabase = getSupabaseAdmin();
  unwrap(
    await supabase.from("email_campaigns").update(patch).eq("id", campaignId),
    "Failed to update campaign",
  );
}

/** Stable per-batch key: identical retries dedupe, fresh attempts do not. */
function batchIdempotencyKey(campaignId, rows) {
  const fingerprint = rows
    .map((row) => `${row.id}:${row.attempts}`)
    .sort()
    .join("|");
  const hash = createHash("sha256").update(fingerprint).digest("hex");
  return `campaign:${campaignId}:${hash}`;
}

function buildMessage(campaign, recipient) {
  const url = unsubscribeUrl(recipient.email);
  const { html, text } = renderCampaignEmail({
    heading: campaign.heading,
    preheader: campaign.preheader,
    bodyHtml: campaign.body_html,
    recipient,
    unsubscribeUrl: url,
  });

  const message = {
    from: config.mailFrom,
    to: [recipient.email],
    subject: applyTokens(campaign.subject, recipient, { escape: false }),
    html,
    text,
    headers: {
      // Lets Gmail/Outlook show a native unsubscribe control, which
      // meaningfully improves deliverability for bulk sends.
      "List-Unsubscribe": `<${url}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
  if (config.mailReplyTo) message.replyTo = config.mailReplyTo;
  const attachments = campaignAttachments();
  if (attachments) message.attachments = attachments;
  return message;
}

/**
 * Sends the campaign in batches until the audience is exhausted or the run
 * budget is spent. Safe to call repeatedly: each call claims only pending
 * rows, so a second call simply picks up where the last one stopped.
 */
export async function processCampaign(campaignId, options = {}) {
  const supabase = getSupabaseAdmin();
  const startedAt = Date.now();
  const maxRunMs = Math.max(5_000, Number(options.maxRunMs) || config.maxRunMs);
  const campaign = await getCampaign(campaignId);

  if (["completed", "canceled"].includes(campaign.status)) {
    return {
      status: campaign.status,
      done: true,
      sent: 0,
      failed: 0,
      batches: 0,
    };
  }

  await updateCampaign(campaignId, {
    status: "sending",
    started_at: campaign.started_at || new Date().toISOString(),
    last_error: null,
  });

  // Recover rows abandoned by a previous run that timed out mid-batch.
  const { data: requeued } = await supabase.rpc(
    "requeue_stale_email_recipients",
    {
      p_campaign_id: campaignId,
      p_older_than_seconds: 600,
      p_max_attempts: config.maxAttempts,
    },
  );

  const batchSize = Math.min(
    100,
    Math.max(
      1,
      Number(options.batchSize) || campaign.batch_size || config.batchSize,
    ),
  );

  let sent = 0;
  let failed = 0;
  let batches = 0;
  let paused = false;
  let pauseReason = null;

  while (true) {
    if (Date.now() - startedAt > maxRunMs) break;

    const rows =
      unwrap(
        await supabase.rpc("claim_email_batch", {
          p_campaign_id: campaignId,
          p_limit: batchSize,
        }),
        "Failed to claim a batch",
      ) || [];

    if (!rows.length) break;

    batches += 1;
    const messages = rows.map((row) => buildMessage(campaign, row));

    let result;
    try {
      result = await sendEmailBatch(messages, {
        idempotencyKey: batchIdempotencyKey(campaignId, rows),
      });
    } catch (error) {
      // Release the batch so the next run retries it — but give up on rows
      // that have already burned their attempts, so a permanently broken
      // batch can never loop forever.
      const retryable = rows.filter((row) => row.attempts < config.maxAttempts);
      const exhausted = rows.filter(
        (row) => row.attempts >= config.maxAttempts,
      );

      if (retryable.length) {
        unwrap(
          await supabase
            .from("email_recipients")
            .update({ status: "pending", error: error.message })
            .in(
              "id",
              retryable.map((row) => row.id),
            ),
          "Failed to release batch",
        );
      }
      if (exhausted.length) {
        failed += exhausted.length;
        unwrap(
          await supabase
            .from("email_recipients")
            .update({ status: "failed", error: error.message })
            .in(
              "id",
              exhausted.map((row) => row.id),
            ),
          "Failed to mark exhausted recipients",
        );
      }

      if (isQuotaError(error) || error.code === "quota_exceeded") {
        paused = true;
        pauseReason = `Resend quota reached: ${error.message}`;
        break;
      }
      await updateCampaign(campaignId, {
        status: "sending",
        last_error: error.message,
      });
      throw error;
    }

    const now = new Date().toISOString();
    const updates = rows.map((row, index) => {
      const rowError = result.errors.get(index);
      const ok = !rowError && Boolean(result.ids[index]);
      if (ok) sent += 1;
      else failed += 1;
      return {
        id: row.id,
        campaign_id: campaignId,
        email: row.email,
        name: row.name,
        attempts: row.attempts,
        status: ok ? "sent" : "failed",
        resend_id: ok ? result.ids[index] : null,
        error: ok
          ? null
          : rowError || "Resend returned no id for this recipient.",
        sent_at: ok ? now : null,
      };
    });

    unwrap(
      await supabase
        .from("email_recipients")
        .upsert(updates, { onConflict: "id" }),
      "Failed to record batch results",
    );

    if (config.batchDelayMs) await sleep(config.batchDelayMs);
  }

  const progress = await getCampaignProgress(campaignId);
  const remaining = Number(progress.pending) + Number(progress.in_flight);

  let status = "sending";
  if (paused) {
    status = "paused";
    await updateCampaign(campaignId, { status, last_error: pauseReason });
  } else if (remaining === 0) {
    // Nothing pending or in flight, so the campaign is finished even if the
    // loop happened to exit on its time budget rather than an empty claim.
    status = "completed";
    await updateCampaign(campaignId, {
      status,
      completed_at: new Date().toISOString(),
    });
  }

  return {
    campaignId,
    status,
    done: status === "completed",
    paused,
    pauseReason,
    batches,
    sent,
    failed,
    requeued: Number(requeued) || 0,
    remaining,
    progress,
    runMs: Date.now() - startedAt,
  };
}

/** Finds campaigns that still have work left, for the cron safety net. */
export async function findResumableCampaigns(limit = 5) {
  const supabase = getSupabaseAdmin();
  const rows = unwrap(
    await supabase
      .from("email_campaign_progress")
      .select("*")
      .in("status", ["queued", "sending", "paused"])
      .order("created_at", { ascending: true })
      .limit(limit),
    "Failed to find resumable campaigns",
  );
  return (rows || []).filter(
    (row) => Number(row.pending) + Number(row.in_flight) > 0,
  );
}

export async function setCampaignStatus(campaignId, status) {
  if (!["queued", "paused", "canceled"].includes(status)) {
    throw badRequest('`status` must be "queued", "paused" or "canceled".');
  }
  await getCampaign(campaignId);
  await updateCampaign(campaignId, { status });
  return getCampaignProgress(campaignId);
}
