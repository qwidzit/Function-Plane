// Function Plane — progress sync, end to end against a fake Supabase
//
// Run by scripts/test.js in a child process, because accounts.js is async all
// the way down and the harness is not. Loads the real accounts.js into a
// sandbox with an in-memory localStorage and a Supabase stub, plays out the
// cases that have destroyed or resurrected saves before, and prints what
// happened as JSON for the test to assert on.

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const SRC    = path.join(__dirname, '..', 'function-plane', 'src');
const CUTOFF = Date.parse('2026-10-01T12:00:00Z');
const tick   = ms => new Promise(r => setTimeout(r, ms));

// opts: seed (localStorage), remote (server progress blob), cutoff (ms|null),
// session (bool), progressDelay (ms), progressError (bool), profileError (bool),
// stallUploads (how many progress uploads get no answer), fast (run the 10 s
// timeout and the retry gaps 250 times faster)
async function boot(opts) {
  const store = new Map(Object.entries(opts.seed || {}).map(([k, v]) => [k, JSON.stringify(v)]));
  const localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: k => { store.delete(k); },
    key: i => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  };
  const log = [];
  const uploads = [];
  const events = [];
  let stalls = opts.stallUploads || 0;
  let listener = null;
  const query = table => {
    const b = {
      select: () => b, eq: () => b, in: () => b, ilike: () => b,
      limit: async () => ({ data: [], error: null }),
      single: async () => answer(table),
      maybeSingle: async () => answer(table),
      upsert: rows => ({
        abortSignal(signal) {
          if (table === 'progress' && stalls-- > 0) {
            signal.addEventListener('abort', () => log.push('abort:' + table));
            return new Promise(() => {});
          }
          log.push('upsert:' + table);
          uploads.push({ table, rows: [].concat(rows) });
          return Promise.resolve({ error: null });
        },
      }),
    };
    return b;
  };
  async function answer(table) {
    log.push('get:' + table);
    if (table === 'game_state') return { data: { times_reset_at: opts.cutoff ? new Date(opts.cutoff).toISOString() : null }, error: null };
    if (table === 'admins')     return { data: null, error: null };
    if (table === 'profiles') {
      if (opts.profileError) return { data: null, error: { message: 'fetch failed' } };
      return { data: { name: 'P', avatar: 'a', total_stars: 9, is_premium: true }, error: null };
    }
    if (table === 'progress') {
      if (opts.progressDelay) await tick(opts.progressDelay);
      if (opts.progressError) return { data: null, error: { message: 'Failed to fetch' } };
      return { data: opts.remote ? { data: opts.remote } : null, error: null };
    }
    return { data: null, error: null };
  }
  const user = { id: 'u1', email: 'p@x' };
  const sb = {
    from: query,
    rpc: async () => ({ error: null }),
    auth: {
      getSession: async () => {
        log.push('getSession');
        // An expired token whose refresh could not reach the server.
        if (opts.sessionError) return { data: { session: null }, error: { message: 'Failed to fetch' } };
        return { data: { session: opts.session === false ? null : { user } } };
      },
      onAuthStateChange(fn) { log.push('listen'); listener = fn; },
      signOut: async () => ({ error: null }),
      signUp: async () => {
        // Autoconfirm: the session is adopted before signUp returns.
        listener && listener('SIGNED_IN', { user });
        await tick(5);
        return { data: { user }, error: null };
      },
    },
  };
  const ctx = {
    localStorage, Promise, Date, clearTimeout, AbortController,
    // The stalled upload is expected to warn; keep it out of the test output.
    console: opts.stallUploads ? { ...console, warn() {} } : console,
    // The upload debounce is 1.5 s; run it at 60 ms so a slow download can
    // still be slower than it.
    setTimeout: (fn, ms) => setTimeout(fn, ms === 1500 ? 60 : opts.fast && ms >= 10000 ? ms / 250 : ms),
    navigator: { onLine: true },
    CustomEvent: class { constructor(type, o) { this.type = type; this.detail = o?.detail; } },
    addEventListener() {}, dispatchEvent(e) { events.push(e.detail); },
    SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon',
    supabase: { createClient: () => sb },
    starBitsOf: (n, bits) => bits ?? 0, starCount: bits => bits,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(SRC, 'accounts.js'), 'utf8'), ctx);
  await tick(20);
  const read = k => (store.has(k) ? JSON.parse(store.get(k)) : null);
  return { ctx, uploads, log, read, events, fire: (event, session) => listener(event, session) };
}

const played = {
  'r-I': {
    stars: [3, 2, -1], starBits: [7, 3, null], best: [20, 40, null],
    bestTime: [2.5, 3.1, null], bestTimeAt: [CUTOFF - 60000, null, null],
    history: [[{ exprs: ['y=x'], time: 2.5, ts: CUTOFF - 60000 }], null, null],
  },
};
const fresh = { 'r-I': { stars: Array(10).fill(-1), best: Array(10).fill(null) } };
const progressUploads = u => u.filter(x => x.table === 'progress').map(x => x.rows[0].data);

