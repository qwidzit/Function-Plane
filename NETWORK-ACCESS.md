# Network access — when writes never arrive

Some networks let the app read and silently swallow everything it writes. This
is what that looks like, how it was proved, and what fixing it costs.

It is filed separately from `ABOUT.md` because it is not about how the game
works: nothing here is a bug in the app, and no amount of code changes the
answer. `TODO.md` item **11c** tracks it.

> ## Superseded — 20 September 2026
>
> **The fault below does not currently reproduce, and no relay was bought.**
> Re-measured the same way: `edge_logs` for `cf.country = 'RU'` over 24 h
> showed **29 POSTs, 28 of them 2xx** — `level_scores`, `progress` and
> `auth/v1/token` all writing — and a 16,631-byte GET returned intact, above
> the 16,384-byte cap Russian ISPs apply to interfered traffic.
>
> Three explanations fit and cannot be told apart: the interference is
> intermittent, the route changed, or the original measurement was wrong.
> Supabase caps log retention at 24 hours, so the window below cannot be
> re-examined.
>
> Two things worth knowing before trusting either measurement:
> - **The verification command in the old plan could never pass.** It posted
>   `"kind":"proxy-test"`, which violates `client_errors_kind_ck`
>   (`'error' | 'unhandledrejection' | 'react'`). It returns 400 on every
>   network, relay or no relay.
> - **Every Russian request in the logs comes from one IP, one city.** That is
>   the developer. It says nothing about other Russian ISPs.
>
> `fp-probe.bat` re-measures this across two ISPs. Decision deferred to
> Build 3. If a relay is ever built: **not Hetzner** — it is one of the four
> networks Russia interferes with (Cloudflare, Hetzner, DigitalOcean, OVH) and
> it no longer serves Russian customers.

## What was measured

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

Auth, RLS, realtime and storage all ride the same origin, so nothing else in
the app changes. The proxy holds no data and no keys — it forwards bytes.

The same box can serve the PWA itself, which is worth doing: `pages.dev` is
Cloudflare, the most filtered name in the chain. Installed Android builds
bundle their assets and only need the API.

## Until then

The app no longer *hides* the failure. Every mutation goes through `_write` in
`accounts.js`: bounded by `_withTimeout` and retried once, which is safe
because they are all upserts or deletes. A save that cannot get through now
says so instead of spinning "Saving…" forever, and the retry sometimes slips
through, since the filtering is intermittent. That is honesty, not a fix.

Admin work from an affected network needs a VPN. That demonstrably works.
