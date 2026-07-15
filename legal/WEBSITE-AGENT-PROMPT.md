# Handoff prompt — add legal pages to the Function Plane website

Copy the text below into the agent working on the **website repo** (the one that
deploys `functionplane.pages.dev`). Attach or copy in the two files
`privacy.html` and `terms.html` from this folder first.

---

We need to publish a Privacy Policy and Terms of Service on the site so the game
can be submitted to the Google Play Store (Google requires the privacy policy to
be reachable at a public URL, not just inside the app).

I'm providing two ready-made static HTML files: `privacy.html` and `terms.html`.
They are self-contained (no build step, no dependencies) and already styled to
match Function Plane.

Please:

1. Place both files at the **site root** so they are served at exactly:
   - `https://functionplane.pages.dev/privacy.html`
   - `https://functionplane.pages.dev/terms.html`
   (If the site is built from a `public/`, `dist/`, `static/`, or similar output
   folder, put them there instead so they land at the root of the deployed site.
   Do not nest them under a subfolder — the URLs above must resolve.)

2. Add footer links to **Privacy** and **Terms** on the site's main/landing page
   if it has one, so they're discoverable.

3. Commit and let Cloudflare Pages deploy, then confirm both URLs load (HTTP 200)
   in a browser.

Don't change the content of the two HTML files — the wording is finalized. Just
place them, link them, and deploy.
