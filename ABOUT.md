# ABOUT.md

Everything about the Function Plane project: what it is, how it's built, how
the pieces fit together, and what's left to do. Working agreements — code
style, the checks to run before calling a change done — live in `CLAUDE.md`.

## What this is

**Function Plane** is a mobile-first math puzzle game: players write equations
(`y = f(x)`, implicit `F(x,y) = 0`, sums, derivatives, integrals) to build a
track that guides a bouncing ball through a set of stars on a coordinate
plane. Fewer/simpler equations score higher.

Shipped three ways from one codebase, no per-platform forks:

- **Web PWA** — the `function-plane/` folder, deployed to Cloudflare Pages at
  **https://functionplane.pages.dev**.
- **Android** — the same PWA wrapped in a [Capacitor](https://capacitorjs.com)
  WebView shell, shipped as an APK/AAB. See `MOBILE-BUILD.md`.
- **iOS** — planned; `@capacitor/ios` is installed but the `ios/` folder has
  never been generated (needs a Mac + `npm run cap:add:ios`).

Backend is **Supabase** (auth, database, storage). There is no bundler and no
server of our own — the app is static files talking to Supabase over HTTPS.

## Architecture & the one build gotcha

React and ReactDOM are loaded as UMD `<script>` tags from local vendor files
(`function-plane/vendor/`), not npm, not a CDN. UI is written in **JSX** but
compiled ahead of time with `scripts/build-jsx.js` (`@babel/core` +
`@babel/preset-react`, `runtime: 'classic'` → emits `React.createElement`),
because the Capacitor Android WebView cannot run runtime Babel reliably:
`<script type="text/babel" src="...">` XHR-fetches and evals each file, and
that silently fails on some Android WebView versions. CDN scripts with SRI
checks break too. Precompiled local JS is the only combination that's worked
across browser, Android WebView, and iOS WebView.

> **Every `.jsx` file in `function-plane/src/` is pre-compiled to a `.js` file
> next to it. After editing any `.jsx`, run `node scripts/build-jsx.js` (or
> `npm run build:jsx`) and commit BOTH files.** `index.html` loads the `.js`
> versions, never the `.jsx`. Editing only the `.jsx` will appear to do
> nothing. It's idempotent and takes ~2 seconds — safe to re-run any time.

Not every `.js` file has a `.jsx` sibling — some are hand-written plain JS
with no source to compile from: `physics-engine.js`, `equation-classifier.js`,
`overrides-store.js`, `accounts.js`, `audio.js`, `physics-config.js`,
`supabase-config.js`, `premium-config.js`. **Never hand-edit a `.js` file that
has a `.jsx` sibling** — the next `build:jsx` run silently overwrites it.

Script load order is fixed in `function-plane/index.html` (config files →
vendor → `accounts.js` → data/store → screens → `app.js`, which must load
last because it calls `ReactDOM.createRoot(...).render(<App/>)`). Globals are
attached to `window` (`FP_AUTH`, `FP_DATA`, `FP_PHYSICS`, `LevelScreen`,
`PREMIUM_LINKS`, etc.) rather than imported — there are no ES module imports
at runtime. A new top-level file needs three additions in lockstep: the
`<script>` tag in `index.html` (in the right position — e.g. `data.js` before
`main-screen.js` because `MainScreen` calls `getPack()` at module scope), the
`SHELL` array in `sw.js` (see below), and — if `App` renders it — a `typeof`
check in the `mount()` polling guard near the bottom of `app.jsx`
(`setTimeout(mount, 30)` until every global it needs exists; skipping this
creates a race where React tries to render a component before its script has
finished parsing).

> **Babel-version churn.** The committed `.js` files were built with an older
> Babel that escapes non-ASCII in string literals (`•`, `—`). A newer
> Babel emits those characters literally, so a full `build-jsx.js` run
> reformats ~all files with functionally-identical churn. Two implications:
> (1) for a **one-line** change, it's cleaner to edit the matching `.js` line
> directly instead of rebuilding everything (verify the hand-edit matches a
> fresh Babel build of just that region before committing — diff the two,
> normalizing `\uXXXX`/`\xXX` escapes, since that's the only churn source);
> (2) a real full rebuild will produce a large one-time reformat diff — do it
> deliberately, not mixed into a feature commit. Also note `npm install`
> fails in sandboxes: `@capacitor/assets` pulls in `sharp`, whose binary
> download is proxy-blocked. To rebuild, install only `@babel/core` +
> `@babel/preset-react` (e.g. in a temp dir) and point `NODE_PATH` at them.

## Layout

```
function-plane/            # THE deployed PWA (Cloudflare Pages serves this)
  index.html               # entry; fixed <script> load order
  sw.js  manifest.json     # service worker + PWA manifest
  vendor/                  # React, ReactDOM, Supabase JS, webfonts (no npm/CDN at runtime)
    fonts.css  fonts/       # self-hosted woff2 subsets
  src/                     # *.jsx = source, *.js = generated (build-jsx.js)
    accounts.js            # FP_AUTH — auth, profiles, is_premium, leaderboards
    overrides-store.js     # FP_DATA — boots from baked snapshot, syncs by version check
    overrides-snapshot.js  # generated dump of Supabase override tables (npm run snapshot:data)
    physics-engine.js      # FP_PHYSICS — ball collision against sampled curve geometry
    equation-classifier.js # classifyEquation/detectClass — AST-based equation analysis
    supabase-config.js     # Supabase URL + anon key + VAPID key
    premium-config.js      # Stripe Payment Link URLs (web payment path) — not filled in yet
    data.jsx               # pack/level data + lock/unlock logic
    level-screen.jsx       # graph view, equation panel, physics step loop
    admin-screen.jsx       # in-app admin (grant premium, edit packs/levels, audit leaderboard)
    sandbox-screen.jsx     # free play — same plane/panel/physics, no goals
    legal-screens.jsx      # in-app Privacy / Terms / Licenses text
    keyboard.jsx           # custom math keyboard (basic/advanced pages)
    app.jsx                # root component, routing, mount() guard
    ...                    # per-screen components
scripts/
  build-jsx.js              # JSX -> JS compiler; run after every .jsx edit
  snapshot-overrides.js     # pulls Supabase override tables -> overrides-snapshot.js
legal/                     # hostable Privacy/Terms HTML for the website (see below)
supabase/config.toml       # Supabase project config
capacitor.config.json      # native shell config (appId app.functionplane)
MOBILE-BUILD.md            # how to build the Android/iOS apps
```

`android/` and `ios/` are gitignored — recreated locally with `npx cap add
android` / `npx cap add ios` (iOS needs a Mac).

## npm scripts (run from repo root)

| Script | What it does |
|---|---|
| `npm test` | Run `scripts/test.js` — no dependencies, ~1 s. Run before every commit. |
| `npm run build:jsx` | Compile all `.jsx` → `.js`. Run after every `.jsx` edit. |
| `npm run snapshot:data` | Pull Supabase override tables → `overrides-snapshot.js`. Run before every release. |
| `npm run cap:sync` | build:jsx + copy web files into `android/` and `ios/` |
| `npm run android:build` | build:jsx + sync android + open Android Studio |
| `npm run ios:build` | build:jsx + sync ios + open Xcode (needs Mac + `ios/` folder) |
| `npm run cap:add:android` / `cap:add:ios` | Generate the native shell folder (one-time) |

Full build walkthrough (Android Studio / Xcode steps, troubleshooting) is in
`MOBILE-BUILD.md`.

## Tests (`npm test`)

`scripts/test.js` is a zero-dependency Node suite covering the things this
file says to re-check by hand. It runs in about a second — there is no excuse
for not running it before a commit.

- **Classifier** — parity table (same class *and* score as before the AST
  rewrite, since level goals were tuned against those numbers) plus the
  loophole set (implicit conics, disguised exponentials, roots, products,
  piecewise, rationals must not read as `linear`). Also extracts
  `classMatches` straight out of the shipped `level-screen.js` so pack gating
  is tested as shipped, not as a copy.
- **Physics** — free fall, resting height, no sink-through, energy loss on a
  real bounce, determinism, and the slope roll that dies instantly if the
  "`energyRetention` only when `-vn > 1.5`" gate is broken.
- **Sim clock** — that recorded times come from tick count and not the wall
  clock (see below), that 60Hz still steps exactly once per frame, and that a
  stall can't trigger unbounded catch-up.
- **Shell integrity** — every script/stylesheet in `index.html` is in `sw.js`'s
  `SHELL` and still exists, `app.js` loads last, every `.jsx` has a `.js`, and
  the screens agree on the build number.
- **Level data** — the snapshot parses, every authored level has a ball, stars
  and positive goals, and `_default`'s goal stays on the authored scale.
- **Build parity** — recompiles every `.jsx` and compares to the committed
  `.js` (escape-normalized). Skipped with a notice if `@babel/core` isn't
  installed, so it's silent in sandboxes and real in CI.

Content coverage prints as an informational report and never fails the suite —
levels are authored in Supabase while the app ships, so a gap is news, not
breakage.

Every check has been mutation-tested: breaking the energy gate, reverting the
sim clock, forgetting a `SHELL` entry, or regressing the classifier each turn
the suite red.

## Sim timing — fixed tick, never the wall clock

`level-screen.jsx`'s frame loop accumulates real elapsed time and drains it in
whole `TICK_DT` (1/60 s) ticks, and `wonAtS` / the HUD read `ph.simS`, which
counts ticks. **Never derive elapsed time from the `requestAnimationFrame`
timestamp.** It used to: the sim advanced a fixed 1/60 s per *frame* while the
recorded time came from the wall clock, so a 120Hz phone ran the game at
double speed and posted times roughly half a 60Hz phone's for identical play —
the time leaderboard ranked display hardware. At 60Hz the accumulator is
exactly one tick per frame, so stepping is unchanged from before the fix.
`MAX_TICKS` caps catch-up so a tab switch makes the sim fall behind rather than
freeze replaying lost seconds.

## Service worker — the most-forgotten step

Every time a source file is added or bundled assets change, do **both**:

1. Bump `const CACHE = 'fp-vNN'` at the top of `function-plane/sw.js`.
2. Add the new file to the `SHELL` array so it's precached.

Skipping the bump means users keep the old cached SW + old assets
indefinitely. Symptom: your change works with DevTools "Disable cache"
checked, but not on a real install or after a normal reload. When in doubt,
bump it — check `sw.js` line 1 for the current version before editing.

## Physics engine (physics-engine.js, window.FP_PHYSICS)

Collision is **sampled-geometry-based**, not analytic. Earlier versions
approximated each curve as a tangent line (explicit) or `F/|∇F|` (implicit)
evaluated at the ball's position — both blow up on high-frequency curves
(`y=sin(40x)` teleported the ball), discontinuities (`floor()` grew invisible
walls around the jump), and sharp corners (hitbox sank into `y=|x|` vertices).
Do not reintroduce that approach.

Current design:
- **Explicit `y=f(x)`**: adaptively-sampled polyline (subdivides wherever the
  curve deviates from a chord, down to a fine minimum step), cached in a
  window around the ball and resampled as it travels. The ball resolves
  against the true closest point on the polyline.
- **Implicit `F(x,y)=0`**: marching squares on a small local grid, mirroring
  the renderer's own algorithm (`CoordPlane`'s `marchingSquares`) — physics
  collides with what's actually drawn.
- **Discontinuity policy**: "collide with what's drawn." A small jump
  (`floor()` risers) renders as a solid stroke and is solid; an
  asymptote-scale jump (`tan`, `1/x`) is where the renderer lifts the pen, and
  the ball passes through the gap instead of hitting an invisible wall.
- **Response law**: reflect the inward normal-velocity component by
  `PHYSICS_CONFIG.bounciness` (`physics-config.js`), and apply
  `energyRetention` only on **real bounces** (`-vn > 1.5`), never on
  sliding/rolling contact — otherwise a ball rolling down a slope loses all
  momentum in under a second. Don't touch this gate.
- **Traction** (`PHYSICS_CONFIG.traction`) bleeds *tangential* speed while the
  ball is touching anything. It is decayed by elapsed contact **time**
  (`exp(-k*h)`), never per call, because `stepBall` subdivides a substep into
  up to 8 passes at speed: a per-call factor would make a fast ball lose 8x
  the grip of a slow one on identical geometry, and would shift the moment
  `MAX_TICKS` clamped a stalled frame. `exp(-k*h)` composes to `exp(-k*dt)`
  however the substep is cut up.
  Because the drag is proportional to speed, a ball on a slope settles at
  `gravity*sin(angle)/traction` instead of stopping — it keeps gliding
  forever, just stops accelerating forever. It only comes fully to rest where
  the surface is flat enough that gravity has no tangential pull.
- `GRAVITY = 12`, `SUB_STEPS = 20` substeps/frame, `BALL_R = 0.22` are defined
  in `level-screen.jsx`. `physics-engine.js` also micro-substeps internally at
  extreme speeds to avoid tunneling; normal speeds integrate identically to
  before the rewrite (verified bit-identical on free fall / flat-ground
  bounces / slope rolls).
- Colliders (`FP_PHYSICS.makeColliders`) are built **once per run**, not per
  frame — equations are locked while the sim is running.
- Level ends **0.5 s after the last star is collected** (`wonAtS` timestamp),
  not when the ball falls off. Recorded finish time is `wonAtS`, not the
  wind-down endpoint.

## Equation classifier (equation-classifier.js)

`classifyEquation()` (complexity score) and `detectClass()` (linear /
quadratic / cubic / trig / inverseTrig / log / exp / piecewise / rational /
advanced / unknown) are **AST-based**, not regex-based. A regex scan over the
raw string only ever saw `x^N` and missed almost everything else: `x+y^2=1`
scored as linear (y-powers invisible), `x*y=1` scored as linear (product
degree never counted), `2^x` scored as linear (only `e^` and `letter^letter`
matched), `pow(x,7)` scored as linear (`pow()` never matched), `sqrt(x)`
scored as linear (roots invisible), `abs(x)`/`floor(x)` scored as linear
(piecewise invisible) — all of which let players sneak disallowed equation
types past themed-pack restrictions (`allowedClass`) and get underscored.

The classifier now tokenizes the expression with the same conventions as the
runtime parser (`normExpr` in `level-screen.jsx`: implicit multiplication,
`arcsin→asin` aliases, `π`, `**`/`^`) and walks a real parse tree: polynomial
degree is tracked through `+ - * / ^` in **both x and y** (so implicit conics
classify correctly), constant subtrees fold numerically (`sin(1)*x` is linear,
`e^2` is just a number), and variable exponents, roots, rationals
(`1/x`-style), and piecewise ops (`abs`/`floor`/`ceil`/`round`/`min`/`max`)
each get their own class so they can't hide inside a themed pack. Scoring
reproduces the pre-rewrite formula exactly on everything it used to get
right — level goals and past records tuned against those numbers stay
meaningful. Unparseable input classifies as `'unknown'` (blocked by
`classMatches` in any themed pack) and scores conservatively high, never low.

If you touch this file, re-run it against both a parity check (same score/
class as before on ordinary expressions) and a loophole check (implicit
conics, disguised exponentials, roots, products, piecewise, rationals must
NOT read as linear) before trusting a change.

## Level data: baked snapshot + versioned sync

Levels/packs/achievements are defined by Supabase `*_overrides` tables, but
the app does **not** trust the network for them:

- `function-plane/src/overrides-snapshot.js` is a **generated** dump of those
  tables, committed with the app. **Run `npm run snapshot:data` before each
  release** (needs network access to Supabase) and commit the result — it
  keeps offline boots playing the *real* levels instead of the easy built-in
  fallbacks (which was an exploitable way to farm stars/records).
- At boot, `overrides-store.js` (`window.FP_DATA`) synchronously applies the
  newer of (snapshot, localStorage cache of the last fetch), then does a
  cheap background version check (per-table row count + max `updated_at`, a
  few hundred bytes) and only downloads the full tables when something
  changed.
- Never make override fetches "fail to empty" — `FP_AUTH.fetchOverrides`
  deliberately throws on errors so bad networks can't wipe good local data.
- Leaderboards (`FP_AUTH.buildLeaderboard`) cache raw server rows for 3 min
  and fall back to the last-known board when offline.

## Level & pack data / unlock logic

- Base data lives in `data.jsx` (`LEVELS`, `ROMAN_PACKS`, `SPECIAL_PACKS`).
  Supabase overrides (`FP_LEVEL_OVERRIDES`, `FP_PACK_OVERRIDES`) merge in at
  runtime via `applyOverrides()` (called by `overrides-store.js`, not
  fetched directly by screens).
- **Pack unlock**: Roman pack N unlocks at **27/30 stars (90%) in pack N-1**
  (`computePackLocked` in `data.jsx`); pack I is always unlocked. Themed packs
  unlock at total-star thresholds in `SPECIAL_UNLOCK_STARS`. Premium/admin
  accounts bypass all pack locks.
- **Level unlock** (inside an already-open pack, `level-selector.jsx`): level
  0 is always playable; level `i` unlocks once level `i-1` has `stars >= 1`.
  Do **not** gate level 0 on `stars[0] !== null` — a freshly-unlocked pack's
  star array is still all-`null` (nothing played yet), and gating on that
  locked every level including the first, with a nonsensical "Clear level 0
  first" message. Pack-level gating already happened one screen up.
- **Star totals shown in the UI** (`pack-selector.jsx`) must be computed over
  *visible* packs only (`visiblePacks()`) — a hidden/unreleased pack must not
  inflate the "earned / possible" header total. The *unlock-threshold* total
  (how many stars you need to open a themed pack) is a separate calculation
  and correctly counts **all** packs including hidden ones, since
  `computePackLocked` does the same — don't accidentally unify these two.
- Themed packs enforce equation class via `allowedClass` (linear / quadratic
  / trig / exp); enforcement runs in `level-screen.jsx`'s `classWarning` via
  `classMatches()`, which groups related classes (e.g. `exp` pack allows both
  `exp` and `log`; `trig` pack allows both `trig` and `inverseTrig`).

## Sandbox (sandbox-screen.jsx)

Free play: graph anything, run the ball, no goals and nothing recorded. It
reuses `PlaneFiller`, `EquationsPanel` and `physicsStep` exported from
`level-screen.js` rather than reimplementing them, so the ball behaves exactly
as it does in a level — a lookalike would drift the first time physics
changed.

Stars and the spawn are **fixed objects you move**, not things you scatter by
tapping: select one from the chip row or grab it on the plane, then drag it or
type coordinates. Dragging snaps to a quarter unit so a drag lands on a round
number. Tapping empty space still pans, so editing never fights navigation —
`CoordPlane` hit-tests in *pixels* (26px), which keeps a star grabbable when
zoomed far out. Editing is disabled while a run is in flight.

The view frames the objects once on entry and never again: re-framing on Play
would discard a view the player deliberately composed. The run ends when the
ball leaves the world or a 30s clock expires; collecting every star just makes
the noise.

Reached from the main screen, directly under the Play card — the second thing
you can do sits under the first, outlined rather than filled so it reads as
subordinate to Play instead of competing with it.

## Ball rendering vs the drawn curve

The physics rests the ball *exactly* `BALL_R` from a curve's true centreline —
measured, not assumed. But an SVG stroke straddles its path, so the curve
covers `EQ_STROKE/2` px either side of that centreline and the ball's own
outline reaches `BALL_OUTLINE/2` px past its radius. Drawing the ball at the
full `BALL_R * scale` therefore *looks* like it is sunk into the line by about
2px even though the simulation is perfect. `br` subtracts both half-strokes so
the ball's edge kisses the top of the stroke, which is what resting on a line
looks like. If either stroke width changes, that subtraction has to follow —
which is why they are named constants rather than literals.

## Ball path trace

Every run records the ball's position every third tick (20/s, so a full run
stays under 200 points) and the path stays on screen once the run ends. A
failed attempt otherwise tells the player nothing about *why* it failed. It is
drawn as one path under a gradient anchored to the path's own two ends — not
to the ball, which resets to its start on failure and would collapse the
gradient to zero length — so the end of the run is the most visible part.
Cleared when the next run starts.

