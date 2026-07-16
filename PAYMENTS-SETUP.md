# Payments & Rate button — setup guide

This is the step-by-step for turning on payments after the code work (already
done — see "What's already wired" below). Function Plane sells **one thing**: a
lifetime **Premium** unlock that opens every pack. It ships three ways, and each
uses a different payment rail, but they all end at the same place — flipping
`profiles.is_premium = true` for the buyer's account.

| Channel | Where it runs | Payment rail | Who flips `is_premium` |
|---|---|---|---|
| **Web / online** | functionplane.pages.dev, PWA | **Stripe** Payment Link | `stripe-webhook` Edge Function |
| **Sideloaded APK** | APK downloaded from the site | **Stripe** (same as web) | `stripe-webhook` Edge Function |
| **Google Play** | Play Store install | **Google Play Billing** via RevenueCat | `revenuecat-webhook` Edge Function |
| **App Store (later)** | iOS install | **StoreKit** via RevenueCat | `revenuecat-webhook` Edge Function |

Premium is **account-based**: it follows the user across web, Android, and iOS
once they sign in. Because the webhook maps a payment to a Supabase user id, a
purchase **requires the user to be signed in** — the app enforces this and asks
guests to create an account first.

> **Anti-steering, important:** the Google Play build never shows the Stripe
> button (and the App Store build never will either) — the environment detector
> switches it to native billing automatically. Don't hard-code a Stripe link
> anywhere that a store build can reach it.

---

## What's already wired (no action needed)

New files:

- `function-plane/src/environment.js` (`window.FP_ENV`) — detects platform
  (`web`/`android`/`ios`) and distribution channel (`web`/`play`/`appstore`),
  and exposes the Rate helpers.
- `function-plane/src/billing.js` (`window.FP_BILLING`) — one `buy()` /
  `restore()` interface that routes to Stripe (web) or RevenueCat (native).
- `supabase/functions/stripe-webhook/` and `supabase/functions/revenuecat-webhook/`
  — the two webhooks that set `is_premium`.

Changed:

- `premium-config.js` — the only file you edit for keys/links (all public,
  safe to commit).
- `account-screen.jsx` — Premium screen is now channel-aware, single lifetime
  plan, with a working **Restore purchases** button and a signed-in-required
  gate.
- `accounts.js` — added `FP_AUTH.refreshProfile()` (re-reads the premium flag
  after a purchase).
- `app.jsx` — re-checks the flag when you return to the tab from Stripe
  checkout, so it unlocks without a manual reload.
- `main-screen.jsx` — Rate button now calls the per-channel path when enabled.
- `index.html`, `sw.js` — load + cache the two new files (SW bumped to `fp-v25`).

Everything you configure below lands in **`function-plane/src/premium-config.js`**
(client, public) and in **Supabase Edge Function secrets** (server, private).

---

## Part A — Supabase (shared backend, do this first)

1. **Confirm the flag exists.** In the Supabase dashboard → Table editor →
   `profiles`, there should be a boolean `is_premium` column. (It already
   drives pack unlocking — `computePackLocked` unlocks all packs when it's
   true.) If it's missing:
   ```sql
   alter table profiles add column if not exists is_premium boolean not null default false;
   ```

