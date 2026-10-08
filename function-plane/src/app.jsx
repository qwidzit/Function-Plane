// Function Plane — App shell & router

const { useState, useEffect, useRef, useMemo } = React;

const SETTINGS_DEFAULTS = {
  theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  density: 'comfortable',
  sound: true,
  volume: 70,
  gridLabels: true,
  autoZoom: true,
};

function App() {
  const [settings, setSettings] = useState(() => {
    try {
      return { ...SETTINGS_DEFAULTS, ...JSON.parse(localStorage.getItem('fp-settings') || '{}') };
    } catch {
      return { ...SETTINGS_DEFAULTS };
    }
  });

  // Active account (null = guest). Re-read on FP_AUTH events.
  const [account, setAccount] = useState(() => FP_AUTH.getActive());
  useEffect(() => FP_AUTH.subscribe(() => {
    setAccount(FP_AUTH.getActive());
    adoptProgress();
  }), []);

  // Leaving a browser tab throws away whatever run is in flight and any score
  // still queued for upload, and a tab closes without asking. The native shell
  // has the hardware back button below and no such dialog, so this is web only.
  useEffect(() => {
    if (window.FP_NATIVE) return;
    // Only while a score is still owed to the server: with nothing pending
    // the prompt is a nag on every tab close.
    const ask = e => { if (!FP_AUTH.hasPendingUpload?.()) return; e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', ask);
    return () => window.removeEventListener('beforeunload', ask);
  }, []);

  // Bump on every config-override change so screens re-render with new pack/level data.
  // Level/pack data itself is already applied synchronously at boot from the
  // baked snapshot / localStorage cache (overrides-store.js) — this only runs
  // the cheap background version check and re-renders if fresh data came in.
  const [overridesRev, setOverridesRev] = useState(0);
  const reloadOverrides = async (opts) => {
    if (!window.FP_DATA) return;
    const res = await FP_DATA.sync(opts);
    if (res.updated) setOverridesRev(r => r + 1);
  };
  useEffect(() => { reloadOverrides(); }, []);

  // A save made before a pack existed has no entry for it, and completing a
  // level there spread undefined and crashed — five of seven cloud saves lack
  // s-flip, so un-hiding Inversion would have crashed them all.
  const withAllPacks = p => {
    const fresh = freshProgress();
    if (!p) return fresh;
    const missing = Object.keys(fresh).filter(k => !p[k]);
    return missing.length ? { ...p, ...Object.fromEntries(missing.map(k => [k, fresh[k]])) } : p;
  };

  const [progress, setProgress] = useState(() => withAllPacks(FP_AUTH.getActiveProgress()));

  // Progress arriving from FP_AUTH — a sign-in, an account switch, or the
  // background download landing — replaces what is on screen and re-seeds the
  // achievement baseline against it.
  //
  // It has to re-seed on *every* one of those, not only when the account id
  // changes. Signing in used to seed against the empty progress that existed
  // for the half-second before the download arrived, so the moment the real
  // save landed every achievement in it counted as newly earned and the whole
  // history toasted at once. And keying the reload on the id alone meant a
  // download that finished later never reached the screen at all.
  const adoptProgress = () => {
    setProgress(withAllPacks(FP_AUTH.getActiveProgress()));
    achInitRef.current = false;
    prevUnlockedRef.current = new Set();
  };

  const [nav, setNav] = useState({ route: 'main', pack: null, levelIndex: 0 });

  // Which screen a crash report belongs to. Nothing else about the session
  // goes with it — see error-log.js.
  useEffect(() => { window.FP_ERRORS?.setRoute(nav.route); }, [nav.route]);

  // Achievement toast queue
  const [toastQueue, setToastQueue] = useState([]);
  const achInitRef    = useRef(false);
  const prevUnlockedRef = useRef(new Set());

  // Online / offline indicator (so the player knows their progress is queued)
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  useEffect(() => {
    // Back online: refresh the data version check too, so an offline boot
    // picks up pending level updates as soon as the network returns.
    const up = () => { setOnline(true); reloadOverrides(); };
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  // Sync-error toast (Supabase upload failures). A request that got no answer
  // is usually a Russian network filtering the server, and only the player can
  // fix that, so the first one is said in the middle of the screen and every
  // later one carries the advice in the toast.
  const [syncError, setSyncError] = useState(null);
  const [vpnNotice, setVpnNotice] = useState(null);
  useEffect(() => {
    const onErr = (e) => {
      const { msg, network } = e.detail;
      if (!network) { setSyncError(msg); return; }
      let seen = true;
      try {
        seen = !!localStorage.getItem('fp-vpn-notice');
        localStorage.setItem('fp-vpn-notice', '1');
      } catch {}
      if (seen) setSyncError(msg + '. If you are in Russia, turn on a VPN and try again');
      else setVpnNotice(msg);
    };
    window.addEventListener('fp-sync-error', onErr);
    return () => window.removeEventListener('fp-sync-error', onErr);
  }, []);
  useEffect(() => {
    if (!syncError) return;
    const t = setTimeout(() => setSyncError(null), 6000);
    return () => clearTimeout(t);
  }, [syncError]);

  // Global toast + confirm modal (replacements for native alert/confirm).
  // Anywhere in the app:
  //   window.fpToast('Saved!', { kind: 'ok' })
  //   const ok = await window.fpConfirm({ title: '…', body: '…', danger: true })
  const [toast,      setToast]      = useState(null);
  const [confirmReq, setConfirmReq] = useState(null);
  const confirmRef = useRef(null);   // read by the back-button listener, which closes over nothing else
  confirmRef.current = confirmReq;
  useEffect(() => {
    window.fpToast = (msg, opts = {}) => {
      setToast({ msg, kind: opts.kind || 'info', stamp: Date.now() });
    };
    window.fpConfirm = ({ title, body, confirmLabel = 'Confirm', danger = false } = {}) =>
      new Promise(resolve => setConfirmReq({ title, body, confirmLabel, danger, resolve }));
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const updateSetting = (key, value) =>
    setSettings(s => ({ ...s, [key]: value }));

  // Apply theme to the DOM
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  // Persist settings
  useEffect(() => {
    // Storage can throw (site data blocked, private mode); there is no error
    // boundary, so an exception here unmounts the whole app.
    try { localStorage.setItem('fp-settings', JSON.stringify(settings)); } catch {}
  }, [settings]);

  // Persist progress (routes to active account, or guest fp-progress)
  useEffect(() => {
    FP_AUTH.updateActiveProgress(progress);
  }, [progress]);

  // Achievement unlock detection
  useEffect(() => {
    if (typeof getAchievementList !== 'function') return;
    const list = getAchievementList();
    if (!achInitRef.current) {
      // Seed on first render so we don't toast pre-existing achievements
      list.filter(a => a.check(progress)).forEach(a => prevUnlockedRef.current.add(a.id));
      achInitRef.current = true;
      return;
    }
    const newlyUnlocked = list.filter(
      a => a.check(progress) && !prevUnlockedRef.current.has(a.id)
    );
    newlyUnlocked.forEach(a => {
      prevUnlockedRef.current.add(a.id);
      setToastQueue(q => [...q, { id: a.id, name: a.name }]);
    });
  }, [progress, overridesRev]);

  const totalStars    = useMemo(() => totalStarsAll(progress), [progress]);
  const continuePoint = useMemo(() => findContinuePoint(progress), [progress]);

  // Navigation history so the Android hardware back button can step back
  // through screens instead of closing the app.
  const navStackRef = useRef([]);
  // On the web the browser's own back button walks the same stack: every push
  // here is a history entry carrying its depth, and popstate pops to that
  // depth. A back button in the UI pops the stack and then steps history
  // back silently, so the two never disagree. The native shell has the
  // hardware button below and no history to keep.
  const silentPopRef = useRef(0);
  const navigate = (route, extra = {}) => {
    setNav(curr => {
      // Don't push the same route twice in a row
      if (curr.route !== route) {
        navStackRef.current.push(curr);
        if (!window.FP_NATIVE) try { history.pushState({ fp: navStackRef.current.length }, ''); } catch {}
      }
      return { route, pack: null, levelIndex: 0, legalKind: null, ...extra };
    });
  };
  useEffect(() => {
    if (window.FP_NATIVE) return;
    try { history.replaceState({ fp: 0 }, ''); } catch {}
    const onPop = e => {
      if (silentPopRef.current > 0) { silentPopRef.current--; return; }
      const depth = navStackRef.current.length;
      const target = Number(e.state?.fp ?? 0);
      if (target < depth) {
        setNav(curr => {
          let prev = curr;
          while (navStackRef.current.length > Math.max(target, 0)) prev = navStackRef.current.pop();
          return prev;
        });
      } else if (target > depth) {
        // Forward, which nothing here can replay: step history back to where
        // the screen actually is.
        silentPopRef.current++;
        history.go(depth - target);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  // Every backward affordance goes through here, never through navigate() —
  // navigate() pushes the screen it leaves, so a back button routed through it
  // pushes a *forward* entry and the Android back button then walks the player
  // into the screen they just left instead of out of the app.
  // The fallback is only used when the stack is empty (deep link, cold start).
  const navigateBack = (fallback = 'main', extra = {}) => {
    setNav(curr => {
      const prev = navStackRef.current.pop();
      if (prev && !window.FP_NATIVE && Number(history.state?.fp ?? 0) > navStackRef.current.length) {
        silentPopRef.current++;
        try { history.back(); } catch { silentPopRef.current--; }
      }
      return prev || { route: fallback, pack: null, levelIndex: 0, legalKind: null, ...extra };
    });
  };

  // Capacitor: hook the Android hardware back button (no-op in browsers)
  useEffect(() => {
    const Cap = window.Capacitor;
    if (!Cap?.Plugins?.App) return;
    let removeFn;
    const ret = Cap.Plugins.App.addListener('backButton', () => {
      // A confirm dialog is App-level state, not a screen: back dismisses it
      // as a No rather than leaving it drawn over the previous screen.
      if (confirmRef.current) {
        confirmRef.current.resolve(false);
        setConfirmReq(null);
        return;
      }
      if (navStackRef.current.length > 0) {
        navigateBack();
      } else {
        Cap.Plugins.App.exitApp();
      }
    });
    // Capacitor 6 returns the handle directly; older bridges wrapped it in a
    // Promise. Support both so this can't throw on either runtime.
    if (ret && typeof ret.then === 'function') {
      ret.then(h => { removeFn = h?.remove; });
    } else {
      removeFn = ret?.remove;
    }
    return () => { try { removeFn?.(); } catch {} };
  }, []);

  const renderScreen = () => {
    const { route } = nav;

    if (route === 'main') {
      return (
        <MainScreen
          totalStars={totalStars}
          continuePoint={continuePoint}
          progress={progress}
          density={settings.density}
          onPlay={() => navigate('packs')}
          onSandbox={() => navigate('sandbox')}
          onInfo={() => navigate('how-to-play')}
          onAchievements={() => navigate('achievements')}
          onAccount={() => navigate('account')}
          onSettings={() => navigate('settings')}
        />
      );
    }

    if (route === 'packs') {
      return (
        <PackSelector
          progress={progress}
          density={settings.density}
          onBack={() => navigateBack('main')}
          onPickPack={pack => navigate('levels', { pack })}
          onPremium={() => navigate('account', { view: 'premium' })}
        />
      );
    }

    if (route === 'levels') {
      return (
        <LevelSelector
          pack={nav.pack}
          progress={progress}
          density={settings.density}
          onBack={() => navigateBack('packs')}
          onPickLevel={(pack, levelIndex) => navigate('level', { pack, levelIndex })}
        />
      );
    }

    if (route === 'settings') {
      return (
        <SettingsScreen
          settings={settings}
          updateSetting={updateSetting}
          density={settings.density}
          onBack={() => navigateBack('main')}
          onLegal={(kind) => navigate('legal', { legalKind: kind })}
        />
      );
    }

    if (route === 'legal') {
      return <LegalScreen kind={nav.legalKind} density={settings.density} onBack={() => navigateBack('settings')}/>;
    }

    if (route === 'level') {
      const { pack, levelIndex } = nav;
      const handleComplete = (rating, score, time, exprs, runEntry) => {
        setProgress(prev => {
          const next  = { ...prev };
          const pd    = next[pack.id] = { ...prev[pack.id] };
          const stars    = [...pd.stars];
          const best     = [...pd.best];
          const bestTime = pd.bestTime  ? [...pd.bestTime]  : Array(10).fill(null);
          // bestTimeAt: when each best time was set. A reset of times keeps the
          // ones set after it, including offline ones not yet uploaded.
          const bestTimeAt = pd.bestTimeAt ? [...pd.bestTimeAt] : Array(10).fill(null);
          // maxScore: highest score ever achieved on a winning run (for achievements
          // like "solve a level with a complex equation worth 100+ pts").
          const maxScore = pd.maxScore  ? [...pd.maxScore]  : Array(10).fill(null);
          // bestEqs: the equations behind the best score, uploaded with the
          // leaderboard row so a submission can be audited against the
          // classifier. Only meaningful next to the score it produced.
          const bestEqs  = pd.bestEqs   ? [...pd.bestEqs]   : Array(10).fill(null);
          // starBits: which of the three stars are lit, accumulated across
          // attempts — earning the score goal in one run and the equation goal
          // in another keeps both. `stars` stays the count the rest of the app
          // adds up.
          const starBits = pd.starBits  ? [...pd.starBits]  : Array(10).fill(null);
          // history: the last ten winning runs per level, so "load these
          // equations" survives a reload. It lives here rather than in a
          // localStorage key of its own so it merges and uploads with
          // everything else the account owns.
          const history  = pd.history   ? [...pd.history]   : Array(10).fill(null);
          const bits = starBitsOf(stars[levelIndex] ?? 0, starBits[levelIndex]) | rating;
          starBits[levelIndex] = bits;
          stars[levelIndex]    = starCount(bits);
          if (best[levelIndex] == null || score < best[levelIndex]) {
            best[levelIndex]    = score;
            bestEqs[levelIndex] = exprs ?? null;
          }
          if (time != null && (bestTime[levelIndex] == null || time < bestTime[levelIndex])) {
            bestTime[levelIndex]   = time;
            // Never earlier than the times reset: a device clock set in the
            // past would otherwise date every new time before the cutoff and
            // lose it. A time set now is after the reset by definition.
            bestTimeAt[levelIndex] = Math.max(Date.now(), FP_AUTH.timesCutoff?.() ?? 0);
          }
          maxScore[levelIndex] = maxScore[levelIndex] == null ? score : Math.max(maxScore[levelIndex], score);
          if (levelIndex + 1 < 10 && stars[levelIndex + 1] === null) {
            stars[levelIndex + 1] = -1;
          }
          pd.stars    = stars;
          pd.starBits = starBits;
          pd.best     = best;
          pd.bestTime = bestTime;
          pd.bestTimeAt = bestTimeAt;
          pd.maxScore = maxScore;
          pd.bestEqs  = bestEqs;
          if (runEntry) {
            const sig  = (runEntry.exprs || []).join('||');
            const prev = (history[levelIndex] || []).filter(r => (r.exprs || []).join('||') !== sig);
            history[levelIndex] = [runEntry, ...prev].slice(0, 10);
          }
          pd.history  = history;
          return next;
        });
      };
      const handleNext = () => {
        const nextIndex = levelIndex + 1;
        if (nextIndex < 10) {
          navigate('level', { pack, levelIndex: nextIndex });
        } else {
          navigate('levels', { pack });
        }
      };
      return (
        <LevelScreen
          key={`${pack.id}-${levelIndex}`}
          pack={pack}
          levelIndex={levelIndex}
          progress={progress}
          density={settings.density}
          settings={settings}
          onBack={() => navigateBack('levels', { pack })}
          onComplete={handleComplete}
          onNext={handleNext}
        />
      );
    }

    if (route === 'sandbox') {
      return <LevelStudio mode="sandbox" onBack={() => navigateBack('main')} density={settings.density} settings={settings}/>;
    }

    if (route === 'how-to-play') {
      return <HowToPlayScreen onBack={() => navigateBack('main')} density={settings.density}/>;
    }

    if (route === 'achievements') {
      return <AchievementsScreen onBack={() => navigateBack('main')} progress={progress} density={settings.density}/>;
    }

    if (route === 'account') {
      return <AccountScreen onBack={() => navigateBack('main')} density={settings.density} account={account} progress={progress} onAdmin={() => navigate('admin')} initialView={nav.view}/>;
    }

    if (route === 'admin') {
      return <AdminScreen onBack={() => navigateBack('account')} density={settings.density} settings={settings} onChanged={() => reloadOverrides({ force: true })}/>;
    }

    return <BootFailed message={`No screen named ${route}.`} />;
  };

  return (
    <div
      data-theme={settings.theme}
      data-density={settings.density}
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      {renderScreen()}

      {/* Achievement toast */}
      {toastQueue.length > 0 && (
        <AchievementToast
          key={toastQueue[0].id}
          name={toastQueue[0].name}
          onDone={() => setToastQueue(q => q.slice(1))}
        />
      )}

      {/* Offline indicator (shows only when offline) */}
      {!online && (
        <div style={{
          position: 'absolute', bottom: 'env(safe-area-inset-bottom, 0px)', left: 0, right: 0,
          display: 'flex', justifyContent: 'center', zIndex: 9998, pointerEvents: 'none',
        }}>
          <div style={{
            background: 'var(--fp-ink)', color: 'var(--fp-bg)',
            padding: '6px 12px', margin: '6px',
            borderRadius: 999, fontSize: 11.5, fontWeight: 500,
            opacity: 0.9, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#e34' }}/>
            Offline — progress will sync when you reconnect
          </div>
        </div>
      )}

      {/* Generic toast (window.fpToast) */}
      {toast && (
        <div style={{
          position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 12px)', left: 0, right: 0,
          display: 'flex', justifyContent: 'center', zIndex: 10001, pointerEvents: 'none',
        }}>
          <div style={{
            background: toast.kind === 'error' ? '#e34' : toast.kind === 'ok' ? 'var(--fp-accent)' : 'var(--fp-ink)',
            color: toast.kind === 'ok' ? 'var(--fp-accent-ink)' : '#fff',
            padding: '10px 14px', margin: '0 12px',
            borderRadius: 12, fontSize: 12.5, fontWeight: 500,
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            maxWidth: 360, textAlign: 'center', pointerEvents: 'auto',
          }}>{toast.msg}</div>
        </div>
      )}

      {/* Generic confirm modal (window.fpConfirm) */}
      {confirmReq && (
        <div onClick={() => { confirmReq.resolve(false); setConfirmReq(null); }} style={{
          position: 'absolute', inset: 0, zIndex: 10002,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px', backdropFilter: 'blur(2px)',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--fp-bg)', border: '1px solid var(--fp-line)',
            borderRadius: 16, padding: '20px',
            maxWidth: 340, width: '100%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}>
            {confirmReq.title && (
              <div style={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontStyle: 'italic', fontSize: 22, color: 'var(--fp-ink)',
                letterSpacing: '-0.02em', marginBottom: 8,
              }}>{confirmReq.title}</div>
            )}
            <div style={{ fontSize: 13, color: 'var(--fp-ink-3)', lineHeight: 1.55, marginBottom: 18, whiteSpace: 'pre-line' }}>
              {confirmReq.body}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { confirmReq.resolve(false); setConfirmReq(null); }} style={{
                flex: 1, height: 44, borderRadius: 12,
                background: 'transparent', border: '1px solid var(--fp-line)',
                color: 'var(--fp-ink)', fontSize: 13.5, fontWeight: 500,
              }}>Cancel</button>
              <button onClick={() => { confirmReq.resolve(true); setConfirmReq(null); }} style={{
                flex: 1, height: 44, borderRadius: 12,
                background: confirmReq.danger ? '#e34' : 'var(--fp-ink)',
                color: confirmReq.danger ? '#fff' : 'var(--fp-bg)',
                fontSize: 13.5, fontWeight: 500,
              }}>{confirmReq.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}

      {/* First request that got no answer (see the sync-error effect) */}
      {vpnNotice && (
        <div onClick={() => setVpnNotice(null)} style={{
          position: 'absolute', inset: 0, zIndex: 10003,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px', backdropFilter: 'blur(2px)',
        }}>
          <div className="fp-screen" onClick={e => e.stopPropagation()} style={{
            border: '1px solid var(--fp-line)',
            borderRadius: 16, padding: '20px',
            maxWidth: 340, width: '100%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}>
            <div style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontStyle: 'italic', fontSize: 22, color: 'var(--fp-ink)',
              letterSpacing: '-0.02em', marginBottom: 8,
            }}>No answer from the server</div>
            <div style={{ fontSize: 13, color: 'var(--fp-ink-3)', lineHeight: 1.55, marginBottom: 10 }}>
              {vpnNotice}.
            </div>
            <div style={{ fontSize: 13, color: 'var(--fp-ink)', lineHeight: 1.55, marginBottom: 18 }}>
              If you are in Russia, turn on a VPN and try again.
            </div>
            <button onClick={() => setVpnNotice(null)} style={{
              width: '100%', height: 44, borderRadius: 12,
              background: 'var(--fp-ink)', color: 'var(--fp-bg)',
              fontSize: 13.5, fontWeight: 500,
            }}>OK</button>
          </div>
        </div>
      )}

      {/* Sync-error toast */}
      {syncError && !vpnNotice && (
        <div style={{
          position: 'absolute', top: 'env(safe-area-inset-top, 0px)', left: 0, right: 0,
          display: 'flex', justifyContent: 'center', zIndex: 10000, pointerEvents: 'none',
        }}>
          <div className="fp-screen" style={{
            background: '#e34', color: '#fff',
            padding: '10px 14px', margin: '6px 12px',
            borderRadius: 12, fontSize: 12.5, fontWeight: 500,
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            maxWidth: 360, textAlign: 'center',
            pointerEvents: 'auto',
          }}>{syncError}</div>
        </div>
      )}
    </div>
  );
}

function AchievementToast({ name, onDone }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setShow(true), 60);
    const t2 = setTimeout(() => setShow(false), 2800);
    const t3 = setTimeout(onDone, 3400);
    return () => [t1, t2, t3].forEach(clearTimeout);
  }, []);

  return (
    <div style={{
      position: 'absolute',
      top: 0, left: 0, right: 0,
      display: 'flex', justifyContent: 'center',
      zIndex: 9999,
      pointerEvents: 'none',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'var(--fp-ink)', color: 'var(--fp-accent-ink)',
        padding: '10px 16px 10px 12px',
        borderRadius: '0 0 18px 18px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
        transform: show ? 'translateY(0)' : 'translateY(-100%)',
        transition: 'transform 0.38s cubic-bezier(.22,.68,0,1.2)',
        marginTop: 'env(safe-area-inset-top, 0px)',
        maxWidth: 300,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, flex: '0 0 30px',
          background: 'rgba(255,255,255,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon.Trophy size={16} c="currentColor"/>
        </div>
        <div>
          <div style={{ fontSize: 9.5, opacity: 0.65, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 1 }}>
            Achievement unlocked
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>{name}</div>
        </div>
      </div>
    </div>
  );
}

// A render that throws unmounts the whole tree in React 18, leaving a blank
// page with nothing to tap. This catches it, reports it the way an uncaught
// error is reported, and offers a reload.
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) {
    window.FP_ERRORS?.report('react', error?.message || String(error), error?.stack);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return <BootFailed message="Something went wrong on this screen." />;
  }
}

function BootFailed({ message }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center', background: 'var(--fp-bg)', color: 'var(--fp-ink)' }}>
      <div style={{ fontSize: 15, lineHeight: 1.5 }}>{message}</div>
      <button onClick={() => window.location.reload()} style={{ height: 46, padding: '0 22px', borderRadius: 14, background: 'var(--fp-ink)', color: 'var(--fp-bg)', fontSize: 14, fontWeight: 500 }}>
        Reload
      </button>
    </div>
  );
}

// Polled until every script has parsed. A script that never arrives — a bad
// deploy, a stale cache — used to poll forever behind a hidden splash, with
// nothing on screen and nothing reported.
const MOUNT_WAIT_MS = 10000;
const mountStarted  = Date.now();

function mount() {
  const missing = [
    'MainScreen', 'PackSelector', 'LevelSelector', 'SettingsScreen', 'LevelScreen',
    'LevelCompletePopup', 'HowToPlayScreen', 'AchievementsScreen', 'AccountScreen',
    'AdminScreen', 'LevelStudio', 'FP_OBJECTS', 'LegalScreen', 'MathKeyboard', 'MathField',
    'freshProgress', 'Icon', 'FP_AUTH',
  ].filter(n => typeof window[n] === 'undefined');
  if (missing.length && Date.now() - mountStarted > MOUNT_WAIT_MS) {
    window.FP_ERRORS?.report('error', 'boot: missing ' + missing.join(', '));
    ReactDOM.createRoot(document.getElementById('root')).render(
      <BootFailed message="The game could not load. Check your connection and try again." />);
    return;
  }
  if (
    typeof MainScreen === 'undefined' ||
    typeof PackSelector === 'undefined' ||
    typeof LevelSelector === 'undefined' ||
    typeof SettingsScreen === 'undefined' ||
    typeof LevelScreen === 'undefined' ||
    typeof LevelCompletePopup === 'undefined' ||
    typeof HowToPlayScreen === 'undefined' ||
    typeof AchievementsScreen === 'undefined' ||
    typeof AccountScreen === 'undefined' ||
    typeof AdminScreen === 'undefined' ||
    typeof LevelStudio === 'undefined' ||
    typeof FP_OBJECTS === 'undefined' ||
    typeof LegalScreen === 'undefined' ||
    typeof MathKeyboard === 'undefined' ||
    typeof MathField === 'undefined' ||
    typeof freshProgress === 'undefined' ||
    typeof Icon === 'undefined' ||
    typeof FP_AUTH === 'undefined'
  ) {
    return setTimeout(mount, 30);
  }
  ReactDOM.createRoot(document.getElementById('root')).render(<ErrorBoundary><App /></ErrorBoundary>);
}
mount();
