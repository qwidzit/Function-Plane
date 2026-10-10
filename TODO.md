# What's left

Everything still to do, in one place. How the game works, and how it is built,
sold and released, is in [`ABOUT.md`](./ABOUT.md).

## Where the release stands — 8 October 2026

- **Closed testing is finished** (25 September). All 70 levels of the seven
  visible packs are authored and have been played by hand.
- **Premium works.** The first real purchase went through on 8 October, on
  Build 3: Play sheet, server verification, a row in `purchases`, Premium on
  the account. Builds before 3 could not sell at all — they never loaded the
  billing plugin's script, so the premium card stayed hidden.
- **Build 4 is in the repo and not yet built or uploaded.** It adds the OG
  badge on the leaderboards and the admin's grant for it, and everything the
  8 October audit found and fixed across five commits (`8dc2c38` to
  `e9ea7fd`): an offline boot after an hour no longer signs the player out,
  foreground returns no longer re-sync, π and zero-folded terms price
  correctly and uppercase names read as the runtime reads them, the
  locked-pack popup's Premium button opens the premium screen, the auth forms
  are real forms, the legal text matches the website, the service worker
  stays out of the native shell, a boot or render failure shows a reload
  button, and pre-placed curves keep their settings. `versionCode` is 4 on
  the build machine, `sw.js` is at `fp-v101`, and the level snapshot is
  current as of 7 October. The web build at functionplane-game.pages.dev
  already serves all of it.
- **Build 5 was uploaded on 9 October** to the closed track. Over Build 4
  (8 October, the audit's fixes) it adds *Pacesetter*, the achievement for
  holding the fastest time on any level's board (`my_time_firsts()`, asked
  after every score upload), bounds the Play restore query so "Checking…"
  always ends, shows the offline notice for five seconds instead of the
  whole session, and lets a level name wrap beside its badge instead of
  truncating. `versionCode` is 5, `sw.js` is at `fp-v105`. The Rate and
  Google Play buttons and the studio's Export were tapped on the installed
  build and work.
- **The refund is proven server-side** (10 October). The test order was refunded
  without the revoke option, then revoked through `orders.refund?revoke=true` in
  the API explorer; Google's voided-purchases feed never listed it, so the sweep
  now also re-checks every live ledger row with `products.get`. The first run
  voided the row and took Premium off the account. Restore on the phone then
  reported the refund. Restore on a second device, with Premium arriving, has
  not been exercised; it would need a fresh licence-tester purchase, since a
  refunded token is never granted again.
- **Database and website are already current.** Every migration through
  `20261009_stripe_purchase_integrity.sql` is applied, the dormant Stripe
  webhook is redeployed against its grant RPC, and the May APK is gone from
  the website. `best_time_at` was tested and has to stay readable (see
  *Leaderboard integrity* in `ABOUT.md`).
- **No Russia relay** (decided 7 October). Russian mobile networks hold the
  connection without a VPN; the app retries stalled uploads and tells the
  player to turn one on. See *Networks that hold the connection* in `ABOUT.md`.

## Before production, in order

| # | Where | What |
|---|---|---|
| 1 | Supabase | **Reset best times for everyone**, once the testers have a build from 3 onward: `select public.reset_times();` in the SQL editor. It stamps `game_state.times_reset_at` and clears every stored time; stars, scores and equations stay. A device on Build 3 or later drops its own pre-reset times the next time it connects and keeps any set after, even offline; since Build 4 a device clock set in the past cannot date a new time before the cutoff. Build 2 keeps saving stars and scores but its times carry no date and are dropped. It has not been run (`times_reset_at` is null) |
| 2 | Play Console | **Apply for production access**, then promote the build with a staged rollout, about 20% first |
| 3 | Website repo | **On launch day:** the homepage still says "Not on Google Play yet — it is in closed testing" and shows a "Soon on Google Play" badge (the APK download is already gone). Point it at `https://play.google.com/store/apps/details?id=app.functionplane` |
| 4 | Website repo | **The password-reset page accepts 6 characters.** `auth/reset.html` has `MIN_LENGTH = 6` and the hint "At least 6 characters"; Auth refuses anything under 8. Set both to 8. Any time |

