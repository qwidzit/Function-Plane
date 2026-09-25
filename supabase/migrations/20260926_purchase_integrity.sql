-- Function Plane — a purchase is claimed once, and a refund is final
--
-- Two holes in play-verify:
--   * It cleared voided_at when a token came back ("Google issued this token
--     again") — Play never reissues a one-time-product token, and products.get
--     can still read purchaseState 0 after a refund. Buy, refund, verify again:
--     Premium back. Deleting the account cascaded the purchases row away, so a
--     new account could claim the refunded token as if it were fresh.
--   * It checked for an existing owner, asked Google (hundreds of ms), then
--     upserted. Two accounts verifying the same token at once both passed the
--     check and both got Premium; a refund then revoked only one.
--
-- voided_tokens keeps a SHA-256 of every refunded token, linked to no one, so
-- it outlives the account without keeping personal data. grant_play_purchase
-- claims the token, refuses a voided one, and grants — in one transaction, so
-- the first claim wins and the second sees its owner.

create table if not exists public.voided_tokens (
  token_hash text primary key,
  voided_at  timestamptz not null default now()
);
alter table public.voided_tokens enable row level security;
revoke all on public.voided_tokens from anon, authenticated;

insert into public.voided_tokens (token_hash, voided_at)
  select encode(sha256(convert_to(token, 'UTF8')), 'hex'), voided_at
    from public.purchases where voided_at is not null
  on conflict do nothing;

create or replace function public.void_purchase(p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  u uuid;
begin
  insert into public.voided_tokens (token_hash)
    values (encode(sha256(convert_to(p_token, 'UTF8')), 'hex'))
    on conflict do nothing;

  update public.purchases
     set voided_at = now()
   where token = p_token and voided_at is null
   returning user_id into u;

  if u is null then return false; end if;

  -- Premium stays if another live purchase remains, or if an admin granted it.
  if not exists (select 1 from public.purchases where user_id = u and voided_at is null) then
    update public.profiles set is_premium = false where id = u and not premium_granted;
  end if;

  return true;
end;
$$;
revoke all on function public.void_purchase(text) from public, anon, authenticated;

-- 'ok' (granted, or already this account's), 'voided' (refunded — never again),
-- or 'taken' (another account owns it).
create or replace function public.grant_play_purchase(p_token text, p_user uuid, p_product text, p_order text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner  uuid;
  voided timestamptz;
begin
  if exists (select 1 from public.voided_tokens
              where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')) then
    return 'voided';
  end if;

  insert into public.purchases (token, user_id, platform, product_id, payment_ref)
    values (p_token, p_user, 'play', p_product, p_order)
    on conflict (token) do nothing;

  select user_id, voided_at into owner, voided from public.purchases where token = p_token;
  if voided is not null then return 'voided'; end if;
  if owner <> p_user then return 'taken'; end if;

  update public.profiles set is_premium = true where id = p_user;
  return 'ok';
end;
$$;
revoke all on function public.grant_play_purchase(text, uuid, text, text) from public, anon, authenticated;
