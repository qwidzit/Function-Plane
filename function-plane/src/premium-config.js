// Premium / payments configuration.
//
// Function Plane sells one thing — a lifetime "Premium" unlock that opens every
// pack. It ships through three channels, each with its own payment path:
//
//   • Web / sideloaded APK  → Stripe Payment Link (PREMIUM_LINKS.lifetime)
//   • Google Play build     → Google Play Billing via RevenueCat
//   • iOS App Store build    → Apple StoreKit via RevenueCat (same SDK)
//
// Which path the app uses is decided at runtime by FP_ENV (environment.js) and
// executed by FP_BILLING (billing.js). Both converge on the same server-side
// write: an Edge Function webhook flips profiles.is_premium for the buyer.
//
// Everything in this file is PUBLIC and safe to commit (Stripe Payment Link
// URLs and RevenueCat *public* SDK keys are publishable). Secret keys — the
// Stripe secret/webhook-signing key and the Supabase service-role key — live
// only in the Edge Function secrets, never here. See PAYMENTS-SETUP.md.

// ── Stripe (web / sideload) ────────────────────────────────────────────────
// One Payment Link from the Stripe Dashboard (Products → Payment links).
// The app appends ?client_reference_id=<userId> so the webhook can map the
// completed checkout back to the buyer's account.
window.PREMIUM_LINKS = {
  lifetime:   '',        // e.g. 'https://buy.stripe.com/xxxYourLifetimeLinkxxx'
  priceLabel: '$14.99',  // shown on the web Premium screen — the Stripe checkout
                         // is the source of truth for the actual amount charged
};

// ── RevenueCat (native Google Play / App Store) ─────────────────────────────
// Public SDK keys from RevenueCat → Project → API keys (the "public" ones,
// prefixed goog_ / appl_). entitlementId is the entitlement you attach the
// Premium product to. offeringId/packageId are optional hints — if left blank
// the current offering's lifetime/first package is used.
window.REVENUECAT_CONFIG = {
  androidApiKey: '',        // e.g. 'goog_xxxxxxxxxxxxxxxxxxxxxxxx'
  iosApiKey:     '',        // e.g. 'appl_xxxxxxxxxxxxxxxxxxxxxxxx'
  entitlementId: 'premium', // must match the entitlement identifier in RevenueCat
  offeringId:    '',        // blank = use the current offering
  packageId:     '',        // blank = use the offering's lifetime / first package
};

// ── Distribution channel override ───────────────────────────────────────────
// Normally the channel is auto-detected (web origin → 'web', native Android →
// 'play', native iOS → 'appstore'). Force it here only for a build that breaks
// that assumption — most importantly a SIDELOADED / web-download APK, which is
// native Android but must use Stripe, not Play Billing. Set to 'web' for that
// build. Leave undefined for the normal Play Store build.
// window.FP_BUILD_CHANNEL = 'web';

// ── Rate button ─────────────────────────────────────────────────────────────
// The "Rate" tile stays a "coming soon" popup until the app is actually live
// on a store. Flip `enabled` to true once it is, and fill in the listing URLs.
// Native Android then opens the in-app review sheet (falling back to the Play
// listing); iOS opens the App Store; web opens the Play listing.
window.RATE_CONFIG = {
  enabled:        false,
  androidPackageId: 'app.functionplane',
  playListingUrl: '',  // e.g. 'https://play.google.com/store/apps/details?id=app.functionplane'
  appStoreUrl:    '',  // e.g. 'https://apps.apple.com/app/idXXXXXXXXXX'
};
