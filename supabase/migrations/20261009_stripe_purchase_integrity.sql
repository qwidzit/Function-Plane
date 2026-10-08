-- Function Plane — the Stripe channel claims a purchase the way Play does
--
-- stripe-webhook (dormant: no secret, nothing points at it) upserted its
-- purchases row with voided_at = null and then set is_premium directly, which
-- is the pair of holes 20260926_purchase_integrity.sql closed for Play: a
-- replayed event re-granted a refunded purchase, and nothing checked
-- voided_tokens. Same shape as grant_play_purchase, keyed on the checkout
-- session id and remembering the payment_intent a refund arrives under.
--
-- Safe to run more than once.

create or replace function public.grant_stripe_purchase(p_token text, p_user uuid, p_product text, p_intent text)
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
    values (p_token, p_user, 'stripe', p_product, p_intent)
    on conflict (token) do nothing;

  select user_id, voided_at into owner, voided from public.purchases where token = p_token;
  if voided is not null then return 'voided'; end if;
  if owner <> p_user then return 'taken'; end if;

  update public.profiles set is_premium = true where id = p_user;
  return 'ok';
end;
$$;
revoke all on function public.grant_stripe_purchase(text, uuid, text, text) from public, anon, authenticated;
