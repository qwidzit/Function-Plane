// Function Plane — App shell & router

const { useState, useEffect, useRef, useMemo } = React;

const SETTINGS_DEFAULTS = {
  theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  density: 'comfortable',
  sound: true,
  volume: 70,
  gridLabels: true,
  autoZoom: true,
  notation: 'pretty',
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
  useEffect(() => FP_AUTH.subscribe(() => setAccount(FP_AUTH.getActive())), []);

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

  const [progress, setProgress] = useState(() => {
    const fromAuth = FP_AUTH.getActiveProgress();
    if (fromAuth) return fromAuth;
    return freshProgress();
  });

  // When the active account changes (sign in / out / switch), reload its progress.
  useEffect(() => {
    const p = FP_AUTH.getActiveProgress();
    setProgress(p || freshProgress());
    // Reset achievement seed so the new account's already-earned ones don't toast.
    achInitRef.current = false;
    prevUnlockedRef.current = new Set();
  }, [account?.id]);

  const [nav, setNav] = useState({ route: 'main', pack: null, levelIndex: 0 });

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

  // Sync-error toast (Supabase upload failures)
  const [syncError, setSyncError] = useState(null);
  useEffect(() => {
    const onErr = (e) => setSyncError(e.detail || 'Sync error');
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
    localStorage.setItem('fp-settings', JSON.stringify(settings));
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
  const navigate = (route, extra = {}) => {
    setNav(curr => {
      // Don't push the same route twice in a row
      if (curr.route !== route) navStackRef.current.push(curr);
      return { route, pack: null, levelIndex: 0, legalKind: null, ...extra };
    });
  };
  const navigateBack = () => {
    setNav(curr => {
      const prev = navStackRef.current.pop();
      return prev || { route: 'main', pack: null, levelIndex: 0, legalKind: null };
    });
  };

  // Capacitor: hook the Android hardware back button (no-op in browsers)
  useEffect(() => {
    const Cap = window.Capacitor;
    if (!Cap?.Plugins?.App) return;
    let removeFn;
    const ret = Cap.Plugins.App.addListener('backButton', () => {
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
          onBack={() => navigate('main')}
          onPickPack={pack => navigate('levels', { pack })}
        />
      );
    }

    if (route === 'levels') {
      return (
        <LevelSelector
          pack={nav.pack}
          progress={progress}
          density={settings.density}
          onBack={() => navigate('packs')}
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
          onBack={() => navigate('main')}
          onLegal={(kind) => navigate('legal', { legalKind: kind })}
        />
      );
    }

    if (route === 'legal') {
      return <LegalScreen kind={nav.legalKind} density={settings.density} onBack={() => navigate('settings')}/>;
    }

    if (route === 'level') {
      const { pack, levelIndex } = nav;
      const handleComplete = (rating, score, time, exprs) => {
        setProgress(prev => {
          const next  = { ...prev };
          const pd    = next[pack.id] = { ...prev[pack.id] };
          const stars    = [...pd.stars];
          const best     = [...pd.best];
          const bestTime = pd.bestTime  ? [...pd.bestTime]  : Array(10).fill(null);
          // maxScore: highest score ever achieved on a winning run (for achievements
          // like "solve a level with a complex equation worth 100+ pts").
          const maxScore = pd.maxScore  ? [...pd.maxScore]  : Array(10).fill(null);
          // bestEqs: the equations behind the best score, uploaded with the
          // leaderboard row so a submission can be audited against the
          // classifier. Only meaningful next to the score it produced.
          const bestEqs  = pd.bestEqs   ? [...pd.bestEqs]   : Array(10).fill(null);
          stars[levelIndex] = Math.max(stars[levelIndex] ?? -1, rating);
          if (best[levelIndex] == null || score < best[levelIndex]) {
            best[levelIndex]    = score;
            bestEqs[levelIndex] = exprs ?? null;
          }
          if (time != null) {
            bestTime[levelIndex] = bestTime[levelIndex] == null ? time : Math.min(bestTime[levelIndex], time);
          }
          maxScore[levelIndex] = maxScore[levelIndex] == null ? score : Math.max(maxScore[levelIndex], score);
          if (levelIndex + 1 < 10 && stars[levelIndex + 1] === null) {
            stars[levelIndex + 1] = -1;
          }
          pd.stars    = stars;
          pd.best     = best;
          pd.bestTime = bestTime;
          pd.maxScore = maxScore;
          pd.bestEqs  = bestEqs;
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
          onBack={() => navigate('levels', { pack })}
          onComplete={handleComplete}
          onNext={handleNext}
        />
      );
    }

    if (route === 'sandbox') {
      return <SandboxScreen onBack={() => navigate('main')} density={settings.density} settings={settings}/>;
    }

    if (route === 'how-to-play') {
      return <HowToPlayScreen onBack={() => navigate('main')} density={settings.density}/>;
    }

    if (route === 'achievements') {
      return <AchievementsScreen onBack={() => navigate('main')} progress={progress} density={settings.density}/>;
    }

    if (route === 'account') {
      return <AccountScreen onBack={() => navigate('main')} density={settings.density} account={account} progress={progress} onAdmin={() => navigate('admin')}/>;
    }

    if (route === 'admin') {
      return <AdminScreen onBack={() => navigate('account')} density={settings.density} onChanged={() => reloadOverrides({ force: true })}/>;
    }

    return (
      <PlaceholderScreen
        title={route}
        subtitle="Coming soon"
        onBack={() => navigate('main')}
      />
    );
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

      {/* Sync-error toast */}
      {syncError && (
        <div style={{
          position: 'absolute', top: 'env(safe-area-inset-top, 0px)', left: 0, right: 0,
          display: 'flex', justifyContent: 'center', zIndex: 10000, pointerEvents: 'none',
        }}>
          <div style={{
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

function PlaceholderScreen({ title, subtitle, onBack }) {
  return (
    <div className="fp-screen" style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      boxSizing: 'border-box',
    }}>
      <div style={{
        padding: `calc(14px + env(safe-area-inset-top, 0px)) 22px 6px`,
        display: 'flex', alignItems: 'center',
      }}>
        <button onClick={onBack} style={{
          width: 38, height: 38, borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--fp-ink-2)',
        }}>
          <Icon.Chevron dir="left" size={20} />
        </button>
      </div>

      <div style={{
        flex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 10, padding: '0 32px',
      }}>
        <div style={{
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontStyle: 'italic',
          fontSize: 36, lineHeight: 1, letterSpacing: '-0.02em',
          color: 'var(--fp-ink)', textAlign: 'center',
        }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--fp-ink-3)', textAlign: 'center' }}>
          {subtitle}
        </div>
      </div>
    </div>
  );
}

function mount() {
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
    typeof SandboxScreen === 'undefined' ||
    typeof LegalScreen === 'undefined' ||
    typeof MathKeyboard === 'undefined' ||
    typeof freshProgress === 'undefined' ||
    typeof Icon === 'undefined' ||
    typeof FP_AUTH === 'undefined'
  ) {
    return setTimeout(mount, 30);
  }
  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
}
mount();
