# CLAUDE.md

How to work in this repository.

**Everything about the project itself — what it is, how it's built, how the
physics, classifier, level data, auth and native shells actually work, and
what's left to ship — is in [`ABOUT.md`](./ABOUT.md).** Read it before
changing anything you don't already understand; this file assumes it.

Two things live outside it: [`NETWORK-ACCESS.md`](./NETWORK-ACCESS.md) (why
writes from some countries never arrive, and what it costs to fix — not a code
problem, don't try to solve it in the app) and
[`RELEASE-CHECKLIST.md`](./RELEASE-CHECKLIST.md) (what is left before launch).

## Before calling a change done

1. **Edited a `.jsx`?** Run `npm run build:jsx` and commit **both** files.
   `index.html` loads the `.js`, never the `.jsx` — editing only the source
   looks like nothing happened.
2. **Added or renamed a file, or changed a bundled asset?** Bump
   `const CACHE = 'fp-vNN'` in `function-plane/sw.js` and add the file to the
   `SHELL` array. Skipping the bump leaves users on the old cached app
   indefinitely.
3. **Run `npm test`.** Zero dependencies, about a second. It catches the
   classifier, parser, physics, sim-clock, service-worker and build-parity
   regressions this project has actually shipped before.
4. **Touched physics, the spawn, or what an object does?** Run
   `npm run verify:levels` too. It replays every authored level's intended
   solution through the real run loop; a level authored close to a hazard can
   stop clearing over a change of a single pixel.

## Getting Babel, and never hand-editing a compiled `.js`

`package.json` pins `@babel/core` and `@babel/preset-react` at **7.29.7**, and
the committed `.js` are exactly what that version emits: run
`npm run build:jsx` on a clean tree with it and `git status` comes back empty.
So **edit the `.jsx` and rebuild, however small the change** — there is no
longer any reason to hand-edit a compiled file, and the next `build:jsx` would
silently overwrite it anyway.

`npm install` fails in sandboxes — `@capacitor/assets` pulls in `sharp`,
whose binary download is proxy-blocked. To get Babel, install
`@babel/core@7.29.7` + `@babel/preset-react@7.29.7` into a temp dir and point
`NODE_PATH` at it; `npm test` then runs the build-parity check instead of
skipping it, and prints the version it compiled with.

**Pin the version.** A different Babel reformats most files with
functionally-identical churn (non-ASCII escaping, and how props spread
compiles), so a parity failure naming a dozen files is almost always the wrong
Babel rather than real drift — check the version the test printed before
believing it.

## Conventions & code style

- Match the surrounding code: `window.*` globals, no ES module imports at
  runtime, CSS variables (`--fp-ink`, `--fp-bg`, ...) for theming, Instrument
  Serif italic for headings + Geist for body. Two-space indent, single
  quotes.
- Aliased hook destructuring at the top of each component file (e.g.
  `const { useState: useSL, useRef: useRL } = React;`) avoids collisions in
  the global-hooks world — follow it in new files.
- **No emojis** in code unless the UI legitimately displays one. **Terse
  comments only**, explaining *why* not *what* — well-named identifiers do
  the "what" job; comments are rare in this codebase and should earn their
  spot. **No premature abstraction** — a three-line helper used once stays
  inline. **No backwards-compat shims** — if a field is renamed, rename
  every caller, don't leave `// old field` re-exports.
- A `useEffect` callback must not be `async` — React only respects a
  returned cleanup function, not a returned Promise. Do the awaiting inside
  with `.then()`/an inner async IIFE instead.
- Keep code minimal — remove unused paths rather than leaving them, no
  backwards-compat cruft, no haptics without being asked.
- Keep secrets out of git (`supabase-config.js` anon key is publishable/safe;
  never commit service-role keys or Stripe secret keys — see `.gitignore`).

## Common pitfalls (learned the hard way)

- Edited a `.jsx`, refreshed, no change → forgot `npm run build:jsx`.
- A perfectly ordinary expression reads as invalid → check whether the bracket
  is closed. `normExpr` closes what was left open; a surplus `)` is still an
  error.
- Something you type lands in the wrong part of a fraction, an exponent or a
  bracket → the field is a tree (`math-field.jsx`), and every key is a call on
  it: `write`, `frac`, `sup`, `sqrt`, `backspace`. Nothing types a bare
  `/` or `^` or moves a text selection. The rules are MathQuill's — see
  *Equation field* in `ABOUT.md` — and `npm test` types the cases that have
  gone wrong before.
- Typing after a function puts the text *inside* it → that is the ghost
  bracket, and it is by design: `sin(` opens a bracket whose closer is drawn
  faint and treated as present, so `+1` typed next lands inside, exactly as
  it looks. `)` or → steps out. An exponent is the same: `a^1+x` is
  `a^(1+x)` until → leaves it. Desmos does both.
- The classifier and the runtime parser disagree about an expression → they
  are two tokenizers over the same conventions and drift is a scoring bug, not
  a cosmetic one. `x(x+1)` priced as an unknown function while the game drew a
  quadratic; `2pi` folded to a constant in one and to `p*i` in the other. If
  you change one, put the expression in `npm test` against both.
- You cannot type after the end of an expression → the root block stretches
  across the row (`flex: 1`, `alignSelf: 'stretch'`) so a tap past the last
  glyph resolves to it and seeks to its end. Anything that replaces the row's
  layout has to keep it.
- The cursor disappears somewhere → the caret is `field.cur`, a block and an
  index, and `renderBlock` draws it when its block is the caret's. A node kind
  that owns a block must list it in `kidsOf`, or the caret can move into a
  block nothing draws. `npm test` walks the caret across a set of expressions
  and counts the cursors.
- An edit ignores the selection, or leaves a stale highlight → every mutation
  starts with `cutSel()` (takes the selected nodes out, caret where they were)
  or `dropSel()`, and the replacing commands — `frac`, `sup`, `sqrt`,
  `bracket` — build around what `cutSel` returns. A new command has to do the
  same, or it inserts beside a selection that then stays drawn.
- The caret draws somewhere you cannot tap → a tap resolves through
  `data-n` on every node and `data-b` on every block, then `seek` picks a
  side by x. Give every node its `data-n`, and an empty block a size — the
  dashed slot — or it is a place on paper and nowhere on screen.
- A curve setting shows in the row but does nothing on the plane → the row's
  ⋯ settings (bounce, move, domain) are fields on the equation object, and a
  shift only takes effect through `parseEquation(expr, shift)`, which wraps
  the compiled function. Anything that builds an equation object — the panel's
  `update`, a loaded run, a studio file — has to pass the shift, and the run
  entry has to carry it (`shifts`, beside `mats`) or *Load these equations*
  brings back a curve in the wrong place.
- A second custom keyboard appears over the first → `EquationsPanel` takes
  `suppressKeyboard` for exactly this. Whoever opens a keypad outside the panel
  passes it.
- Something in the panel header runs off the edge of a narrow phone → the
  header is the tab strip against the controls, and by default neither gives.
  The strip is the part that may shrink (`minWidth: 0`, `overflowX: 'auto'` —
  a flex item will not shrink below its content without the first); the
  controls take `flex: '0 0 auto'`, because a label you scroll to beats a
  button you cannot reach. The studio's three tabs pushed Add equation clean
  off screen below about 400px, which is most phones.
- A list inside `EquationsPanel` collapses to a sliver when a keyboard opens →
  `flex: 1` has a zero basis, so it contributes nothing to the panel's own
  height. Use `flex: '1 1 auto'` with `minHeight: 0`.
- A panel or sheet is taller than the screen on desktop → `vh` is the window,
  and `#root` is capped at 844px on a desktop-width viewport. Size against the
  parent (`%`), not the viewport.
- A number field rewrites what is being typed → `Number('')` is `0` and
  `String(-0)` is `"0"`, and a `type="number"` input reports `""` for a
  half-typed `-`. In-game the answer is the `NumPad`, not a text field: it
  holds the raw string and commits only what parses. Anywhere a real `<input>`
  is unavoidable, hold a draft string, re-seed it only when the number really
  changed, and use `type="text" inputMode="decimal"`.
- Deployed a new build, users still see the old app → forgot to bump the
  `sw.js` cache version.
- New source file loads locally but not for other users → forgot to add it
  to `index.html`'s script tags AND `sw.js`'s `SHELL` list.
- Hand-edited a compiled `.js` for a "one-line fix" without checking it
  against a fresh Babel build of that region → drifted from what a real
  rebuild would produce, silent until the next full rebuild's diff.
- Added a component to `app.jsx`'s routing → forgot its `typeof` check in
  `mount()` → race condition on cold load.
- Physics feels off → check whether the "only apply `energyRetention` when
  `-vn > 1.5`" gate got broken. That gate is what keeps a ball rolling down a
  slope from dying instantly.
- A ball grinds to a halt on a slope, or behaves differently when fast →
  traction was applied per call instead of per contact-second. `stepBall`
  subdivides into up to 8 passes at speed; anything that damps velocity must
  scale with `h` (see *Physics engine* in `ABOUT.md`).
- Added a tuning knob to `PHYSICS_CONFIG` → pass it through `physicsStep` in
  `level-screen.jsx` too. `npm test` fails if the two drift, because a knob
  the game never passes is a knob the tests silently stop covering.
- Recorded times look wrong or device-dependent → something is deriving
  elapsed time from the `requestAnimationFrame` timestamp again instead of
  counting ticks (see *Sim timing* in `ABOUT.md`).
- Star/pack totals look wrong → check whether hidden packs are being counted
  where they shouldn't (earned/possible header) or excluded where they
  should be counted (unlock thresholds) — these are two different totals,
  see *Level & pack data* in `ABOUT.md`.
- A level shows the wrong stars → `stars[i]` is *how many* and `starBits[i]`
  is *which*, and they are separate fields (see *Stars* in `ABOUT.md`). Draw
  from the bits via `starBitsOf(count, bits)`; count from the count. Writing
  one without the other is how they drift.
- Wrote a maths expression that JS won't accept → `normExpr` rewrites it
  before compiling, and `fixUnaryPow` is the part that matches parentheses
  rather than patterns. `-(5*(x+1))^3` was broken for exactly that reason:
  the pattern it replaced only understood parens with nothing nested inside.
- A themed pack keeps a restriction you removed → it cannot any more, but this
  is why: `getPack` and `applyOverrides` *assign* `allowedClass`/`modifier`
  from the override row instead of patching over the built-in, so an empty
  `allowed_class` clears one. Set-only patching is what kept Geometry
  demanding quadratics after its row said otherwise.
- A themed pack lets through an equation it shouldn't (or blocks one it
  should allow) → the classifier is AST-based; check `detectClass()` in
  `equation-classifier.js` directly against the expression before assuming
  the pack-gating logic (`classMatches`) is at fault.
