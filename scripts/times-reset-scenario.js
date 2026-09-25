// Function Plane — the one-time reset of best times, end to end
//
// Run by scripts/test.js in a child process, because accounts.js is async all
// the way down and the harness is not. Loads the real accounts.js into a
// sandbox with an in-memory localStorage and a Supabase stub whose game_state
// carries a times_reset_at cutoff, then prints what happened as JSON for the
// test to assert on.

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const SRC    = path.join(__dirname, '..', 'function-plane', 'src');
const CUTOFF = Date.parse('2026-10-01T12:00:00Z');
const tick   = ms => new Promise(r => setTimeout(r, ms));

async function boot({ seed, remote }) {
  const store = new Map(Object.entries(seed).map(([k, v]) => [k, JSON.stringify(v)]));
  const localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: k => { store.delete(k); },
    key: i => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  };
  const uploads = [];
  const query = table => {
    const b = {
      select: () => b, eq: () => b, in: () => b,
      single: async () => {
        if (table === 'game_state') return { data: { times_reset_at: new Date(CUTOFF).toISOString() }, error: null };
        if (table === 'profiles')   return { data: { name: 'P', avatar: 'a', total_stars: 9, is_premium: false }, error: null };
        if (table === 'progress')   return { data: remote ? { data: remote } : null, error: null };
        return { data: null, error: null };
      },
      upsert: async rows => { uploads.push({ table, rows: [].concat(rows) }); return { error: null }; },
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
    localStorage, console, Promise, Date, clearTimeout,
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
  return { ctx, uploads, read };
}

// Played before the reset: fast times, one dated before the cutoff and one
// from a build that never dated them.
const before = {
  'r-I': {
    stars: [3, 2, -1], starBits: [7, 3, null], best: [20, 40, null],
    bestTime: [2.5, 3.1, null], bestTimeAt: [CUTOFF - 60000, null, null],
    history: [[{ exprs: ['y=x'], time: 2.5, ts: CUTOFF - 60000 }], null, null],
  },
};

(async () => {
  const out = {};

  // A device from before the reset, with an upload queued offline.
  {
    const { uploads, read } = await boot({
      seed: {
        'fp-progress-u1': before, 'fp-progress': before, 'fp-last-user': 'u1',
        'fp-pending-upload': { userId: 'u1', progress: before, ts: 1 },
      },
    });
    out.boot = {
      account: read('fp-progress-u1')['r-I'], guest: read('fp-progress')['r-I'],
      queue: read('fp-pending-upload'), cutoff: read('fp-times-reset'),
      uploadedTimes: uploads.flatMap(u => u.table === 'level_scores' ? u.rows.map(r => r.best_time) : u.rows.map(r => r.data['r-I'].bestTime)).flat(),
    };
  }

  // Offline when the reset happened, and faster since — while the server still
  // holds the old, even faster, undated time.
  {
    const offline = { 'r-I': { ...before['r-I'], bestTime: [4.4, 3.1, null], bestTimeAt: [CUTOFF + 5000, null, null] } };
    const { uploads, read } = await boot({
      seed: { 'fp-progress-u1': offline, 'fp-last-user': 'u1' },
      remote: { 'r-I': { ...before['r-I'], bestTime: [1.9, 2.0, null], bestTimeAt: [null, null, null] } },
    });
    out.offline = { local: read('fp-progress-u1')['r-I'], scores: uploads.filter(u => u.table === 'level_scores').pop()?.rows };
  }

  process.stdout.write(JSON.stringify({ cutoff: CUTOFF, ...out }));
})().catch(e => { process.stdout.write(JSON.stringify({ error: e.stack })); });
