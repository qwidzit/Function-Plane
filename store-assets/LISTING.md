# Play Console listing copy

Draft text for checklist item 25, plus the exact answers for the Data safety
and content-rating forms (items 27 and 28). Everything here is written to be
literally true of the shipped app — if you change the app, change this.

Assets that go with it are in this folder:

- `feature-graphic-1024x500.png` — the required feature graphic.
- `screenshots/` — ten 1080×1920 phone screenshots captured from the running
  app against the authored levels. Play takes 2 to 8: upload `01` to `08` in
  file order, gameplay first. `09-howtoplay` and `10-achievements` are spares.

- `icon-512.png` — the 512×512 app icon the Console asks for, resized from
  `assets/icon.png`. `@capacitor/assets` only writes mipmaps up to 192px, so
  this one is generated separately; regenerate it whenever the source art
  changes.

---

## Title

> **Function Plane**

14 of 30 characters. If you want the keyword in the title:
`Function Plane: Math Puzzle` (27 characters).

## Short description

> **Draw curves with real equations and roll a ball through every star.**

67 of 80 characters.

## Full description

> **Function Plane is a puzzle game about functions.**
>
> Every level gives you a ball, a set of stars, and an empty coordinate plane.
> Your job is to write the equations that build a track between them — then
> press Play and watch gravity do the rest.
>
> **Type maths, not levels.**
> `y = sin(x)` makes a wave. `x² + y² = 25` makes a circle. `y = 0.5x - 1`
> makes a ramp. Anything you can write, you can roll a ball down: polynomials,
> trigonometry, logarithms, exponentials, absolute values, sums, derivatives
> and integrals. Restrict a curve's domain to turn it into a platform.
>
> **Fewer equations, better score.**
> Clearing a level earns one star. Coming in under the score goal earns two.
> Solving it within the equation budget earns three. There is almost always a
> shorter answer than the one that worked — the game is really about finding
> it.
>
> **A real physics sandbox underneath.**
> The ball collides with the curve you actually drew, not an approximation of
> it — sharp corners, staircases from `floor(x)`, high-frequency waves and
> asymptotes all behave the way they look. There is a free-play Sandbox mode
> with no goals, where you can move the ball and the stars anywhere and graph
> whatever you like.
>
> **Compete, or don't.**
> Per-level leaderboards for both lowest score and fastest time, and a global
> star ranking. Playing signed out is fully supported — progress is kept on
> your device.
>
> **What's not in it.**
> No advertisements. No trackers or analytics. No advertising ID. Nothing is
> shared with third parties. The whole game is bundled in the app, so it plays
> offline and contacts nothing but its own account server.
>
> Made for anyone who liked graphing calculators more than they expected to.

Fits well inside the 4000-character limit.

> [!NOTE]
> **Before you publish:** if you want a level count in the description, add it
> only once the levels are actually authored (checklist item 1). The current
> draft deliberately claims no number.

## Categorisation

| Field | Value |
|---|---|
| App or game | **Game** |
| Category | **Puzzle** (alternative: Educational) |
| Tags | puzzle, brain game, education, maths |
| Price | Free |
| Contains ads | **No** |
| In-app purchases | **No** for the first closed-testing build. Becomes Yes only when Play Billing ships (checklist item 5) — one product then: lifetime unlock, €4.90. |
| Email | functionplane.support@gmail.com |
| Privacy policy | https://functionplane.pages.dev/privacy.html |

---

## Data safety form (item 27)

Answer exactly this. Every line is true of the app as it stands.

**Does your app collect or share any of the required user data types?** Yes.

**Is all of the user data collected by your app encrypted in transit?** Yes
(HTTPS to Supabase only).

**Do you provide a way for users to request that their data be deleted?** Yes —
`https://functionplane.pages.dev/delete-account.html`

### Data types to declare

| Type | Collected | Shared | Optional? | Purpose |
|---|---|---|---|---|
| Personal info → **Email address** | Yes | No | Yes — account is optional | Account management |
| Personal info → **User IDs** (display name) | Yes | No | Yes | Account management, app functionality |
| App activity → **In-app actions** (level progress, scores, times) | Yes | No | Yes | App functionality (cross-device sync, leaderboards) |
| App info and performance → **Crash logs** | Yes | No | No — sent automatically | App functionality (diagnosing faults) |
| Financial info → **Purchase history** | Yes | No | Yes — buying is optional | App functionality (keeping and restoring the unlock) |

**Crash logs are not linked to a user.** Answer *No* to "Is this data linked to
a user's identity?" — the report carries the message, the trace, the screen and
the build, and no account, name or device identifier. See `error-log.js`.

**Purchase history is linked to a user, and is only declarable once billing
ships.** The `purchases` table holds one row per verified purchase — the
store's token, the product, an order reference, when it was bought and whether
it was voided — keyed on `user_id`, which is what lets Restore return the
unlock on another device. So: *Collected* yes, *Shared* no, *Processed
ephemerally* no, *Linked to a user's identity* **yes**, *Users can choose
whether it is collected* **yes** (buying is optional), purpose **App
functionality**. Card details, billing address and every other payment
credential stay with Google Play and never reach us, so none of that is
declarable here. Drop this row again if a build ever ships without billing.

### Declare NOT collected

Location, health, messages, photos/videos, audio, files,
calendar, contacts, device or other IDs, **advertising ID**. Under *Financial
info*, everything except Purchase history — no payment info, no credit score,
no other financial info. Under *App info and performance*, **Diagnostics** and
**Other app performance data** are not collected either — only Crash logs
above.

### Other declarations

| Declaration | Answer |
|---|---|
| Ads | No ads |
| Government app | No |
| Financial features | None |
| Target audience | 13+ — do **not** tick any under-13 age band, the privacy policy sets 13 as the floor |
| Designed for Families | No |
| News app | No |
| COVID-19 / contact tracing | No |
| Data-sharing with third parties | None |

---

## Content rating questionnaire (item 28)

Category: **Game**. Every substantive question answers **No** — no violence, no
sexuality, no profanity, no controlled substances, no gambling or simulated
gambling, no user-generated content shared between users, no unrestricted
internet access.

Two that need care:

- **Does the app let users interact or exchange content?** The leaderboard
  shows other players' chosen display names. That is not messaging, but if the
  questionnaire asks whether users can share content with each other, the
  honest answer is that they see each other's names and scores only.
- **Does the app share the user's location with other users?** No.

Expected outcome: PEGI 3 / ESRB Everyone / IARC equivalent.

---

## Release notes for the first closed-testing build

> First closed test build. The full level set is still being written — packs
> III onward currently repeat a placeholder level, and that is what most of the
> testing window is for. Everything else is feature-complete: accounts,
> leaderboards, achievements, sandbox mode and offline play all work.
>
> Please report anything that crashes, anything that reads wrong, and any level
> that feels unfair. Thanks for testing.
