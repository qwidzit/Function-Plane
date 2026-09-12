-- Function Plane — the record of what has actually been bought
--
-- One row per verified purchase, keyed by the thing the store gave us: a Play
-- purchaseToken or a Stripe checkout session id. The primary key is the point:
-- it stops one purchase being replayed from a second account, which is the
-- cheapest way to get premium for free once billing is live.
--
-- Nobody but the service role touches this table — the two edge functions are
-- the only writers, and the app reads the entitlement off `profiles`, never
-- from here. So there are no policies: RLS is on and the client roles have no
-- privileges, which denies them by default rather than by policy.

create table if not exists public.purchases (
  token      text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  platform   text not null check (platform in ('play', 'stripe')),
  product_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists purchases_user_id_idx on public.purchases (user_id);

alter table public.purchases enable row level security;
revoke all on public.purchases from anon, authenticated;