## Custom math keyboard

- Native mobile keyboard is suppressed via `inputMode="none"` on equation
  inputs.
- `MathKeyboard` (`keyboard.jsx`) has two pages: `basic` (sin/cos/log/digits)
  and `advanced` (arcsin, Σ, d/dx, ∫, the `n` loop variable).
- Domain-restriction inputs use a separate `NumPad` (in `level-screen.jsx`)
  that opens when the user taps a domain value button — needed because
  `<input type="number">` can't reliably suppress the native keyboard on
  Android, and two custom keyboards can't be open/covering each other.
- When any keyboard is open, `EquationsPanel` sets `maxHeight: 'none'` so
  both the equation rows and the keyboard fit; the graph area shrinks to
  accommodate.

## Splash screen (index.html)

Non-obvious timing:
- Held at `opacity: 0` for `revealDelay = 500 ms` — a fast boot never flashes
  the splash.
- Once revealed, stays visible for at least `minVisible = 350 ms` so it
  doesn't blink out.
- Hidden only when **both** `document.fonts.load(...)` and the first React
  render complete.
- Hard fallback: `setTimeout(hide, 7000)` prevents a stuck splash on slow
  networks.

Fonts are **self-hosted** in `vendor/fonts/` (latin subsets, latin-ext for
Geist since it renders player display names). They used to come from
fonts.googleapis.com, which meant the native app rendered its cold first
launch in a fallback face — the WebView has no network then — and leaked every
player's IP to Google. Apart from Supabase the app now contacts nobody, which
is what the privacy policy claims, so **don't reintroduce a CDN font link**.
Adding a weight means adding the woff2 to `vendor/fonts/`, a rule to
`vendor/fonts.css`, and the file to `sw.js`'s `SHELL` (`npm test` checks the
last one).

