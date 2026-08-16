# Design review — menus & level UI

A read of the shipped screens (`main-screen`, `pack-selector`, `level-selector`,
`level-screen`, `level-complete`, `how-to-play`, `settings-screen`) against
what the code actually does. Findings are ordered by how much they cost a real
player, not by how hard they are to fix. Each one names the file and a
concrete solution.

Nothing here has been implemented — this is the analysis. `npm test` is green
at 42 passed on this branch, unchanged.

The visual language itself is strong and unusually coherent for a hobby
project: one type pairing used consistently, a real token system, safe-area
handling everywhere, no stock UI-kit smell. Most of what follows is about
*information* and *feedback*, not about taste.

---

## 1. Progression is gated far harder than the content supports

**Where:** `data.jsx:computePackLocked`, the shipped `overrides-snapshot.js`.

Roman pack N unlocks at **27 of 30 stars in pack N−1** — 90%. Three stars on a
level requires meeting `eqGoal`, and *every authored level in Pack I has
`eqGoal: 1`*. So the gate between the tutorial pack and the second pack is:
solve at least seven of ten levels with a **single equation**, including
level 9 (four stars to collect) and level 10 (five stars).

That is a mastery requirement placed at the point where a new player is still
learning what `y = 0.5x - 1` does to a ball. The star economy compounds it:
the score-based 2-star tier is nearly free by comparison (score goals run
30–60), so the distribution is bimodal — players cluster at 2 stars per level,
which caps them at 20/30 and locks Pack II permanently.

Two thresholds sit downstream of the same problem: `SPECIAL_UNLOCK_STARS` asks
for 100 total stars for Trigonometry and 150 for Exponential, against a
realistic visible ceiling that most players will never approach.

**Solution.** Decouple "can I move on" from "have I mastered this".
- Drop the roman gate from 27 to ~18/30 (60%) — clearing every level at 2
  stars should open the next chapter. 3-star hunting stays as the replay loop
  it's designed to be, rather than the price of admission.
- Alternatively keep 27 but make it *stars OR levels cleared*: `have >= 18 ||
  clearedCount >= 9`. That's a two-line change in `computePackLocked` and
  removes the hard stop without touching authored goals.
- Re-scale `SPECIAL_UNLOCK_STARS` to the new curve (roughly 30 / 60 / 90).

This is the single highest-impact change in the review — everything else is
polish by comparison.

---

## 2. Five of seven visible packs are the same level ten times over

**Where:** `data.jsx:getLevelData` → `LEVELS._default`; `pack-selector.jsx`.

`npm test`'s own coverage report says it: 20 of 70 visible levels are authored.
Packs III (Curves), IV (Geometry), V (Mastery), Linear and Trigonometry have
**zero** authored rows, so every one of their ten levels falls back to
`LEVELS._default` — identical ball at (−3, 5), identical three stars,
identical `scoreGoal: 40, eqGoal: 1`.

The menus actively hide this. `PackSelector` renders those packs with distinct
names, distinct `MiniGraph` previews and a "0/30" counter that implies content.
`LevelSelector` gives all ten rows names from `LEVEL_NAMES` — and since that
array is indexed by level, not by pack, "Warm-up" and "First slope" appear in
*every* pack. A player who fights through the Pack I gate is rewarded with the
same puzzle thirty more times under five different names.

**Solution.** Let the UI tell the truth until the content exists.
- Treat "no authored row for level 0" as unreleased: render the pack card with
  a "Coming soon" state instead of a lock, and make it non-navigable. This is
  a `getLevelData`-adjacent helper plus a branch in `PackRow`/`SpecialPackCard`
  — no data migration.
- Or set `is_hidden` on r-III/IV/V and s-trig in `pack_overrides`, which the
  admin panel already supports and which `visiblePacks()` already honours. That
  is a five-minute fix and correctly shrinks the "/210" header total.
- Independently: `LEVEL_NAMES[levelIndex]` reused across packs is a bug in its
  own right. Fall back to `Level N` when there's no authored name, rather than
  to a name that belongs to a different pack's level.

---

## 3. The in-app back buttons corrupt the Android back stack

**Where:** `app.jsx:navigate` / `navigateBack`.

`navigate()` pushes the current screen onto `navStackRef` before switching.
Every in-app back button calls `navigate('main')` / `navigate('packs')` rather
than `navigateBack()`, so **going back pushes a forward entry**.

Walk it: main → packs pushes `main`. Tap the ← in the pack selector →
`navigate('main')` pushes `packs`. The stack is now `[main, packs]` and you're
on main. Press the Android hardware back button and the app navigates *forward*
into the pack selector instead of exiting.

Deeper journeys are worse — main → packs → levels → level → back → back → back
leaves six entries, and the hardware button walks the player forward through
their entire session history. The stack also grows without bound.

