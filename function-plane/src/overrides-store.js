// Function Plane — override data store (window.FP_DATA)
//
// Levels, packs and achievements are defined by "override" rows in Supabase.
// Previously the app downloaded all three tables on every boot and, when the
// network was down, silently fell back to the built-in defaults — which meant
// offline players got the wrong (much easier) levels and could farm cheap
// stars and records that later synced to the real leaderboards.
//
// This store makes the on-device data authoritative and the network a cheap
// freshness check:
//
//   1. BOOT (synchronous, before first render): apply the best local copy —
//      the build-time snapshot (overrides-snapshot.js, committed with the
//      app) or the localStorage cache of the last successful fetch,
//      whichever is newer. No network involved; offline boots always play
//      the last-known-correct levels.
//   2. SYNC (async, after boot): ask the server only for a tiny version
//      signature per table (row count + newest updated_at — a few hundred
//      bytes). Only when it differs from the local signature are the full
//      tables downloaded, applied, and cached for the next offline boot.
//   3. FAIL-SAFE: any network error keeps the current data. Nothing is ever
//      overwritten with empty results.
//
// The admin screen calls FP_DATA.sync({ force: true }) after saving so its
// own edits round-trip immediately.

(function () {
  'use strict';

  const CACHE_KEY = 'fp-overrides-cache';

  // ── Version signature ──────────────────────────────────────────────────
  // Per table: "<count of rows with updated_at>:<max updated_at>". Computed
  // identically from local data (here) and by the server-side version query
  // (FP_AUTH.fetchOverridesVersion), so equality means "nothing changed".
  // Count catches inserts/deletes, max(updated_at) catches edits.
  function tableSig(rows) {
    let count = 0, max = '';
    for (const r of rows || []) {
      if (r && r.updated_at) {
        count++;
        if (r.updated_at > max) max = r.updated_at;
      }
    }
    return count + ':' + max;
  }
  function sigOf(data) {
    return {
      packs:        tableSig(data.packs),
      levels:       tableSig(data.levels),
      achievements: tableSig(data.achievements),
    };
  }
  function sigEqual(a, b) {
    return !!a && !!b && a.packs === b.packs && a.levels === b.levels &&
           a.achievements === b.achievements;
  }
  // Newest updated_at across all tables — used only to pick between the
  // baked snapshot and the localStorage cache at boot.
  function maxTsOf(data) {
    let max = '';
    for (const rows of [data.packs, data.levels, data.achievements]) {
      for (const r of rows || []) {
        if (r && r.updated_at && r.updated_at > max) max = r.updated_at;
      }
    }
    return max;
  }

  function readCache() {
    try {
      const v = JSON.parse(localStorage.getItem(CACHE_KEY));
      return v && v.data ? v : null;
    } catch { return null; }
  }
  function writeCache(data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data, savedAt: Date.now() })); }
    catch {}
  }

  let current = null;   // { data, sig } — what's applied right now
  let source  = 'none'; // 'snapshot' | 'cache' | 'network' | 'none'

  function apply(data, src) {
    window.applyOverrides(data);
    current = { data, sig: sigOf(data) };
    source = src;
  }

  // ── 1. Boot: apply best local copy, synchronously ──────────────────────
  (function applyBestLocal() {
    const snap  = window.FP_OVERRIDES_SNAPSHOT?.data || null;
    const cache = readCache()?.data || null;
    if (snap && cache) {
      // Cache wins only when strictly newer; on a tie the snapshot is
      // authoritative (it is a full dump — catches delete-only changes).
      if (maxTsOf(cache) > maxTsOf(snap)) apply(cache, 'cache');
      else apply(snap, 'snapshot');
    } else if (cache) {
      apply(cache, 'cache');
    } else if (snap) {
      apply(snap, 'snapshot');
    }
  })();

  // ── 2 + 3. Sync: cheap version check, full fetch only when changed ─────
  let _inflight = null;

  function sync({ force = false } = {}) {
    if (_inflight) {
      // A forced sync must not be swallowed by an in-flight version check —
      // run it after the current one settles.
      if (force) return _inflight.then(() => sync({ force: true }));
      return _inflight;
    }
    _inflight = (async () => {
      try {
        const auth = window.FP_AUTH;
        if (!auth || !auth.fetchOverridesVersion) return { updated: false };

        if (!force && current) {
          const remote = await auth.fetchOverridesVersion();
          if (!remote) return { updated: false };            // guest mode
          if (sigEqual(remote, current.sig)) return { updated: false };
        }

        const data = await auth.fetchOverrides();            // throws on error
        apply(data, 'network');
        writeCache(data);
        return { updated: true };
      } catch (e) {
        // Offline or server trouble — keep whatever we have.
        console.warn('FP_DATA sync (kept current data):', e?.message || e);
        return { updated: false, error: true };
      } finally {
        _inflight = null;
      }
    })();
    return _inflight;
  }

  window.FP_DATA = {
    sync,
    getSource: () => source,
    getSignature: () => current?.sig || null,
  };
})();
