# Handoff prompt — resync the website before the Play submission

Copy the text below to the agent working on the **website repo** (the one that
deploys `functionplane.pages.dev`), and attach the current `privacy.html` and
`delete-account.html` from this folder.

Context for you, not for that agent: the old policy claimed the app collects
"approximate region, language, operating system, and version", which nothing in
the app does, and it never mentioned that submitted equations are uploaded with
a score. Google cross-checks the published privacy policy against the Play Data
safety declaration, and that declaration is now filed, so the live pages have to
match it before the first release is reviewed.

---

The Function Plane game is being submitted to Google Play, and Google compares
the live website against what the app declares. Two things: replace two legal
pages, then check the rest of the site for claims that are no longer true.

## 1. Replace two pages, byte-for-byte

I'm providing updated `privacy.html` and `delete-account.html`. They must keep
exactly the URLs they already serve:

- `https://functionplane.pages.dev/privacy.html`
- `https://functionplane.pages.dev/delete-account.html`

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

## 2. Sweep the rest of the site for stale claims

Anywhere else the site describes the game — landing page, features section,
FAQ, meta description, Open Graph tags, a cached summary — make it agree with
these facts. Fix what disagrees; do not invent new copy where the site is
simply silent.

- **Data.** The game collects a display name, an email address, an account ID,
  level progress, and the equations submitted with a score. Nothing else. No
  location, no device identifiers, no advertising ID, no analytics, no crash
  reporting, no third-party sharing. Supabase is the only processor.
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
