// Function Plane — Stripe webhook for the web/sideload channel.
//
// A Payment Link is opened with `?client_reference_id=<supabase user id>`, so
// the completed checkout session says which account to grant. Runs with
// verify_jwt disabled — Stripe has no Supabase JWT — which is exactly why the
// signature check below is the authentication, and why nothing is read from
// the body before it passes.
//
// Env (Supabase dashboard → Edge Functions → Secrets):
//   STRIPE_WEBHOOK_SECRET   the `whsec_...` from the endpoint's signing secret
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY  provided by the platform
import { createClient } from 'jsr:@supabase/supabase-js@2';

const TOLERANCE_S = 300;  // reject replays of an old signed payload

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function signatureValid(payload: string, header: string, secret: string): Promise<boolean> {
  // Stripe sends every v1 signature it considers current, so during a secret
  // rotation there are two. Keeping only the last one would reject real
  // deliveries for the length of the rotation window.
  const parts = header.split(',').map(p => p.split('='));
  const t   = parts.find(p => p[0] === 't')?.[1];
  const v1s = parts.filter(p => p[0] === 'v1').map(p => p[1]);
  if (!t || !v1s.length) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(t)) > TOLERANCE_S) return false;

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const mac = new Uint8Array(await crypto.subtle.sign(
    'HMAC', key, new TextEncoder().encode(`${t}.${payload}`),
  ));
  const hex = [...mac].map(b => b.toString(16).padStart(2, '0')).join('');
  return v1s.some(v => timingSafeEqual(hex, v));
}

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });

  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!secret) return new Response('STRIPE_WEBHOOK_SECRET is not set', { status: 500 });

  const payload = await req.text();
  const header  = req.headers.get('stripe-signature') || '';
  if (!(await signatureValid(payload, header, secret))) {
    return new Response('Bad signature', { status: 400 });
  }

  const event = JSON.parse(payload);
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  // Money going back out. A dispute is treated as a refund on the grounds
  // that arguing with a chargeback over €4.90 costs more than the €4.90.
  if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created') {
    // A charge and a dispute both carry payment_intent, which is what the
    // purchase row was stamped with.
    const intent = (event.data?.object || {}).payment_intent;
    if (!intent) return new Response('no payment_intent', { status: 200 });

    // A partial refund on a single non-consumable is not a thing we sell, so
    // any refund at all ends the entitlement.
    const { data: row } = await admin
      .from('purchases').select('token').eq('payment_ref', intent).maybeSingle();
    if (!row) {
      console.warn('stripe-webhook: refund for a payment we have no row for', intent);
      return new Response('unknown payment', { status: 200 });
    }
    const { error } = await admin.rpc('void_purchase', { p_token: row.token });
    if (error) {
      console.error('stripe-webhook: could not void', error.message);
      return new Response('void failed', { status: 500 });  // let Stripe retry
    }
    return new Response('voided', { status: 200 });
  }

  // Anything else is acknowledged and ignored — an unhandled event type is not
  // an error, and a non-2xx makes Stripe retry it for days.
  if (event.type !== 'checkout.session.completed') return new Response('ignored', { status: 200 });

  const session = event.data?.object || {};
  const userId  = session.client_reference_id;
  if (session.payment_status !== 'paid') return new Response('unpaid', { status: 200 });
  if (!userId) {
    // Someone paid and we cannot tell who. Loud, because it needs a manual
    // grant from the admin screen and the player is waiting.
    console.error('stripe-webhook: paid session with no client_reference_id', session.id);
    return new Response('no client_reference_id', { status: 200 });
  }

  const { error: recErr } = await admin.from('purchases').upsert({
    token:       session.id,
    user_id:     userId,
    platform:    'stripe',
    product_id:  'premium_lifetime',
    // How a later refund finds its way back to this row, and what clears a
    // previous void if this player is buying again after one.
    payment_ref: session.payment_intent,
    voided_at:   null,
  }, { onConflict: 'token' });
  if (recErr) {
    console.error('stripe-webhook: could not record purchase', recErr.message);
    return new Response('record failed', { status: 500 });  // let Stripe retry
  }

  const { error: grantErr } = await admin
    .from('profiles').update({ is_premium: true }).eq('id', userId);
  if (grantErr) {
    console.error('stripe-webhook: could not grant premium', grantErr.message);
    return new Response('grant failed', { status: 500 });
  }

  return new Response('ok', { status: 200 });
});