If you change fonts, update the `document.fonts.load(...)` calls in
`fontsReady()`.

## Supabase & entitlement model

- Table `profiles` holds `id` (PK, FK to `auth.users`), `name` (unique,
  case-insensitive), `avatar`, `total_stars`, and **`is_premium`**.
- `FP_AUTH.isPremium()` reads that flag; `data.jsx`/`computePackLocked`
  unlocks **all packs** when it's true (admins also get full access for
  testing).
- Premium is **account-based, not device-based** — buying on any channel and
  logging in anywhere grants access everywhere. Whatever payment path is
  used, the job is always the same: flip `is_premium` on the user's profile
  (server-side).
- Admins can grant premium manually today via the in-app admin screen
  (Manage users / grant premium). This is the current interim mechanism.
- **Admin identity**: there is exactly one admin account — the profile whose
  `name` is exactly `Test Account` (case-sensitive, no trailing spaces),
  checked by `isAdmin()` in `accounts.js`. Overrides-table RLS policies key
  off this same string. Don't hard-code additional admins in application
  code — expand via the DB/RLS if that's ever needed.
- Other tables: `progress` (`user_id` PK, `data` JSONB — the whole progress
  blob, `updated_at`), `level_scores` (`(user_id, pack_id, level_index)`
  composite PK, `best_score`, `stars`, `best_time` — drives per-level
  leaderboards), `pack_overrides` (`pack_id` PK, `name`, `allowed_class`,
  `is_hidden`), `level_overrides` (`(pack_id, level_index)` composite PK,
  `ball_x`, `ball_y`, `stars` JSON, `score_goal`, `eq_goal`, `preplaced` JSON,
  `name`), `achievement_overrides` (`id` PK, `kind` — one of `ACH_KINDS` in
  `achievements.jsx` — `name`, `description`, `threshold`, `pack_id`,
  `level_index`, `is_hidden`), `push_subscriptions` (`endpoint` PK,
  `user_id`, `keys`). Schemas live in the Supabase dashboard, not this repo.
  RLS: users read/write only their own rows; overrides tables restrict writes
  to the `Test Account` profile.
