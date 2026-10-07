# Network access — when the server cannot be reached

Some Russian networks hold the app's connection to Supabase for a minute or
more. This is what that looks like, how it was measured, what the app does
about it, and what a real fix would cost.

It is filed separately from `ABOUT.md` because it is not about how the game
works: nothing here is a bug in the app. `TODO.md` item **11c** tracks it.

## Status — 7 October 2026: real on mobile data, relay not bought

**Measured on 6 October**, one account, VPN off:

- **Home fibre (KOMTEHCENTR):** two levels cleared, both scores saved, the
  leaderboards loaded. Same as 18–21 September — about 55 writes from that
  ISP in 30 days and none lost.
- **MTS mobile, Moscow:** one level cleared. The progress upload was built at
  15:37:38 UTC and reached Supabase at 15:38:59 — **81 seconds later**, in one
  burst with the leaderboard reads that had been waiting beside it. The app
  had given up at 10 s, the leaderboard showed a timeout, and the score row
  was never sent at all (that part was a bug, now fixed — see below).
- The same phone did the same on 17 September: it synced through a VPN, and
  26 seconds later with the VPN off its preflights arrived and the uploads
  behind them did not.

So it is not "reads arrive and writes never do", which is what the September
measurement below concluded. The connection is held — reads included — and
sometimes let go. Two attempts on one SIM in one city is the whole sample.

**Decision: no relay for now.**

- Nearly every Russian player runs a VPN. In 30 days of logs every tester
  with an account came in through a VPN exit on every session, and the only
  tester device seen on a Russian network never signed in.
- The game works without the server. Levels and progress are local; what a
  player on a held connection loses is the leaderboard for that session, and
  the score goes up later.
- A relay is €3–5 a month, a box to keep patched, a domain to renew, and a
  single point of failure for every player in the world — for a game that may
  not earn that back.
- It can be added in an evening if that changes (*The fix*, below).

Revisit if players without a VPN turn out to be a real share of the audience.

**What the app does instead:**

- The save and the score rows upload independently (`_uploadSave`,
  `_uploadScores`), so a stalled progress upload no longer skips the scores.
- An upload that got no answer is retried on its own after 15 s, 30 s, 1, 2
  and 5 minutes, and at once when the app returns to the foreground. The
  stalled request is cancelled first (`_send`), because every upload replaces
  the whole server copy and one delivered a minute late would land over a
  newer one.
- The first request that gets no answer on a device opens a notice in the
  middle of the screen: nothing is lost, and if you are in Russia, turn on a
  VPN. After that the same advice rides in the red toast. The retries are
  silent. The flag is `fp-vpn-notice` in localStorage.

**Before trusting any measurement here:**

- **The logs go back 30 days, not 24 hours.** Each query is capped at a
  24-hour window, but the store answers for older days; walk it one day at a
  time. The September note that the window "cannot be re-examined" was wrong.
- **A signed-out player sends no writes.** A country with GETs and no POSTs
  proves nothing unless those requests carry `auth_user`. Every Russian
  request in the logs before 17 September was signed out.
- **The edge log is not complete.** On 6 October it had no entry for an
  upload the database proves arrived. The database is the witness:
  `level_scores.submitted_at` is the server's clock, `progress.updated_at` is
  the phone's, and the gap between that and the edge log's timestamp is how
  long the request was held.
- **The old verification command could never pass.** It posted
  `"kind":"proxy-test"`, which violates `client_errors_kind_ck`
  (`'error' | 'unhandledrejection' | 'react'`) and returns 400 on any network.
- **On 20 September the fault was declared gone** on the strength of 29 POSTs
  from Russia, 28 of them 2xx. All of them were from the home ISP above.

## The September measurement

Kept as it was written. Read it with the caveats above: these Russian
requests were most likely signed out, and a held connection that is later let
go fits the same table.

24 hours of the project's `edge_logs`, grouped by country and HTTP method:

