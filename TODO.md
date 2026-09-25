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
> **Blocking production:** the Google Play Android Developer API is switched
> off in the service account's Cloud project, so no purchase can be confirmed
> (§4). No test purchase has been made yet — `purchases` is empty.
>
> **Deferred past launch (§7):** the Russia relay, whose premise stopped
> reproducing, and the reset epoch — unless it goes into Build 3.

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
| 34 | Reset epoch — optional | Only if the closed-test records should not carry into production. Decide first; detailed in §7 |
| ~~23~~ | ~~Bump to build 3~~ | **Done (25 September).** `FP_BUILD` and both screen strings read build 3, and `versionCode` is **3** in `android/app/build.gradle` on this machine (gitignored — a fresh checkout still needs it). `versionName` stays `"1.0"` |
| 4 | `npm run snapshot:data` | Current as of 20 September (the last admin edit). Re-run only if a level is edited in the admin panel before the build. Only from a networked machine — the sandbox proxy refuses the Supabase host |
| — | Bump `sw.js` | `fp-v88` as of the build 3 bump; bump again if anything else bundled changes |

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
| 16 | ~~Wipe progress, scores and times.~~ **Does not work as written — see 34.** A server-side wipe is undone by any device that still holds local progress: `_syncProgressDown` merges remote with local, local wins on every field, and the merge is uploaded straight back (`accounts.js:168`) |
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
| 5 | **Enable the Google Play Android Developer API** in Cloud project 1096366903282 — the one the service account belongs to. Blocks every purchase |
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
| 34 | **A reset epoch, so records can actually be cleared.** Detailed below — or in Build 3, if the decision is made in time |
| 11c | The Russia relay, if the probe data justifies it. See section 6 |

### 34 — reset epoch

**Goal.** The server can reset leaderboard records and have it stick, while a
player's device keeps enough progress to stay playable offline. Today neither
half is true: a reset cannot be made to stick, and the only thing that would
make it stick is deleting what the player needs offline.

**Three things block it, two of them silently.**

1. `level_scores_guard` clamps every downward write:
   ```sql
   new.best_time := least(old.best_time, new.best_time);
   new.stars     := greatest(old.stars, new.stars);
   ```
   Postgres `least()` ignores NULLs, so `update level_scores set best_time =
   null` reports rows updated and changes nothing. The guard is right to do
   this — it is what stops a client posting a worse run — but it means no
   reset can come in over the normal write path.
2. `_mergeProgress` (`accounts.js:216`) resolves every field toward the better
   value: `if (ta === null) return tb`. A cleared server field loses to any
   local value.
3. `_syncProgressDown` (`accounts.js:168`) merges remote with local, writes
   the merge to disk, then `_scheduleUpload`s it. A tester signing in does not
   merely ignore the reset — it **restores and re-uploads** the old records.

**Sketch.** A monotonic `reset_epoch` on the server; the client stores the
last epoch it has applied. When the server epoch is ahead, the client takes
the reset branch instead of merging: clear the record fields, keep the
entitlement fields, store the new epoch, upload the cleared state. Offline it
simply never sees a new epoch and keeps playing. The server-side clear needs a
path the guard permits — an epoch-aware exception in `level_scores_guard`, or
a `security definer` reset function — not a trigger disabled by hand.

**Decide before building:**
- What "everything" covers. Clearing `best_time` and `best_score` while
  keeping `stars` is coherent. Clearing stars too is not, unless offline
  unlocks are allowed to diverge from `profiles.total_stars`, which
  `sync_total_stars()` derives from `level_scores`, and which pack unlock
  thresholds read.
- Whether a reset is global or per-player. Global is what a leaderboard wipe
  wants; per-player is what a "reset my progress" button would want. They can
  share a mechanism but not a value.
- What an offline device shows in the meantime — its own old time, or nothing.
  A player who beats a cleared record offline and syncs later should not
  resurrect the pre-reset value.

**Why it matters beyond tidiness.** Records set before a level's board changed
are not comparable with records set after, and 75 commits of level authoring
landed between Build 1 and Build 2. Without this, the only honest reset is to
wait for old installs to disappear.

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
