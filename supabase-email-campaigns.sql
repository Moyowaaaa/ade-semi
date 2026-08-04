-- ══════════════════════════════════════════════════════════════
--  Mass email (RSVP broadcast) schema
--  Run this once in the Supabase SQL editor.
-- ══════════════════════════════════════════════════════════════
--
--  Design notes
--  ------------
--  * A "campaign" is one message. When it is created we snapshot the
--    audience into email_recipients, one row per address. That snapshot is
--    what makes sending resumable and safe to retry: progress lives in the
--    database, not in the memory of a serverless function.
--  * These tables are only ever touched by the server using the
--    service_role key, so RLS is enabled with no anon/authenticated
--    policies at all (service_role bypasses RLS).

-- ── Campaigns ─────────────────────────────────────────────────
create table if not exists public.email_campaigns (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  subject       text not null,
  heading       text,
  preheader     text,
  body_html     text not null,
  -- Snapshot of the filter used to build the audience, for auditing.
  audience      jsonb not null default '{}'::jsonb,
  -- draft → queued → sending → completed | paused | canceled | failed
  status        text not null default 'draft'
                check (status in ('draft','queued','sending','completed','paused','canceled','failed')),
  batch_size    integer not null default 25 check (batch_size between 1 and 100),
  last_error    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  started_at    timestamptz,
  completed_at  timestamptz
);

-- ── Recipients (the send queue) ───────────────────────────────
create table if not exists public.email_recipients (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.email_campaigns(id) on delete cascade,
  email         text not null,
  name          text,
  -- pending → sending → sent | failed | skipped
  status        text not null default 'pending'
                check (status in ('pending','sending','sent','failed','skipped')),
  attempts      integer not null default 0,
  resend_id     text,
  error         text,
  sent_at       timestamptz,
  claimed_at    timestamptz,
  created_at    timestamptz not null default now(),
  -- One send per address per campaign. This is the core duplicate guard.
  unique (campaign_id, email)
);

-- Batch claiming always filters on (campaign_id, status).
create index if not exists email_recipients_campaign_status_idx
  on public.email_recipients (campaign_id, status);

-- ── Unsubscribes ──────────────────────────────────────────────
create table if not exists public.email_unsubscribes (
  email         text primary key,
  reason        text,
  created_at    timestamptz not null default now()
);

-- ── keep updated_at fresh ─────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists email_campaigns_touch_updated_at on public.email_campaigns;
create trigger email_campaigns_touch_updated_at
  before update on public.email_campaigns
  for each row execute function public.touch_updated_at();

-- ══════════════════════════════════════════════════════════════
--  Atomic batch claim
--
--  Marks up to p_limit pending recipients as 'sending' and returns them.
--  FOR UPDATE SKIP LOCKED means two concurrent senders can never claim
--  the same row, so a double-invocation cannot double-send.
-- ══════════════════════════════════════════════════════════════
create or replace function public.claim_email_batch(
  p_campaign_id uuid,
  p_limit       integer
)
returns table (id uuid, email text, name text, attempts integer)
language sql
volatile
as $$
  with picked as (
    select r.id
    from public.email_recipients r
    where r.campaign_id = p_campaign_id
      and r.status = 'pending'
    order by r.created_at
    limit p_limit
    for update skip locked
  )
  update public.email_recipients r
  set status = 'sending',
      claimed_at = now(),
      attempts = r.attempts + 1
  from picked
  where r.id = picked.id
  returning r.id, r.email, r.name, r.attempts;
$$;

-- Requeue rows left in 'sending' by a crashed/timed-out invocation.
create or replace function public.requeue_stale_email_recipients(
  p_campaign_id uuid,
  p_older_than_seconds integer default 600,
  p_max_attempts integer default 3
)
returns integer
language sql
volatile
as $$
  with reset as (
    update public.email_recipients
    set status = 'pending'
    where campaign_id = p_campaign_id
      and status = 'sending'
      and claimed_at < now() - make_interval(secs => p_older_than_seconds)
      and attempts < p_max_attempts
    returning 1
  )
  select coalesce(count(*), 0)::integer from reset;
$$;

-- ── Progress view ─────────────────────────────────────────────
create or replace view public.email_campaign_progress
with (security_invoker = true) as
select
  c.id            as campaign_id,
  c.name,
  c.subject,
  c.status,
  c.batch_size,
  c.created_at,
  c.started_at,
  c.completed_at,
  c.last_error,
  count(r.id)                                              as total,
  count(r.id) filter (where r.status = 'sent')             as sent,
  count(r.id) filter (where r.status = 'failed')            as failed,
  count(r.id) filter (where r.status = 'skipped')           as skipped,
  count(r.id) filter (where r.status = 'pending')           as pending,
  count(r.id) filter (where r.status = 'sending')           as in_flight
from public.email_campaigns c
left join public.email_recipients r on r.campaign_id = c.id
group by c.id;

-- ══════════════════════════════════════════════════════════════
--  Lock everything down.
--  Only the server (service_role) may read or write these tables.
-- ══════════════════════════════════════════════════════════════
alter table public.email_campaigns    enable row level security;
alter table public.email_recipients   enable row level security;
alter table public.email_unsubscribes enable row level security;

-- No policies are created on purpose: with RLS on and zero policies,
-- anon/authenticated get nothing, while service_role still bypasses RLS.

revoke all on public.email_campaigns    from anon, authenticated;
revoke all on public.email_recipients   from anon, authenticated;
revoke all on public.email_unsubscribes from anon, authenticated;
revoke all on public.email_campaign_progress from anon, authenticated;

revoke all on function public.claim_email_batch(uuid, integer) from anon, authenticated;
revoke all on function public.requeue_stale_email_recipients(uuid, integer, integer) from anon, authenticated;

grant execute on function public.claim_email_batch(uuid, integer) to service_role;
grant execute on function public.requeue_stale_email_recipients(uuid, integer, integer) to service_role;
