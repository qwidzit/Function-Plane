# CLAUDE.md

Guidance for working in the Function Plane repository.

## What this is

**Function Plane** is a mobile-first math puzzle game shipped three ways from one
codebase:

- **Web PWA** — the `function-plane/` folder, deployed to Cloudflare Pages at
  **https://functionplane.pages.dev**.
- **Android / iOS** — the same PWA wrapped in a [Capacitor](https://capacitorjs.com)
  WebView shell (see `MOBILE-BUILD.md`).

Backend is **Supabase** (auth, database, storage). There is no bundler and no
server of our own — the app is static files talking to Supabase over HTTPS.

## Architecture & the one build gotcha

React is loaded from local vendor files (`function-plane/vendor/`), not npm. UI is
written in **JSX** but the WebView cannot run runtime Babel reliably, so:

> **Every `.jsx` file in `function-plane/src/` is pre-compiled to a `.js` file
> next to it. After editing any `.jsx`, run `node scripts/build-jsx.js` (or
> `npm run build:jsx`) and commit BOTH files.** `index.html` loads the `.js`
> versions, never the `.jsx`. Editing only the `.jsx` will appear to do nothing.

Script load order is fixed in `function-plane/index.html` (config files → vendor →
`accounts.js` → screens → `app.js`). Globals are attached to `window`
(`FP_AUTH`, `LegalScreen`, `PREMIUM_LINKS`, etc.) rather than imported.

> **Babel-version churn.** The committed `.js` files were built with an older
> Babel that escapes non-ASCII in string literals (`•`, `—`). A newer
> Babel emits those characters literally (`•`, `—`), so a full `build-jsx.js` run
> reformats ~all files with functionally-identical churn. Two implications:
> (1) for a **one-line** change, it's cleaner to edit the matching `.js` line
> directly instead of rebuilding everything; (2) a real full rebuild will produce
> a large one-time reformat diff — do it deliberately, not mixed into a feature
> commit. Also note `npm install` fails in sandboxes: `@capacitor/assets` pulls in
> `sharp`, whose binary download is proxy-blocked. To rebuild, install only
> `@babel/core` + `@babel/preset-react` (e.g. in a temp dir) and point `NODE_PATH`
> at them.

## Layout

```
function-plane/            # THE deployed PWA (Cloudflare Pages serves this)
  index.html               # entry; fixed <script> load order
  sw.js  manifest.json     # service worker + PWA manifest
  vendor/                  # React, ReactDOM, Supabase JS (no npm at runtime)
  src/                     # *.jsx = source, *.js = generated (build-jsx.js)
    accounts.js            # FP_AUTH — auth, profiles, is_premium, leaderboards
    supabase-config.js     # Supabase URL + anon key + VAPID key
    premium-config.js      # Stripe Payment Link URLs (web payment path)
    data.jsx               # pack/level data + lock/unlock logic
    admin-screen.jsx       # in-app admin (grant premium, edit packs/levels)
    legal-screens.jsx      # in-app Privacy / Terms / Licenses text
    app.jsx                # root component + routing
    ...                    # per-screen components
scripts/build-jsx.js       # JSX -> JS compiler; run after every .jsx edit
legal/                     # hostable Privacy/Terms HTML for the website (see below)
supabase/config.toml       # Supabase project config
capacitor.config.json      # native shell config (appId app.functionplane)
MOBILE-BUILD.md            # how to build the Android/iOS apps
```

`android/` and `ios/` are gitignored — recreated locally with `npx cap add`.

## Level data: baked snapshot + versioned sync

Levels/packs/achievements are defined by Supabase `*_overrides` tables, but the
app does **not** trust the network for them:

- `function-plane/src/overrides-snapshot.js` is a **generated** dump of those
  tables, committed with the app. **Run `npm run snapshot:data` before each
  release** (needs network access to Supabase) and commit the result — it keeps
  offline boots playing the *real* levels instead of the easy built-in
  fallbacks (which was an exploitable way to farm stars/records).
- At boot, `overrides-store.js` (`window.FP_DATA`) synchronously applies the
  newer of (snapshot, localStorage cache of the last fetch), then does a cheap
  background version check (per-table row count + max `updated_at`, a few
  hundred bytes) and only downloads the full tables when something changed.
- Never make override fetches "fail to empty" — `FP_AUTH.fetchOverrides`
  deliberately throws on errors so bad networks can't wipe good local data.
- Leaderboards (`FP_AUTH.buildLeaderboard`) cache raw server rows for 3 min
  and fall back to the last-known board when offline.

## Supabase & entitlement model

- Table `profiles` holds `name`, `avatar`, `total_stars`, and **`is_premium`**.
- `FP_AUTH.isPremium()` reads that flag; `data.jsx` unlocks **all packs** when it's
  true (admins also get full access for testing).
- Premium is **account-based, not device-based** — buying on any channel and
  logging in anywhere grants access everywhere. Whatever payment path is used, the
  job is always the same: flip `is_premium` on the user's profile (server-side).
- Admins can grant premium manually today via the in-app admin screen
  (`Manage users / grant premium`). This is the current interim mechanism.
- If the app is unreachable after inactivity, check the Supabase dashboard — a
  free-tier project **auto-pauses after ~7 days** and needs a manual restore.

## Legal / privacy (Google Play requirement)

Google Play requires the privacy policy at a **public URL**, not just in-app.

- Source of truth for the text is `function-plane/src/legal-screens.jsx`
  (`PRIVACY_TEXT`, `TERMS_TEXT`).
- Hostable standalone pages live in `legal/` (`privacy.html`, `terms.html`) and are
  **deployed on the website** at:
  - https://functionplane.pages.dev/privacy.html
  - https://functionplane.pages.dev/terms.html
- `legal/WEBSITE-AGENT-PROMPT.md` is the handoff prompt used to deploy them to the
  separate website repo.
- Publisher: Nikolay Yaremko (the Netherlands). Support:
  functionplane.support@gmail.com.

> The website Terms (`legal/terms.html`) intentionally use **store-neutral**
> billing wording (not "Google Play handles billing") because the game sells via
> both Google Play and the web. If you touch `TERMS_TEXT` in `legal-screens.jsx`,
> keep it store-neutral to match.

## Roadmap / left to do

### Payments — dual path + environment detection *(planned, not built)*

The game will be distributed on **both** Google Play and the open web, and the two
channels require different, mutually exclusive payment systems:

- [ ] **Google Play Billing** — required for the Play Store build. Google forbids
      Stripe/external payment for digital goods, and Play Billing does **not**
      work on sideloaded / web-downloaded installs. Verify purchases and flip
      `is_premium`. RevenueCat (`@revenuecat/purchases-capacitor`) is the
      recommended integration; a RevenueCat→Supabase webhook (Edge Function) sets
      the flag. Must include a **Restore purchases** button.
- [ ] **Stripe (web / sideloaded)** — already scaffolded in `premium-config.js`
      (Payment Link URLs, currently empty) and `account-screen.jsx` `PremiumView`.
      Allowed everywhere **except** inside the Play Store build. A Stripe webhook
      (Supabase Edge Function) sets `is_premium`.
- [ ] **Environment detection** — the app must show the correct buy button per
      channel: **Play Billing inside the Play build**, **Stripe on web/sideload**.
      Never show Stripe links inside the Play Store build (Google anti-steering).
      Detect via Capacitor platform + Play Billing availability. Both paths
      converge on the same `is_premium` write, so screen logic downstream is
      unchanged.
- [ ] iOS equivalent uses StoreKit (RevenueCat covers it in the same integration).

### Other pre-launch / v2 items

- [ ] Set `LEGAL_WEBSITE = 'https://functionplane.pages.dev'` in
      `legal-screens.jsx` (currently `''`), rebuild JSX, and enter the privacy URL
      + Data safety form in the Play Console.
- [ ] Fill `PREMIUM_LINKS` in `premium-config.js` once Stripe products exist.
- [ ] Reset-password deep link (custom URL scheme / App Links) — see
      `MOBILE-BUILD.md`.
- [ ] Native push via `@capacitor/push-notifications` + FCM/APNs (SW scaffolding
      exists).
- Done already: Android hardware back button (`@capacitor/app`), haptics removed.

### Housekeeping

- Stray files `main` (empty) and `test.md` are committed at the repo root and can
  be deleted.

## Conventions

- Match the surrounding code: `window.*` globals, no ES module imports at runtime,
  CSS variables (`--fp-ink`, `--fp-bg`, ...) for theming, Instrument Serif italic
  for headings + Geist for body.
- Keep secrets out of git (`supabase-config.js` anon key is publishable/safe; never
  commit service-role keys or Stripe secret keys — see `.gitignore`).
