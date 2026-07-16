// Supabase Edge Function — Stripe webhook (web / sideload payment path)
//
// Grants Function Plane Premium after a successful Stripe checkout. The web app
// opens a Stripe Payment Link with ?client_reference_id=<supabase user id>, so
// the completed session carries the buyer's account id and we flip
// profiles.is_premium for them using the service-role key.
//
// Deploy:
//   supabase functions deploy stripe-webhook --no-verify-jwt
//     (--no-verify-jwt because Stripe, not a signed-in user, calls this;
//      authenticity is proven by the Stripe signature instead.)
//
// Secrets (supabase secrets set ...):
//   STRIPE_SECRET_KEY       sk_live_… (or sk_test_… while testing)
//   STRIPE_WEBHOOK_SECRET   whsec_…  (from the webhook endpoint you create)
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.
//
// Point a Stripe webhook endpoint at this function's URL and subscribe to at
// least `checkout.session.completed`.

import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';

const admin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } },
);

async function setPremium(userId: string, value: boolean) {
  const { error } = await admin.from('profiles').update({ is_premium: value }).eq('id', userId);
  if (error) throw new Error(`profiles update failed: ${error.message}`);
}

Deno.serve(async (req) => {
  const sig = req.headers.get('stripe-signature');
  if (!sig) return new Response('Missing signature', { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    // constructEventAsync (not the sync variant) — Deno verifies via SubtleCrypto.
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (err) {
    return new Response(`Signature verification failed: ${(err as Error).message}`, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      // Only grant once the money is actually captured.
      if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') {
        const userId = session.client_reference_id;
        if (userId) await setPremium(userId, true);
        else console.warn('checkout.session.completed with no client_reference_id — cannot map to a user');
      }
    }
    // Optional: revoke on a full refund if you stored the user id in metadata.
    else if (event.type === 'charge.refunded') {
      const charge = event.data.object as Stripe.Charge;
      const userId = (charge.metadata && charge.metadata.supabase_user_id) || null;
      if (userId && charge.amount_refunded >= charge.amount) await setPremium(userId, false);
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
