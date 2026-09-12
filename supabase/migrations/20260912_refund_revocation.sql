-- Function Plane — take premium back when a purchase is refunded
--
-- Two paths, one rule. Stripe tells us within seconds (`charge.refunded`,
-- `charge.dispute.created`); Google tells nobody unless asked, so a daily
-- sweep asks the Play Developer API for voided purchases and matches them
-- against the ledger.
--
-- The rule itself lives here rather than in either edge function, because
-- "revoke" is not "set is_premium = false": a player who bought on Play and
-- again on the web keeps premium when one of the two is refunded. Two copies
-- of that condition would eventually disagree.

alter table public.purchases add column if not exists voided_at   timestamptz;
-- Stripe refunds arrive as a charge, which knows its payment_intent but not
-- the checkout session we keyed the row on.
alter table public.purchases add column if not exists payment_ref text;

create index if not exists purchases_payment_ref_idx on public.purchases (payment_ref)
  where payment_ref is not null;

create or replace function public.void_purchase(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  u uuid;
begin
  update public.purchases
     set voided_at = now()
   where token = p_token and voided_at is null
   returning user_id into u;

  -- Unknown token, or one already voided: nothing to do, and say so rather
  -- than reporting a revocation that did not happen.
  if u is null then return false; end if;

  if not exists (
    select 1 from public.purchases where user_id = u and voided_at is null
  ) then
    update public.profiles set is_premium = false where id = u;
  end if;

  return true;
end;
$$;

-- Only the service role calls this — the two edge functions. Revoking from
-- public also covers anon and authenticated, and PostgREST exposes anything
-- left as an RPC.
revoke all on function public.void_purchase(text) from public, anon, authenticated;

-- ── The daily Play sweep ───────────────────────────────────────────────────
--
-- pg_cron cannot sign a Google service-account JWT, so it poses the request to
-- the `play-refunds` edge function, which can. The shared secret lives in
-- Vault; until it is created the job returns without calling anything, so
-- installing this migration on a project that has not been set up yet is a
-- no-op rather than a daily error.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.sweep_play_refunds()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  sweep_secret text;
begin
  select decrypted_secret into sweep_secret
    from vault.decrypted_secrets where name = 'refund_sweep_secret';
  if sweep_secret is null then
    raise notice 'refund_sweep_secret is not in the vault — skipping';
    return;
  end if;

  perform net.http_post(
    url     := 'https://miuxqxllxjvxddolpzno.supabase.co/functions/v1/play-refunds',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-sweep-secret', sweep_secret),
    body    := '{}'::jsonb
  );
end;
$$;

revoke all on function public.sweep_play_refunds() from public, anon, authenticated;

-- 03:40 UTC, off the hour and away from the keepalive ping.
select cron.unschedule('play-refund-sweep')
 where exists (select 1 from cron.job where jobname = 'play-refund-sweep');

select cron.schedule('play-refund-sweep', '40 3 * * *',
                     $$select public.sweep_play_refunds()$$);
