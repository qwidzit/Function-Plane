# CLAUDE.md

How to work in this repository.

**Everything about the project itself — what it is, how it's built, how the
physics, classifier, level data, auth and native shells actually work, and
what's left to ship — is in [`ABOUT.md`](./ABOUT.md).** Read it before
changing anything you don't already understand; this file assumes it.

## Before calling a change done

1. **Edited a `.jsx`?** Run `npm run build:jsx` and commit **both** files.
   `index.html` loads the `.js`, never the `.jsx` — editing only the source
   looks like nothing happened.
2. **Added or renamed a file, or changed a bundled asset?** Bump
   `const CACHE = 'fp-vNN'` in `function-plane/sw.js` and add the file to the
   `SHELL` array. Skipping the bump leaves users on the old cached app
   indefinitely.
3. **Run `npm test`.** Zero dependencies, about a second. It catches the
   classifier, physics, sim-clock, service-worker and build-parity
   regressions this project has actually shipped before.

## Editing compiled `.js` by hand

A full `build-jsx.js` run reformats ~12 files with functionally-identical
unicode-escape churn (older Babel escaped non-ASCII string contents, newer
Babel doesn't). So for a small change it's cleaner to edit the matching `.js`
region directly than to rebuild everything — but **verify the hand-edit
against a fresh Babel build of that file before committing**, normalizing
`\uXXXX`/`\xXX` escapes on both sides, since that's the only legitimate
source of difference. Never assume a raw string diff.

A real full rebuild produces a large one-time reformat diff. Do it
deliberately, in its own commit, never mixed into a feature change.

`npm install` fails in sandboxes — `@capacitor/assets` pulls in `sharp`,
whose binary download is proxy-blocked. To get Babel, install `@babel/core` +
`@babel/preset-react` into a temp dir and point `NODE_PATH` at it.

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
- Recorded times look wrong or device-dependent → something is deriving
  elapsed time from the `requestAnimationFrame` timestamp again instead of
  counting ticks (see *Sim timing* in `ABOUT.md`).
- Star/pack totals look wrong → check whether hidden packs are being counted
  where they shouldn't (earned/possible header) or excluded where they
  should be counted (unlock thresholds) — these are two different totals,
  see *Level & pack data* in `ABOUT.md`.
- A themed pack lets through an equation it shouldn't (or blocks one it
  should allow) → the classifier is AST-based; check `detectClass()` in
  `equation-classifier.js` directly against the expression before assuming
  the pack-gating logic (`classMatches`) is at fault.
- iOS folder mysteriously missing → it's never been generated. Needs a Mac +
  `npm run cap:add:ios`.

## When in doubt

- Read the header comments in `physics-engine.js` and
  `equation-classifier.js` — both are extensively documented at the top.
- Never hand-edit a `.js` that has a `.jsx` sibling without also updating the
  `.jsx`; the next `build:jsx` run silently overwrites it.
- If a change touches level goals, scoring, or the classifier's output, say
  so explicitly — past records and authored level goals were tuned against
  those exact numbers.
