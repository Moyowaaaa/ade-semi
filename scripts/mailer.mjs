#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════
//  Campaign driver
//
//  The API is resumable by design: /api/campaigns/send returns after its
//  time budget with whatever is still pending. This script is the loop that
//  keeps calling it until the campaign is finished, so a large guest list
//  goes out in one command.
//
//  Usage (see MASS_EMAIL_SETUP.md for the full walkthrough):
//    node scripts/mailer.mjs audience --attending yes
//    node scripts/mailer.mjs preview --subject "Hi" --file msg.txt --to you@x.com
//    node scripts/mailer.mjs create  --name "Save the date" --subject "Hi" --file msg.txt
//    node scripts/mailer.mjs send    --id <campaign-id>
//    node scripts/mailer.mjs status  --id <campaign-id> --failures
//    node scripts/mailer.mjs pause|resume|cancel --id <campaign-id>
// ══════════════════════════════════════════════════════════════
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import "dotenv/config";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {};
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith("--")) continue;
    const key = token.replace(/^--/, "");
    const next = rest[i + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = true;
    } else {
      flags[key] = next;
      i += 1;
    }
  }
  return { command, flags };
}

const { command, flags } = parseArgs(process.argv.slice(2));

const baseUrl = (
  flags.url ||
  process.env.MAILER_BASE_URL ||
  process.env.PUBLIC_SITE_URL ||
  "http://localhost:3000"
).replace(/\/+$/, "");

const token = flags.token || process.env.ADMIN_API_TOKEN;

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

