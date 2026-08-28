# Play Console — "Finish setting up your game"

Copy-paste answers for every task in the Console's setup checklist, in the
order the Console lists them. Each answer is true of the app as it stands
(`app.functionplane`, versionCode 1). If you change the app, change this.

Store listing copy, the Data safety table and the content-rating detail live in
[`LISTING.md`](./LISTING.md) — this file is the click-through order and the
answers to the screens that file does not cover.

---

## 1. Privacy policy URL

```
https://functionplane.pages.dev/privacy.html
```

Live and byte-identical to `legal/privacy.html`. It names the data collected
(display name, email, progress), names Supabase as the only processor, states
the 13+ floor, and links account deletion — everything the Data safety form
below declares.

## 2. App access ("Is any part of your app restricted?")

**All functionality is available without special access.**

Every level, the sandbox, settings and the leaderboards work signed out;
progress is kept on the device. An account is optional and unlocks only
cross-device sync and leaderboard entry. Nothing is behind a paywall either —
premium skips the star-based pack unlocks, it does not gate content.

The admin panel is the one exception, and it is not user-facing: the button
only renders for the account whose display name is `Test Account`, display
names are unique, and the Supabase policies check the same name server-side.
Reviewers do not need it to see the whole game. If you would rather declare it
anyway, add one restricted item named "Admin panel" with those credentials and
the instruction "Account ▸ Admin".

## 3. Ads

**No, my app does not contain ads.**

There is no ad SDK, no advertising ID, and no ad network in the bundle. The
game ships all its own code, fonts and images and contacts nothing but
Supabase.

## 4. Content rating

Email: `functionplane.support@gmail.com` · Category: **Game**

Answer **No** to every substantive question — violence of any kind, sexuality,
profanity or crude humour, controlled substances, horror or fear themes,
gambling and simulated gambling, and unrestricted internet access (the app
opens no arbitrary web content).

Three that need a moment:

- **Do users interact or exchange content?** No. There is no chat, no
  messaging, no shared user content. If the form instead asks whether users can
  *see* content other users provide, the honest answer is yes and it is
  display names and scores on a leaderboard, nothing else.
- **Does the app share the user's location with other users?** No. Location is
  never collected.
- **Does the app offer digital purchases?** No for this build — Play Billing is
  not implemented yet. Flip it to Yes and re-take the questionnaire in the same
  release that ships billing.

Expected result: PEGI 3 / ESRB Everyone / USK 0 / IARC 3+.

## 5. Target audience and content

**Age groups:** 13–15, 16–17, 18 and over. Do **not** tick any band under 13 —
the privacy policy sets 13 as the floor, and ticking a younger band pulls the
app into Designed for Families with its own policy set.

**Could your store listing unintentionally appeal to children under 13?** No.
The listing art is typographic, the copy is about equations, and there are no
child-directed characters, mascots or themes.

**Designed for Families:** not enrolled.

**Ads in an app targeting under-18s:** none, so nothing further applies.

## 6. Data safety

Full data-type table in [`LISTING.md`](./LISTING.md#data-safety-form-item-27).
The screen's own questions:

### Account creation

**Username and password** — that one box, nothing else.

`register()` in `function-plane/src/accounts.js` is the only sign-up path:
display name, email, password (min 6), straight into Supabase `signUp`. There
is no OAuth provider, no magic link or one-time password, no two-factor,
no biometric and no SSO in the codebase. Password reset by email is account
recovery, not a way to create one.

### Account deletion

URL: `https://functionplane.pages.dev/delete-account.html`

The page documents both routes — in-app (account chip ▸ Delete account,
immediate) and by email to `functionplane.support@gmail.com` within 30 days for
users who can no longer sign in — and itemises what is deleted against what
survives in backups. Deleting the account deletes all of its data; there is no
partial-deletion path to declare.

Worth confirming in Supabase before you rely on this answer: the in-app delete
removes the `progress`, `level_scores` and `profiles` rows and trusts
`profiles.id -> auth.users` to be `ON DELETE CASCADE` for the auth row itself.
If that FK does not cascade, the email address outlives the deletion and this
answer stops being true.

### The rest of the screen

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** — HTTPS to Supabase only |
| Do you provide a way for users to request that their data be deleted? | **Yes** — `https://functionplane.pages.dev/delete-account.html`, and in-app at Account ▸ Delete account |
| Is any of this data processed ephemerally? | No |
| Is data collection required to use the app? | **No — optional**, on all three types. The game is fully playable signed out |

Declare exactly three types, all *collected*, none *shared*, all *optional*:

- **Personal info ▸ Name** — the chosen display name, shown publicly on
  leaderboards. Purposes: App functionality, Account management.
- **Personal info ▸ Email address** — sign-in and password reset. Purposes:
  Account management.
- **App activity ▸ Other in-app actions** — level progress, best scores, best
  times. Purposes: App functionality.

Declare **not collected**: location, financial info, health and fitness,
messages, photos and videos, audio, files and docs, calendar, contacts, search
history, installed apps, crash logs, diagnostics, and **device or other IDs**
including the advertising ID. (Revisit crash logs and diagnostics only if
crash reporting ever ships.)

## 7. Government apps

**No, my app is not a government app.**

## 8. Financial features

**My app doesn't have any financial features.**

Premium is a one-off unlock of already-earnable content, not a financial
product: no lending, no banking, no payments to third parties, no crypto, no
insurance or investment. Nothing here changes when Play Billing ships — Play
Billing is not a "financial feature" in this form's sense.

## 9. Health

**My app doesn't have any health features.** No health data, no medical
claims, no fitness or wellness tracking, no health research.

## 10. App category and contact details

| Field | Value |
|---|---|
| App category | **Puzzle** |
| Tags | Puzzle, Brain games, Education, Casual (max 5) |
| Email | `functionplane.support@gmail.com` |
| Website | `https://functionplane.pages.dev` |
| Phone | leave blank — optional, and it is shown publicly |
| External marketing | opt out unless you want Google promoting the app |

## 11. Store listing

All copy is in [`LISTING.md`](./LISTING.md); assets are in this folder.

| Field | Source |
|---|---|
| App name (30) | `Function Plane` |
| Short description (80) | `Draw curves with real equations and roll a ball through every star.` |
| Full description (4000) | `LISTING.md` ▸ *Full description* |
| App icon (512×512, 32-bit PNG) | `icon-512.png` |
| Feature graphic (1024×500) | `feature-graphic-1024x500.png` |
| Phone screenshots (min 2) | `screenshots/` — suggested `01-main`, `05-run`, `04-level`, `03-levels`, `06-howtoplay`, `08-sandbox` |
| Tablet screenshots | optional; skipping them limits tablet visibility, nothing else |
| Video | none |

Do not put a level count in the description until the levels are authored
(release checklist item 1), and re-capture the screenshots then — the current
set shows placeholder levels.

---

## Two things to decide before you submit

**In-app purchases.** Declare **No** for now: the Play build has no Play
Billing, so there is nothing to buy. The premium screen still renders in the
native build and shows prices behind a "purchases aren't switched on" dialog.
That is policy-safe — it never opens a Stripe link on the `play` channel — but
it reads as broken to a reviewer. Hiding the premium entry when
`FP_PAY_CHANNEL === 'play'` is a small change and the cleaner v1.

**Countries and testers** come after this checklist, on the closed-testing
track. Nothing in this file changes for them.