- A database that hasn't had the latest migration applied is missing newer
  `level_scores` columns (`best_time`, `equations`). An upsert naming a
  missing column fails wholesale, so `_uploadProgress` in `accounts.js` drops
  whichever column the error names and retries — scores keep saving, the
  dependent feature just stays dark until the migration runs.

## Leaderboard integrity

Clients write their own `level_scores` rows, so anyone with devtools could
once post any score, star count or time. Full verification means replaying the
physics server-side; short of that, two layers do the useful work.

**The database refuses the impossible.** `supabase/migrations/` holds
`20260816_leaderboard_integrity.sql`, which adds a `before insert or update`
trigger rejecting a `level_index` outside 0–9, stars outside 1–3, a score
under 30 (the cheapest winning run is one linear equation: complexity 10 plus
20 per equation), a score under `30 × equation count`, and a time outside
0.05–30 s (`TIME_LIMIT` is 28). It also makes the **server** decide what
"best" means — `least`/`greatest` against the stored row — so a client cannot
walk a record backwards and a stale offline sync cannot clobber a better
result. A 2-star claim whose score misses `score_goal` is *clamped* to 1 star
rather than rejected, because rejecting would make retuning a level's goals
lock every existing record holder out of syncing. RLS restricts writes to
`auth.uid() = user_id`, keeps reads public (the leaderboard is public by
design), and lets the `Test Account` delete anyone's row.