async function api(routePath, { method = "GET", body } = {}) {
  if (!token) fail("ADMIN_API_TOKEN is not set (add it to .env or pass --token).");

  const response = await fetch(`${baseUrl}${routePath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    fail(`${response.status} from ${routePath}: ${text.slice(0, 400)}`);
  }
  if (!response.ok) {
    fail(`${response.status} ${payload.error || "request failed"}${payload.code ? ` (${payload.code})` : ""}`);
  }
  return payload;
}

async function readBody({ optional = false } = {}) {
  if (flags.file) {
    const filePath = path.resolve(repoRoot, flags.file);
    const contents = await readFile(filePath, "utf8");
    // .html files are used as-is; anything else is treated as plain text
    // and converted into paragraphs server-side.
    return filePath.endsWith(".html")
      ? { bodyHtml: contents }
      : { bodyText: contents };
  }
  if (flags.text) return { bodyText: String(flags.text) };
  // Server falls back to the Figma default reminder copy.
  if (optional) return {};
  fail("Provide the message with --file <path> or --text \"...\"");
}

function audienceFromFlags() {
  const audience = {};
  if (flags.attending) audience.attending = String(flags.attending);
  if (flags.extra) {
    audience.extraEmails = String(flags.extra)
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }
  // --test a@b.com,c@d.com → ONLY these addresses (ignores the RSVP list)
  if (flags.test) {
    audience.testEmails = String(flags.test)
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }
  return audience;
}

function printProgress(progress) {
  if (!progress) return;
  const { total, sent, failed, pending, in_flight: inFlight, skipped } = progress;
  console.log(
    `   total ${total} · sent ${sent} · failed ${failed} · pending ${pending} · in-flight ${inFlight} · skipped ${skipped}`,
  );
}

const commands = {
  async audience() {
    const result = await api("/api/campaigns/preview", {
      method: "POST",
      body: { audienceOnly: true, audience: audienceFromFlags() },
    });
    console.log(`\n${result.total} recipient(s) would receive this campaign.`);
    console.log(
      `Skipped → invalid: ${result.skipped.invalid}, unsubscribed: ${result.skipped.unsubscribed}, duplicates: ${result.skipped.duplicates}`,
    );
    if (result.sample.length) {
      console.log("\nFirst few:");
      for (const entry of result.sample) {
        console.log(`  · ${entry.email}${entry.name ? ` (${entry.name})` : ""}`);
      }
    }
    console.log("");
  },

  async preview() {
    if (!flags.subject) fail("--subject is required.");
    const body = await readBody({ optional: true });
    const result = await api("/api/campaigns/preview", {
      method: "POST",
      body: {
        subject: flags.subject,
        heading: flags.heading,
        preheader: flags.preheader,
        to: flags.to,
        ...body,
      },
    });
    if (result.sentTo) {
      console.log(`\n✓ Test email sent to ${result.sentTo} (id ${result.resendId})\n`);
    } else {
      console.log(result.html);
    }
  },

  async create() {
    if (!flags.name) fail("--name is required.");
    if (!flags.subject) fail("--subject is required.");
    const body = await readBody({ optional: true });

    const result = await api("/api/campaigns/create", {
      method: "POST",
      body: {
        name: flags.name,
        subject: flags.subject,
        heading: flags.heading,
        preheader: flags.preheader,
        audience: audienceFromFlags(),
        batchSize: flags["batch-size"] ? Number(flags["batch-size"]) : undefined,
        status: "draft",
        ...body,
      },
    });

    console.log(`\n✓ Campaign created`);
    console.log(`   id         ${result.campaign.id}`);
    console.log(`   recipients ${result.recipientCount}`);
    console.log(`   batch size ${result.campaign.batchSize}`);
    console.log(
      `   skipped    invalid ${result.skipped.invalid} · unsubscribed ${result.skipped.unsubscribed} · duplicates ${result.skipped.duplicates}`,
    );
    console.log(`\nNext: node scripts/mailer.mjs send --id ${result.campaign.id}\n`);
  },

  async send() {
    if (!flags.id) fail("--id <campaign-id> is required.");
    console.log(`\nSending campaign ${flags.id} …`);

    let round = 0;
    while (true) {
      round += 1;
      const result = await api("/api/campaigns/send", {
        method: "POST",
        body: {
          campaignId: flags.id,
          batchSize: flags["batch-size"] ? Number(flags["batch-size"]) : undefined,
        },
      });

      console.log(
        `\n· run ${round}: ${result.batches} batch(es), ${result.sent} sent, ${result.failed} failed${result.requeued ? `, ${result.requeued} requeued` : ""}`,
      );
      printProgress(result.progress);

      if (result.done) {
        console.log("\n✓ Campaign complete.\n");
        return;
      }
      if (result.paused) {
        console.log(`\n⏸ Paused: ${result.pauseReason}`);
        console.log("   Re-run this command once the quota resets.\n");
        return;
      }
      if (result.remaining === 0) {
        console.log("\n✓ Nothing left to send.\n");
        return;
      }
      // The endpoint stopped on its time budget; continue where it left off.
      console.log(`   ${result.remaining} remaining — continuing …`);
    }
  },

  async status() {
    if (!flags.id) {
      const { campaigns } = await api("/api/campaigns/status");
      if (!campaigns.length) {
        console.log("\nNo campaigns yet.\n");
        return;
      }
      console.log("");
      for (const row of campaigns) {
        console.log(`${row.campaign_id}  ${row.status.padEnd(10)} ${row.name}`);
        printProgress(row);
      }
      console.log("");
      return;
    }

    const query = flags.failures ? "&failures=1" : "";
    const result = await api(`/api/campaigns/status?id=${flags.id}${query}`);
    console.log(`\n${result.progress.name} — ${result.progress.status}`);
    printProgress(result.progress);
    if (result.progress.last_error) {
      console.log(`   last error: ${result.progress.last_error}`);
    }
    if (result.failures?.length) {
      console.log("\nFailures:");
      for (const row of result.failures) {
        console.log(`  · ${row.email} — ${row.error}`);
      }
    }
    console.log("");
  },

  async pause() {
    await commands._setStatus("paused");
  },
  async resume() {
    await commands._setStatus("queued");
  },
  async cancel() {
    await commands._setStatus("canceled");
  },
  async _setStatus(status) {
    if (!flags.id) fail("--id <campaign-id> is required.");
    const result = await api("/api/campaigns/status", {
      method: "POST",
      body: { campaignId: flags.id, status },
    });
    console.log(`\n✓ Campaign is now "${result.progress.status}".\n`);
  },
};

if (!command || command.startsWith("_") || !commands[command]) {
  console.log(`
Wedding mass mailer

  audience   Count who would receive a campaign (default: Supabase rsvps)
  preview    Render the email, or send a single test with --to
  create     Snapshot the RSVP audience and create a campaign
  send       Send (and keep sending) until the campaign completes
  status     Show progress; add --failures to list bounced addresses
  pause      Stop a campaign after the current batch
  resume     Mark a paused campaign as ready to continue
  cancel     Abandon a campaign

Common flags
  --id <uuid>          campaign id
  --name "..."         campaign name (create)
  --subject "..."      email subject; supports {{first_name}}
  --heading "..."      optional heading shown above the message
  --preheader "..."    inbox preview text
  --file <path>        message body (.html kept as-is, anything else = text)
  --text "..."         message body inline
  --attending yes|no|all   audience filter (default all)
  --extra a@b.com,c@d.com  extra addresses to include
  --test a@b.com,c@d.com   ONLY these addresses (test send; skips RSVP list)
  --batch-size 25      emails per Resend batch call (1–100)
  --to you@x.com       send a test copy (preview)
  --url https://...    API base URL (default MAILER_BASE_URL or localhost:3000)

Target: ${baseUrl}
`);
  process.exit(command ? 1 : 0);
}

commands[command]().catch((error) => fail(error.message));