- Changed what an equation *costs* → the leaderboard's SQL trigger has the
  same numbers baked in (`supabase/migrations/`). If the cheapest winning run
  gets cheaper and the guard isn't migrated with it, every run at the new
  price is rejected on sync and the player silently loses the record.
- Retuned a level in the admin panel and nothing changed for players →
  the studio writes Supabase, and offline boots read
  `overrides-snapshot.js`. Run `npm run snapshot:data` and bump `sw.js`, and
  copy the new geometry back into `levels/*.json` so the draft still
  describes the level that exists.
- `npm run snapshot:data` fails from a Claude session → it always will: the
  egress proxy refuses the Supabase host (`HTTP 403 Host not in allowlist`),
  so the REST fetch never connects, while the Supabase MCP tools reach the same
  database fine. Rebuild the file from the tables read that way, then **check
  it rather than trust it**: reproduce Postgres's `jsonb` key order (by key
  length, then bytewise) and confirm it reproduces the rows already in the file
  before adding yours, and compare an md5 per row over every column against the
  same digest computed in SQL. Keep the writer's exact shape — the four comment
  lines, `Generated:` in `toISOString()` form, `JSON.stringify(…, null, 1)`,
  and the client-side sort (`localeCompare` on `pack_id`, then `level_index`).
  Say in the commit that the script could not run, so the next person re-runs
  it from a networked machine.