2. **Install the Supabase CLI** and link the project (from the repo root):
   ```bash
   npx supabase login
   npx supabase link --project-ref miuxqxllxjvxddolpzno
   ```
   (`miuxqxllxjvxddolpzno` is this project's ref, from `supabase-config.js`.)

3. **Deploy both functions:**
   ```bash
   npx supabase functions deploy stripe-webhook
   npx supabase functions deploy revenuecat-webhook
   ```
   `config.toml` already sets `verify_jwt = false` for both (they're called by
   Stripe/RevenueCat, not a logged-in user). Their public URLs will be:
   ```
   https://miuxqxllxjvxddolpzno.supabase.co/functions/v1/stripe-webhook
   https://miuxqxllxjvxddolpzno.supabase.co/functions/v1/revenuecat-webhook
   ```

   > `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected into the
   > functions automatically — you do **not** set those as secrets, and you
   > must never put the service-role key in the client.

You'll set the Stripe/RevenueCat secrets in their sections below.

---

## Part B — Stripe (web + sideloaded APK)

**In the Stripe Dashboard:**

1. Create the product: **Products → Add product** → name *Function Plane
   Premium*, price **one-time** (e.g. $14.99), currency of your choice.
2. Create the checkout link: **Products → Payment links → New** → select that
   product → **one-time** → Create. Copy the URL (`https://buy.stripe.com/…`).
   - No extra toggle is needed for the account id — the app appends
     `?client_reference_id=<userId>` to the link and Stripe passes it through
     to the webhook.
3. Create the webhook: **Developers → Webhooks → Add endpoint** →
   URL = the `stripe-webhook` function URL from Part A →
   **Select events → `checkout.session.completed`** → Add endpoint.
   Copy the **Signing secret** (`whsec_…`).
4. Grab your **Secret key** from **Developers → API keys** (`sk_live_…`, or
   `sk_test_…` while testing).

**Set the Stripe secrets:**
```bash
npx supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx
npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
```

**Fill in the client** — `function-plane/src/premium-config.js`:
```js
window.PREMIUM_LINKS = {
  lifetime:   'https://buy.stripe.com/xxxYourLinkxxx',
  priceLabel: '$14.99',   // shown on the web Premium screen
};
```

**Test (Stripe test mode):** use test keys + a test payment link, sign in to the
app, open Account → Premium → **Unlock Premium**, pay with card `4242 4242 4242
4242`. Return to the app tab → it should flip to "Premium active" within a
second or two (or tap **Restore purchases**). Verify `is_premium` went true on
that profile row.

---

## Part C — Google Play + RevenueCat (Android)

You need a Play Console app and a RevenueCat account (free tier is fine).

**1. Google Play Console**
- Create the app (package `app.functionplane`), and get at least an **internal
  testing** build uploaded once (Play requires an uploaded build before IAP
  products can be activated). Build the AAB per `MOBILE-BUILD.md`.
- **Monetize → Products → In-app products → Create product**:
  - Product ID: `premium_lifetime` (remember this exact id)
  - Type: one-time / managed product → set price → **Activate**.
- Add **license testers** (Settings → License testing) so you can test
  purchases without being charged.
- Create a **service account** and grant RevenueCat access (RevenueCat's Play
  setup guide walks you through the Google Cloud service-account JSON + the
  Play Console permission grant).

**2. RevenueCat Dashboard**
- Create a project → add a **Google Play** app → upload the service-account
  credentials from the previous step.
- **Entitlements → New** → identifier `premium`.
- **Products → Import/Add** → add the Play product `premium_lifetime` → attach
  it to the `premium` entitlement.
- **Offerings** → in the current (default) offering, add a **package** of type
  **Lifetime** and point it at the `premium_lifetime` product.
- **API keys** → copy the **public** Google key (`goog_…`).
- **Integrations → Webhooks → Add**:
  - URL = the `revenuecat-webhook` function URL from Part A.
  - **Authorization header value** = a strong random string you invent
    (e.g. `openssl rand -hex 24`). Keep it — it's the shared secret.

**Set the RevenueCat secret** (same value you pasted into the webhook's
Authorization field):
```bash
npx supabase secrets set REVENUECAT_WEBHOOK_AUTH=your-strong-random-string
```

**Fill in the client** — `function-plane/src/premium-config.js`:
```js
window.REVENUECAT_CONFIG = {
  androidApiKey: 'goog_xxxxxxxxxxxxxxxxxxxx',
  iosApiKey:     '',          // later, for iOS
  entitlementId: 'premium',   // must match the RevenueCat entitlement
  offeringId:    '',          // blank = current offering
  packageId:     '',          // blank = the offering's Lifetime package
};
```

**3. Add the RevenueCat plugin to the native build.** This is what makes
`window.Capacitor.Plugins.Purchases` exist (the app talks to it through the
Capacitor bridge — no bundler/import needed):
```bash
npm install @revenuecat/purchases-capacitor
npx cap sync android
```
Then rebuild in Android Studio and install on a device signed in with a
**license tester** Google account.

**Test:** sign into the app → Account → Premium → **Unlock Premium** → the
Google Play purchase sheet appears → complete it (testers aren't charged). The
RevenueCat webhook flips `is_premium`; the app re-checks and shows "Premium
active". Test **Restore purchases** on a fresh install / after reinstall.

> If `Unlock Premium` says *"In-app purchases are not available in this build"*,
> the plugin isn't synced into the native project — re-run step 3. If it says
> *"No products found"*, the RevenueCat offering/package or the Play product
> isn't active yet.

---

## Part D — iOS (App Store), when you're ready

Same RevenueCat project:
- Add an **App Store** app, create a StoreKit **non-consumable** matching the
  lifetime unlock, attach it to the `premium` entitlement and the Lifetime
  package.
- Copy the public Apple key (`appl_…`) into `REVENUECAT_CONFIG.iosApiKey`.
- The plugin already covers iOS: `npx cap sync ios` after `npm run cap:add:ios`
  on a Mac. No webhook or code changes — `revenuecat-webhook` handles Apple
  events the same way.

---

## Part E — Which build shows which button

Handled automatically by `FP_ENV`, but know the rule:

- **Web deploy** (Cloudflare Pages) → channel `web` → **Stripe**.
- **Google Play build** → native Android → channel `play` → **RevenueCat**,
  Stripe hidden. Nothing to configure.
- **App Store build** → native iOS → channel `appstore` → **RevenueCat**.
- **Sideloaded APK** (the "download from our website" option) → it's native
  Android, so it would *default* to Play Billing, which doesn't work off-Play.
  For that build **only**, uncomment this in `premium-config.js` before syncing
  so it uses Stripe instead:
  ```js
  window.FP_BUILD_CHANNEL = 'web';
  ```
  Keep it commented for the real Play Store build.

---

## Part F — Turn on the Rate button

It intentionally still shows a "coming soon" popup. Once the app is live:

1. In `premium-config.js`:
   ```js
   window.RATE_CONFIG = {
     enabled:        true,
     androidPackageId: 'app.functionplane',
     playListingUrl: 'https://play.google.com/store/apps/details?id=app.functionplane',
     appStoreUrl:    '',   // fill when iOS ships
   };
   ```
2. (Optional, nicer) add the native in-app review sheet on Android:
   ```bash
   npm install @capacitor-community/in-app-review
   npx cap sync android
   ```
   The code already uses it if present (`Capacitor.Plugins.InAppReview`),
   otherwise it opens the Play listing.
3. **Bump the service worker** (`function-plane/sw.js` → `const CACHE = 'fp-v26'`)
   so web users pick up the config change.

Behavior once on: native Android → in-app review (falls back to Play listing);
iOS → App Store; web → Play listing.

---

## Part G — Do-this-after-any-change checklist

- Edited a `.jsx`? → `npm run build:jsx` and commit both files.
  (`premium-config.js`, `environment.js`, `billing.js` are plain JS — no build
  step.)
- Changed anything under `function-plane/`? → **bump `sw.js`'s `CACHE`**
  version, or web users keep the old cached app.
- Native build? → `npx cap sync android` (and `ios`) after every web change.
- Redeployed a webhook or changed a secret? → `npx supabase functions deploy …`
  / `npx supabase secrets set …` again.

---

## Security — do NOT commit these

`premium-config.js` holds only **public** values (Stripe Payment Link URL,
RevenueCat public SDK keys) — safe in git. Everything below lives only in
Supabase Edge Function secrets and must **never** be committed:

- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `REVENUECAT_WEBHOOK_AUTH`
- the Supabase **service-role** key (never leaves the server; injected into the
  functions automatically)

The `.gitignore` already blocks `.env`, `**/secrets.json`, etc. — keep secrets
there or in the Supabase dashboard only.

---

## Fallback: manual grant

The admin panel's **grant premium** still works (sign in as `Test Account` →
Admin → Manage users). Use it to comp an account or fix a stuck purchase while
you're still testing the automated paths.
