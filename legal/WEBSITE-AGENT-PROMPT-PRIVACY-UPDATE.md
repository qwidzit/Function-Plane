# Handoff prompt — republish the corrected privacy and deletion pages

Copy the text below to the agent working on the **website repo** (the one that
deploys `functionplane.pages.dev`), and attach the updated `privacy.html` and
`delete-account.html` from this folder.

Context for you, not for that agent: the old policy claimed the app collects
"approximate region, language, operating system, and version", which nothing in
the app does, and it never mentioned that submitted equations are uploaded with
a score. Google cross-checks the privacy policy against the Play Data safety
form, so both had to match what the app really does before submission.

---

Two of the legal pages on the site need replacing with corrected versions. I'm
providing the updated files: `privacy.html` and `delete-account.html`.

They must keep exactly the URLs they already serve:

- `https://functionplane.pages.dev/privacy.html`
- `https://functionplane.pages.dev/delete-account.html`

Please replace the deployed files with these versions byte-for-byte — do not
reword, reformat, re-indent, or run them through a formatter. The wording is
final and has to stay identical to the copies held in the app repo, because
Google Play's review compares the published policy against the app's declared
data collection.

What changed, so you can sanity-check the deploy:

1. `privacy.html`, section 1 — the paragraph headed **Device information** is
   replaced by one headed **Technical data**, which states that the app
   collects no device identifiers and no location, and that only the hosting
   provider's server logs record IP addresses, for security.
2. `privacy.html`, section 1 — the **Gameplay data** paragraph now also
   mentions the equations submitted for a level.
3. `privacy.html` — the effective date is now 28 August 2026.
4. `delete-account.html` — the "what gets deleted" table row for level progress
   now names submitted equations too.

If the site keeps its own copy of this text anywhere else (a summary on the
landing page, a cached snippet, an About section), update it to match rather
than leaving two versions in circulation.

After deploying, confirm both URLs return HTTP 200 and that the served HTML
matches the files I gave you exactly — a previous deploy of the deletion page
silently fell through to the site's catch-all and returned the homepage with a
200, so please check the actual page content, not just the status code.
