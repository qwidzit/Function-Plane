// Function Plane — verify a Google Play purchase and grant premium.
//
// The app sends a purchaseToken; this asks the Play Developer API whether it
// is real, records it, flips is_premium with the service-role key, and only
// then acknowledges it to Google. The client is never believed: is_premium is
// revoked from both client roles (20260912_premium_entitlement_guard.sql), so
// this function and the Stripe webhook are the only writers.
//
// Env (Supabase dashboard → Edge Functions → Secrets):
//   GOOGLE_SERVICE_ACCOUNT  the whole service-account JSON, one line
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY  provided by the platform
//
// An unacknowledged purchase is refunded by Google after three days, so the
// acknowledge call at the end is not optional — but it comes last, because a
// purchase we could not grant is better left to auto-refund than acknowledged
// and lost.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const PACKAGE_NAME = 'app.functionplane';
const PRODUCT_ID   = 'premium_lifetime';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// Service-account JWT → OAuth access token. Google's own libraries do this,
// but they are a large dependency for one RS256 signature.
async function googleAccessToken(): Promise<string> {
  const raw = Deno.env.get('GOOGLE_SERVICE_ACCOUNT');
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT is not set');
  const sa = JSON.parse(raw);

  const now    = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss:   sa.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  };

  const b64url = (s: string) =>
    btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;

  const pem = (sa.private_key as string)
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned),
  ));
  const jwt = `${unsigned}.${b64url(String.fromCharCode(...sig))}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Google token exchange failed: ${body.error_description || res.status}`);
  return body.access_token;
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return json({ error: 'POST only' }, 405);

  try {
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'Sign in first' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    const user = userData?.user;
    if (userErr || !user) return json({ error: 'Sign in first' }, 401);

    const { purchaseToken } = await req.json().catch(() => ({ purchaseToken: '' }));
    if (!purchaseToken || typeof purchaseToken !== 'string') {
      return json({ error: 'No purchase token' }, 400);
    }

    // One purchase, one account. Without this the same token, replayed from a
    // second account, would unlock both.
    const { data: existing } = await admin
      .from('purchases').select('user_id').eq('token', purchaseToken).maybeSingle();
    if (existing && existing.user_id !== user.id) {
      return json({ error: 'That purchase is already attached to another account' }, 409);
    }

    const token   = await googleAccessToken();
    const url     = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}`
                  + `/purchases/products/${PRODUCT_ID}/tokens/${encodeURIComponent(purchaseToken)}`;
    const lookup  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const receipt = await lookup.json();

    if (!lookup.ok) {
      // 404 means Google has never heard of this token.
      return json({ error: receipt?.error?.message || 'Google could not find that purchase' }, 402);
    }
    // 0 = purchased, 1 = cancelled, 2 = pending. A pending purchase grants
    // nothing yet; Play sends it again when the payment clears.
    if (receipt.purchaseState !== 0) {
      return json({ premium: false, pending: receipt.purchaseState === 2 }, 200);
    }

    const { error: recErr } = await admin.from('purchases').upsert({
      token:      purchaseToken,
      user_id:    user.id,
      platform:   'play',
      product_id: PRODUCT_ID,
      // Clears an earlier void: Google issued this token again, so whatever
      // the refund sweep marked is no longer true.
      voided_at:  null,
    }, { onConflict: 'token' });
    if (recErr) return json({ error: recErr.message }, 500);

    const { error: grantErr } = await admin
      .from('profiles').update({ is_premium: true }).eq('id', user.id);
    if (grantErr) return json({ error: grantErr.message }, 500);

    if (receipt.acknowledgementState === 0) {
      await fetch(`${url}:acknowledge`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    '{}',
      });
    }

    return json({ premium: true });
  } catch (e) {
    console.error('play-verify', e);
    return json({ error: (e as Error).message || 'Verification failed' }, 500);
  }
});
