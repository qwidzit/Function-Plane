# Play Console — "Finish setting up your game"

Copy-paste answers for every task in the Console's setup checklist, in the
order the Console lists them. Each answer is true of the app as it stands
(`app.functionplane`, versionCode 1). If you change the app, change this.

Store listing copy, the Data safety table and the content-rating detail live in
[`LISTING.md`](./LISTING.md) — this file is the click-through order and the
answers to the screens that file does not cover.

> **Status: all of this is filed, and build 1 was sent for review on the closed
> testing track.** Two things are easy to miss on the way there: publishing the
> release is not the same as submitting it — *Publishing overview* → **Send
> changes for review** is what actually queues everything — and the App access
> declaration below blocks that button until it carries a login.

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

**Answered Yes, with a reviewer login.**

The instinctive answer is No — sign-in is optional, every level and the
sandbox work signed out, nothing sits behind a paywall. But the Yes criteria
are about what the app *includes*, not what it gates ("account sign in
details, such as an email address, username"), and answering No leaves the
pre-review check failing with *Missing sign in details*, which blocks sending
for review at all. Filed as:

| Field | Value |
|---|---|
| Name | `Optional account sign-in` |
| Username / password | a throwaway account made through the app's own sign-up |
| Other instructions | An account is optional. All 70 levels, the sandbox and settings work signed out — tap the account chip at the top right of the main screen to sign in and see cross-device sync and the leaderboards. |

Never hand over the `Test Account` credentials: that display name is the admin
gate in both the client and the Supabase policies. Keep the reviewer account
alive and its password unchanged — a dead login is a rejection reason on later
updates, not just this one.

The old reasoning, kept because it is still what the app does:

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

## 3. Ads and advertising ID

**No ads**, and **No** to "Does your app use advertising ID?" — which hides
the purpose checkboxes that follow it.

There is no ad SDK, no ad network and no advertising ID in the bundle — the
only native dependencies are `@capacitor/core`, `@capacitor/app`,
`@capacitor/android` and `@capacitor/ios`. Any library using the advertising ID
would have to declare the `AD_ID` permission, so
`findstr /s /i "AD_ID" app\build\intermediates\*.xml` from `android` proves
it. This also has to be No for consistency with Data safety, where the
advertising ID is declared not collected.

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
- **Purchases, cash rewards, or transferable digital assets?** No to all three
  boxes. Play Billing is not implemented, so nothing in the app can complete a
  purchase; stars unlock later packs and cannot be traded, transferred or
  cashed out; there is no crypto, token or NFT anywhere in the codebase. Tick
  **Purchases of digital goods** and re-take the questionnaire in the same
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

Confirmed against the live database, and it was half wrong:

- The `progress` and `level_scores` rows do go.
- The `profiles` row **did not** — RLS was on with no DELETE policy, so the
  delete matched zero rows and reported success, leaving the display name and
  the leaderboard entry behind. Fixed in
  `supabase/migrations/20260912_star_integrity.sql` and verified.
- The **auth row still survives**, so the email address outlives the deletion.
  The cascade runs the other way (`profiles.id -> auth.users ON DELETE
  CASCADE` removes the profile when the *user* goes, not the reverse), and a
  client cannot delete an auth user — that needs the admin API from a
  server-side function. Until that exists, finish a deletion request by
  removing the user in Supabase → Authentication → Users, or narrow this
  answer.

### The rest of the screen

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** — HTTPS to Supabase only |
| Do you provide a way for users to request that their data be deleted? | **Yes** — `https://functionplane.pages.dev/delete-account.html`, and in-app at Account ▸ Delete account |
| Is any of this data processed ephemerally? | No |
| Is data collection required to use the app? | **No — optional**, on all three types. The game is fully playable signed out |

### Data types

Tick exactly five, all *collected*, none *shared*, all *optional* — the game is
fully playable signed out:

| Box | What it is | Purposes |
|---|---|---|
| Personal info ▸ **Name** | the chosen display name, public on leaderboards | Account management |
| Personal info ▸ **Email address** | sign-in credential | Account management |
| Personal info ▸ **User IDs** | the Supabase account UUID keying every row | Account management, App functionality |
| App activity ▸ **Other actions** | level progress, stars, best scores, best times — Play files gameplay under this box, not App interactions | App functionality |
| App activity ▸ **Other user-generated content** | the `equations` column on `level_scores` uploads the expression strings the player typed | App functionality |

For each of the five, Play then asks whether the data is required and why it is
collected:

| Data type | Required or optional | Purposes |
|---|---|---|
| Name | Users can choose | App functionality, Account management |
| Email address | Users can choose | Account management |
| User IDs | Users can choose | App functionality, Account management |
| Other actions | Users can choose | App functionality, Fraud prevention/security/compliance |
| Other user-generated content | Users can choose | App functionality, Fraud prevention/security/compliance |

Optional on all five because a signed-out player uploads nothing — progress
stays in `localStorage` and no Supabase call is made. Every one of these types
exists only because someone chose to make an account, and deleting it returns
them to guest play.

Fraud prevention is not padding on the two gameplay types: the database trigger
rejects impossible scores and the admin audit re-scores the submitted equations
with the real classifier to catch forged leaderboard entries
(`admin-screen.js:199`). The equations also sync back inside the progress blob
(`accounts.js:154`), which is the App functionality half.

**Analytics stays unticked on every type** — no analytics SDK, no usage
measurement, no crash reporter — as do Developer communications (password-reset
mail is account management, and there are no push notifications), Advertising or
marketing, and Personalization.

Leave everything else unticked, and know why:

- **App interactions** — no page-view, tap or session telemetry is sent.
- **Crash logs, Diagnostics, Other app performance data** — no crash reporter
  ships. Tick them in the same release that adds one (checklist item 30).
- **Device or other IDs** — no advertising ID, no Device plugin; the app
  declares `INTERNET` and nothing else.
- **Approximate location** — no geolocation call and no location permission
  anywhere in the app.
- All of location, financial, health, messages, photos, video, audio, files,
  calendar, contacts, search history, installed apps and web history.

Two open points behind those answers:

- `legal/privacy.html` section 1 claims the app collects "approximate region,
  language, operating system, and version". Nothing in the code does — Supabase
  request logs see an IP, which is exempt and is not a declared type. Google
  cross-checks the policy against this form, so reword that sentence rather
  than ticking Approximate location, and redeploy the page.
- RLS is row-level, so the SELECT policy that lets the leaderboard read other
  players' `level_scores` rows also exposes their `equations` column to any
  authenticated caller, though no screen shows it. It does not change this form
  (collected, not shared), but it belongs with checklist item 13.

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
| Tags | up to 5, from the picker's fixed list: Physics, Brain games, Logic puzzle, Education, then Casual if a slot is spare |
| Email | `functionplane.support@gmail.com` — the only mandatory field here |
| Website | `https://functionplane.pages.dev` |
| Phone | leave blank — optional, publicly shown, and it gets scraped |
| External marketing | leave opted in |

Tags feed Play's recommendation placements, so a wrong one puts the game in
front of people who bounce: four accurate tags beat five with a lie in them.
Never tick Match 3, Word, Jigsaw, Trivia, Block puzzle, Hidden object, Escape
room or Card & board. If Physics is not offered under Puzzle, do not switch
category to chase it.

External marketing lets Google promote the app outside the Play Store. It
shares no user data, costs nothing, and is free reach for an unknown game; the
reasons to opt out are brand-control reasons that need a marketing department.
It has no effect at all during closed testing.

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
Billing, so there is nothing to buy, and the premium entry point is hidden
outright on the `play` channel (`PremiumCard` returns null) — a reviewer sees
no prices and no dead button. This becomes **Yes** in the release that ships
billing, along with re-taking the content rating questionnaire and revisiting
the Data safety answers if a third-party billing SDK goes in.

**Countries and testers** come after this checklist, on the closed-testing
track. Nothing in this file changes for them.
