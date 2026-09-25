# What's left

Everything still to do, grouped by **where you do it**.
[`RELEASE-CHECKLIST.md`](./RELEASE-CHECKLIST.md) is the same work grouped by
area, with the history of how each item got to where it is; the numbers below
point back at it.

> ## Where the release stands — 25 September 2026
>
> **Closed testing is finished.** Build 2 (`versionCode` 2, Play Billing
> included) is live on the closed track. Build 3 is the last upload before
> production.
>
> **Checked and done since the 20th:** the website's legal pages (served
> byte-identical to `legal/`), Data safety (crash logs, purchase history), the
> content rating re-take, the keystore backup, the low-end device pass, both
> refund-sweep secrets and the service-account key, and the store screenshots
> (re-captured against the authored levels).
>
> **Blocking production:** the API is on, but Google refuses the service
> account for *insufficient permissions*, so no purchase can be confirmed
> (§4). No test purchase has been made yet — `purchases` is empty.
>
> **In Build 3:** a reset of everyone's progress now sticks (item 34, its
> migration applied). Run it once Build 3 has reached the testers (§3, 16).
>
> **Deferred past launch (§7):** the Russia relay, whose premise stopped
> reproducing.

## First, the question that decides everything

**Levels, packs and achievements are not in the build.** `overrides-store.js`
syncs all three from Supabase on every boot and on every reconnect. The baked
`overrides-snapshot.js` only serves the first offline boot before a sync lands.

So a level goal, a hint, a pack's rule, an achievement threshold or a pack's
visibility can be changed from the admin panel at any time and reaches players
who already installed. Only §1 needs an upload.

---

## 1. In the build — Build 3

Needs `versionCode` +1 and a new AAB.

| # | What | Note |
|---|---|---|
| ~~35~~ | ~~In-app terms behind `legal/terms.html`~~ | **Done in the repo (25 September).** The terms gained "refunded or charged back removes Premium" and "only where Google Play offers in-app purchases". The legal renderer also split every wrapped bullet into a bullet plus a stray paragraph mid-sentence — visible in Build 2 — and now joins them |
| ~~37~~ | ~~Load these equations drops a curve's domain~~ | **Done in the repo (25 September).** The run entry stores `domains` beside `mats` and `shifts`, and one function (`rowsFromRun`) turns a run back into rows, so all three restore on the same curve-aligned index. Runs saved before this load unrestricted, as they did; a new win records the domain. `npm test` round-trips a run through JSON and back |
| ~~34~~ | ~~Reset epoch~~ | **Done (25 September), and its migration is applied.** A reset now sticks on every device — see §3 item 16 for how and when to run one |
| ~~23~~ | ~~Bump to build 3~~ | **Done (25 September).** `FP_BUILD` and both screen strings read build 3, and `versionCode` is **3** in `android/app/build.gradle` on this machine (gitignored — a fresh checkout still needs it). `versionName` stays `"1.0"` |
| 4 | `npm run snapshot:data` | Current as of 20 September (the last admin edit). Re-run only if a level is edited in the admin panel before the build. Only from a networked machine — the sandbox proxy refuses the Supabase host |
| — | Bump `sw.js` | `fp-v89` as of the reset epoch; bump again if anything else bundled changes |

## 2. In the admin panel

Account ▸ Admin, on the admin account. Everything here is live for every
player on their next launch. No build, no deploy.

**What it can edit**

| Where | What |
|---|---|
| Pack ▸ *(any pack)* | Name, allowed equation class, pack rule (gravity flip), hide from all users |
| Pack ▸ *(any level)* | Opens the studio: name, score goal, equation goal, hint, the explainer popup, whether players may set bounce, the spawn, the stars, every object, pre-placed equations. Export and import a level as JSON |
| Manage achievements | Every achievement — kind, thresholds, name, description, hide. Add new ones |
| Manage users | Grant premium |
| Audit leaderboard | Review submitted runs |

**Outstanding**

| # | What |
|---|---|
| 2 | Re-tune anything closed testing found. Goals are the common case and they live here |
| 3 | Raise *Impossible?* (`stars_210`) if a hidden pack is ever released. 210 is 70 levels × 3 — release more and the achievement stops meaning "a perfect game" |
| 1d | Unhide Trigonometry, Exponential, Inversion and Roman VI–X once they are authored. All are empty today — v2, not a launch blocker |

## 3. In Supabase

| # | What |
|---|---|
| 36 | **Apply `supabase/migrations/20260921_delete_account_completely.sql`.** Not applied as of 25 September — the `profiles_delete_auth_user` trigger does not exist. Until it is, the app's Delete account leaves the email, password hash and `purchases` row behind while the live `delete-account` page says they go. Server-side only, no build: the app already deletes the profile last, `purchases` cascades from `auth.users`, and `profiles_delete` only lets a player delete their own row |
| — | Delete the `stripe-webhook` edge function. There is no Stripe provider (checklist 10c), and it is deployed with JWT verification off |
| 16 | **Reset progress, scores and times for everyone, once Build 3 is live.** `select public.reset_all_progress();` in the SQL editor. It bumps `game_state.reset_epoch` and deletes every `level_scores` and `progress` row; each Build 3 device clears its own copy the next time it reaches the server and keeps saving locally from there. Premium, purchases and names are untouched. **Run it only after Build 3 has reached the testers:** Build 2 knows nothing of the epoch, so from the moment of a reset every save it makes is refused with a sync-error toast until it updates. Play made offline after a reset and before the device next connects is cleared with the rest |
| — | Optional hardening: `anon` and `authenticated` hold `TRUNCATE` and `REFERENCES` on the public tables, which is a Supabase default. PostgREST cannot issue either, so nothing is reachable — but they buy nothing and could be revoked |

