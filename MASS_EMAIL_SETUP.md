# Mass email to RSVP guests

Sends one message to everyone who RSVP'd, in batches, using **Resend** for
delivery and **Supabase** as the source of guests and the record of progress.

---

## How it works

Sending a few hundred emails from a serverless function is risky in one
specific way: if the function dies halfway, you have no idea who already
received the email. Re-running then double-mails people.

So progress lives in the database, not in memory:

1. **Create** a campaign. The audience is *snapshotted* into
   `email_recipients` — one row per address, `status = 'pending'`.
2. **Send** claims a batch of pending rows (default 25), marks them
   `sending`, hands them to Resend's batch endpoint in a single API call, then
   writes back `sent` or `failed` per address.
3. Repeat until nothing is pending.

That gives us, for free:

- **No double sends.** `unique (campaign_id, email)` plus atomic claiming with
  `FOR UPDATE SKIP LOCKED` means a row can only ever be claimed once.
- **Resumability.** Call `send` again and it continues where it stopped.
- **Retry safety.** Each batch carries a Resend *idempotency key*, so if the
  network drops after Resend accepted the batch, the retry returns the
  original result instead of sending twice.
- **Partial failure tolerance.** Batches use `batchValidation: "permissive"`,
  so one bad address fails only itself instead of the whole batch of 25.

Rate limits are respected by construction: Resend allows 10 requests/second,
and one batch of 25 every 600ms is ~1.7 requests/second.

---

## One-time setup

### 1. Database

Run **`supabase-email-campaigns.sql`** in the Supabase SQL editor. It creates
`email_campaigns`, `email_recipients`, `email_unsubscribes`, the batch-claim
functions, and a progress view.

All three tables have RLS enabled with **no policies**, so the browser
(`anon`) cannot read or write them. Only the server, using the service role
key, can touch them.

### 2. Resend

1. **Verify a domain** at [resend.com/domains](https://resend.com/domains) and
   add the DNS records. This matters: `onboarding@resend.dev` can only deliver
   to your own account address, so mass mail will silently go nowhere.
2. Create an API key.
3. Note your plan's limits — the free tier is 100 emails/day and 3,000/month.
   If a send hits the cap the campaign **pauses itself**; re-run `send` after
   the quota resets and it picks up the remaining guests.

### 3. Environment variables

Copy the new keys from `.env.template` into `.env` locally and into
**Vercel → Settings → Environment Variables** for production:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Same value as `VITE_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side DB access (**never** prefix with `VITE_`) |
| `RESEND_API_KEY` | Delivery |
| `MAIL_FROM` | e.g. `Semilore & Adeoluwa <hello@yourdomain.com>` — must be on the verified domain |
| `MAIL_REPLY_TO` | Optional reply address |
| `ADMIN_API_TOKEN` | Protects every `/api/campaigns/*` route |
| `UNSUBSCRIBE_SECRET` | Signs unsubscribe links |
| `PUBLIC_SITE_URL` | Used to build unsubscribe URLs |
| `CRON_SECRET` | Lets the daily cron authenticate itself |

Generate the secrets with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> `VITE_`-prefixed variables are compiled into the browser bundle. The service
> role key and admin token must **not** use that prefix.

---

## Sending a campaign

`scripts/mailer.mjs` drives the API. Point it at production with
`MAILER_BASE_URL`, or run `npm run api:dev` (`vercel dev`) to test locally.

**1. Write the message** (optional). The email shell is the Figma wedding
design (logo, “It's Almost Time”, couple illustration, floral footer). If you
omit `--file` / body text, the default reminder copy from the design is used
(including `Hi {{name}}` and the Adeoluwa & Semilore sign-off).

To override the body, put copy in a text file. Blank lines become paragraphs.
Tokens: `{{first_name}}`, `{{name}}`, `{{email}}`.

```
Hi {{name}},

We can't wait to celebrate with you on August 15th. Here are the final
details for the day.

Ceremony: 10:00 AM, New Covenant Church, IITA
Reception: 1:00 PM, Daylan Events Centre

With love,
Adeoluwa and Semilore
```

Preview the rendered HTML locally: open `tmp/email-preview.html` after running
`npm run mail -- preview --subject "It's Almost Time"` (or regenerate via a
test send to yourself).

**2. Check who will receive it:**

```powershell
npm run mail -- audience --attending yes
```

**3. Send yourself a test copy:**

```powershell
npm run mail -- preview --subject "Wedding details for {{first_name}}" --file message.txt --to you@example.com
```

**4. Create the campaign** (snapshots the audience, sends nothing yet):

```powershell
npm run mail -- create --name "Final details" --subject "Wedding details for {{first_name}}" --file message.txt --attending yes
```

It prints a campaign id.

**5. Send it.** This loops until every guest is done:

```powershell
npm run mail -- send --id <campaign-id>
```

**6. Check the outcome**, including any addresses that bounced:

```powershell
npm run mail -- status --id <campaign-id> --failures
```

`pause`, `resume`, and `cancel` take the same `--id`.

### Useful flags

| Flag | Meaning |
| --- | --- |
| `--attending yes\|no\|all` | Filter by RSVP response (default `all`) |
| `--extra a@b.com,c@d.com` | Extra addresses beyond the RSVP list |
| `--batch-size 30` | Emails per Resend call (1–100, default 25) |
| `--heading "..."` | Heading shown above the message |
| `--preheader "..."` | Inbox preview text |
| `--file msg.html` | `.html` is used verbatim; any other extension is treated as text |

---

## API reference

Every `/api/campaigns/*` route requires `Authorization: Bearer $ADMIN_API_TOKEN`.

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/campaigns/preview` | POST | Render HTML, send a test with `to`, or count the audience with `audienceOnly` |
| `/api/campaigns/create` | POST | Create a campaign and snapshot its audience |
| `/api/campaigns/send` | POST | Send batches until done or out of time; safe to repeat |
| `/api/campaigns/status` | GET | Progress for one campaign (`?id=`) or the recent list |
| `/api/campaigns/status` | POST | Set status to `queued`, `paused`, or `canceled` |
| `/api/unsubscribe` | GET/POST | **Public.** Signed-token unsubscribe |
| `/api/cron/resume-campaigns` | GET | Daily safety net; resumes anything unfinished |

`send` returns `{ done, paused, remaining, sent, failed, progress }`. When
`done` is `false` and `remaining > 0`, call it again — that is exactly what the
CLI does.

---

## Deliverability notes

These are already handled, but worth knowing:

- Every email includes a **`List-Unsubscribe`** header with one-click support,
  which is what Gmail and Outlook expect from bulk senders.
- Unsubscribed addresses are **excluded when the audience is built**, so they
  are never queued again.
- Each message has both an **HTML and a plain-text part**.
- Duplicate RSVPs from the same address are collapsed to one email.

## Unsubscribes

The footer link is a signed URL — the address plus an HMAC — so nobody can
unsubscribe someone else, and no session or lookup table is needed. Clicking
it records the address in `email_unsubscribes` and shows a confirmation page.

Changing `UNSUBSCRIBE_SECRET` invalidates every link already sent.
