# What's left

Everything still to do, grouped by **where you do it**.
[`RELEASE-CHECKLIST.md`](./RELEASE-CHECKLIST.md) is the same work grouped by
area, with the history of how each item got to where it is; the numbers below
point back at it.

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
| 16 | Wipe progress, scores and times. **Do it the day you send the opt-in link**, not now — anything played between now and then would land on the board you just cleaned |
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
| 17 | **The live site still serves the 4 May privacy text**, and the repo copy has moved on twice since. Hand `legal/WEBSITE-AGENT-PROMPT-PRIVACY-UPDATE.md` plus `privacy.html` and `delete-account.html` to the website agent — the prompt now carries the purchase disclosure as change 6. Then fetch all three pages and compare the served HTML against `legal/`: a previous deploy returned the homepage with a 200, so a status code proves nothing. I cannot check this from here — the egress proxy blocks the domain |

## 6. On your machine

| # | What |
|---|---|
| 21 | **Back the keystore up offline.** Nothing else on this page is irreversible |
| 31 | Test on a real low-end device: frame rate, touch targets, the custom keyboard, cold-start offline |
| 11c | Writes from Russia never arrive — GETs answered, zero POSTs received. Not a code problem. The ~€3/mo fix is in [`NETWORK-ACCESS.md`](./NETWORK-ACCESS.md). Verify a candidate host answers a POST from that network before paying for more than a month |
| — | Build and upload: `npm test`, `npx cap sync android`, `gradlew bundleRelease`. Steps in [`COMMANDS.md`](./COMMANDS.md) |

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
