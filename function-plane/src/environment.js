// Function Plane — runtime environment & distribution channel (window.FP_ENV)
//
// One codebase ships three ways, and each needs a different payment path and a
// different "Rate" target. This module answers two questions the rest of the
// app asks:
//
//   channel  — 'web' | 'play' | 'appstore'  (which store/payment rules apply)
//   platform — 'web' | 'android' | 'ios'     (which native APIs exist)
//
// The channel decides the payment provider (see billing.js) and must respect
// store anti-steering rules: the Play build never offers Stripe, the App Store
// build never offers Stripe — both go through native billing.
//
// Detection is Capacitor-based with an explicit override. The override
// (window.FP_BUILD_CHANNEL, set in premium-config.js) exists for the one case
// auto-detection can't get right: a sideloaded / web-download APK is native
// Android but must use Stripe, so that build forces channel 'web'.

(() => {
  const Cap = window.Capacitor;
  const platform = (Cap && typeof Cap.getPlatform === 'function') ? Cap.getPlatform() : 'web';
  const isNative = !!(Cap && typeof Cap.isNativePlatform === 'function' && Cap.isNativePlatform());

  // Distribution channel: explicit override wins, else derive from platform.
  const override = window.FP_BUILD_CHANNEL;
  let channel;
  if (override === 'web' || override === 'play' || override === 'appstore') {
    channel = override;
  } else if (isNative && platform === 'ios') {
    channel = 'appstore';
  } else if (isNative && platform === 'android') {
    channel = 'play';
  } else {
    channel = 'web';
  }

  // Payment provider follows the channel. Native stores go through RevenueCat;
  // web (incl. sideload) goes through Stripe.
  const paymentProvider = channel === 'web' ? 'stripe' : 'revenuecat';

  // ── Rate button target ────────────────────────────────────────────────────
  // Stays disabled (main screen shows a "coming soon" popup) until RATE_CONFIG
  // is switched on with real listing URLs.
  function canRate() {
    const cfg = window.RATE_CONFIG || {};
    if (!cfg.enabled) return false;
    if (channel === 'appstore') return !!cfg.appStoreUrl;
    // web + play both point at the Play listing (web has no store review of its own)
    return !!(cfg.playListingUrl || (isNative && platform === 'android'));
  }

  async function openRating() {
    const cfg = window.RATE_CONFIG || {};
    if (!cfg.enabled) return false;

    // Native Android: prefer the Play in-app review sheet if the plugin is
    // present, otherwise fall through to the store listing.
    if (isNative && platform === 'android') {
      const review = Cap?.Plugins?.InAppReview;
      if (review && typeof review.requestReview === 'function') {
        try { await review.requestReview(); return true; } catch {}
      }
    }
    if (isNative && platform === 'ios') {
      const review = Cap?.Plugins?.InAppReview;
      if (review && typeof review.requestReview === 'function') {
        try { await review.requestReview(); return true; } catch {}
      }
    }

    const url = channel === 'appstore'
      ? cfg.appStoreUrl
      : (cfg.playListingUrl ||
         (cfg.androidPackageId ? `https://play.google.com/store/apps/details?id=${cfg.androidPackageId}` : ''));
    if (!url) return false;
    try { window.open(url, '_blank', 'noopener,noreferrer'); return true; } catch { return false; }
  }

  window.FP_ENV = {
    platform,
    isNative,
    isWeb: !isNative,
    channel,
    paymentProvider,
    canRate,
    openRating,
  };
})();
