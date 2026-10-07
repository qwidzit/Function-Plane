// Function Plane — Play Billing, end to end against a fake Google Play
//
// Run by scripts/test.js in a child process. Loads the real billing.js and the
// plugin's real JavaScript (vendor/cdv-purchase.js) into a sandbox where the
// only fake is the native half, Capacitor.Plugins.PurchasePlugin, answering in
// the shapes PurchasePlugin.java sends. Prints what happened as JSON.

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const APP  = path.join(__dirname, '..', 'function-plane');
const tick = ms => new Promise(r => setTimeout(r, ms));
// The plugin batches purchase updates before it reports them approved.
const SETTLE = 1200;

const PRODUCT = {
  productId: 'premium_lifetime', title: 'Premium', name: 'Premium', description: 'Everything',
  product_type: 'inapp', product_format: 'v11.0',
  formatted_price: '€4.90', price_amount_micros: 4900000, price_currency_code: 'EUR',
};
const purchase = (token, acknowledged) => ({
  orderId: 'GPA.' + token, packageName: 'app.functionplane', productId: 'premium_lifetime',
  purchaseTime: 1791000000000, purchaseState: 0, purchaseToken: token, quantity: 1,
  productIds: ['premium_lifetime'], getPurchaseState: 1, acknowledged, autoRenewing: false,
  signature: 'sig', receipt: '{}',
});

// opts: owned (purchases Play already holds), verify (token -> { premium, pending } | throws),
// channel ('play' | 'web')
async function boot(opts = {}) {
  const owned = [...(opts.owned || [])];
  const calls = [];
  const events = [];
  const listeners = {};
  const emit = (name, data) => (listeners[name] || []).forEach(fn => fn(data));
  const plugin = {
    addListener(name, fn) { (listeners[name] = listeners[name] || []).push(fn); return Promise.resolve({ remove() {} }); },
    async init() { calls.push('init'); },
    async getAvailableProducts() { calls.push('products'); return { products: [PRODUCT] }; },
    async getPurchases() { calls.push('getPurchases'); emit('setPurchases', { purchases: owned }); },
    async buy({ productId }) {
      calls.push('buy:' + productId);
      const p = purchase('tok-new', false);
      owned.push(p);
      emit('purchasesUpdated', { purchases: [p] });
    },
    async acknowledgePurchase({ purchaseToken }) {
      calls.push('ack:' + purchaseToken);
      const p = owned.find(x => x.purchaseToken === purchaseToken);
      if (p) p.acknowledged = true;
    },
    async getStorefront() { return { countryCode: 'NL' }; },
  };

  const ctx = {
    console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
    Promise, Date, setTimeout, clearTimeout, setInterval, clearInterval, JSON, Object, Array, Math, Error,
    navigator: { userAgent: 'node', onLine: true },
    CustomEvent: class { constructor(type, o) { this.type = type; this.detail = o?.detail; } },
    addEventListener() {}, removeEventListener() {},
    dispatchEvent(e) { events.push({ type: e.type, ...e.detail }); },
    FP_PAY_CHANNEL: opts.channel || 'play',
    Capacitor: { Plugins: { PurchasePlugin: plugin }, getPlatform: () => 'android' },
    FP_AUTH: {
      async verifyPlayPurchase(token) {
        calls.push('verify:' + token);
        return (opts.verify || (() => ({ premium: true })))(token);
      },
    },
    document: {
      createElement: () => ({}),
      // The one <script> billing.js adds: run it the way the WebView would.
      head: { appendChild(el) {
        calls.push('load:' + el.src);
        setTimeout(() => vm.runInContext(fs.readFileSync(path.join(APP, el.src), 'utf8'), ctx), 5);
      } },
      addEventListener() {},
    },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(APP, 'src', 'billing.js'), 'utf8'), ctx);
  return { ctx, calls, events, owned };
}

(async () => {
  const out = {};

  // A cold boot of the Play build: the plugin's script is loaded, the store
  // comes up, and the premium card is told it can show.
  {
    const { ctx, calls, events } = await boot();
    const before = ctx.FP_BILLING.available();
    await ctx.FP_BILLING.start();
    await tick(50);
    out.boot = {
      before, after: ctx.FP_BILLING.available(), loaded: calls.includes('load:vendor/cdv-purchase.js'),
      ready: events.some(e => e.type === 'fp-billing-ready'),
      price: ctx.CdvPurchase.store.get('premium_lifetime')?.getOffer()?.pricingPhases?.[0]?.price ?? null,
    };
  }

  // Buying: the token goes to the server, and only the server's yes
  // acknowledges the purchase to Google.
  {
    const { ctx, calls, events } = await boot();
    await ctx.FP_BILLING.buy();
    await tick(SETTLE);
    out.buy = { calls: calls.filter(c => /^(buy|verify|ack)/.test(c)), events: events.filter(e => e.type === 'fp-premium') };
  }

  // The server refuses: nothing is acknowledged, so Google refunds it.
  {
    const { ctx, calls, events } = await boot({ verify: () => { throw new Error('That purchase was refunded'); } });
    await ctx.FP_BILLING.buy();
    await tick(SETTLE);
    out.refused = { acked: calls.some(c => c.startsWith('ack')), events: events.filter(e => e.type === 'fp-premium') };
  }

  // A pending payment (cash, slow card): not premium yet, and not acknowledged.
  {
    const { ctx, calls, events } = await boot({ verify: () => ({ premium: false, pending: true }) });
    await ctx.FP_BILLING.buy();
    await tick(SETTLE);
    out.pending = { acked: calls.some(c => c.startsWith('ack')), events: events.filter(e => e.type === 'fp-premium') };
  }

  // Restore on a second device: Play already holds an acknowledged purchase.
  {
    const { ctx, calls } = await boot({ owned: [purchase('tok-old', true)] });
    const granted = await ctx.FP_BILLING.restore();
    await tick(50);
    out.restore = { granted, verified: calls.filter(c => c.startsWith('verify')) };
  }

  // Restore with nothing bought.
  {
    const { ctx, calls } = await boot();
    out.restoreNone = { granted: await ctx.FP_BILLING.restore(), verified: calls.filter(c => c.startsWith('verify')).length };
  }

  // The web build never loads the plugin.
  {
    const { ctx, calls } = await boot({ channel: 'web' });
    const ok = await ctx.FP_BILLING.start();
    out.web = { ok, loaded: calls.some(c => c.startsWith('load')), available: ctx.FP_BILLING.available() };
  }

  process.stdout.write(JSON.stringify(out), () => process.exit(0));
})().catch(e => { process.stdout.write(JSON.stringify({ error: e.stack }), () => process.exit(0)); });