`ABOUT.md` already warns "Navigate only via `navigate()` / `navigateBack()` or
the back button gets confused"; the screens are using the wrong one of the two.

**Solution.** Point every backward affordance at `navigateBack()` and let the
stack pop. Where a screen needs a specific destination rather than "wherever I
came from" (`AdminScreen` → account, say), add a `navigateBack(fallbackRoute)`
that pops if the stack is non-empty and otherwise navigates fresh. Roughly:

```js
const navigateBack = (fallback) => setNav(curr => {
  const prev = navStackRef.current.pop();
  return prev || (fallback ? { route: fallback, pack: null, levelIndex: 0, legalKind: null } : ROOT);
});
```

---

## 4. Nothing in the app responds to being touched

**Where:** `styles.css` reset; every inline `<button>` style.

`button { -webkit-tap-highlight-color: transparent }` removes the platform's
default press flash, and nothing replaces it — there is no `:active` rule, no
hover state, and no transition anywhere in the stylesheet. Combined with the
deliberate removal of haptics, a tap on Play, on a pack row, on a keyboard key
produces **zero** feedback until the resulting screen paints.

On a math keyboard where players type dozens of characters per level, that is
the difference between "responsive" and "did that register?". It is also the
cheapest fix in this document.

**Solution.** Two rules in `styles.css`, no per-component work:

```css
button { transition: transform .08s ease, opacity .08s ease; }
button:active:not(:disabled) { transform: scale(0.97); opacity: 0.82; }
```

Consider exempting the keyboard keys from `scale` (a shrinking key under a
fingertip reads oddly) and giving them a background flash instead.

---

## 5. The level HUD hides the two numbers that decide the run

**Where:** `level-screen.jsx` — HUD row, `GoalChip`, the `missMsg` overlay.

Three separate gaps, all in the same 40px strip:

**a. The 28-second time limit is invisible.** `TIME_LIMIT = 28` silently ends
the run. The Time chip shows elapsed while running and *best time* while
idle — the same slot, two different meanings, no label distinguishing them. A
ball that settles into a slow roll (which the traction model guarantees:
it glides forever rather than stopping) hits the limit with no warning.

**b. Failures don't say why.** `failed` is true for either "fell below
`FALL_LIMIT`" or "ran out of time", and both print `Collect all stars!` —
which is the goal, not the reason.

**c. The star rating you're currently earning is never shown.** The two
`GoalChip`s state the thresholds (`score ≤ 40`, `≤ 1 eq`) but never light up.
`liveScore` and `eqsUsed` are both already computed one scope away; the player
does the comparison in their head every time they edit a row.

**Solution.**
- Time chip: render `12.4 / 28s` while running and turn it amber past ~22s.
  Label the idle state `Best` so the two readings are distinguishable.
- Give `missMsg` a reason string: `'Out of time'` when `elapsedS > TIME_LIMIT`,
  `'The ball fell off'` on `FALL_LIMIT`, keep the class warning as-is.
- Make `GoalChip` take `met`, and pass `eqsUsed <= eqGoal` / `liveScore <=
  scoreGoal`. Filled stars and ink text when met, hollow and muted when not.
  The HUD then answers "what am I getting if this works" before Play is pressed.

Related: the top bar shows previous-best stars in an unlabelled pill while the
HUD shows *collected* stars as `0/3`. Two different star meanings, 30px apart,
neither labelled. Label the pill `Best`.

---

## 6. The plane can be squeezed to nothing while typing

**Where:** `level-screen.jsx:EquationsPanel` (`maxHeight: 'none'` when a
keyboard is open), and the flex column in `LevelScreen`.

When a keyboard opens, the panel's height cap is removed so rows and keys both
fit. But the panel is a normal flex child (`flex-basis: auto`) and the plane is
`flex: 1` with `minHeight: 0` — so the panel claims its full content height
first and the plane gets whatever remains, which on a short screen with several
equation rows is close to zero.

Typing an equation is exactly when a player most wants to see the curve move.
The comment above the `maxHeight` line says "the graph area shrinks to
accommodate" — the issue is that there is no floor on how far.

**Solution.** Give the plane container `minHeight: '28vh'` (or `flex: '1 1
28vh'`). The panel becomes the scrolling region when space runs out, which is
already the intended behaviour — the rows list is `overflow-y: auto`.

---

## 7. Dead ends and untruths in the menus

Small, individually cheap, collectively the difference between "polished" and
"unfinished".

