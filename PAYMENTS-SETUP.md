# Payments setup

What is built, and the steps that need your machine and your accounts.

**What is sold:** one lifetime unlock of every pack, **€4.90**, **through
Google Play only**. Not a subscription — `is_premium` is a boolean with no
expiry column, so nothing in the schema could express a lapsed subscription.

The web build has no checkout. It signs in, restores, and plays everything
already unlocked, and its premium screen says premium is sold in the Android
app (with a link to the listing once `FP_STORE_LINKS.android` is set). That is
a tax decision rather than a technical one — see *The web channel* at the end.

**The trust model, in one line:** nothing the device says grants anything.
`is_premium` is revoked from both client roles, so the only writers are the two
edge functions (service-role key) and the admin RPC. A modified app can lie all
it likes; the column does not move.

```
  Play build          app  →  Play sheet  →  purchaseToken
                                              ↓
                                     play-verify (edge fn)
                                              ↓  asks Google
                                     profiles.is_premium = true
                                              ↓
                                     tx.finish()  ← releases the money

  Web build           no checkout — "buy it in the Android app", and
                      Restore purchases unlocks what Play already sold

  Refunds             Play  →  nightly sweep asks Google
                                              ↓
                                     void_purchase(token)
                                              ↓  no live purchase left?
                                     profiles.is_premium = false
```

Both paths end at the same column, so everything downstream — pack unlocks,
restore, the admin screen — is unchanged.

---

## Already done

| | |
|---|---|
| Entitlement is server-side only | `20260912_premium_entitlement_guard.sql`, applied and verified against the live project |
| Purchase ledger | `20260912_purchases.sql`, applied — one row per verified purchase, keyed by the store's token, so a purchase cannot be replayed onto a second account |
| `play-verify` edge function | Deployed to `Function Plane Main`, `verify_jwt` on |
| Client purchase + restore | `billing.js` (Play) and `PremiumView`; restore works on both builds, because the entitlement is on the account |
| Refund revocation | A daily sweep (`play-refunds` + the `play-refund-sweep` cron job, both live) asks Google for voided purchases, since it reports a refund only when asked. `void_purchase()` drops premium only when no live purchase is left |
| `stripe-webhook` edge function | Deployed but **dormant** — no secret, nothing pointing at it. Left in place for the day the web channel opens; it grants and revokes on its own if a Stripe endpoint is ever configured |
| Premium entry point | Appears by itself once billing is really installed — no flag to remember |

Both functions are inert until their secrets exist. Until then the buy button
reports a clear error rather than half-working.

---

## 1. Google Play

The order matters: Play will not let you create an in-app product until it has
seen a build that declares the billing permission.

1. **Install the plugin** (on your machine, where `npm install` works):
   ```
   npm install capacitor-plugin-cdv-purchase
   npx cap sync android
   ```
   It is MIT-licensed and builds against Play Billing Library 9. That matters:
   since **31 August 2026** Google rejects uploads using anything below
   Billing Library 8, so a plugin pinned to 7 would fail at upload, not at run
   time.

2. **Check the permission landed.** `android/app/src/main/AndroidManifest.xml`
   (merged) must contain `com.android.vending.BILLING`. If it doesn't, the
   product page in Play Console stays greyed out.

3. **Upload a build** with the plugin to the closed track. Bump `versionCode`
   — it must increase on every upload, forever.

4. **Create the product.** Play Console → Monetise → Products → **In-app
   products** → Create product.
   - Product ID **`premium_lifetime`** — this exact string is in `billing.js`
     and in `play-verify`; a typo here is a purchase that verifies against a
     product that does not exist.
   - Price €4.90 for the euro zone; let Play convert the rest.
   - **Activate** it. A draft product cannot be bought, including by you.

5. **Service account** so the server can ask Google about a purchase:
   - Google Cloud Console → the project linked to your Play account → IAM →
     Service accounts → create one → Keys → **Add key → JSON**.
   - Play Console → Users and permissions → **Invite** that service account's
     email → grant **View financial data** and **Manage orders and
     subscriptions**, scoped to this app.
   - Permissions take up to **24 hours** to propagate. Until they do, every
     verification returns 401 and the app says the purchase could not be
     confirmed. This is the single most common "it's broken" that isn't.

6. **Supabase secret.** Dashboard → Edge Functions → Secrets → add
   `GOOGLE_SERVICE_ACCOUNT`, value = the whole JSON key file, as one line.

   While you are there, the refund sweep needs a shared secret in two places.
   Generate one (`openssl rand -hex 32`), then:
   - add it as the Edge Function secret **`REFUND_SWEEP_SECRET`**, and
   - put the same value in the database's vault, so the cron job can pose it:
     ```sql
     select vault.create_secret('<the same value>', 'refund_sweep_secret');
     ```
   Until both exist the nightly job returns without calling anything, which is
   why installing this before you have a Play product is harmless.

