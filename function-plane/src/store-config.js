// Store listing links, and which payment channel this build is allowed to use.
//
// Paste the Play listing URL once the app is live on Google Play. Until it is
// non-empty the Rate button keeps showing its "not on the store yet" popup, so
// a tester never lands on a 404.
window.FP_STORE_LINKS = {
  android: '',  // 'https://play.google.com/store/apps/details?id=app.functionplane'
  web:     'https://functionplane.pages.dev',
};

// The two payment channels are mutually exclusive and decided by where the app
// is running, not by configuration: Google forbids external payment for digital
// goods inside a Play build (anti-steering — a real rejection risk), and Play
// Billing does not work on web or sideloaded installs.
//
// A native build is treated as 'play' even when it was sideloaded. We cannot
// tell a Play install from a sideload without reading the installing package
// name in native code, and of the two ways to be wrong, offering Stripe inside
// the Play build is the one that gets the app taken down.
window.FP_PAY_CHANNEL = (function () {
  const cap = window.Capacitor;
  const native = !!(cap && (typeof cap.isNativePlatform === 'function'
    ? cap.isNativePlatform()
    : cap.platform && cap.platform !== 'web'));
  return native ? 'play' : 'stripe';
})();
