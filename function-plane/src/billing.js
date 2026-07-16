// Function Plane — unified billing (window.FP_BILLING)
//
// One entry point the Premium screen calls; the provider is chosen by FP_ENV:
//
//   web / sideload  → Stripe Payment Link (opens checkout in a new tab)
//   Play / App Store → RevenueCat (native in-app purchase)
//
// Premium is a single lifetime unlock and is ACCOUNT-BASED: the entitlement is
// granted by flipping profiles.is_premium server-side (an Edge Function webhook
// does this — Stripe's on checkout.session.completed, RevenueCat's on the
// purchase event). Because of that, a purchase requires the user to be signed
// in — the webhook maps the payment to a Supabase user id:
//   • Stripe:     via ?client_reference_id=<userId> on the Payment Link
//   • RevenueCat: via the appUserID we set to <userId>
//
// The client never writes is_premium itself (RLS forbids it). After a purchase
// we re-fetch the profile a few times so the freshly-granted flag lands in the
// UI without a manual reload.
//
// Return shapes (all methods resolve, they don't reject for expected outcomes):
//   { premium:true }               entitlement is active now
//   { pending:true }               purchase succeeded, flag not visible yet
//   { redirected:true }            opened an external checkout (Stripe web)
//   { cancelled:true }             user backed out of the native sheet
//   { unavailable:true, message }  provider not configured / not in this build

