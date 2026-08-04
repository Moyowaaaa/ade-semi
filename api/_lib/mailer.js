import { Resend } from "resend";
import { config } from "./config.js";

let resend = null;

export function getResend() {
  if (resend) return resend;
  if (!config.resendApiKey) {
    throw Object.assign(new Error("RESEND_API_KEY is not configured."), {
      statusCode: 500,
      code: "missing_env",
    });
  }
  resend = new Resend(config.resendApiKey);
  return resend;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Sending stops entirely when the account runs out of allowance — retrying
// would just burn requests. The campaign is paused instead.
const QUOTA_CODES = new Set(["daily_quota_exceeded", "monthly_quota_exceeded"]);
const RETRYABLE_CODES = new Set([
  "rate_limit_exceeded",
  "internal_server_error",
  "application_error",
  "concurrent_idempotent_requests",
]);

function isRetryable(error) {
  if (!error) return false;
  if (RETRYABLE_CODES.has(error.name)) return true;
  const status = Number(error.statusCode);
  return status === 429 || (status >= 500 && status < 600);
}

export function isQuotaError(error) {
  return Boolean(error && QUOTA_CODES.has(error.name));
}

/**
 * Sends one email at a time. Used when messages include attachments —
 * Resend's batch endpoint does not support the `attachments` field.
 * Returns the same { ids, errors } shape as sendEmailBatch.
 */
async function sendEmailsIndividually(
  messages,
  { idempotencyKey, maxRetries = 3 } = {},
) {
  const client = getResend();
  const ids = [];
  const errors = new Map();
  // Stay under Resend's ~10 req/s default with room to spare.
  const gapMs = Math.max(120, Math.floor(config.batchDelayMs / 2) || 150);

  for (let i = 0; i < messages.length; i += 1) {
    if (i > 0) await sleep(gapMs);

    let attempt = 0;
    let lastError = null;
    let sentId = null;

    while (attempt <= maxRetries) {
      if (attempt > 0) {
        const backoff =
          1000 * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);
        await sleep(backoff);
      }
      attempt += 1;

      const key = idempotencyKey ? `${idempotencyKey}:${i}` : undefined;
      let response;
      try {
        response = await client.emails.send(
          messages[i],
          key ? { idempotencyKey: key } : undefined,
        );
      } catch (thrown) {
        lastError = {
          message: thrown?.message || "Network error",
          name: "application_error",
          statusCode: null,
        };
        if (attempt > maxRetries) break;
        continue;
      }

      const { data, error } = response;
      if (error) {
        lastError = error;
        if (isQuotaError(error)) {
          throw Object.assign(new Error(error.message), {
            code: "quota_exceeded",
            resendCode: error.name,
          });
        }
        if (isRetryable(error) && attempt <= maxRetries) continue;
        break;
      }

      sentId = data?.id || null;
      lastError = null;
      break;
    }

    if (lastError) {
      ids.push(null);
      errors.set(i, lastError.message || "Resend rejected this email.");
    } else {
      ids.push(sentId);
    }
  }

  return { ids, errors };
}

/**
 * One batch of up to 100 emails.
 *
 * - Without attachments: Resend batch API (one HTTP call).
 * - With attachments: individual sends (batch API does not support files).
 *
 * Returns { ids, errors } where `ids[i]` maps to `messages[i]`.
 */
export async function sendEmailBatch(
  messages,
  { idempotencyKey, maxRetries = 3 } = {},
) {
  const hasAttachments = messages.some(
    (message) => message.attachments && message.attachments.length > 0,
  );
  if (hasAttachments) {
    return sendEmailsIndividually(messages, { idempotencyKey, maxRetries });
  }

  const client = getResend();
  let attempt = 0;
  let lastError = null;

  while (attempt <= maxRetries) {
    if (attempt > 0) {
      // 1s, 2s, 4s … with a little jitter to avoid lockstep retries.
      const backoff =
        1000 * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);
      await sleep(backoff);
    }
    attempt += 1;

    let response;
    try {
      response = await client.batch.send(messages, {
        idempotencyKey,
        batchValidation: "permissive",
      });
    } catch (thrown) {
      // Network/transport failure: the SDK throws instead of returning.
      lastError = {
        message: thrown?.message || "Network error",
        name: "application_error",
        statusCode: null,
      };
      if (attempt > maxRetries) break;
      continue;
    }

    const { data, error } = response;
    if (error) {
      lastError = error;
      if (isQuotaError(error)) {
        throw Object.assign(new Error(error.message), {
          code: "quota_exceeded",
          resendCode: error.name,
        });
      }
      if (isRetryable(error) && attempt <= maxRetries) continue;
      throw Object.assign(
        new Error(error.message || "Resend rejected the batch."),
        { code: "resend_error", resendCode: error.name },
      );
    }

    const ids = (data?.data || []).map((entry) => entry?.id || null);
    const errors = new Map();
    for (const item of data?.errors || []) {
      errors.set(item.index, item.message);
    }
    return { ids, errors };
  }

  throw Object.assign(
    new Error(lastError?.message || "Resend batch failed after retries."),
    { code: "resend_error", resendCode: lastError?.name },
  );
}

/** Attachment descriptor for campaign / preview sends. */
export function campaignAttachments() {
  if (!config.mailAttachmentUrl) return undefined;
  return [
    {
      filename: config.mailAttachmentFilename,
      path: config.mailAttachmentUrl,
    },
  ];
}