| Country | GET | OPTIONS | POST | PATCH |
|---|---|---|---|---|
| **RU** | 15 ✅ | 15 ✅ | **0** | **0** |
| AT | 10 ✅ | 12 ✅ | 7 ✅ | 3 ✅ |
| CH | 12 ✅ | 19 ✅ | 9 ✅ | 3 ✅ |
| NL | 9 ✅ | 13 ✅ | 4 ✅ | 1 ✅ |

Not one non-2xx response anywhere. Every request that reached Supabase was
answered, in single-digit milliseconds. From Russia, **reads arrive and writes
never do** — they are not rejected, they never turn up at all.

The one admin save that has ever landed from that account came in from a Dutch
exit node (`POST /rest/v1/level_overrides 200`), i.e. with a VPN on. That is
the whole of "it saved once out of fifteen tries, then stopped".

To re-check, query `edge_logs` grouped by `cf_ipcountry` and
`request.method`. A country with GETs and no POSTs is this, not a code bug.

## Why it happens

Before every cross-origin write the browser sends a CORS preflight: a tiny
`OPTIONS` with no body and no credentials. That gets through. The write behind
it carries a JSON body and a bearer token roughly a kilobyte long, and is
dropped in transit. Supabase's REST endpoint is Cloudflare-fronted, which is
what that filtering is aimed at.

Two consequences worth stating plainly:

- The preflight succeeding is what makes it *look* fine. Nothing errors.
- **Players lose scores silently**, not just admins. The progress upload is a
  `POST` too. This is not only an editing annoyance.

## What does not fix it

**Switching database provider.** Supabase answered every request it received.
Moving to Firebase, Neon or anything else means rewriting auth, RLS and the
leaderboard trigger, and it is a coin flip whether the new provider's endpoint
is any less filtered — you would not know until after the migration. The
address is the problem; fix the address.

**Supabase's own custom-domain add-on** ($10/mo). Over budget, and it still
terminates on their Cloudflare edge, so it probably changes nothing.

## The fix — about €3/month

Nothing leaves Supabase. Only the address the app dials changes, from the
Cloudflare-fronted `<ref>.supabase.co` to a host the filtering does not
recognise, which forwards every request on unchanged.

1. Rent the smallest VPS that answers from the affected country — Hetzner CX22
   ≈ €3.79/mo, Netcup ≈ €3. **Verify it answers a `POST` from that network
   before paying for more than a month.** Which ranges are filtered changes
   over time, and nothing in this repo can tell you from here.
2. Point `api.<domain>` at it and install Caddy. The whole config:

   ```
   api.example.com {
     reverse_proxy https://<ref>.supabase.co {
       header_up Host <ref>.supabase.co
     }
   }
   ```

   Caddy gets the TLS certificate itself. `header_up Host` is **not optional**
   — Supabase routes on the Host header, and without it every request 404s.
3. Change the one line in `function-plane/src/supabase-config.js`:

   ```js
   window.SUPABASE_URL = 'https://api.example.com';
   ```
4. Pin the session's storage key in `createClient` (`accounts.js`):
   `auth: { storageKey: 'sb-<ref>-auth-token', … }`. supabase-js names the
   saved session after the first label of the hostname, so without this the
   new address signs every player out once.

Auth, RLS, realtime and storage all ride the same origin, so nothing else in
the app changes. The proxy holds no data and no keys — it forwards bytes.

The same box can serve the PWA itself, which is worth doing: `pages.dev` is
Cloudflare, the most filtered name in the chain. Installed Android builds
bundle their assets and only need the API.

**Not Hetzner** — it is one of the four networks Russia interferes with
(Cloudflare, Hetzner, DigitalOcean, OVH) and it no longer serves Russian
customers. Whatever the host, it becomes the only door for every player, so
keep the direct Supabase address as a fallback.

## Admin work

Admin saves go through `_write` in `accounts.js`: bounded by `_withTimeout`
and retried once, which is safe because they are all upserts or deletes. A
save that cannot get through says so instead of spinning "Saving…" forever.
From an affected network, use a VPN. That demonstrably works.
