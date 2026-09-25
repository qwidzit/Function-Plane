// Function Plane — reset epoch, end to end against a fake Supabase
//
// Run by scripts/test.js in a child process, because accounts.js is async all
// the way down and the harness is not. Loads the real accounts.js into a
// sandbox with an in-memory localStorage and a Supabase stub that enforces
// the epoch the way 20260925_reset_epoch.sql does, then prints what happened
// as JSON for the test to assert on.

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const SRC = path.join(__dirname, '..', 'function-plane', 'src');
const tick = ms => new Promise(r => setTimeout(r, ms));

async function boot({ seed, serverEpoch }) {
  const store = new Map(Object.entries(seed).map(([k, v]) => [k, JSON.stringify(v)]));
  const localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: k => { store.delete(k); },
    key: i => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  };
  const server = { epoch: serverEpoch, uploads: [] };
  const query = table => {
    const b = {
      select: () => b, eq: () => b, in: () => b,
      single: async () => {
        if (table === 'game_state') return { data: { reset_epoch: server.epoch }, error: null };
        if (table === 'profiles')   return { data: { name: 'P', avatar: 'a', total_stars: 9, is_premium: false }, error: null };
        return { data: null, error: null };
      },
      upsert: async rows => {
        for (const row of [].concat(rows)) {
          if ((row.epoch ?? 0) < server.epoch) return { error: { message: 'stale_epoch: this progress predates the last reset' } };
        }
        server.uploads.push({ table, rows: [].concat(rows) });
        return { error: null };
      },
    };
    return b;
  };
  const sb = {
    from: query,
    rpc: async () => ({ error: null }),
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'u1', email: 'p@x' } } } }),
      onAuthStateChange() {},
      signOut: async () => {},
    },
  };
  const ctx = {
    localStorage, console, Promise, clearTimeout,
    // The upload debounce is the only 1.5 s timer; everything else keeps its delay.
    setTimeout: (fn, ms) => setTimeout(fn, ms === 1500 ? 0 : ms),
    navigator: { onLine: true },
    CustomEvent: class { constructor(type, o) { this.type = type; this.detail = o?.detail; } },
    addEventListener() {}, dispatchEvent() {},
    SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon',
    supabase: { createClient: () => sb },
    starBitsOf: (n, bits) => bits ?? 0, starCount: bits => bits,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(SRC, 'accounts.js'), 'utf8'), ctx);
  await tick(30);
  const read = k => (store.has(k) ? JSON.parse(store.get(k)) : null);
  return { ctx, server, read };
}

const played = { 'r-I': { stars: [3, 2, -1], best: [20, 40, null] } };

(async () => {
  const out = {};

  // A device from before the reset: progress for the account and a guest,
  // plus an upload queued offline by a build that never stamped an epoch.
  {
    const { ctx, server, read } = await boot({
      serverEpoch: 1,
      seed: {
        'fp-progress-u1': played, 'fp-progress': played,
        'fp-pending-upload': { userId: 'u1', progress: played, ts: 1 },
        'fp-last-user': 'u1', 'fp-settings': { theme: 'dark' },
      },
    });
    out.boot = {
      account: read('fp-progress-u1'), guest: read('fp-progress'), queue: read('fp-pending-upload'),
      epoch: read('fp-epoch'), settings: read('fp-settings'), staleAccepted: server.uploads.length,
    };
    ctx.FP_AUTH.updateActiveProgress({ 'r-I': { stars: [1], best: [60] } });
    await tick(30);
    out.after = { local: read('fp-progress-u1'), uploads: server.uploads };
  }

  // A reset lands while the app is open: the next upload is refused, and the
  // refusal is what tells the device.
  {
    const { ctx, server, read } = await boot({
      serverEpoch: 1,
      seed: { 'fp-progress-u1': played, 'fp-epoch': 1, 'fp-last-user': 'u1' },
    });
    server.epoch = 2;
    ctx.FP_AUTH.updateActiveProgress(played);
    await tick(30);
    out.live = { local: read('fp-progress-u1'), epoch: read('fp-epoch'), uploads: server.uploads.length };
  }

  process.stdout.write(JSON.stringify(out));
})().catch(e => { process.stdout.write(JSON.stringify({ error: e.stack })); });
