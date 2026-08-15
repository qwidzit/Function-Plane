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

  const readJSON  = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
  const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const progressKey = id  => id ? PROGRESS_PREFIX + id : GUEST_KEY;

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

    // Restore existing session (e.g. returning visitor on same device)
    const { data: { session } } = await _sb.auth.getSession();
    if (session) {
      _currentUser = await _fetchProfile(session.user);
      await _syncProgressDown(session.user.id, true);
      _flushQueue();
    }
    notify();

    // Keep cache in sync when auth state changes (sign-in / sign-out / token refresh)
    _sb.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        _currentUser = await _fetchProfile(session.user);
        if (event === 'SIGNED_IN') {
          await _syncProgressDown(session.user.id, false);
          _flushQueue();
        }
      } else {
        _currentUser = null;
      }
      notify();
    });
  }

  async function _fetchProfile(user) {
    if (!_sb) return null;
    const { data } = await _sb.from('profiles')
      .select('name, avatar, total_stars, is_premium').eq('id', user.id).single();
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
    const { data } = await _sb.from('progress').select('data').eq('user_id', userId).single();
    const remote   = data?.data || null;
    const local    = readJSON(progressKey(userId), null);
    const merged   = _mergeProgress(remote, local);
    writeJSON(progressKey(userId), merged);
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
      out[k] = {
        stars: Array.from({ length: 10 }, (_, i) => {
          const sa = pa.stars?.[i] ?? null, sb = pb.stars?.[i] ?? null;
          if (sa === null && sb === null) return null;
          return Math.max(sa ?? -1, sb ?? -1);
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
    const { error } = await _sb.auth.signInWithPassword({
      email: (email || '').trim().toLowerCase(), password,
    });
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
    // RLS lets a user delete their own rows
    const errs = [];
    const r1 = await _sb.from('progress').delete().eq('user_id', id);
    if (r1.error) errs.push(r1.error.message);
    const r2 = await _sb.from('level_scores').delete().eq('user_id', id);
    if (r2.error) errs.push(r2.error.message);
    const r3 = await _sb.from('profiles').delete().eq('id', id);
    if (r3.error) errs.push(r3.error.message);
    // Local cleanup
    try {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('fp-progress-' + id)) localStorage.removeItem(k);
      });
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

      const [pRes, profRes] = await Promise.all([
        _sb.from('progress').upsert({ user_id: userId, data: progress, updated_at: new Date().toISOString() }),
        _sb.from('profiles').update({ total_stars: totalStars }).eq('id', userId),
      ]);
      if (pRes.error)    console.warn('FP_AUTH: progress upsert error', pRes.error);
      if (profRes.error) console.warn('FP_AUTH: profile update error',  profRes.error);

      // Upsert individual completed level rows (drives per-level leaderboards)
      // Some installs may not have run the best_time migration yet — if the
      // upsert fails because that column is missing, retry without it.
      const rowsFull = [];
      for (const [packId, pd] of Object.entries(progress)) {
        (pd?.best || []).forEach((score, levelIndex) => {
          const stars = pd?.stars?.[levelIndex] ?? -1;
          if (score != null && stars >= 1) {
            const t = pd?.bestTime?.[levelIndex];
            rowsFull.push({
              user_id: userId, pack_id: packId, level_index: levelIndex,
              best_score: score, stars,
              best_time: t == null ? null : t,
            });
          }
        });
      }
      if (rowsFull.length) {
        let { error: upErr } = await _sb.from('level_scores').upsert(rowsFull, {
          onConflict: 'user_id,pack_id,level_index', ignoreDuplicates: false,
        });
        if (upErr && /best_time/i.test(upErr.message || '')) {
          // Retry without the new column for backwards compatibility
          const rowsLegacy = rowsFull.map(({ best_time, ...rest }) => rest);
          const r2 = await _sb.from('level_scores').upsert(rowsLegacy, {
            onConflict: 'user_id,pack_id,level_index', ignoreDuplicates: false,
          });
          upErr = r2.error;
          if (!upErr) console.warn('FP_AUTH: level_scores upserted without best_time (run the migration to enable time leaderboard)');
        }
        if (upErr) {
          console.warn('FP_AUTH: level_scores upsert error', upErr);
          _emitSyncError('Could not save your score: ' + (upErr.message || 'unknown error'));
        }
      }

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
      const rows = await fetchLive();
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
      console.warn('FP_AUTH: leaderboard fetch failed' + (hit ? ', showing cached copy' : ''), e?.message || e);
      return hit ? hit.rows : [];    // stale beats empty when offline
    }
  }

  async function _lbFetchStarsRaw() {
    const { data, error } = await _sb
      .from('profiles')
      .select('id, name, avatar, total_stars')
      .order('total_stars', { ascending: false })
      .limit(25);
    if (error) throw new Error(error.message || 'stars leaderboard failed');
    return (data || []).map((r, i) => ({
      id: r.id, name: r.name, avatar: r.avatar,
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
      .from('profiles').select('id, name, avatar').in('id', ids);
    if (pErr) throw new Error(pErr.message || 'leaderboard profiles failed');
    const pmap = new Map((profs || []).map(p => [p.id, p]));

    return scores.map((s, i) => {
      const p = pmap.get(s.user_id) || {};
      return {
        id: s.user_id,
        name:   p.name   || 'Player',
        avatar: p.avatar || '🟢',
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
    ] = await Promise.all([
      _sb.from('pack_overrides').select('*'),
      _sb.from('level_overrides').select('*'),
      _sb.from('achievement_overrides').select('*'),
    ]);
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
    const { error } = await _sb.from('pack_overrides').upsert(row, { onConflict: 'pack_id' });
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
    const { error } = await _sb.from('level_overrides').upsert(row, { onConflict: 'pack_id,level_index' });
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
    const { error } = await _sb.from('achievement_overrides').upsert(payload, { onConflict: 'id' });
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
    const { error } = await _sb.from('achievement_overrides').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  function isAdmin() {
    return _currentUser?.name === 'Test Account';
  }

  function isPremium() {
    return !!_currentUser?.isPremium;
  }

  // Admin-only: flip is_premium on a profile (for manual grant before
  // Stripe webhook is wired). Uses RLS, so only the Test Account can call.
  async function setPremium(userId, value) {
    if (!_sb) throw new Error('Supabase not configured');
    const { error } = await _sb.from('profiles').update({ is_premium: !!value }).eq('id', userId);
    if (error) throw new Error(error.message);
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
    enablePushNotifications,
    register, signIn, resetPassword,
    checkNameAvailable,
    getActiveProgress, updateActiveProgress,
    buildLeaderboard, totalStarsFromProgress,
    fetchOverrides, fetchOverridesVersion, savePackOverride, saveLevelOverride,
    saveAchievementOverride, deleteAchievementOverride,
    subscribe,
    AVATARS,
  };

  // Kick off async init (errors are caught internally; app always loads)
  _init().catch(e => console.warn('FP_AUTH init:', e));
})();
