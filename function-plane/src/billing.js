// Function Plane — Google Play Billing (the `play` channel's purchase path).
//
// The plugin (capacitor-plugin-cdv-purchase, Billing Library 9) exists only in
// the native build, so every call here no-ops when `window.CdvPurchase` is
// absent. That is what keeps the two channels from ever meeting: the web build
// cannot reach Play Billing, and `PremiumView` will not open a Stripe link off
// the `stripe` channel.
//
// The app never decides that a purchase is real. An approved transaction is
// sent to the `play-verify` edge function, which asks Google and flips
// is_premium with the service-role key — the client roles have no write
// privilege on that column at all (see the entitlement model in ABOUT.md).
// Only after the server agrees is the transaction finished, which is also what
// releases the money: an unfinished purchase is refunded by Google.
window.FP_BILLING = (function () {
  const PRODUCT_ID = 'premium_lifetime';

  let _started = null;  // Promise, so concurrent callers share one init

  const cdv   = () => window.CdvPurchase;
  const store = () => window.CdvPurchase?.store;

  function available() {
    return !!store();
  }

  // The plugin attaches its global through the Capacitor bridge, which can land
  // after our scripts. Give it a moment rather than deciding "no billing here"
  // on a race.
  function _waitForPlugin(ms = 3000) {
    if (available()) return Promise.resolve(true);
    return new Promise(resolve => {
      const started = Date.now();
      const id = setInterval(() => {
        if (available() || Date.now() - started > ms) {
          clearInterval(id);
          resolve(available());
        }
      }, 100);
    });
  }

  function _emit(detail) {
    window.dispatchEvent(new CustomEvent('fp-premium', { detail }));
  }

  // An approved transaction can arrive at any time — right after an order, out
  // of restorePurchases(), or on launch when a pending payment finally cleared
  // — so the handler is registered once and reports through the event rather
  // than resolving whichever call happened to be in flight.
  function _onApproved(tx) {
    const token = tx?.nativePurchase?.purchaseToken || tx?.purchaseId;
    if (!token) {
      _emit({ premium: false, error: 'That purchase arrived without a token — contact support.' });
      return;
    }
    FP_AUTH.verifyPlayPurchase(token)
      .then(premium => {
        // Finishing acknowledges the purchase to Google. Do it only once the
        // entitlement is actually granted, so a failure here is a refund
        // rather than a player who paid and got nothing.
        if (premium) tx.finish();
        _emit({ premium });
      })
      .catch(e => _emit({ premium: false, error: e.message || 'Could not confirm the purchase' }));
  }

  function start() {
    if (_started) return _started;
    _started = _waitForPlugin().then(ok => {
      // The premium entry point is drawn off available(), which is false until
      // the bridge lands — so say when that changes rather than leaving a cold
      // boot with no way to buy.
      if (ok) window.dispatchEvent(new CustomEvent('fp-billing-ready'));
      if (!ok) return false;
      const { store, Platform, ProductType } = cdv();
      store.register([{ id: PRODUCT_ID, platform: Platform.GOOGLE_PLAY, type: ProductType.NON_CONSUMABLE }]);
      store.when().approved(_onApproved);
      return store.initialize([Platform.GOOGLE_PLAY]).then(() => true);
    });
    return _started;
  }

  // Opens Play's purchase sheet. Resolves once the sheet has been handed over;
  // the entitlement itself arrives later on the `fp-premium` event.
  async function buy() {
    if (!(await start())) throw new Error('Google Play billing is not available in this build');
    const offer = store().get(PRODUCT_ID)?.getOffer();
    if (!offer) throw new Error('Google Play has not loaded the product yet — try again in a moment');
    const err = await offer.order();
    if (err) throw new Error(err.message || 'Google Play refused the order');
  }

  // Asks Play what this Google account owns. Anything it still owns comes back
  // through the same approved handler, so the restore path and the purchase
  // path grant the entitlement the same way.
  async function restore() {
    if (!(await start())) throw new Error('Google Play billing is not available in this build');
    const err = await store().restorePurchases();
    if (err) throw new Error(err.message || 'Google Play could not restore purchases');
  }

  // A purchase can complete while the app is closed, so pick up anything Play
  // is already holding at launch instead of waiting for the premium screen.
  if ((window.FP_PAY_CHANNEL || 'stripe') === 'play') start();

  return { PRODUCT_ID, available, start, buy, restore };
})();