**Checked and clear:**

- **5 / 8b — secrets (25 September).** `GOOGLE_SERVICE_ACCOUNT` and both halves
  of `REFUND_SWEEP_SECRET` are set: the nightly `play-refund-sweep` passes the
  function's own check and reaches Google, which is where it fails (§4).
- **4 — the snapshot (25 September).** Generated 10 s after the last
  `level_overrides` edit; nothing has changed since.
- **11 — the leaderboard migration is live (20 September).** `level_scores_guard`
  plus the three `level_scores_stars_*` triggers exist, and `sync_total_stars`,
  `admin_set_premium` and `void_purchase` are all present.
- **13 — the RLS sweep passes (20 September).** RLS is on for all ten tables.
  Overrides and `news` are read-all / admin-write; `progress` and
  `push_subscriptions` are owner-only; `level_scores` inserts and updates only
  as `auth.uid() = user_id` and deletes own-or-admin; `client_errors` is
  insert-for-anyone, read-admin, with no update or delete path; `purchases`
  carries no policy at all, so only the edge functions' service role touches
  it. `profiles` has SELECT, INSERT and DELETE policies and **no UPDATE** —
  read-only to clients, as intended. The table holds no email, so the open read
  policy leaks nothing; and the whole admin gate rests on
  `profiles.name = 'Test Account'`, which holds because `profiles_name_lower_key`
  makes the name unique case-insensitively and no client can UPDATE one.
- **14 — email confirmation is off (20 September).**

## 4. In Google Cloud and Play Console

| # | What |
|---|---|
| ~~5~~ | ~~Enable the Google Play Android Developer API~~ | **Done (25 September).** Google now answers — with *insufficient permissions* (next row) |
| 5 | **Give the service account its Play permissions.** Google refuses the sweep with "The current user has insufficient permissions to perform the requested operation." Play Console ▸ Users and permissions ▸ the service account ▸ **Account permissions**: *View financial data, orders and cancellation survey responses* and *Manage orders and subscriptions*, with the app included. Changes can take up to 24 h to reach the API |
| 5 | **Make a test purchase** as a licence tester once the API is on. The first end-to-end run of `play-verify`; a row should appear in `purchases` and the account should show Premium |
| 26 | Replace the uploaded screenshots with `store-assets/screenshots/01`–`08`, in that order |
| — | Confirm the listing's **In-app purchases** answer reads **Yes**, and that `premium_lifetime` is **active**, not draft |
| — | Upload Build 3 to the closed track, then apply for production access and roll out staged, ~20% first |

**Done:** 30 and 27b (Data safety), 28 (content rating re-take), the product,
the service account and its Play permissions, licence testing.

## 5. On the website

| # | What |
|---|---|
| 38 | **The homepage still describes closed testing.** It says "Not on Google Play yet — it is entering closed testing", shows a "Soon on Google Play" badge, and offers the APK as the way to install. Point it at `https://play.google.com/store/apps/details?id=app.functionplane` the day production goes live |

**Done:** 17 — `privacy`, `terms` and `delete-account` are served byte-identical
to `legal/` (checked 25 September).

## 6. On your machine

| # | What |
|---|---|
| — | Build and upload Build 3: `npm test`, `npx cap sync android`, `gradlew bundleRelease`. Steps in [`COMMANDS.md`](./COMMANDS.md) |
| 11c | Deferred. Russian writes arrived normally on 20 September; run `fp-probe.bat` across two ISPs for a few days before buying anything. Background in [`NETWORK-ACCESS.md`](./NETWORK-ACCESS.md) |

**Done:** 21 (keystore backed up offline), 31 (low-end device pass).

## 7. After launch

Each of these needs a client change, so each costs a build.

| # | What |
|---|---|
| 11c | The Russia relay, if the probe data justifies it. See section 6 |

### 34 — reset epoch (done 25 September)

A reset could not stick: `level_scores_guard` refuses to lower a record,
`_mergeProgress` resolves every field toward the better value, and
`_syncProgressDown` uploads the merge. It is now an epoch — see *Resets* in
[`ABOUT.md`](./ABOUT.md). The open questions were settled as:

- **Everything is cleared**, stars included, so offline unlocks and
  `profiles.total_stars` never disagree. Premium is not progress and stays.
- **Global only.** A per-player "reset my progress" would need its own value.
- **Offline, a device keeps playing on its old progress** and cannot upload
  it. When it next reaches the server it clears everything, including play
  made after the reset, which is the price of never resurrecting an old record.

## Known and accepted

- **46 of the 70 levels have no recorded answer**, so `npm run verify:levels`
  replays 24. All 70 have been played by hand, so nothing is unclearable
  today — but a future physics change has no automated check over those 46.
  Recording answers into `levels/*.json` is the fix, and it can happen any
  time; it ships nothing.
- **`r-V-9` *The finale* is `70/4` on purpose.** Four equations cost 80 at the
  floor, so the score goal cannot be met at the full equation budget. The
  stars are independent: a four-equation run still takes the clear star and
  the equation star. Tightening it to `70/3` would take that second star away.

## Not required for launch

iOS (needs a Mac and an Apple developer account), native push notifications,
daily levels, the reset-password deep link into the app, and server-side
replay verification of leaderboard scores.