(async () => {
  const out = { cutoff: CUTOFF };

  // Times reset: a device from before the reset, signed in and as a guest.
  {
    const { read } = await boot({ cutoff: CUTOFF, seed: { 'fp-progress-u1': played, 'fp-progress': played, 'fp-last-user': 'u1' } });
    await tick(120);
    out.reset = { account: read('fp-progress-u1')['r-I'], guest: read('fp-progress')['r-I'], cutoff: read('fp-times-reset') };
  }

  // Offline when the reset happened, faster since; the server holds an older,
  // faster, undated time.
  {
    const offline = { 'r-I': { ...played['r-I'], bestTime: [4.4, 3.1, null], bestTimeAt: [CUTOFF + 5000, null, null] } };
    const { uploads, read } = await boot({
      cutoff: CUTOFF, seed: { 'fp-progress-u1': offline, 'fp-last-user': 'u1' },
      remote: { 'r-I': { ...played['r-I'], bestTime: [1.9, 2.0, null], bestTimeAt: [null, null, null] } },
    });
    await tick(120);
    out.offline = { local: read('fp-progress-u1')['r-I'], scores: uploads.filter(u => u.table === 'level_scores').pop()?.rows };
  }

  // A fresh install signs in and the progress download fails: nothing may be
  // uploaded over the cloud save.
  {
    const { ctx, uploads } = await boot({ progressError: true, remote: played });
    ctx.FP_AUTH.updateActiveProgress(fresh);   // what the app does on mount
    await tick(150);
    out.failedDownload = { progressUploads: progressUploads(uploads).length };
  }

  // A slow download: the app's first write must wait for it, and what goes up
  // is the merge, not the empty install.
  {
    const { ctx, uploads } = await boot({ progressDelay: 200, remote: played });
    ctx.FP_AUTH.updateActiveProgress(fresh);
    await tick(400);
    const up = progressUploads(uploads);
    out.slowDownload = { first: up[0]?.['r-I']?.stars ?? null, count: up.length };
  }

  // Registering: the guest's progress becomes the account's, and the guest
  // save is cleared so it cannot seed the next account.
  {
    const { ctx, read } = await boot({ session: false, seed: { 'fp-progress': played } });
    await ctx.FP_AUTH.register({ name: 'Newbie', email: 'n@x', password: 'secret12' });
    await tick(150);
    out.register = { account: read('fp-progress-u1')?.['r-I']?.stars ?? null, guest: read('fp-progress') };
  }

  // The auth listener is registered before the session check, which can time
  // out offline; a failed profile read is not cached as "no premium".
  {
    const { log, read } = await boot({ profileError: true, seed: { 'fp-profile-u1': { id: 'u1', isPremium: true }, 'fp-last-user': 'u1' } });
    await tick(120);
    out.boot = { listenFirst: log.indexOf('listen') < log.indexOf('getSession'), premiumKept: read('fp-profile-u1')?.isPremium === true };
  }

  // Offline with an expired token: the refresh fails, the session comes back
  // null with an error and then as INITIAL_SESSION null. The account stays.
  {
    const { ctx, fire, read } = await boot({
      sessionError: true, seed: { 'fp-profile-u1': { id: 'u1', name: 'P' }, 'fp-last-user': 'u1', 'fp-progress-u1': played },
    });
    const afterCheck = ctx.FP_AUTH.getActive()?.id ?? null;
    fire('INITIAL_SESSION', null);
    const afterNull = read('fp-last-user');
    fire('SIGNED_OUT', null);
    out.offlineBoot = { afterCheck, afterNull, afterSignOut: ctx.FP_AUTH.getActive() };
  }

  // Back in the foreground, supabase-js emits SIGNED_IN again for the same
  // session; the save was downloaded at boot and is not downloaded twice.
  {
    const { log, fire } = await boot({ remote: played, seed: { 'fp-last-user': 'u1' } });
    await tick(120);
    fire('SIGNED_IN', { user: { id: 'u1', email: 'p@x' } });
    await tick(120);
    out.foreground = { downloads: log.filter(x => x === 'get:progress').length };
  }

  // A progress upload that gets no answer: the score rows go up anyway, the
  // stalled request is cancelled, the player is told once, and the upload is
  // tried again without being asked.
  {
    const { log, events } = await boot({
      fast: true, stallUploads: 1, remote: played, seed: { 'fp-progress-u1': played, 'fp-last-user': 'u1' },
    });
    await tick(500);
    out.stalled = { events, sent: log.filter(x => /^(upsert|abort):/.test(x)) };
  }

  process.stdout.write(JSON.stringify(out));
})().catch(e => { process.stdout.write(JSON.stringify({ error: e.stack })); });
