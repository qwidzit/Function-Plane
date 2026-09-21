# What's left

Everything still to do, grouped by **where you do it**.
[`RELEASE-CHECKLIST.md`](./RELEASE-CHECKLIST.md) is the same work grouped by
area, with the history of how each item got to where it is; the numbers below
point back at it.

> ## Where the release stands — 20 September 2026
>
> **Build 2 is signed, uploaded and live on the closed track.** `versionCode`
> 2, `versionName` 1.0, Play Billing included and verified present in the
> bundle. Closed testing is on **day 11 of the 14** Google requires.
>
> **Done:** the store product (`premium_lifetime`, one-time, activated), the
> Google Cloud service account and its key, both Supabase secrets, and licence
> testing. The test purchase itself is still to run — it is the first thing
> that exercises `GOOGLE_SERVICE_ACCOUNT` end to end.
>
> **Left:** the App content forms (§4) and the website legal resync (§5).
> Nothing left needs another build.
>
> **Deferred to Build 3 (§7):** the Russia relay, whose premise stopped
> reproducing, and a reset epoch, without which no leaderboard wipe can
> actually stick.

## First, the question that decides everything

**Levels, packs and achievements are not in the build.** `overrides-store.js`
syncs all three from Supabase on every boot and on every reconnect. The baked
`overrides-snapshot.js` only serves the first offline boot before a sync lands.

So a level goal, a hint, a pack's rule, an achievement threshold or a pack's
visibility can be changed from the admin panel at any time and reaches testers
who already installed. Only §1 needs an upload.

---

## 1. In the build

Needs `versionCode` +1 and a new AAB. Nothing else on this page does.

| # | What | Note |
|---|---|---|
| 5 | **Install Play Billing** | Decided: it ships. On your machine: `npm install capacitor-plugin-cdv-purchase` then `npx cap sync android`. Then check the merged `android/app/src/main/AndroidManifest.xml` contains `com.android.vending.BILLING` — without it the Console keeps the product page greyed out. Nothing to do in this repo; `billing.js` is already written against it. |
| ~~29~~ | ~~`FP_STORE_LINKS.android`~~ | **Done.** Set to the appId's listing URL. |
| ~~17a~~ | ~~The privacy policy had no purchase wording~~ | **Done.** The in-app copy only changes in a build, so it went in this one. The website half is §5. |
| 23 | **Bump `versionCode` to 2** | The repo half is done — `FP_BUILD` and both screen strings read `build 2`. `versionCode` lives in `android/app/build.gradle`, which is gitignored and local to you: set it to **2** before the upload. `versionName` stays `"1.0"`. It must increase on every upload, forever. |
| 4 | **`npm run snapshot:data`** | The last content step, after every admin-panel edit is final. Only from a networked machine — the sandbox proxy refuses the Supabase host. More than a new `Generated:` line means the database moved since. |
| — | Bump `sw.js` | `const CACHE = 'fp-vNN'`. Web players stay on the old app otherwise. |

Anything the phone pass turns up that is a *code* problem also lands here. A
level that cannot be cleared because of its goals does not — that is §2.

**The order that matters.** Play will not show you the in-app product page
until it has seen a build that declares the billing permission. So it goes:
install the plugin → build → upload → *then* create `premium_lifetime`,
set up the service account, add the secrets, and test as a licence tester.
The Console work in §4 marked "only if billing ships" all sits after the
upload, not before it.

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
| 3 | Raise *Impossible?* (`stars_210`) if a hidden pack is ever released. 210 is 70 levels × 3 — release more and the achievement stops meaning "a perfect game" |
| 2 | Re-tune anything the phone pass found. Goals are the common case and they live here |
| 1d | Unhide Trigonometry, Exponential, Inversion and Roman VI–X once they are authored. All are empty today — v2, not a launch blocker |

## 3. In Supabase

| # | What |
|---|---|
| 16 | ~~Wipe progress, scores and times.~~ **Does not work as written — see 34.** A server-side wipe is undone by any device that still holds local progress: `_syncProgressDown` merges remote with local, local wins on every field, and the merge is uploaded straight back (`accounts.js:168`). It clears the board only for players installing fresh, which is true at production rollout and not before. Testers already holding the app keep their records regardless |
| 5 | `GOOGLE_SERVICE_ACCOUNT` — Edge Function secret, the whole JSON key on one line |
| 8b | `REFUND_SWEEP_SECRET` in **two** places: the Edge Function secret, and the database vault via `select vault.create_secret('<same value>', 'refund_sweep_secret');`. Until both exist the nightly sweep returns without calling anything |
| — | Optional hardening: `anon` and `authenticated` hold `TRUNCATE` and `REFERENCES` on the public tables, which is a Supabase default. PostgREST cannot issue either, so nothing is reachable — but they buy nothing and could be revoked |

**Checked and clear (20 September):**

- **11 — the leaderboard migration is live.** `level_scores_guard` plus the three
  `level_scores_stars_*` triggers exist, and `sync_total_stars`,
  `admin_set_premium` and `void_purchase` are all present.
