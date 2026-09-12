// Store listing links, what premium costs, and which channel this build sells
// through.
//
// Paste the Play listing URL once the app is live on Google Play. Until it is
// non-empty the Rate button keeps showing its "not on the store yet" popup, so
// a tester never lands on a 404 — and the web build's premium screen says
// "get the Android app" in words rather than offering a dead link.
window.FP_STORE_LINKS = {
  android: '',  // 'https://play.google.com/store/apps/details?id=app.functionplane'
  web:     'https://functionplane.pages.dev',
};

// The one thing the game sells: a lifetime unlock of every pack. Not a
// subscription — is_premium is a boolean with no expiry, and a permanent
// unlock is what it can honestly express.
//
// This price is only ever a display string. Play returns its own localized
// price for the product, which is what a buyer actually sees on the purchase
// sheet; this is what the web build quotes when it tells someone where to buy.
window.FP_PREMIUM_PRICE = '€4.90';

// Premium is sold **through Google Play only**. The web build can still sign
// in, restore a purchase made in the app, and play everything already
// unlocked — it just has no checkout of its own.
//
// A native build is treated as 'play' even when it was sideloaded: we cannot
// tell a Play install from a sideload without reading the installing package
// name in native code, and of the two ways to be wrong, offering an outside
// payment route inside the Play build is the one that gets the app taken down
// (anti-steering).
window.FP_PAY_CHANNEL = (function () {
  const cap = window.Capacitor;
  const native = !!(cap && (typeof cap.isNativePlatform === 'function'
    ? cap.isNativePlatform()
    : cap.platform && cap.platform !== 'web'));
  return native ? 'play' : 'web';
})();
