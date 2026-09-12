// Function Plane — daily sweep for refunded Play purchases.
//
// Google does not tell anyone about a refund unless asked. (It can, through
// Pub/Sub real-time developer notifications, but that is a topic, a push
// subscription and another endpoint to keep alive — for one product at €4.90,
// asking once a day is the same answer for a fraction of the setup.)
//
// Called by the `play-refund-sweep` cron job, which poses the shared secret it
// reads from Vault. It has no Supabase JWT, so that header is the
// authentication — though note the function is harmless to call: it only ever
// voids purchases Google itself reports as voided.
//
// Env (Supabase dashboard → Edge Functions → Secrets):
//   GOOGLE_SERVICE_ACCOUNT  same service-account JSON as play-verify
//   REFUND_SWEEP_SECRET     must equal the vault secret `refund_sweep_secret`
import { createClient } from 'jsr:@supabase/supabase-js@2';

const PACKAGE_NAME = 'app.functionplane';
// Google keeps voided purchases for 30 days. A week is a wide enough net for a
// daily job to survive a few failed runs, and short enough to stay one page.
const WINDOW_DAYS = 7;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function googleAccessToken(): Promise<string> {
  const raw = Deno.env.get('GOOGLE_SERVICE_ACCOUNT');
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT is not set');
  const sa = JSON.parse(raw);

  const now    = Math.floor(Date.now() / 1000);
  const b64url = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.`
                 + `${b64url(JSON.stringify({
                     iss:   sa.client_email,
                     scope: 'https://www.googleapis.com/auth/androidpublisher',
                     aud:   'https://oauth2.googleapis.com/token',
                     iat:   now,
                     exp:   now + 3600,
                   }))}`;

  const pem = (sa.private_key as string)
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const key = await crypto.subtle.importKey(
    'pkcs8', Uint8Array.from(atob(pem), c => c.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned),
  ));

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  `${unsigned}.${b64url(String.fromCharCode(...sig))}`,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Google token exchange failed: ${body.error_description || res.status}`);
  return body.access_token;
}

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });

  const expected = Deno.env.get('REFUND_SWEEP_SECRET');
  if (!expected) return new Response('REFUND_SWEEP_SECRET is not set', { status: 500 });
  if (!timingSafeEqual(req.headers.get('x-sweep-secret') || '', expected)) {
    return new Response('Bad secret', { status: 401 });
  }

  try {
    const token = await googleAccessToken();
    const start = Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    let pageToken = '';
    let seen = 0, revoked = 0;

    // type=1 asks for refunds *and* revocations, not only user-initiated
    // cancellations — an order Google reverses for fraud counts the same here.
    do {
      const url = new URL(
        `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/purchases/voidedpurchases`,
      );
      url.searchParams.set('startTime', String(start));
      url.searchParams.set('type', '1');
      if (pageToken) url.searchParams.set('token', pageToken);

      const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message || `voidedpurchases returned ${res.status}`);

      for (const v of body.voidedPurchases || []) {
        if (!v.purchaseToken) continue;
        seen++;
        // void_purchase() owns the rule, because "refunded" is not always
        // "revoke": a player who also bought on the web keeps premium.
        const { data } = await admin.rpc('void_purchase', { p_token: v.purchaseToken });
        if (data === true) revoked++;
      }
      pageToken = body.tokenPagination?.nextPageToken || '';
    } while (pageToken);

    console.log(`play-refunds: ${seen} voided purchases from Google, ${revoked} newly voided here`);
    return new Response(JSON.stringify({ seen, revoked }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('play-refunds', e);
    return new Response((e as Error).message || 'sweep failed', { status: 500 });
  }
});