| Where | Problem | Fix |
|---|---|---|
| `pack-selector.jsx:LockedPackPopup` | **"Upgrade to Premium" calls `onClose`.** The primary, visually dominant button in the only monetisation surface a free player reaches does nothing. | Thread a callback up to `App` and `navigate('account')` with the premium view open. |
| `settings-screen.jsx` | **"Show grid labels" is a dead toggle.** `settings.gridLabels` is written to storage and read by nothing — `CoordPlane` always draws `tickLabels`, and `LevelScreen` never passes `settings` down to it. | Pass `gridLabels` through `PlaneFiller` → `CoordPlane` and gate `tickLabels`, or remove the row. |
| `pack-selector.jsx:PackRow` | Locked roman packs say **"Complete previous pack"** while `lockInfo` already carries `have`/`need`/`prevPackName`. The number only appears after you tap. | Render `12/27★ in Foundations` on the row itself. Same for `SpecialPackCard`, which has `totalStars` in scope and ignores it — show `40/100★`, not `100★ to unlock`. |
| `pack-selector.jsx` (both cards) | `Math.round(stars / 10)` fills all three summary stars at 25/30, so an incomplete pack reads as complete. | `Math.floor`. |
| `level-complete.jsx` | The Stars readout is `{totalStars}/{totalStars}` — literally always "3/3", since you cannot win without collecting them all. Next to a 1–3 star rating, it reads as a contradiction. | Replace with the rating (`2/3 stars`) or the equation count used — the actual variable in the run. |
| `level-complete.jsx` | **"Next level" is shown on level 10**, where `onNext` actually returns to the level list. | Label it `Back to levels` when `levelIndex === 9`. There is also no direct route to the level list from the popup on any other level — the scrim just resets the sim. |
| `index.html` | The splash is hard-coded `#0e0f10` and `theme-color` is dark, but the default theme follows `prefers-color-scheme`. Light-mode users get a dark splash that flashes to a light app. | Wrap the splash colours in a `prefers-color-scheme` media query. |

---

## 8. How to play is wrong about scoring

**Where:** `how-to-play.jsx` vs `equation-classifier.js` / `computeScore`.

The per-class points table is accurate. The prose around it is not:

- *"Score = base 20 + sum of equation complexity points"* — the base is **20
  per equation**, not 20 per run (`complexity + active.length * 20`). The card
  contradicts itself four lines later with "Each equation also adds 20 pts
  overhead", which is the correct version.
- *"applies a ×1.5 composition bonus"* — the multiplier is **×1.3**
  (`score = Math.round(score * 1.3)`), and only when a transcendental meets a
  degree ≥ 2 polynomial.
- The **+60% per additional transcendental** rule (`totalTrans > 1`) is the
  single biggest cost driver in practice and isn't mentioned at all.
- Three classes are missing from the table: rational (30), piecewise (20), and
  unparseable (60 — worth stating, since it's the penalty for a typo).
- The star rules are listed as three independent criteria. `starRating` is a
  **ladder**: `eqsUsed <= eqGoal` → 3, else `score <= scoreGoal` → 2, else 1.
  You can take 3 stars while blowing the score goal. Phrase it as tiers.

**Solution.** Correct the four numbers and reframe the star card as a ladder.
Since level goals were tuned against these exact values, the doc should follow
the code — do not adjust the code to match the doc.

---

## 9. Smaller level-UI notes

- **Initial framing uses a guessed viewport.** `CoordPlane`'s auto-zoom effect
  runs on mount, when `PlaneFiller` still reports its `{w:360, h:300}` default;
  the `ResizeObserver` corrects the size afterwards but the effect doesn't
  re-run. Add `width`/`height` to the dependency list with a "framed once"
  ref guard.
- **With auto-zoom off, a level can open with the ball off-screen** — the view
  starts at origin/scale 40 and the reset button also returns to origin rather
  than to the level. Make the crosshair button *frame the level* (bump
  `autoZoomTrigger`); "reset to origin" is almost never what's wanted, and
  `how-to-play` documents the current behaviour faithfully enough that both
  should change together.
- **Nothing validates authored ball positions against `FALL_LIMIT = -13`.** A
  level authored with `ball_y < -13` fails the instant it starts. Worth a guard
  in the admin editor.
- **Equation rows start empty** though essentially every one begins `y=`.
  Pre-filling `y=` on `addRow()` (caret at the end) removes two taps per
  equation. The `Σ` key already inserts a full template (`sum(1,5,n*x)`) while
  `d/dx` inserts only `deriv(` — worth making consistent either way.
- **Stop discards the trail.** `handlePlay`'s stop branch clears `trail`, so a
  player who stops a run to inspect what happened loses exactly the diagnostic
  the trail exists to provide. Keep it until the next Play.

---

## Suggested order

1. §1 progression gate and §2 placeholder packs — these decide whether anyone
   sees the rest of the game.
2. §3 back-stack and §7 dead premium button — correctness bugs with visible
   symptoms.
3. §4 press feedback and §5 HUD — highest polish-per-line in the review.
4. §6, §8, §9 — cleanup.

Items 3–8 are all small and self-contained; the two content items are product
decisions rather than code.