7. **Test without paying.** Play Console → Setup → **License testing** → add
   your tester Google accounts. Their purchases complete for free and can be
   refunded from the Orders page, so you can run the flow repeatedly.

## 2. The web channel

Nothing to do. The web build sells nothing, so there is no Stripe account, no
Payment Link and no VAT question — `FP_PAY_CHANNEL` is `web` there and the
premium screen points at Google Play.

**Why it is off.** On Play, Google is the merchant of record: it charges the
buyer's local VAT and remits it, and you account for net payouts as income.
Selling direct makes you the merchant, and EU VAT on digital goods is then
yours from the first sale — there is no small-seller threshold for
cross-border digital sales to consumers. For a channel that will see a
fraction of Play's volume, that is a poor trade.

**If you turn it on later**, the options in rough order of effort:

1. **Stripe + Stripe Tax** (0.5% per transaction) — calculates and collects
   the right local rate and gives you the filing data. You still register,
   usually through **One-Stop Shop**: one quarterly return covering the EU.
2. **A merchant-of-record reseller** — Paddle, Lemon Squeezy, FastSpring. They
   sell to the customer and you sell to them, so VAT stops being yours, the
   same way it is not yours on Play. Costs more (~5% + fees against Stripe's
   ~1.5% + €0.25) and is the least work by a distance.
3. **Stripe alone**, registering and filing yourself. Cheapest per sale, and
   the only one where a missed filing is your problem.

Whichever: the server half already exists. `stripe-webhook` is deployed and
grants on `checkout.session.completed`, revokes on `charge.refunded` and
`charge.dispute.created`, and records `payment_ref` so a refund finds its row.
What was removed is the client half — a checkout button in `PremiumView` and
the link config — because a payment link the app can open is the part that
must never exist inside the Play build (anti-steering). A reseller would need
a different webhook; the Play side and everything downstream is untouched.

## 3. The release that turns it on

- [ ] `versionCode` up, and the in-app version string in `main-screen.jsx` and
      `settings-screen.jsx` in step with it (`npm test` checks they agree).
- [ ] Bump `const CACHE` in `sw.js` — otherwise returning players keep the old
      cached app and never see the premium screen.
- [ ] Play Console → the listing's **In-app purchases** answer becomes **Yes**.
- [ ] **Re-take the content rating questionnaire** — the digital-purchases
      question is now Yes, and the old rating was filed on a No.
- [ ] Data safety: unchanged. Nothing new is collected and no third-party SDK
      was added, which was the point of doing the verification server-side
      rather than through a billing provider.

## 4. Proving it works

1. Buy as a licence tester. Expect: Play sheet → purchase → within a second or
   two the screen says *Purchase confirmed*.
2. In Supabase, `select * from purchases` has one row, and that account's
   `profiles.is_premium` is true.
3. Sign in on a second device and press **Restore purchases** — premium
   without paying again.
4. Refund the test order in Play Console, then run the sweep by hand rather
   than waiting for 03:40 UTC:
   ```sql
   select public.sweep_play_refunds();
   ```
   Within a few seconds the `purchases` row has a `voided_at` and
   `is_premium` is false again. The `play-refunds` logs say how many voided
   purchases Google reported and how many were new to us.
5. On the web build, sign in as that same account: the premium screen should
   say premium is active. Sign in as a different one and it should say premium
   is sold in the Android app, with no button that cannot complete.
6. Kill the app mid-purchase and reopen it: `billing.js` starts at launch and
   picks up anything Play is still holding, so the purchase completes.

## If something goes wrong

| Symptom | Cause |
|---|---|
| "Could not confirm the purchase (401)" | Service-account permissions have not propagated yet, or `GOOGLE_SERVICE_ACCOUNT` is missing/malformed |
| "Google could not find that purchase" (402) | Product ID mismatch, or the purchase was made against a different package |
| Purchase succeeds, premium never arrives | Look at the `play-verify` logs in the Supabase dashboard — every failure path logs |
| Money taken, then refunded a few days later | The transaction was never finished. That is the deliberate order: we acknowledge only after granting |
| A refunded player still has premium | Play refunds are swept nightly, not instantly — run `select public.sweep_play_refunds();` to check now. If that does nothing, the two halves of `REFUND_SWEEP_SECRET` disagree, or the player has a second live purchase row (`select * from purchases where user_id = …`) |