**The app catches the plausible-but-false.** Scoring runs through the
classifier, which SQL has no access to, so each row also carries the
`equations` that produced its best score. *Admin → Audit leaderboard*
recomputes every submission with the same `computeScore`/`starRating` the game
uses and flags rows whose score doesn't match their equations, whose
equations don't parse, or which use a class the themed pack forbids — with a
Remove button. Star mismatches are flagged amber, not red: a row holds a
personal best, and a 3-star run using more equations can score worse than a
2-star run using fewer, so the stored equations aren't necessarily from the
run that earned the stars. That is detection, not prevention; prevention needs
a deterministic server-side replay, which the fixed-tick sim clock now makes
possible.
- If the app is unreachable after inactivity, check the Supabase dashboard —
  a free-tier project **auto-pauses after ~7 days** and needs a manual
  restore. A paused project doesn't refuse connections, it stops answering
  them, which is why every network call in `accounts.js` goes through
  `_withTimeout` (10 s): `fetch` has no default timeout, so an unanswered
  request leaves its promise pending forever and any spinner waiting on it
  stays up for good. A leaderboard that fails with nothing cached emits
  `fp-sync-error` so the reason reaches the player, instead of showing
  "No scores yet" — which reads as fact when the truth is "couldn't ask".

## Progress data shape (localStorage + Supabase `progress.data`)

