# Release checklist

Everything still outstanding before Function Plane can go public on Google
Play. Account setup and tester recruitment are deliberately excluded — this is
the work on the game itself.

**Who** is either **Claude** (can be done in this repo without you) or **You**
(needs your machine, your accounts, or your judgement). A few say **Both**:
Claude writes the code, you supply a key or press the button.

Order is by area, not priority. See [`PLAYTEST-SETUP.md`](./PLAYTEST-SETUP.md)
for which of these block the start of closed testing, and for the exact steps.

**Done** marks work that has landed in the repo. Several of those still need
something from you to take effect — a URL pasted in, a file deployed, an asset
approved — and each one says so.

---

## Content

| # | Item | Description | Who |
|---|---|---|---|
| 1 | Author the remaining 50 levels | Packs III, IV, V, Linear and Trig have no level data and currently repeat one placeholder. `npm test` prints live coverage. | You |
| 2 | Re-tune level goals | Score and equation goals across all 70 levels, once the levels exist. | You |
| 3 | Set the `stars_200` threshold | 200 of a maximum 210 stars is near-impossible; editable in the admin panel. | You |
| 4 | Regenerate the data snapshot | `npm run snapshot:data` bakes the finished Supabase level data into the app. Must be the last content step. | You |

## Payments

| # | Item | Description | Who |
|---|---|---|---|
| 5 | Google Play Billing | The Play build must use Play Billing; Stripe is forbidden there for digital goods. | Both |
| 6 | Restore purchases | A restore button is a Play requirement for any paid entitlement. | Claude |
| 7 | Channel detection | **Done.** `FP_PAY_CHANNEL` in `src/store-config.js` resolves to `play` on any native build and `stripe` on web; the premium screen refuses to open a Stripe link unless the channel is `stripe`. A sideloaded build is treated as `play` — we can't tell it from a Play install without native code, and that's the safe way to be wrong. | Claude |
| 8 | Entitlement webhook | A verified purchase has to flip `is_premium` server-side, not client-side. | Both |
| 9 | Stripe payment links | `premium-config.js` holds three empty strings; the web channel is dead until they're filled. | You |
| 10 | Decide: ship premium at all in v1 | Launching with premium hidden is a legitimate option and removes items 5–9 from the critical path. | You |

## Backend

| # | Item | Description | Who |
|---|---|---|---|
| 11 | Confirm the leaderboard migration is applied | `supabase/migrations/20260816_leaderboard_integrity.sql` — verify the trigger, columns and policies exist. | You |
| 12 | Stop the Supabase project auto-pausing | A free project auto-pauses after ~7 days idle, which takes the whole game down. **Handled without paying** by `.github/workflows/supabase-keepalive.yml` — enable it in the repo's Actions tab. Paying for Pro is the alternative, not the requirement. | Both |
| 13 | Verify RLS on every table | Confirm players can only write their own rows and only the admin account can write override tables. | You |
| 14 | Decide the email-confirmation setting | Signup has no "check your inbox" state, so confirmations being on is confusing today. | You |
| 15 | Add the reset-password redirect URL | Supabase must allow `https://functionplane.pages.dev/auth/reset` as a redirect target. | You |
| 16 | Reset all test data | Wipe progress, scores and times so the public leaderboard starts clean. | You |

## Website

| # | Item | Description | Who |
|---|---|---|---|
| 17 | Publish the legal-text corrections | The privacy policy no longer lists Google Fonts or CDNs as processors; the live site must match. | You |
| 18 | Correct the level count and ad wording | The site advertises 140 levels; v1 ships 70, and the game is fully ad-free. | You |
| 19 | Add a web account-deletion page | **Done** — `legal/delete-account.html`, matching the existing legal pages. **You still need to deploy it** to `https://functionplane.pages.dev/delete-account.html`; the Data safety form checks the URL resolves. | Both |

## Store submission

| # | Item | Description | Who |
|---|---|---|---|
| 20 | Generate the Android project | `android/` has never been created; it is gitignored and built locally. | You |
| 21 | Create and back up the signing keystore | Losing it means never being able to update the app again, with no recovery. | You |
| 22 | Generate app icons and splash | Source art exists in `assets/`; the tooling needs a real machine. | You |
| 23 | Set the version scheme | `versionCode` must increase on every single upload, forever. | You |
| 24 | Confirm the target API level | **Blocker, with a deadline.** Capacitor 6 (what `package.json` pins) generates an Android project targeting API 34. Google's floor is already 35, and from **31 Aug 2026** every new app and update needs **36**. Fix by upgrading to Capacitor 8 *before* `cap add android` — step 0 of `PLAYTEST-SETUP.md`. | You |
| 25 | Store listing text | **Drafted** in `store-assets/LISTING.md` — title, short and full description, all within Google's limits, plus the exact Data safety and content-rating answers. Yours to approve or rewrite. | Both |
| 26 | Screenshots and feature graphic | **Done, pending your approval.** Eight real 1080×1920 captures in `store-assets/screenshots/` and a `1024×500` feature graphic, both generated from the running app. Re-capture once the real levels exist — the current shots use placeholder levels. | Both |
| 27 | Complete the Data safety form | Declares email + progress, no ads, no third-party sharing — all now literally true. | You |
| 28 | Complete the content rating questionnaire | Short form; a puzzle game with no ads or user content rates trivially. | You |

## App polish

| # | Item | Description | Who |
|---|---|---|---|
| 29 | Point the Rate button at the store | **Done** — the button opens `FP_STORE_LINKS.android` when it's set and falls back to the existing popup when it isn't. **Paste the listing URL** into `src/store-config.js` once the app is live. | Both |
| 30 | Add crash and error reporting | Without it, production failures are invisible. Needs a Sentry (or equivalent) DSN from you. | Both |
| 31 | Test on a real low-end device | Frame rate, touch targets, the custom keyboard, and cold-start offline behaviour. | You |
| 32 | Final pass on the whole game | Play every level start to finish on a phone before strangers do. | You |

---

## Explicitly not required for launch

iOS (needs a Mac and an Apple developer account), native push notifications
and daily levels (v2), the reset-password deep link into the app (the website
page covers it), and server-side replay verification of leaderboard scores
(the database guard plus the admin audit covers v1).