(() => {
  const rcCfg = () => window.REVENUECAT_CONFIG || {};
  const entitlementId = () => rcCfg().entitlementId || 'premium';

  const provider = () => (window.FP_ENV ? window.FP_ENV.paymentProvider : 'stripe');

  // ── Stripe (web) ───────────────────────────────────────────────────────────

  function stripeConfigured() {
    return !!(window.PREMIUM_LINKS && window.PREMIUM_LINKS.lifetime);
  }

  function stripeBuy(userId) {
    const link = (window.PREMIUM_LINKS || {}).lifetime;
    if (!link) {
      return { unavailable: true, message: "Checkout isn't set up yet. The site owner needs to add a Stripe Payment Link." };
    }
    const url = userId
      ? link + (link.includes('?') ? '&' : '?') + 'client_reference_id=' + encodeURIComponent(userId)
      : link;
    try { window.open(url, '_blank', 'noopener,noreferrer'); } catch {}
    return { redirected: true };
  }

  // ── RevenueCat (native) ────────────────────────────────────────────────────

  const _plugin = () => window.Capacitor?.Plugins?.Purchases || null;
  let _configuredFor = null;   // appUserID the SDK was last configured/logged-in with

  function rcApiKey() {
    const c = rcCfg();
    return window.FP_ENV?.platform === 'ios' ? c.iosApiKey : c.androidApiKey;
  }
  function rcConfigured() { return !!_plugin() && !!rcApiKey(); }

  async function _ensureConfigured() {
    const P = _plugin();
    if (!P) throw new Error('In-app purchases are not available in this build.');
    const key = rcApiKey();
    if (!key) throw new Error('Store billing is not configured yet.');
    const uid = window.FP_AUTH?.getActive?.()?.id || null;

    if (_configuredFor === null) {
      await P.configure(uid ? { apiKey: key, appUserID: uid } : { apiKey: key });
      _configuredFor = uid;
      return;
    }
    // User signed in / switched after configure — re-point the SDK.
    if (uid && uid !== _configuredFor && typeof P.logIn === 'function') {
      try { await P.logIn({ appUserID: uid }); _configuredFor = uid; } catch {}
    }
  }

  function _pickPackage(offering) {
    if (!offering) return null;
    const pkgs = offering.availablePackages || [];
    const wantId = rcCfg().packageId;
    if (wantId) {
      const hit = pkgs.find(p => p.identifier === wantId);
      if (hit) return hit;
    }
    return offering.lifetime || pkgs[0] || null;
  }

  function _entitlementActive(customerInfo) {
    const active = customerInfo?.entitlements?.active || {};
    return !!active[entitlementId()];
  }

  function _isCancelled(e) {
    if (!e) return false;
    if (e.userCancelled === true) return true;
    const s = ((e.code || '') + ' ' + (e.message || '')).toLowerCase();
    return s.includes('cancel');
  }

  async function rcBuy() {
    if (!_plugin()) return { unavailable: true, message: 'In-app purchases are not available in this build.' };
    if (!rcApiKey()) return { unavailable: true, message: 'Store billing is not configured yet.' };
    await _ensureConfigured();
    const P = _plugin();

    const offerings = await P.getOfferings();
    const cfg = rcCfg();
    const offering = (cfg.offeringId && offerings?.all?.[cfg.offeringId]) || offerings?.current || null;
    const pkg = _pickPackage(offering);
    if (!pkg) {
      return { unavailable: true, message: 'No products found. Check the RevenueCat offering and your store products.' };
    }
    try {
      const res = await P.purchasePackage({ aPackage: pkg });
      const activeNow = _entitlementActive(res?.customerInfo);
      const premium = await _pollPremium(activeNow);
      return premium ? { premium: true } : { pending: true };
    } catch (e) {
      if (_isCancelled(e)) return { cancelled: true };
      throw new Error(e?.message || 'Purchase failed. Please try again.');
    }
  }

  async function rcRestore() {
    if (!_plugin()) return { unavailable: true, message: 'In-app purchases are not available in this build.' };
    if (!rcApiKey()) return { unavailable: true, message: 'Store billing is not configured yet.' };
    await _ensureConfigured();
    const P = _plugin();
    const res = await P.restorePurchases();
    const activeNow = _entitlementActive(res?.customerInfo);
    const premium = await _pollPremium(activeNow);
    return { premium };
  }

  // ── Entitlement propagation ─────────────────────────────────────────────────
  // The webhook flips is_premium server-side; re-fetch the profile a few times
  // so the UI reflects it promptly. `hintActive` is what RevenueCat reported
  // locally — used only to decide how patiently to wait, never as the truth.
  async function _pollPremium(hintActive) {
    const refresh = window.FP_AUTH?.refreshProfile;
    if (typeof refresh !== 'function') return !!hintActive;
    const attempts = hintActive ? 6 : 2;
    for (let i = 0; i < attempts; i++) {
      try {
        const u = await refresh();
        if (u?.isPremium) return true;
      } catch {}
      if (i < attempts - 1) await new Promise(r => setTimeout(r, 1500));
    }
    return false;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  async function buy() {
    const account = window.FP_AUTH?.getActive?.();
    if (!account) {
      return { unavailable: true, message: 'Sign in or create an account first — Premium is tied to your account so it unlocks on every device.' };
    }
    if (provider() === 'revenuecat') return rcBuy();
    return stripeBuy(account.id);
  }

  async function restore() {
    const account = window.FP_AUTH?.getActive?.();
    if (!account) {
      return { premium: false, message: 'Sign in to the account you bought Premium with, then tap Restore.' };
    }
    if (provider() === 'revenuecat') return rcRestore();
    // Web: the flag lives on the server (Stripe webhook set it) — just re-sync.
    let premium = false;
    try {
      const u = await window.FP_AUTH.refreshProfile();
      premium = !!u?.isPremium;
    } catch {}
    return { premium };
  }

  function isConfigured() {
    return provider() === 'revenuecat' ? rcConfigured() : stripeConfigured();
  }

  // Human-readable price for the Premium screen. Native reads the real
  // localized price from RevenueCat; web falls back to the configured label.
  async function priceLabel() {
    if (provider() === 'revenuecat' && _plugin() && rcApiKey()) {
      try {
        await _ensureConfigured();
        const offerings = await _plugin().getOfferings();
        const cfg = rcCfg();
        const offering = (cfg.offeringId && offerings?.all?.[cfg.offeringId]) || offerings?.current || null;
        const pkg = _pickPackage(offering);
        const s = pkg?.product?.priceString;
        if (s) return s;
      } catch {}
      return '';
    }
    return (window.PREMIUM_LINKS || {}).priceLabel || '';
  }

  // Configure RevenueCat early on native so the first tap is instant, and keep
  // its appUserID in step with sign-in / sign-out.
  function init() {
    if (provider() !== 'revenuecat' || !_plugin() || !rcApiKey()) return;
    _ensureConfigured().catch(() => {});
    window.FP_AUTH?.subscribe?.(() => { _ensureConfigured().catch(() => {}); });
  }

  window.FP_BILLING = { provider, buy, restore, isConfigured, priceLabel, init };

  // Defer init one tick so FP_AUTH/FP_ENV are attached.
  setTimeout(() => { try { init(); } catch {} }, 0);
})();
