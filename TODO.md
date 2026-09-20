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
| 5 | **Decide on Play Billing** | `capacitor-plugin-cdv-purchase` is not installed, so `FP_BILLING.available()` is false and the premium card hides itself — a build without it sells nothing and has no dead button. Adding it later is always another upload. |
| 29 | **`FP_STORE_LINKS.android`** | Empty in `src/store-config.js`. Paste `https://play.google.com/store/apps/details?id=app.functionplane` — it follows from the appId, so it does not have to wait for the listing to exist. Until it is set, Rate shows the "not on the store yet" popup. |
| 23 | **Bump the version** | `versionCode`, `versionName`, `FP_BUILD` in `store-config.js`, and the `v 1.0 · build N` string on the main and settings screens. `npm test` fails if they drift. |
| 4 | **`npm run snapshot:data`** | The last content step, after every admin-panel edit is final. Only from a networked machine — the sandbox proxy refuses the Supabase host. More than a new `Generated:` line means the database moved since. |
| — | Bump `sw.js` | `const CACHE = 'fp-vNN'`. Web players stay on the old app otherwise. |

Anything the phone pass turns up that is a *code* problem also lands here. A
level that cannot be cleared because of its goals does not — that is §2.

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
| 8b | `REFUND_SWEEP_SECRET` in two places, or the nightly Play refund sweep does nothing |
| 5 | `GOOGLE_SERVICE_ACCOUNT` secret — only if billing ships |
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
| 30 | Data safety ▸ App info and performance ▸ **Crash logs**: collected, not shared, not linked to the user. Not yet ticked |
| 26 | Re-capture the screenshots against the authored boards. Re-shoot the sandbox with curves on the plane before using it at all |
| 28 | Re-take the content rating questionnaire — only in the release that ships billing, where the digital-goods answers change |
| 5 | Create the **`premium_lifetime`** product at €4.90 — only if billing ships |
| — | Once build 1 clears review: copy the opt-in link from the track's Testers tab, get to 12+ opted-in testers, hold 14 continuous days, then apply for production access. Roll out staged, ~20% first |

## 5. On the website

| # | What |
|---|---|
| 17 | **The live site still serves the 4 May privacy text.** Hand `legal/WEBSITE-AGENT-PROMPT-PRIVACY-UPDATE.md` plus `privacy.html` and `delete-account.html` to the website agent. Then fetch all three pages and compare the served HTML against `legal/` — a previous deploy returned the homepage with a 200, so a status code proves nothing |

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
