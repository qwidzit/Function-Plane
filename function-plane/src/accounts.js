// Function Plane — FP_AUTH backed by Supabase
//
// Provides: register / signIn / signOut / getActive (sync, cached) /
//           getActiveProgress (sync, localStorage cache) /
//           updateActiveProgress (sync write + async Supabase upload) /
//           buildLeaderboard (async) / subscribe
//
// If SUPABASE_URL / SUPABASE_ANON_KEY are not filled in yet the module runs
// in guest mode — all local features work, no network calls are made.

(() => {
  const AVATARS = ['🟢','🟣','🟠','🔵','🟡','🔴','⚫','⚪','🟤'];
  const PROGRESS_PREFIX = 'fp-progress-';
  const PROFILE_PREFIX  = 'fp-profile-';
  const LAST_USER_KEY   = 'fp-last-user';
  const GUEST_KEY       = 'fp-progress';

  // Module-level cache — keeps getActive() / getActiveProgress() synchronous
  let _sb          = null;   // supabase client
  let _currentUser = null;   // { id, email, name, avatar, totalStars } | null
  let _syncTimer   = null;

  const subscribers = new Set();
  const notify = () => subscribers.forEach(fn => { try { fn(); } catch {} });

  // Sync errors are surfaced via a CustomEvent that the App listens for and
  // shows in a toast — silent failures are exactly what made the last round
  // of "saves don't work" bugs hard to track down.
  function _emitSyncError(msg) {
    try { window.dispatchEvent(new CustomEvent('fp-sync-error', { detail: msg })); }
    catch {}
  }

  // fetch() has no default timeout, so a request that is never answered — a
  // paused Supabase project, a captive portal, a network that black-holes
  // rather than refuses — leaves its promise pending forever, and any spinner
  // waiting on it stays up for good. Every network call goes through this so a
  // stall becomes a reportable error instead of an eternal "Loading…".
  const NET_TIMEOUT_MS = 10000;
  function _withTimeout(promise, what) {
    let timer;
    return Promise.race([
      Promise.resolve(promise).finally(() => clearTimeout(timer)),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${what} timed out — the server did not respond`)),
          NET_TIMEOUT_MS,
        );
      }),
    ]);
  }

  // Writes have to be bounded *and* retried. On networks whose middleboxes
  // throttle a connection after the handshake, the CORS preflight gets through
  // and the POST that follows is simply never delivered — measured from Russia:
  // every GET and OPTIONS answered 200, not one POST or PATCH ever arrived. An
  // unbounded write there leaves "Saving…" up forever with no error. Every one
  // of these is an upsert or a delete, so retrying is idempotent.
  function _write(call, what) {
    return _withTimeout(call(), what).catch(e => {
      if (!/timed out/.test(e?.message || '')) throw e;
      return _withTimeout(call(), what);
    });
  }

  const readJSON  = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
  const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const progressKey = id  => id ? PROGRESS_PREFIX + id : GUEST_KEY;
  // The profile row and the id of whoever was signed in last, kept on disk for
  // the same reason the level data is: so a boot with no network shows the
  // player their own game instead of a stranger's empty one. Progress was
  // always local; who it belonged to was not, so none of it could be shown.
  const profileKey  = id  => PROFILE_PREFIX + id;

  // ── Initialise ────────────────────────────────────────────────────────────

  async function _init() {
    const url = window.SUPABASE_URL  || '';
    const key = window.SUPABASE_ANON_KEY || '';
    if (!url || url.includes('YOUR-PROJECT') || !key || key.includes('YOUR-ANON')) {
      console.info('FP_AUTH: Supabase not configured — guest mode');
      return;
    }

    _sb = window.supabase.createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true },
    });

    // Show the last account this device saw before asking the network anything.
    // Its profile and its progress are both on disk, so an offline boot is a
    // playable game rather than a guest screen.
    const lastId = readJSON(LAST_USER_KEY, null);
    const cached = lastId ? readJSON(profileKey(lastId), null) : null;
    if (cached) { _currentUser = cached; notify(); }

    // Restore the session (returning visitor on the same device). Bounded: an
    // expired token makes this refresh over the network, and unbounded it is a
    // boot that never finishes.
    let session = null;
    try {
      ({ data: { session } } = await _withTimeout(_sb.auth.getSession(), 'Session check'));
    } catch (e) {
      _emitSyncError(e.message);   // keep the cached account and play offline
      return;
    }
    if (session) _adoptSession(session.user, true);
    else if (cached) { _forgetAccount(); }
    else notify();

    // Keep the cache in sync when auth state changes (sign-in / sign-out /
    // token refresh). Deliberately not an async callback: supabase-js runs
    // these inside its auth lock, and awaiting other Supabase calls in here
    // deadlocks every later request until the lock times out — which is
    // exactly what made signing in take minutes and then complete by itself.
    _sb.auth.onAuthStateChange((event, session) => {
      if (!session) { _forgetAccount(); return; }
      _adoptSession(session.user, event === 'SIGNED_IN');
    });
  }

  function _forgetAccount() {
    _currentUser = null;
    writeJSON(LAST_USER_KEY, null);
    notify();
  }

  // Take the session's identity now, from whatever is cached, and confirm it
  // against the server afterwards. Every await in here used to sit between the
  // player and their own save file.
  async function _adoptSession(user, download) {
    const cached = readJSON(profileKey(user.id), null);
    _currentUser = {
      id: user.id, email: user.email,
      name:       cached?.name   || user.user_metadata?.name   || 'Player',
      avatar:     cached?.avatar || user.user_metadata?.avatar || '🟢',
      totalStars: cached?.totalStars || 0,
      isPremium:  !!cached?.isPremium,
    };
    writeJSON(LAST_USER_KEY, user.id);
    notify();

    try {
      _currentUser = await _fetchProfile(user);
      writeJSON(profileKey(user.id), _currentUser);
      notify();
    } catch (e) { _emitSyncError(e.message); }

    if (!download) return;
    try { await _syncProgressDown(user.id); _flushQueue(); }
    catch (e) { _emitSyncError(e.message); }
  }

  async function _fetchProfile(user) {
    if (!_sb) return null;
    const { data } = await _withTimeout(_sb.from('profiles')
      .select('name, avatar, total_stars, is_premium').eq('id', user.id).single(), 'Profile');
    return {
      id:         user.id,
      email:      user.email,
      name:       data?.name  || user.user_metadata?.name   || 'Player',
      avatar:     data?.avatar || user.user_metadata?.avatar || '🟢',
      totalStars: data?.total_stars || 0,
      isPremium:  !!data?.is_premium,
    };
  }

  // Download remote progress, merge with local, push merged back up
  async function _syncProgressDown(userId, skipUpload = false) {
    if (!_sb) return;
    const { data } = await _withTimeout(
      _sb.from('progress').select('data').eq('user_id', userId).single(), 'Progress');
    const remote   = data?.data || null;
    const local    = readJSON(progressKey(userId), null);
    const merged   = _mergeProgress(remote, local);
    writeJSON(progressKey(userId), merged);
    // Whatever came down is on disk but not on screen: the app reads progress
    // out of here when it is told to, and nothing else tells it.
    notify();
    if (!skipUpload && merged) _scheduleUpload(userId, merged);
  }

  // Merge two progress snapshots, taking the best of each level
  function _mergeProgress(a, b) {
    if (!a) return b;
    if (!b) return a;
    const out = {};
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      const pa = a[k] || { stars: [], best: [] };
      const pb = b[k] || { stars: [], best: [] };
      // Which stars are lit merges as a union, not a maximum: one device may
      // hold the score goal and the other the equation goal, and taking the
      // higher count would drop one of them. The count follows from the union
      // so the two can never disagree.
      const bits = Array.from({ length: 10 }, (_, i) => {
        const na = pa.stars?.[i] ?? null, nb = pb.stars?.[i] ?? null;
        if (na === null && nb === null) return null;
        return starBitsOf(na ?? 0, pa.starBits?.[i]) | starBitsOf(nb ?? 0, pb.starBits?.[i]);
      });
      out[k] = {
        starBits: bits,
        stars: Array.from({ length: 10 }, (_, i) => {
          const sa = pa.stars?.[i] ?? null, sb = pb.stars?.[i] ?? null;
          if (sa === null && sb === null) return null;
          // -1 is "attempted, never cleared", which has no bits to union.
          if (!bits[i]) return Math.max(sa ?? -1, sb ?? -1);
          return starCount(bits[i]);
        }),
        best: Array.from({ length: 10 }, (_, i) => {
          const ba = pa.best?.[i] ?? null, bb = pb.best?.[i] ?? null;
          if (ba === null && bb === null) return null;
          if (ba === null) return bb;
          if (bb === null) return ba;
          return Math.min(ba, bb); // lower score = better (fewer equations used)
        }),
        bestTime: Array.from({ length: 10 }, (_, i) => {
          const ta = pa.bestTime?.[i] ?? null, tb = pb.bestTime?.[i] ?? null;
          if (ta === null && tb === null) return null;
          if (ta === null) return tb;
          if (tb === null) return ta;
          return Math.min(ta, tb);
        }),
        maxScore: Array.from({ length: 10 }, (_, i) => {
          const ma = pa.maxScore?.[i] ?? null, mb = pb.maxScore?.[i] ?? null;
          if (ma === null && mb === null) return null;
          return Math.max(ma ?? -Infinity, mb ?? -Infinity);
        }),
        // Follows whichever side owns the better score, so the equations
        // always describe the run that produced it.
        bestEqs: Array.from({ length: 10 }, (_, i) => {
          const ba = pa.best?.[i] ?? null, bb = pb.best?.[i] ?? null;
          if (ba === null) return pb.bestEqs?.[i] ?? null;
          if (bb === null) return pa.bestEqs?.[i] ?? null;
          return (ba <= bb ? pa.bestEqs?.[i] : pb.bestEqs?.[i]) ?? null;
        }),
        // Winning runs from both sides, newest first, one entry per distinct
        // set of equations. A union rather than a pick: two devices holding
        // different answers to the same level should end up holding both.
        history: Array.from({ length: 10 }, (_, i) => {
          const ra = pa.history?.[i] || [], rb = pb.history?.[i] || [];
          if (!ra.length && !rb.length) return null;
          const seen = {}, merged = [];
          for (const r of [...ra, ...rb].sort((x, y) => (y.ts || 0) - (x.ts || 0))) {
            const sig = (r.exprs || []).join('||');
            if (seen[sig]) continue;
            seen[sig] = 1;
            merged.push(r);
          }
          return merged.slice(0, 10);
        }),
      };
    }
    return out;
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  async function register({ name, email, password }) {
    name  = (name  || '').trim();
    email = (email || '').trim().toLowerCase();
    if (!name)                    throw new Error('Display name is required');
    if (!email.includes('@'))     throw new Error('Enter a valid email address');
    if ((password||'').length < 6) throw new Error('Password must be at least 6 characters');
    if (!_sb)                     throw new Error('Supabase is not configured yet');

    // Pre-check name uniqueness so we fail fast with a clear message
    const avail = await checkNameAvailable(name);
    if (!avail.available) throw new Error(avail.reason || 'That name is taken');

    const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
    const { data, error } = await _sb.auth.signUp({
      email, password,
      options: { data: { name, avatar } },
    });
    if (error) {
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('23505')) {
        throw new Error('That name is taken');
      }
      throw new Error(error.message);
    }

    // Migrate any guest progress to the new account
    const guestProgress = readJSON(GUEST_KEY, null);
    if (guestProgress && data.user) {
      writeJSON(progressKey(data.user.id), guestProgress);
    }
    return { id: data.user?.id, name, email, avatar };
  }

  async function signIn({ email, password }) {
    if (!_sb) throw new Error('Supabase is not configured yet');
    const { error } = await _withTimeout(_sb.auth.signInWithPassword({
      email: (email || '').trim().toLowerCase(), password,
    }), 'Sign in');
    if (error) throw new Error(
      error.message.toLowerCase().includes('invalid') ? 'Incorrect email or password' : error.message
    );
    return _currentUser;
  }

  async function signOut() {
    if (_sb) await _sb.auth.signOut();
  }

  // Delete the signed-in user's account. Required by Google Play (2024+).
  // Removes: progress, level_scores, profile row. Then signs out so the local
  // session cache is cleared. The auth.users row is removed by Supabase on
  // cascade once the profile is deleted (FK is ON DELETE CASCADE).
  async function deleteAccount() {
    if (!_sb || !_currentUser) throw new Error('Not signed in');
    const id = _currentUser.id;
    // Each of these needs its own delete policy. `profiles` had none until
    // 20260912_star_integrity.sql, so this reported success and removed
    // nothing — the account kept its name and its leaderboard place.
    const errs = [];
    const r1 = await _sb.from('progress').delete().eq('user_id', id);
    if (r1.error) errs.push(r1.error.message);
    const r2 = await _sb.from('level_scores').delete().eq('user_id', id);
    if (r2.error) errs.push(r2.error.message);
    const r3 = await _sb.from('profiles').delete().eq('id', id);
    if (r3.error) errs.push(r3.error.message);
    // Local cleanup
    try {
      localStorage.removeItem(progressKey(id));
      localStorage.removeItem(profileKey(id));
      localStorage.removeItem(LAST_USER_KEY);
    } catch {}
    await _sb.auth.signOut();
    if (errs.length) {
      throw new Error('Some data could not be removed automatically; please email support: ' + errs.join('; '));
    }
  }

  async function resetPassword(email) {
    if (!_sb) throw new Error('Supabase is not configured yet');
    // Must be an https page on the website, not window.location.origin: in the
    // native shell the app's origin is https://localhost, which Supabase can't
    // redirect an email link to. The page there handles the recovery token and
    // calls updateUser({ password }) — the app has no such screen.
    const { error } = await _sb.auth.resetPasswordForEmail(
      (email || '').trim().toLowerCase(),
      { redirectTo: 'https://functionplane.pages.dev/auth/reset' },
    );
    if (error) throw new Error(error.message);
  }

  function getActive() { return _currentUser; }

  // ── Progress (sync interface, async Supabase background sync) ─────────────

  function getActiveProgress() {
    return readJSON(progressKey(_currentUser?.id), null);
  }

  function updateActiveProgress(progress) {
    writeJSON(progressKey(_currentUser?.id), progress);
    if (_sb && _currentUser) _scheduleUpload(_currentUser.id, progress);
  }

  function _scheduleUpload(userId, progress) {
    clearTimeout(_syncTimer);
    _syncTimer = setTimeout(() => _uploadProgress(userId, progress), 1500);
  }

  // ── Offline upload queue ──────────────────────────────────────────────────
  // If we're offline (or Supabase is briefly unreachable), parking the latest
  // progress payload in localStorage lets us retry next time the user opens
  // the app or comes back online. The queue holds a single pending payload
  // per user (the most recent supersedes older ones).

  const QUEUE_KEY = 'fp-pending-upload';

  function _queue(userId, progress) {
    writeJSON(QUEUE_KEY, { userId, progress, ts: Date.now() });
  }
  function _clearQueue() { try { localStorage.removeItem(QUEUE_KEY); } catch {} }
  function _readQueue()  { return readJSON(QUEUE_KEY, null); }

  async function _flushQueue() {
    const q = _readQueue();
    if (!q || !_sb || !_currentUser || q.userId !== _currentUser.id) return;
    if (!navigator.onLine) return;
    try {
      await _uploadProgress(q.userId, q.progress, /*fromQueue*/ true);
      _clearQueue();
    } catch {/* leave queued */}
  }

  // Re-try whenever the network comes back, when the user signs in, and at
  // initial load (handled by _init via subscribe).
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => { _flushQueue(); });
  }

  async function _uploadProgress(userId, progress, fromQueue = false) {
    if (!_sb) { _queue(userId, progress); return; }
    if (!navigator.onLine) { _queue(userId, progress); return; }
    try {
      const totalStars = _countStars(progress);

      // A stall here would leave progress neither saved nor queued; the
      // timeout throws instead, so the catch below queues it for the next try.
      const pRes = await _withTimeout(
        _sb.from('progress').upsert({ user_id: userId, data: progress, updated_at: new Date().toISOString() }),
        'Progress upload');
      if (pRes.error) console.warn('FP_AUTH: progress upsert error', pRes.error);

      // Upsert individual completed level rows (drives per-level leaderboards).
      // A database that hasn't had the latest migration applied is missing
      // some of these columns, so an upsert naming one fails wholesale — drop
      // whichever column the error names and retry, rather than losing the
      // player's scores until the migration is run.
      const rowsFull = [];
      for (const [packId, pd] of Object.entries(progress)) {
        (pd?.best || []).forEach((score, levelIndex) => {
          const stars = pd?.stars?.[levelIndex] ?? -1;
          if (score != null && stars >= 1) {
            const t   = pd?.bestTime?.[levelIndex];
            const eqs = pd?.bestEqs?.[levelIndex];
            rowsFull.push({
              user_id: userId, pack_id: packId, level_index: levelIndex,
              best_score: score, stars,
              best_time: t == null ? null : t,
              equations: Array.isArray(eqs) ? eqs : null,
            });
          }
        });
      }
      if (rowsFull.length) {
        const upsert = rows => _withTimeout(_sb.from('level_scores').upsert(rows, {
          onConflict: 'user_id,pack_id,level_index', ignoreDuplicates: false,
        }), 'Score upload');
        let rows = rowsFull;
        let { error: upErr } = await upsert(rows);
        for (const col of ['equations', 'best_time']) {
          if (!upErr || !new RegExp(col, 'i').test(upErr.message || '')) continue;
          rows = rows.map(({ [col]: _drop, ...rest }) => rest);
          ({ error: upErr } = await upsert(rows));
          if (!upErr) console.warn(`FP_AUTH: level_scores upserted without ${col} — run the latest migration`);
        }
        if (upErr) {
          console.warn('FP_AUTH: level_scores upsert error', upErr);
          _emitSyncError('Could not save your score: ' + (upErr.message || 'unknown error'));
        }
      }

      // The stored total is derived by the database from the level_scores rows
      // upserted above — the client has no write on that column
      // (20260912_star_integrity.sql). This is the same number, kept locally so
      // the header updates without waiting for a round trip.
      if (_currentUser) _currentUser.totalStars = totalStars;
    } catch (e) {
      console.warn('FP_AUTH: upload error', e);
      _queue(userId, progress);  // try again next time we're online
    }
  }

  function _countStars(progress) {
    if (!progress) return 0;
    return Object.values(progress).reduce(
      (a, pd) => a + (pd?.stars || []).reduce((b, s) => b + (s > 0 ? s : 0), 0), 0,
    );
  }

  // ── Leaderboards (async, cached) ──────────────────────────────────────────
  //
  // metric = 'stars'  → global ranking by total stars (for Achievements screen)
  // metric = 'level'  → ranking for one level by best_score ascending (for Level Complete)
  //
  // Server rows are cached (localStorage, short TTL) so reopening a screen
  // doesn't refetch, and when offline the last-known board is shown instead
  // of an empty list. Only raw server rows are cached — the `self` flag and
  // the local fallback row are recomputed on every call, so account switches
  // and fresh local records always show correctly.

  const LB_TTL     = 3 * 60 * 1000;  // serve cached boards for up to 3 min
  const LB_KEY     = 'fp-lb-cache';
  const LB_MAX_KEYS = 40;            // keep the most recently used boards

  async function _lbCached(key, fetchLive) {
    const map = readJSON(LB_KEY, {});
    const hit = map[key];
    if (hit && Date.now() - hit.ts < LB_TTL) return hit.rows;
    try {
      const rows = await _withTimeout(fetchLive(), 'Leaderboard');
      const next = readJSON(LB_KEY, {});
      next[key] = { ts: Date.now(), rows };
      const keys = Object.keys(next);
      if (keys.length > LB_MAX_KEYS) {
        keys.sort((a, b) => next[a].ts - next[b].ts)
            .slice(0, keys.length - LB_MAX_KEYS)
            .forEach(k => delete next[k]);
      }
      writeJSON(LB_KEY, next);
      return rows;
    } catch (e) {
      const msg = e?.message || String(e);
      console.warn('FP_AUTH: leaderboard fetch failed' + (hit ? ', showing cached copy' : ''), msg);
      // A stale board is better than a nag; an empty one needs explaining, or
      // "No scores yet" reads as truth when the truth is "couldn't ask".
      if (!hit) _emitSyncError('Leaderboard unavailable: ' + msg);
      return hit ? hit.rows : [];
    }
  }

  async function _lbFetchStarsRaw() {
    const { data, error } = await _sb
      .from('profiles')
      .select('id, name, avatar, total_stars, is_premium')
      .order('total_stars', { ascending: false })
      .limit(25);
    if (error) throw new Error(error.message || 'stars leaderboard failed');
    return (data || []).map((r, i) => ({
      id: r.id, name: r.name, avatar: r.avatar, premium: !!r.is_premium,
      stars: r.total_stars, rank: i + 1,
    }));
  }

  async function _lbFetchLevelRaw(packId, levelIndex, isTime) {
    const orderBy = isTime ? 'best_time' : 'best_score';
    let q = _sb.from('level_scores')
      .select(`user_id, ${orderBy}`)
      .eq('pack_id', packId)
      .eq('level_index', levelIndex)
      .order(orderBy, { ascending: true })
      .limit(25);
    if (isTime) q = q.not('best_time', 'is', null);

    const { data: scores, error: sErr } = await q;
    if (sErr) throw new Error(sErr.message || 'level leaderboard failed');
    if (!scores || scores.length === 0) return [];

    // Two-query join: fetch profiles separately so we don't depend on FK embed
    const ids = [...new Set(scores.map(s => s.user_id))];
    const { data: profs, error: pErr } = await _sb
      .from('profiles').select('id, name, avatar, is_premium').in('id', ids);
    if (pErr) throw new Error(pErr.message || 'leaderboard profiles failed');
    const pmap = new Map((profs || []).map(p => [p.id, p]));

    return scores.map((s, i) => {
      const p = pmap.get(s.user_id) || {};
      return {
        id: s.user_id,
        name:   p.name   || 'Player',
        avatar: p.avatar || '🟢',
        premium: !!p.is_premium,
        score: isTime ? null : s.best_score,
        time:  isTime ? s.best_time  : null,
        rank: i + 1,
      };
    });
  }

  async function buildLeaderboard({ metric = 'stars', packId = null, levelIndex = null } = {}) {
    if (!_sb) return [];

    if (metric === 'stars') {
      const raw = await _lbCached('stars', _lbFetchStarsRaw);
      const rows = raw.map(r => ({ ...r, self: r.id === _currentUser?.id }));
      if (_currentUser && !rows.find(r => r.self)) {
        rows.push({
          id: _currentUser.id, name: _currentUser.name, avatar: _currentUser.avatar,
          premium: !!_currentUser.isPremium,
          stars: _countStars(getActiveProgress()), rank: null, self: true,
        });
      }
      return rows;
    }

    if ((metric === 'level' || metric === 'time') && packId != null && levelIndex != null) {
      const isTime = metric === 'time';
      const raw = await _lbCached(
        `${metric}:${packId}:${levelIndex}`,
        () => _lbFetchLevelRaw(packId, levelIndex, isTime),
      );
      const rows = raw.map(r => ({ ...r, self: r.id === _currentUser?.id }));
      if (_currentUser && !rows.find(r => r.self)) {
        rows.push(..._selfOnlyLevelRow(packId, levelIndex, isTime));
      }
      return rows;
    }

    return [];
  }

  function _selfOnlyLevelRow(packId, levelIndex, isTime) {
    if (!_currentUser) return [];
    const pd = getActiveProgress()?.[packId];
    const v  = isTime ? pd?.bestTime?.[levelIndex] : pd?.best?.[levelIndex];
    if (v == null) return [];
    return [{
      id: _currentUser.id, name: _currentUser.name, avatar: _currentUser.avatar,
      premium: !!_currentUser.isPremium,
      score: isTime ? null : v, time: isTime ? v : null,
      rank: null, self: true,
    }];
  }

  // ── Name availability ─────────────────────────────────────────────────────
  // Names are case-insensitive unique. Returns { available: bool, reason?: string }
  async function checkNameAvailable(name) {
    name = (name || '').trim();
    if (!name) return { available: false, reason: 'Display name is required' };
    if (name.length < 2)  return { available: false, reason: 'At least 2 characters' };
    if (name.length > 30) return { available: false, reason: 'Up to 30 characters' };
    if (!_sb) return { available: true };
    const { data, error } = await _sb
      .from('profiles').select('id').ilike('name', name).limit(1);
    if (error) { console.warn('FP_AUTH: name check error', error); return { available: true }; }
    return data && data.length > 0
      ? { available: false, reason: 'That name is taken' }
      : { available: true };
  }

  // ── Admin overrides (pack_overrides + level_overrides tables) ─────────────
  //
  // fetchOverrides THROWS on pack/level errors instead of returning empty
  // arrays: callers (FP_DATA) must never overwrite good local data with
  // empty results just because the network hiccuped. The achievements table
  // may not exist on older Supabase projects — that one degrades to [].
  async function fetchOverrides() {
    if (!_sb) return { packs: [], levels: [], achievements: [] };
    const [
      { data: packs, error: pErr },
      { data: levels, error: lErr },
      { data: achievements, error: aErr },
    ] = await _withTimeout(Promise.all([
      _sb.from('pack_overrides').select('*'),
      _sb.from('level_overrides').select('*'),
      _sb.from('achievement_overrides').select('*'),
    ]), 'Level data');
    if (pErr) throw new Error('pack_overrides: ' + (pErr.message || 'fetch failed'));
    if (lErr) throw new Error('level_overrides: ' + (lErr.message || 'fetch failed'));
    if (aErr && !/not exist|relation/i.test(aErr.message || '')) {
      throw new Error('achievement_overrides: ' + (aErr.message || 'fetch failed'));
    }
    return {
      packs: packs || [],
      levels: levels || [],
      achievements: achievements || [],
    };
  }

  // Tiny per-table version signature: "<count of rows with updated_at>:<max
  // updated_at>" — a few hundred bytes instead of the full tables. Must stay
  // consistent with FP_DATA's local tableSig(): count catches inserts and
  // deletes, max(updated_at) catches edits (every save writes updated_at).
  // Returns null in guest mode; throws when the server can't be reached so
  // callers don't mistake "offline" for "no changes".
  async function fetchOverridesVersion() {
    if (!_sb) return null;
    const q = table => _sb.from(table)
      .select('updated_at', { count: 'exact' })
      .not('updated_at', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1);
    const [p, l, a] = await Promise.all([
      q('pack_overrides'), q('level_overrides'), q('achievement_overrides'),
    ]);
    const sig = (res, tolerateMissing) => {
      if (res.error) {
        if (tolerateMissing && /not exist|relation/i.test(res.error.message || '')) return '0:';
        throw new Error(res.error.message || 'version check failed');
      }
      return (res.count || 0) + ':' + (res.data?.[0]?.updated_at || '');
    };
    return { packs: sig(p), levels: sig(l), achievements: sig(a, true) };
  }

  async function savePackOverride(packId, patch) {
    if (!_sb) throw new Error('Supabase not configured');
    const row = { pack_id: packId, ...patch, updated_at: new Date().toISOString() };
    const { error } = await _write(() => _sb.from('pack_overrides').upsert(row, { onConflict: 'pack_id' }), 'Pack save');
    if (error) {
      console.warn('FP_AUTH: pack_overrides upsert error', error);
      const hint = /not exist|relation/i.test(error.message)
        ? ' (run the admin migration SQL in Supabase first)'
        : /policy|permission|rls/i.test(error.message)
          ? ' (your account name must be exactly "Test Account" with no trailing spaces)'
          : '';
      throw new Error((error.message || 'Save failed') + hint);
    }
  }

  async function saveLevelOverride(packId, levelIndex, patch) {
    if (!_sb) throw new Error('Supabase not configured');
    const row = { pack_id: packId, level_index: levelIndex, ...patch, updated_at: new Date().toISOString() };
    const { error } = await _write(() => _sb.from('level_overrides').upsert(row, { onConflict: 'pack_id,level_index' }), 'Level save');
    if (error) {
      console.warn('FP_AUTH: level_overrides upsert error', error);
      const hint = /not exist|relation/i.test(error.message)
        ? ' (run the admin migration SQL in Supabase first)'
        : /policy|permission|rls/i.test(error.message)
          ? ' (your account name must be exactly "Test Account" with no trailing spaces)'
          : '';
      throw new Error((error.message || 'Save failed') + hint);
    }
  }

  async function saveAchievementOverride(row) {
    if (!_sb) throw new Error('Supabase not configured');
    const payload = { ...row, updated_at: new Date().toISOString() };
    const { error } = await _write(() => _sb.from('achievement_overrides').upsert(payload, { onConflict: 'id' }), 'Achievement save');
    if (error) {
      console.warn('FP_AUTH: achievement_overrides upsert error', error);
      const hint = /not exist|relation/i.test(error.message)
        ? ' (run the admin migration SQL in Supabase first — see admin panel ▸ Achievements ▸ Help)'
        : /policy|permission|rls/i.test(error.message)
          ? ' (your account name must be exactly "Test Account" with no trailing spaces)'
          : '';
      throw new Error((error.message || 'Save failed') + hint);
    }
  }

  async function deleteAchievementOverride(id) {
    if (!_sb) throw new Error('Supabase not configured');
    const { error } = await _write(() => _sb.from('achievement_overrides').delete().eq('id', id), 'Achievement delete');
    if (error) throw new Error(error.message);
  }

  function isAdmin() {
    return _currentUser?.name === 'Test Account';
  }

  function isPremium() {
    return !!_currentUser?.isPremium;
  }

  // Admin-only: flip is_premium on a profile (for manual grant before the
  // entitlement webhook is wired). RLS cannot gate a single column, so the
  // client roles have no write privilege on is_premium at all and this goes
  // through a security-definer RPC that re-checks the caller is the admin
  // (20260912_premium_entitlement_guard.sql).
  async function setPremium(userId, value) {
    if (!_sb) throw new Error('Supabase not configured');
    const { error } = await _write(() => _sb.rpc('admin_set_premium', { target: userId, value: !!value }), 'Premium grant');
    if (error) throw new Error(error.message);
  }

  // Hands a Play purchase token to the edge function, which asks Google
  // whether it is real and flips is_premium with the service-role key. The
  // answer is never taken from the client: the client roles have no write
  // privilege on that column, so a forged "I bought it" changes nothing.
  async function verifyPlayPurchase(purchaseToken) {
    if (!_sb) throw new Error('Supabase is not configured yet');
    const { data } = await _withTimeout(_sb.auth.getSession(), 'Purchase');
    const token = data?.session?.access_token;
    if (!token) throw new Error('Sign in first — a purchase has to attach to an account');

    // Verification is idempotent server-side, so the retry inside _write is
    // safe on the networks that drop a POST after the preflight.
    const res = await _write(() => fetch(`${window.SUPABASE_URL}/functions/v1/play-verify`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
        apikey:          window.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ purchaseToken }),
    }), 'Purchase');

    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Could not confirm the purchase (${res.status})`);
    await refreshEntitlement();
    return !!body.premium;
  }

  // "Restore purchases". The entitlement lives on the profile, not the device,
  // so re-reading it restores a purchase made on any other device or channel —
  // which is the whole job while premium is granted server-side. Play Billing's
  // own restore queries Play first and then lands here.
  async function refreshEntitlement() {
    if (!_sb) throw new Error('Supabase is not configured yet');
    const { data } = await _withTimeout(_sb.auth.getSession(), 'Restore');
    const user = data?.session?.user;
    if (!user) throw new Error('Sign in first — premium follows your account, not this device');
    _currentUser = await _withTimeout(_fetchProfile(user), 'Restore');
    notify();
    return !!_currentUser?.isPremium;
  }

  // Admin-only: the raw leaderboard rows, newest submission first, for the
  // audit screen. The database rejects values no run can produce; recomputing
  // the score from the submitted equations is what catches a plausible-looking
  // forgery, and that needs the real classifier, which only the client has.
  async function fetchScoreRows(limit = 400) {
    if (!_sb) throw new Error('Supabase not configured');
    const { data, error } = await _withTimeout(_sb.from('level_scores')
      .select('user_id, pack_id, level_index, best_score, stars, best_time, equations, submitted_at')
      .order('submitted_at', { ascending: false })
      .limit(limit), 'Audit');
    if (error) throw new Error(error.message);
    const ids = [...new Set((data || []).map(r => r.user_id))];
    if (!ids.length) return [];
    const { data: profs } = await _withTimeout(
      _sb.from('profiles').select('id, name, avatar').in('id', ids), 'Audit profiles');
    const pmap = new Map((profs || []).map(p => [p.id, p]));
    return (data || []).map(r => ({
      ...r,
      name:   pmap.get(r.user_id)?.name   || 'Unknown',
      avatar: pmap.get(r.user_id)?.avatar || '🟢',
    }));
  }

  // Admin-only: remove a forged leaderboard entry. RLS lets the Test Account
  // delete anyone's row; everyone else only their own.
  async function deleteScoreRow(userId, packId, levelIndex) {
    if (!_sb) throw new Error('Supabase not configured');
    const { error } = await _write(() => _sb.from('level_scores').delete()
      .eq('user_id', userId).eq('pack_id', packId).eq('level_index', levelIndex), 'Score delete');
    if (error) throw new Error(error.message);
    writeJSON(LB_KEY, {});   // cached boards still list the deleted entry
  }

  // ── Web Push subscription ─────────────────────────────────────────────────
  // Subscribes the browser/PWA to push notifications (so the SW push handler
  // can fire). Requires window.VAPID_PUBLIC_KEY (set in supabase-config.js
  // alongside the URL/key) and a Supabase table `push_subscriptions` to write
  // the endpoint to. If either is missing this function still requests
  // permission so users see the explanatory prompt.
  async function enablePushNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      throw new Error("This browser doesn't support push notifications.");
    }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('Permission denied');

    const reg = await navigator.serviceWorker.ready;
    const vapid = window.VAPID_PUBLIC_KEY;
    if (!vapid) {
      console.warn('FP_AUTH: VAPID_PUBLIC_KEY missing — push subscription skipped');
      return { skipped: true };
    }
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: _urlBase64ToUint8Array(vapid),
    });
    if (_sb && _currentUser) {
      await _sb.from('push_subscriptions').upsert({
        user_id: _currentUser.id,
        endpoint: sub.endpoint,
        keys: sub.toJSON().keys,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'endpoint' });
    }
    return { subscribed: true };
  }
  function _urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from(raw, c => c.charCodeAt(0));
  }

  // Admin search — by name only (RLS already lets anyone read profile rows).
  async function adminSearchProfiles(q) {
    if (!_sb) return { data: [], error: null };
    const term = `%${(q || '').trim()}%`;
    return _sb.from('profiles')
      .select('id, name, avatar, total_stars, is_premium')
      .ilike('name', term)
      .limit(20);
  }
  window.fpAdminSearchProfiles = adminSearchProfiles;

  // ── Misc ──────────────────────────────────────────────────────────────────

  function totalStarsFromProgress(p) { return _countStars(p); }

  function subscribe(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  }

  // ── Export ────────────────────────────────────────────────────────────────

  window.FP_AUTH = {
    getActive, signOut, isAdmin, isPremium, setPremium, deleteAccount,
    refreshEntitlement, verifyPlayPurchase,
    enablePushNotifications,
    register, signIn, resetPassword,
    checkNameAvailable,
    getActiveProgress, updateActiveProgress,
    buildLeaderboard, totalStarsFromProgress,
    fetchOverrides, fetchOverridesVersion, savePackOverride, saveLevelOverride,
    saveAchievementOverride, deleteAchievementOverride,
    fetchScoreRows, deleteScoreRow,
    subscribe,
    AVATARS,
  };

  // Kick off async init (errors are caught internally; app always loads)
  _init().catch(e => console.warn('FP_AUTH init:', e));
})();
