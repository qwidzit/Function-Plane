# Handoff prompt — resync the website

Copy the text below to the agent working on the **website repo** (the one that
deploys `functionplane.pages.dev`), and attach the current `privacy.html`,
`delete-account.html` and `terms.html` from this folder.

Context for you, not for that agent: the old policy claimed the app collects
"approximate region, language, operating system, and version", which nothing in
the app does, and it never mentioned that submitted equations are uploaded with
a score. Google cross-checks the published privacy policy against the Play Data
safety declaration, and that declaration is filed, so the live pages have to
match it. Build 1 is already in review on closed testing, which does not make
this less urgent — the policy is read again on every release, and it is the
document a player is shown when they ask what the game collects. The in-app
copies in `function-plane/src/legal-screens.jsx` now match these files
exactly; the live site is the only place still serving the old text.

The level count below is what ships today: seven visible packs of ten. Send a
new number only when Trigonometry and Inversion are unhidden.

---

The Function Plane game is being submitted to Google Play, and Google compares
the live website against what the app declares. Two things: replace two legal
pages, then check the rest of the site for claims that are no longer true.

## 1. Replace three pages, byte-for-byte

I'm providing updated `privacy.html`, `delete-account.html` and `terms.html`.
They must keep exactly the URLs they already serve:

- `https://functionplane.pages.dev/privacy.html`
- `https://functionplane.pages.dev/delete-account.html`
- `https://functionplane.pages.dev/terms.html`

Do not reword, reformat, re-indent, or run them through a formatter. The
wording is final and has to stay identical to the copies in the app repo,
because Google's review reads these pages against the app's declared data
collection. What changed:

1. `privacy.html`, section 1 — the paragraph headed **Device information** is
   replaced by one headed **Technical data**, stating that the app collects no
   device identifiers and no location, and that only the hosting provider's
   server logs record IP addresses, for security.
2. `privacy.html`, section 1 — the **Gameplay data** paragraph now also
   mentions the equations submitted for a level.
3. `privacy.html` — the effective date is now 28 August 2026.
4. `delete-account.html` — the "what gets deleted" table row for level progress
   now names submitted equations too.
5. `privacy.html`, section 1 — a new paragraph headed **Crash reports**, and
   section 3 now says crash reports go to the same Supabase database. The app
   sends an error message, its trace, the screen and the build when it hits a
   fault; the reports carry no account or identifier, are not linked to anyone,
   and are deleted after thirty days. There is still no crash-reporting or
   analytics provider — that sentence must survive any rewording.
6. `terms.html`, section 5 — the clause about purchases no longer mentions
   subscriptions or auto-renewal. Premium is one lifetime unlock bought through
   Google Play, so a recurring charge is something this game will never have,
   and a forward-looking clause describing one is a claim about a product that
   does not exist. The effective date is now 17 September 2026.

## 2. Sweep the rest of the site for stale claims

Anywhere else the site describes the game — landing page, features section,
FAQ, meta description, Open Graph tags, a cached summary — make it agree with
these facts. Fix what disagrees; do not invent new copy where the site is
simply silent.

- **Data.** The game collects a display name, an email address, an account ID,
  level progress, and the equations submitted with a score. It also sends
  anonymous crash reports, kept thirty days and linked to nobody. Nothing else.
  No location, no device identifiers, no advertising ID, no analytics, no
  third-party sharing. Supabase is the only processor — crash reports go to
  that same database, not to a crash-reporting service.
- **Accounts are optional.** The whole game is playable signed out, with
  progress stored on the device.
- **Money.** There are no purchases available today. If any page advertises
  premium, a price, a subscription, or a "buy" or "upgrade" call to action,
  remove it or mark it clearly as not yet available — it must not be possible
  to reach a checkout, and there must be no Stripe link live anywhere.
- **Ads.** The game has none. No page should say otherwise.
- **Availability.** The game is not on Google Play yet — it is entering closed
  testing. Do not add a "Get it on Google Play" badge, store link, or "download
  now" copy until I send you the listing URL.
- **Scale.** 70 levels, 210 stars maximum. Do not print a different number.
- **Contact.** `functionplane.support@gmail.com` everywhere, and check no
  address is reversed or mistyped.

## 3. Deploy and verify

Commit, let Cloudflare Pages deploy, then check the **served content**, not
just the status code: fetch each of `/privacy.html`, `/delete-account.html` and
`/terms.html` and confirm the HTML matches the files I gave you. A previous
deploy of the deletion page silently fell through to the site's catch-all and
returned the homepage with a 200, so a green status code proves nothing here.

Reply with the four things you changed and the verification output.