## Any time, in the admin panel

Levels, packs and achievements are not in the build: the app syncs them from
Supabase on every boot, so an edit in Account ▸ Admin reaches every player on
their next launch. No build, no deploy.

- Re-tune anything testing found. Goals are the common case and they live here.
- Raise *Impossible?* (`stars_210`) if a hidden pack is ever released. 210 is
  70 levels × 3 — release more and the achievement stops meaning a perfect game.
- Grant or remove Premium and the OG badge under Manage users.

After editing a level, and before the next build: `npm run snapshot:data`,
bump `sw.js`, and copy new geometry back into `levels/*.json` if that pack has
a draft there.

## Every build

- `versionCode` up by one, with `FP_BUILD` and the two `v 1.0 · build N`
  strings (`npm test` checks the three in the repo agree).
- `sw.js` cache version up if anything bundled changed.
- `npm run snapshot:data` if a level was edited since the last build.

## Known and accepted

- **46 of the 70 levels have no recorded answer**, so `npm run verify:levels`
  replays 24. Nothing is unclearable today, but a future physics change has no
  automated check over those 46. Recording answers into `levels/*.json` fixes
  it and ships nothing.
- **`r-V-9` *The finale* is `70/4` on purpose.** Four equations cost 80 at the
  floor, so the score goal cannot be met at the full equation budget; the
  stars are independent, so a four-equation run still takes the clear star and
  the equation star.
- **Leaderboard scores are not replay-verified.** The database guard and the
  admin's leaderboard audit cover v1; a server-side replay is the full answer.
- **`pg_net` sits in `public`** (advisor 0014). It cannot be moved, only
  dropped and recreated, which would break the refund sweep for a warning.
- **`stripe-webhook` stays deployed and dormant**, for the day the web sells.
  It claims a session through `grant_stripe_purchase` now, the same shape as
  Play. Delete it in the dashboard if that plan is dropped.
- **Email confirmation is off** (decided 8 October). Anyone can register an
  address they do not own; the register flow assumes autoconfirm. If it is
  ever switched on, `account-screen.jsx`'s `onSuccess` needs a "check your
  inbox" state.
- **`allowBackup` is on** in the Android manifest, so the session token and
  local progress travel in device backups. Convenient; known.

## Later — not required for launch

- **The hidden packs.** Trigonometry, Exponential, Inversion and Roman VI–X are
  empty; unhide each once it is authored.
- **iOS.** Needs a Mac and an Apple developer account; purchases through
  StoreKit.
- **Reset-password deep link**, so the email link opens the app rather than
  the website. Resetting already works through the page at
  `https://functionplane.pages.dev/auth/reset`. To hand the link to the app:
  register App Links / Universal Links (`assetlinks.json` /
  `apple-app-site-association`, preferred over a custom scheme), build a
  set-a-new-password screen in the app, repoint `redirectTo` in
  `resetPassword()`, and add the URL under Supabase → Authentication → URL
  Configuration.
- **Native push** through `@capacitor/push-notifications` and FCM/APNs. The
  web-push scaffolding was removed on 8 October; start fresh.
- **Daily levels.**
- **Server-side replay** of leaderboard scores; the fixed-tick sim clock makes
  it possible. The same move — an RPC that does the upsert — is also the only
  way to hide `best_time_at`, if that ever matters.
- **Star occlusion**: a star just behind a thin curve is collected without
  crossing it. By design today; a level that wants a detour would need a
  segment test in the collection loop and a verify-levels pass.
- **A relay for Russian networks**, if players without a VPN turn out to be a
  real share of the audience. The recipe is in `ABOUT.md`.
- **Selling on the web**, which is a VAT decision before it is a code one.
- **More level rules** — ordered stars, per-level equation classes,
  speed-gated stars, one-way and breakable curves. Considered and declined for
  now; the reasoning is under *Level variety* in `ABOUT.md`.
