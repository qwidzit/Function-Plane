// Supabase Edge Function — RevenueCat webhook (Google Play / App Store path)
//
// Grants (and, on refund, revokes) Function Plane Premium from RevenueCat
// purchase events. The native app configures RevenueCat with
// appUserID = <supabase user id>, so every event carries `app_user_id` and we
// flip profiles.is_premium for that account with the service-role key.
//
// Because Premium is account-based, one entitlement follows the user across
// Android, iOS, and web — RevenueCat is just the native billing rail.
//
// Deploy:
//   supabase functions deploy revenuecat-webhook --no-verify-jwt
//
// Secrets (supabase secrets set ...):
//   REVENUECAT_WEBHOOK_AUTH   any strong random string; paste the SAME value
//                             into RevenueCat → Integrations → Webhooks →
//                             "Authorization header value".
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const expectedAuth = Deno.env.get('REVENUECAT_WEBHOOK_AUTH') ?? '';

const admin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } },
);

// A lifetime unlock is a non-consumable, so these are the events that mean
// "owns it now" vs "no longer owns it".
const GRANT = new Set([
  'INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE', 'RENEWAL',
  'PRODUCT_CHANGE', 'UNCANCELLATION', 'SUBSCRIPTION_EXTENDED',
]);
const REVOKE = new Set(['REFUND', 'EXPIRATION']);

async function setPremium(userId: string, value: boolean) {
  const { error } = await admin.from('profiles').update({ is_premium: value }).eq('id', userId);
  if (error) throw new Error(`profiles update failed: ${error.message}`);
}

Deno.serve(async (req) => {
  // RevenueCat authenticates with a static Authorization header value.
  const auth = req.headers.get('authorization') ?? '';
  if (!expectedAuth || auth !== expectedAuth) {
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: { event?: Record<string, unknown> };
  try { payload = await req.json(); }
  catch { return new Response('Bad JSON', { status: 400 }); }

  const event = payload.event ?? {};
  const type = String(event.type ?? '');
  const userId = (event.app_user_id as string) ?? '';

  try {
    // TRANSFER moves the entitlement between accounts (e.g. re-login): revoke
    // from the old ids, grant to the new ones.
    if (type === 'TRANSFER') {
      const from = (event.transferred_from as string[]) ?? [];
      const to   = (event.transferred_to as string[]) ?? [];
      for (const id of from) if (id) await setPremium(id, false);
      for (const id of to)   if (id) await setPremium(id, true);
    } else if (userId && userId !== '$RCAnonymousID') {
      if (GRANT.has(type))       await setPremium(userId, true);
      else if (REVOKE.has(type)) await setPremium(userId, false);
      // other event types (TEST, BILLING_ISSUE, CANCELLATION intent, …) are no-ops
    }
  } catch (err) {
    console.error(err);
    return new Response(`Handler error: ${(err as Error).message}`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
});