```js
{
  "r-I":  { stars: [3,3,2,-1,...], best: [180,220,310,...], bestTime: [1.2,...], maxScore: [220,...] },
  "r-II": { stars: [null, null, ...], best: [...], bestTime: [...], maxScore: [...] },
  "s-lin": { ... },
  ...
}
```

- `stars[i]`: `null` = locked, `-1` = unlocked but unplayed, `1..3` = rating
  earned.
- `best[i]`: **lowest** score used to win (lower = better rating).
- `bestTime[i]`: **fastest** win time in seconds.
- `maxScore[i]`: **highest** score used in a winning run (drives the "beat a
  level with a 100+ pt equation" achievement). Older exports may lack this
  field — handle with `?? null`.

Merging (`accounts.js`'s `_mergeProgress`) takes max of stars/maxScore, min
of best/bestTime.

## Achievements

**Every achievement is a data row** — there is no such thing as a hard-coded
one any more, so the admin panel edits all of them through a single editor.

- `BUILTIN_ACH_ROWS` in `achievements.jsx` ships 17 rows in exactly the shape
  the `achievement_overrides` table uses.
- `getAchievementRows()` merges a matching override row over each built-in,
  taking **only the fields the override actually sets** — a row stores `null`
  for every param its kind doesn't use, and those nulls must not wipe the
  built-in's own threshold. Custom rows (ids not among the built-ins) are
  appended.
- `buildAchievement(row)` turns a row into `{ id, name, desc, check }` using
  its `kind`, and returns null if the kind is unknown or a required param is
  missing. `getAchievementList()` is the filtered, built list the UI renders.

Editing a built-in in the admin panel writes an override row with the same id;
**Reset to default deletes that row** and the shipped values come back. A
built-in's id is not editable — changing it would orphan every unlock recorded
against it and resurrect the default alongside it. `is_hidden` works on
built-ins too, which is how an achievement is retired without deleting
anyone's history.

`ACH_KINDS` is the fixed set of predicate templates (nothing is ever eval'd):
`total_stars`, `total_levels`, `pack_complete`, `pack_full_gold`,
`any_pack_complete`, `any_pack_gold`, `all_roman_packs`, `themed_level`,
`any_3stars`, `min_score`, `score_over`, `time_under`, `time_over`. Time
thresholds are stored in **milliseconds** because the column is an integer; a
kind can set `thresholdLabel` and the editor labels its input accordingly.

Adding a mechanic = add a kind here; the editor picks up its `needs`
automatically. Unlock toasts are driven by `app.jsx`'s effect on
`[progress, overridesRev]`.

## Capacitor / WebView gotchas

- `Cap.Plugins.App.addListener(...)` return shape varies: Capacitor 6 returns
  the handle synchronously, older bridges wrapped it in a Promise. `app.jsx`
  handles both (`typeof ret.then === 'function'`) — follow that pattern for
  any new listener.
- Hardware back button is hooked in `app.jsx`: pushes navigations onto
  `navStackRef` and pops on Android back press, falling back to `exitApp()`
  at the root. Navigate only via `navigate()` / `navigateBack()` or the back
  button gets confused.
- No `type="text/babel"`, no CDN scripts, no runtime eval — the WebView fails
  silently on all three.
- Haptics have been **removed** — do not re-add without an explicit user
  request; there's a history of them not working reliably on this project.

## Legal / privacy (Google Play requirement)

Google Play requires the privacy policy at a **public URL**, not just in-app.

- Source of truth for the text is `function-plane/src/legal-screens.jsx`
  (`PRIVACY_TEXT`, `TERMS_TEXT`). `LEGAL_PUBLISHER = 'Nikolay Yaremko'` and
  `LEGAL_WEBSITE = 'https://functionplane.pages.dev'` are set — don't revert
  either to a placeholder.
- Hostable standalone pages live in `legal/` (`privacy.html`, `terms.html`)
  and are **deployed on the website** at:
  - https://functionplane.pages.dev/privacy.html
  - https://functionplane.pages.dev/terms.html
- `legal/WEBSITE-AGENT-PROMPT.md` is the handoff prompt used to deploy them
  to the separate website repo.
- Support: functionplane.support@gmail.com.

> The website Terms (`legal/terms.html`) intentionally use **store-neutral**
> billing wording (not "Google Play handles billing") because the game sells
> via both Google Play and the web. If you touch `TERMS_TEXT` in
> `legal-screens.jsx`, keep it store-neutral to match.

## Roadmap / left to do

### Payments — dual path + environment detection *(planned, not built)*

The game will be distributed on **both** Google Play and the open web, and
the two channels require different, mutually exclusive payment systems:

- [ ] **Google Play Billing** — required for the Play Store build. Google
      forbids Stripe/external payment for digital goods, and Play Billing
      does **not** work on sideloaded / web-downloaded installs. Verify
      purchases and flip `is_premium`. RevenueCat
      (`@revenuecat/purchases-capacitor`) is the recommended integration; a
      RevenueCat→Supabase webhook (Edge Function) sets the flag. Must
      include a **Restore purchases** button.
- [ ] **Stripe (web / sideloaded)** — already scaffolded in
      `premium-config.js` (`PREMIUM_LINKS`, currently all empty strings) and
      `account-screen.jsx`'s `PremiumView`. Allowed everywhere **except**
      inside the Play Store build. A Stripe webhook (Supabase Edge Function)
      sets `is_premium`.
- [ ] **Environment detection** — the app must show the correct buy button
      per channel: **Play Billing inside the Play build**, **Stripe on
      web/sideload**. Never show Stripe links inside the Play Store build
      (Google anti-steering). Detect via Capacitor platform + Play Billing
      availability. Both paths converge on the same `is_premium` write, so
      screen logic downstream is unchanged.
- [ ] iOS equivalent uses StoreKit (RevenueCat covers it in the same
      integration).

### Other pre-launch / v2 items

- [ ] **Haptic vibration on iOS** — `navigator.vibrate` is a no-op on iOS
      WebKit; would need `@capacitor/haptics`. Low priority (haptics were
      removed project-wide, see above) — only revisit on explicit request.
- [ ] **Native push** via `@capacitor/push-notifications` + FCM/APNs (Web
      Push SW scaffolding already exists).
- [ ] **Reset-password deep link** so the email link opens the *app* rather
      than the website. Resetting already works: `resetPassword()` in
      `accounts.js` sends players to
      `https://functionplane.pages.dev/auth/reset`, a page on the website
      that handles the recovery token and calls `updateUser({ password })`.
      The app itself has no set-a-new-password screen, and the native shell's
      origin (`https://localhost`) can't receive an email redirect, which is
      why the page lives there. To hand the link back to the app instead,
      register App Links / Universal Links via `assetlinks.json` /
      `apple-app-site-association` (recommended over a custom
      `app.functionplane://` scheme), build the password screen in-app, then
      repoint `redirectTo` and add the URL under Supabase → Authentication →
      URL Configuration → Redirect URLs.
- Done already: `LEGAL_WEBSITE` set to the public site URL; Android hardware
  back button (`@capacitor/app`); haptics removed; webfonts self-hosted;
  password-reset redirect pointed at the website page.

## Non-obvious files worth knowing about

- `function-plane/src/physics-engine.js`, `equation-classifier.js`,
  `overrides-store.js` — hand-written plain JS, **no `.jsx` source**. Edit
  them directly; there's no compile step to remember, but also no
  auto-regeneration to catch a hand-edit mistake.
- `function-plane/src/premium-config.js` — feature-flag stub for premium
  (`PREMIUM_LINKS`); billing isn't wired up yet (see Roadmap).
- `function-plane/src/audio.js` — Web Audio synth for SFX, no sample files.
- `function-plane/vendor/` — vendored React/ReactDOM/Supabase, plus the
  self-hosted webfonts (`fonts.css` + `fonts/*.woff2`). If you
  upgrade React, update the license text in `legal-screens.jsx` too.

## Deployment quick reference

| Target | How |
|---|---|
| Android APK | `npm run android:build` → Android Studio → Build APK |
| Cloudflare Pages | Push to `main`; build-output directory is `function-plane`, root directory blank, no build command. Setting both to `function-plane` produces a 404 (looks in `function-plane/function-plane/`). |
| iOS TestFlight | Needs Mac. `npm run cap:add:ios` (first time), then `npm run ios:build` → Xcode → Archive → Upload |

Full walkthrough (prerequisites, device testing, troubleshooting) is in
`MOBILE-BUILD.md`.