- **13 — the RLS sweep passes.** RLS is on for all ten tables. Overrides and
  `news` are read-all / admin-write; `progress` and `push_subscriptions` are
  owner-only; `level_scores` inserts and updates only as `auth.uid() = user_id`
  and deletes own-or-admin; `client_errors` is insert-for-anyone, read-admin,
  with no update or delete path; `purchases` carries no policy at all, so only
  the edge functions' service role touches it. `profiles` has SELECT, INSERT and
  DELETE policies and **no UPDATE** — read-only to clients, as intended. Two
  things worth knowing: the table holds no email (id, name, avatar,
  total_stars, is_premium, created_at), so the open read policy leaks nothing;
  and the whole admin gate rests on `profiles.name = 'Test Account'`, which
  holds because `profiles_name_lower_key` makes the name unique
  case-insensitively and no client can UPDATE one. The `profiles_insert` policy
  is dead — there is no INSERT grant, and rows come from the
  `on_auth_user_created` trigger.
- **14 — email confirmation is off.** All six accounts have
  `email_confirmed_at` within 0 s of `created_at`, which only happens on
  auto-confirm.

## 4. In Play Console

| # | What |
|---|---|
| 30 | Data safety ▸ App info and performance ▸ **Crash logs**: collected, not shared, **not** linked to the user |
| 27b | Data safety ▸ Financial info ▸ **Purchase history**: collected, not shared, **linked** to the user, optional, app functionality. New — the app keeps a purchase row against the account. Exact answers in `store-assets/LISTING.md` |
| 26 | Re-capture the screenshots against the authored boards. Re-shoot the sandbox with curves on the plane before using it at all |
| 28 | Re-take the content rating questionnaire. The digital-purchases answer is Yes now and the filed rating was taken on a No |
| — | The listing's **In-app purchases** answer becomes **Yes** |
| 5 | Create **`premium_lifetime`** at €4.90 and **activate** it — a draft product cannot be bought, including by you. Play only offers the product page once it has seen a build declaring the billing permission, so **this comes after the upload, not before** |
| 5 | Google Cloud → service account → JSON key. Play Console ▸ Users and permissions → invite that address, grant *View financial data* and *Manage orders and subscriptions*. **Allow up to 24 h to propagate** — until it does, every verification returns 401 and the app says the purchase could not be confirmed |
| 5 | Play Console ▸ Setup ▸ **License testing** → add your testers, so their purchases complete for free |
| — | Once build 1 clears review: copy the opt-in link from the track's Testers tab, get to 12+ opted-in testers, hold 14 continuous days, then apply for production access. Roll out staged, ~20% first |

## 5. On the website

| # | What |
|---|---|
| 17 | **Committed in the website repo on 21 September, not yet pushed.** `privacy.html`, `terms.html` and `delete-account.html` copied from `legal/`, and the homepage's "talks only to its own backend" now says Premium goes through Google Play. Push it, then fetch all three pages and compare the served HTML against `legal/` — a previous deploy returned the homepage with a 200, so a status code proves nothing. Only then send the App content changes for review: reviewers read the privacy URL against the Data safety form |
| 36 | **Account deletion does not delete the sign-in account.** The app deletes `progress`, `level_scores` and `profiles` but cannot touch `auth.users`, so the email, password hash and any `purchases` row (which cascades from `auth.users`) survive — while `delete-account.html` says all of them go. `supabase/migrations/20260921_delete_account_completely.sql` fixes it server-side with no build: a trigger on profile deletion removes the auth user. Written, not yet applied |

## 6. On your machine

| # | What |
|---|---|
| 21 | **Back the keystore up offline.** Nothing else on this page is irreversible |
| 31 | Test on a real low-end device: frame rate, touch targets, the custom keyboard, cold-start offline |
| 11c | **Does not currently reproduce (20 September).** `edge_logs` for `cf.country = 'RU'`, 24 h: 29 POSTs, 28 of them 2xx — `level_scores`, `progress` and `auth/v1/token` all writing. A 16,631-byte GET returned intact, above the 16,384 cap Russian ISPs apply to interfered traffic. Deferred to Build 3; run `fp-probe.bat` across two ISPs for a few days before buying anything. Only one Russian IP has ever appeared in the logs, so this proves the developer's connection works and nothing about anyone else's. Background in [`NETWORK-ACCESS.md`](./NETWORK-ACCESS.md) |
| — | Build and upload: `npm test`, `npx cap sync android`, `gradlew bundleRelease`. Steps in [`COMMANDS.md`](./COMMANDS.md) |

## 7. Build 3

Each of these needs a client change, so each costs a build. Nothing here
ships in Build 2.

| # | What |
|---|---|
| 34 | **A reset epoch, so records can actually be cleared.** Detailed below |
| 11c | The Russia relay, if the probe data justifies it. See section 6 |
| 35 | Bring `legal-screens.jsx` level with `legal/terms.html` and `legal/delete-account.html`. On 21 September the terms gained "a refund or chargeback removes Premium" and "Premium can only be bought where Google Play offers in-app purchases", and the deletion table gained the purchase record. The in-app copy has neither; its privacy text already matches |

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