- `overrides-snapshot.js` disagrees with the database → someone hand-edited it
  rather than running `npm run snapshot:data`. Two tells: an `updated_at` in
  `Z` form (the file's own format is `+00:00`) and object keys in insertion
  order (Postgres normalises `jsonb` key order, so a real fetch always sorts
  them). It reads by key either way, but the version signature the app
  compares against the server is built from `updated_at`, so a fabricated one
  makes the check lie. Regenerate it; do not patch it.
- Added a pack to `data.jsx` → the same trigger has an allow-list of pack ids,
  because `profiles.total_stars` is summed from those rows. A pack it doesn't
  know is rejected on sync, which looks like "my scores stopped saving".
- Every level save from the studio fails at once → a field was added to
  `saveLevelOverride`'s patch without its migration being applied. The patch
  names every column it writes, including the ones left `null`, and PostgREST
  refuses an upsert naming a column the table does not have. Reading an
  override is the opposite — a missing key just reads `undefined` — so the
  feature looks fine until someone tries to save.
- Every achievement save from the admin panel fails at once → the same trap the
  level hint column set, one table over. `achievement_overrides` gained `score`
  (`20260919_achievement_score.sql`) for `levels_min_score`, the one kind
  needing two numbers, and the editor's patch names every column it writes,
  `score` included and always. Adding a param to `ACH_KINDS` means applying its
  migration in the same breath — and updating `ACH_SQL` in `admin-screen.jsx`,
  which is the bootstrap someone runs on a fresh project.
- `profiles` is read-only to the client. Anything that needs to write it wants
  a security-definer function (see `admin_set_premium`, `sync_total_stars`) —
  adding a column and PATCHing it from the app will fail with a permission
  error that names the table, not the column.
- A slider parameter doesn't move the curve, or moves it a frame late →
  `parseEquation` writes `window.FP_PARAMS` synchronously on purpose, and
  compiled curves read it at call time. Don't move either into an effect, and
  don't bake values in at compile time.
- A new function name doesn't parse, or parses as a product of letters →
  `normExpr` matches the *longest known name that ends the letter run before
  a `(`*, because `\b` can't separate `3sin(` from `asin(`. Add the name to
  `FN_CALLS` (runtime), `KNOWN_NAMES` (classifier) and `MF_FNS` (the field's
  text out, which brackets a fraction half unless it is one known call) or the
  three disagree.
- A level's shape outline collides with the ball → it must not. `outline` on a
  level is a list of polylines over *star indices*, drawn faintly by
  `CoordPlane` and nowhere else; it never reaches `makeRunColliders`. If you
  find yourself giving it an equation, it has stopped being decoration.
- A ball dies sooner or later than it used to → the world is sized to the
  level now: **one box** around every object, **star** and the spawn, grown by
  `WORLD_MARGIN`, inside a circle that clears the same and is at least
  `WORLD_RADIUS`. So moving a star moves the edge too. `makeWorld` takes the
  stars and the spawn for this. Keep it one box — a margin per item leaves a
  hole between any two more than two margins apart, which is exactly the flight
  path between two distant stars, and it made Tunnel vision unclearable.
  `npm run verify:levels` is the check.
- A pack should not offer hints at all → that is `noHints: true` on the pack in
  `data.jsx`, which hides the bulb; Geometry has it, because its rule is a
  shape and naming a function family would describe the wrong thing. Leaving
  the button up to answer "No hint" on every level of a pack is the thing it
  replaced. A level that is merely *missing* its hint keeps the button.
- Adding a kind of level object → it is one entry in `KINDS` (and `FORCE` /
  `INSIDE` if it acts) in `level-objects.jsx`. The engine, the plane, the
  studio's Objects tab and `getLevelData` are generic; if you find yourself
  editing them for a new kind, the registry is the wrong shape.
- An object that reads `performance.now()`, `Date.now()` or `Math.random()`
  → the leaderboard is comparing hardware again (see *Sim timing*). Objects
  are pure functions of ball position; animation belongs in the drawing.
- Gravity flips too often, or not at all → flipping is per *tick* in
  `drainTicks` and counts `ph.bounces` (real bounces only), never the
  per-frame `ph.bounced` flag. And a flipped ball needs the ceiling in
  `outOfWorld` — which it has, because that bound is radial, not a floor.
- An expression renders oddly instead of as maths → `parseText` never
  throws: a character it does not know is shown as itself, and a missing
  operand is an empty slot, not an error. Only the parser (`parseEquation`)
  may reject input, and only after the row loses focus.
- A curve material or field seems to have no effect → the studio and the
  level both pass `material` into `makeColliders` and `field` into
  `physicsStep`'s `world`; a run loop that builds its own colliders/cfg
  silently drops both. There is one tick loop — `drainTicks` — use it.
- The ball looks like it sinks into the curve → that's rendering, not
  physics: both strokes straddle their paths (see *Ball rendering* in
  `ABOUT.md`). Measure the resting distance before touching the engine.
- iOS folder mysteriously missing → it's never been generated. Needs a Mac +
  `npm run cap:add:ios`.

## When in doubt

- Read the header comments in `physics-engine.js` and
  `equation-classifier.js` — both are extensively documented at the top.
- Never hand-edit a `.js` that has a `.jsx` sibling without also updating the
  `.jsx`; the next `build:jsx` run silently overwrites it.
- Quote an expression back to the player through `MathExpr`, never as its
  source: the game teaches `x²` and `√x`, so its own copy must not show
  `x^2` and `sqrt(x)`. In `how-to-play.jsx` use `M`, which resolves `MathExpr`
  at render time because that file loads first.
- If a change touches level goals, scoring, the classifier's output, the
  spawn or what an object does to the ball, say so explicitly — past records
  and authored level goals were tuned against those exact numbers, and the
  drafts in `levels/` are the only written record of what each level was
  meant to ask for.
