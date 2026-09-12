# Release checklist

Everything still outstanding before Function Plane can go public on Google
Play. Account setup and tester recruitment are deliberately excluded — this is
the work on the game itself.

**Who** is either **Claude** (can be done in this repo without you) or **You**
(needs your machine, your accounts, or your judgement). A few say **Both**:
Claude writes the code, you supply a key or press the button.

Order is by area, not priority. See [`PLAYTEST-SETUP.md`](./PLAYTEST-SETUP.md)
for which of these block the start of closed testing, and for the exact steps;
[`PAYMENTS-SETUP.md`](./PAYMENTS-SETUP.md) does the same for items 5–10.

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
| 4 | Regenerate the data snapshot | `npm run snapshot:data` bakes the finished Supabase level data into the app. Must be the last content step — and it is now also what carries authored **objects** (fans, zero-gravity zones, wells, hazards) and the per-level bounce toggle into offline boots. | You |

## Payments

| # | Item | Description | Who |
|---|---|---|---|
| 5 | Google Play Billing | **Code done, needs your machine.** `billing.js` wraps `capacitor-plugin-cdv-purchase` (MIT, Billing Library 9) and verifies every purchase through the `play-verify` edge function. Left to you: `npm install capacitor-plugin-cdv-purchase`, `npx cap sync android`, create the **`premium_lifetime`** product in Play Console at €4.90, and add the `GOOGLE_SERVICE_ACCOUNT` secret. Steps in [`PAYMENTS-SETUP.md`](./PAYMENTS-SETUP.md). The `PremiumCard` guard no longer needs removing by hand — it follows `FP_BILLING.available()`. | Both |
| 6 | Restore purchases | **Done.** The premium screen has a real Restore button calling `FP_AUTH.refreshEntitlement()`, which re-reads the profile — premium is account-based, so that restores a purchase from another device, the other channel, or before a reinstall. Play Billing's own restore hooks into the same refresh. | Claude |
| 7 | Channel detection | **Done.** `FP_PAY_CHANNEL` in `src/store-config.js` resolves to `play` on any native build and `web` otherwise. A sideloaded build is treated as `play` — we can't tell it from a Play install without native code, and that's the safe way to be wrong. | Claude |
| 8 | Entitlement webhook | **Done.** Two edge functions deployed to `Function Plane Main`: `play-verify` (JWT required; asks the Play Developer API, records the purchase, grants, then acknowledges — in that order, so a purchase we cannot grant auto-refunds rather than being silently kept) and `stripe-webhook` (verify_jwt off, HMAC signature checked — verified against Node's reference implementation, including the two-signature rotation case). Both inert until their secrets are set. | Both |
| 8b | Refund revocation | **Done.** Stripe refunds and disputes revoke within seconds through the same webhook; Play refunds are swept nightly by `play-refunds` + the `play-refund-sweep` cron job, since Google reports a refund only when asked. Both go through `void_purchase()`, which drops premium only when no live purchase is left. Verified against the live database, including the two-channel case, duplicate events and re-purchase after a refund. Needs `REFUND_SWEEP_SECRET` in two places before the sweep does anything — see [`PAYMENTS-SETUP.md`](./PAYMENTS-SETUP.md). | Both |
| 9 | ~~Stripe payment link~~ | **Dropped: Play-only for now.** The web build says premium is sold through Google Play and links to the listing; Restore still unlocks it there for anyone who bought in the app. The reason is tax, not code — on Play, Google is merchant of record and handles EU VAT; selling direct makes that ours from the first sale, for a channel that would see a fraction of the volume. The client half is removed (`premium-config.js` is gone, its price moved to `store-config.js`); `stripe-webhook` stays deployed but dormant, with no secret and nothing pointing at it. | You |
| 10 | Decide: ship premium at all in v1 | **Decided: yes, in the next release.** Worth knowing what is being sold alongside: premium is "all packs unlocked immediately", and until item 1 lands five of seven packs are one repeated placeholder. | You |
| 10b | **Decided: one lifetime unlock at €4.90** | Was monthly/annual/lifetime. `is_premium` is a boolean with no expiry, so the schema cannot express a lapsed subscription; a one-time unlock also drops grace periods, billing retry and subscription restore from the work. The screen, the config and the tests are updated. | Claude |
| 10c | Choose the billing provider | **Decided: no provider.** Verification is ours, against the Play Developer API, which costs you nothing extra to set up (the service account is needed either way) and keeps Supabase the only host the app contacts — so the privacy policy, `legal/` and the Data safety answers all stand. | You |

## Backend

| # | Item | Description | Who |
|---|---|---|---|
| 11 | Confirm the leaderboard migration is applied | `supabase/migrations/20260816_leaderboard_integrity.sql` — verify the trigger, columns and policies exist. | You |
| 11b | Apply the const/slider guard migration | **Done.** `supabase/migrations/20260911_const_class_and_sliders.sql` is applied to `Function Plane Main`: the score floor is 20 (a constant line costs 0 complexity plus the flat 20) and slider definitions no longer count toward the per-equation floor. | Claude |
| 11d | Apply the level-objects migration | **Done.** `supabase/migrations/20260912_level_objects.sql` is applied: `level_overrides.objects` / `.materials` and `pack_overrides.modifier`. Additive with defaults. Levels authored in the studio (objects, bounce toggle) and the Inversion pack's rule now save. Remember `npm run snapshot:data` before the release build once any level uses them, or offline boots play without the objects. | Claude |
| 11c | **Give the REST endpoint a reachable domain** | Writes from Russia never arrive — 24 h of `edge_logs` shows GETs answered and **zero** POSTs received, so Russian testers lose scores silently and the admin panel cannot save without a VPN. Not a bug in the app, and a different database would not fix it. The measurement, the mechanism and the ~€3/mo VPS-plus-Caddy fix are written up in [`NETWORK-ACCESS.md`](./NETWORK-ACCESS.md). Verify a candidate host answers a POST from that network *before* paying for more than a month. | You |
| 12 | Stop the Supabase project auto-pausing | **Done, without paying.** `.github/workflows/supabase-keepalive.yml` is enabled and has run green (HTTP 200 from the project). Paying for Pro remains the alternative, not the requirement. | Both |
| 13 | Verify RLS on every table | Confirm players can only write their own rows and only the admin account can write override tables. The four holes found so far are closed (13b, 13c); this stays open as the sweep of everything else. | You |
| 13c | **Close the star-leaderboard holes** | **Done.** `supabase/migrations/20260912_star_integrity.sql` is applied and verified live: `total_stars` is now summed from the guarded `level_scores` rows instead of asserted by the client (a PATCH used to put anyone at the top); the guard rejects invented `pack_id`s, which summing those rows would otherwise turn into free stars; `profiles` is read-only to clients, so a display name can't be taken from another player; names are unique case-insensitively, so `Test Account` can't be claimed in another case; and `profiles` finally has a DELETE policy — **Delete account had been reporting success and leaving the profile row**, which also made the Data safety answer about in-app deletion untrue. | Claude |
| 13b | **Close the self-grant hole on `is_premium`** | **Done.** `profiles_update` is `auth.uid() = id` and RLS has no column granularity, so any signed-in player could PATCH themselves premium with the publishable key and unlock every pack. `supabase/migrations/20260912_premium_entitlement_guard.sql` is applied to `Function Plane Main`: insert/update on that column are revoked from `anon` and `authenticated`, the admin grant moved to the `admin_set_premium` security-definer RPC, and the over-broad `profiles_premium_admin` policy is dropped. Verified against the live database — a self-grant is refused, the admin grant works, and the game's `total_stars` write is unaffected. | Claude |
| 14 | Decide the email-confirmation setting | Signup has no "check your inbox" state, so confirmations being on is confusing today. | You |
| 15 | Add the reset-password redirect URL | **Done.** Site URL set to the site root and `https://functionplane.pages.dev/auth/reset` added to the allow-list; that page is live again after the redirect-loop fix. | You |
| 16 | Reset all test data | Wipe progress, scores and times so the public leaderboard starts clean. | You |

## Website

| # | Item | Description | Who |
|---|---|---|---|
| 17 | Publish the legal-text corrections | **Handed off, not yet verified live.** `legal/privacy.html` and `legal/delete-account.html` were corrected for the Data safety filing (no location or device-info claim, equations disclosed, new effective date) and the live site still serves the old text. The prompt and both files went to the website agent; fetch `/privacy.html` and `/delete-account.html` and compare the served HTML against `legal/` before trusting it. | You |
| 18 | Correct the level count and ad wording | **Done.** The site says 70 levels / 210 stars and carries no ad claims. The footer's reversed support address was fixed at the same time. | You |
| 19 | Add a web account-deletion page | **Done and deployed** — `https://functionplane.pages.dev/delete-account.html` serves the real page. It previously fell through to the site's catch-all and returned the homepage with a 200. | Both |

## Store submission

> **Status: build 1 (`versionCode 1`) is in review on the closed testing
> track.** The whole *Set up your app* task list is ticked, all declarations
> are filed, and the release was sent for review from *Publishing overview*.
> Nothing here moves until Google answers — a first submission from a new
> account commonly takes several days, not the ~24 hours an update takes.
> When it goes live: copy the opt-in link from the track's Testers tab, send
> it to the list, and chase the opted-in count to 12+.

| # | Item | Description | Who |
|---|---|---|---|
| 20 | Generate the Android project | **Done.** `android/` regenerated on Capacitor 8; still gitignored and local. | You |
| 21 | Create and back up the signing keystore | **Done.** PKCS12 upload key (alias `function-plane`, valid to 2054), read by Gradle from the gitignored `android/keystore.properties`; `app-release.aab` is built and its signature verified against the key. **Still back the `.jks` up offline.** | You |
| 22 | Generate app icons and splash | **Done.** 87 launcher/splash assets, plus `store-assets/icon-512.png` (opaque, 512x512) for the Console. | You |
| 23 | Set the version scheme | **Done** at `versionCode 1` / `versionName "1.0"`. It must increase on every single upload, forever. The in-app string (`v 1.0 · build N` in `main-screen.jsx` and `settings-screen.jsx`, kept in step with each other by `npm test`) mirrors `versionCode` — bump both together at upload time. | You |
| 24 | Confirm the target API level | **Done.** `package.json` pins Capacitor 8; `variables.gradle` reads min 24 / compile 36 / target 36, confirmed as `targetSdkVersion:'36'` in a compiled artifact. | You |
| 25 | Store listing text | **Done.** Pasted into the Console from `store-assets/short-description.txt` and `full-description.txt` (plain text; the Console fields take no markdown). Add a level count only once the levels exist. | Both |
| 26 | Screenshots and feature graphic | **Uploaded and submitted**, in the order `04-level`, `05-run`, `03-levels`, `06-howtoplay`, `01-main`. Re-capture all of them once the real levels exist, and re-shoot the sandbox with curves on the plane before using it at all. | Both |
| 27 | Complete the Data safety form | **Done.** Five types collected, none shared, all optional; answers recorded in `store-assets/CONSOLE-SETUP.md`. | You |
| 33 | Register for Android developer verification | **Done, automatically.** Play Console ▸ Android developer verification shows `app.functionplane` as **Registered** with 3 keys since 28 August 2026 — apps created in the Console are registered on creation. The 30 September 2026 deadline only bites for unregistered packages; the banner is a general notice, not an outstanding task. Revisit only if you ever distribute an APK outside Play under a key that is not listed there. | You |
| 28 | Complete the content rating questionnaire | **Done.** No to every substantive question, including all three digital-goods boxes; re-take it in the release that ships Play Billing. | You |

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
