// Function Plane — Main Screen

function MainScreen({ onPlay, onInfo, onAchievements, onAccount, onSettings, totalStars, continuePoint, progress, density = 'comfortable' }) {
  const padX = density === 'compact' ? 22 : 26;
  const hasAnyProgress = progress && Object.values(progress).some(pd =>
    pd.stars.some(s => s > 0)
  );
  const { useState: useMS } = React;
  const [ratePopup, setRatePopup] = useMS(false);

  // Rate: once RATE_CONFIG is switched on with store URLs, this opens the
  // native review sheet / store listing. Until then it shows a coming-soon note.
  const onRate = () => {
    if (window.FP_ENV?.canRate?.()) { window.FP_ENV.openRating(); return; }
    setRatePopup(true);
  };

  return (
    <div className="fp-screen" style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      paddingBottom: 'max(18px, env(safe-area-inset-bottom, 0px))',
      position: 'relative', overflow: 'hidden',
      boxSizing: 'border-box',
    }}>
      {/* Top bar — sits just below the status bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `calc(19px + env(safe-area-inset-top, 0px)) ${padX}px 0`,
        flex: '0 0 auto',
      }}>
        <button onClick={onSettings} aria-label="Settings"
          style={{ width: 36, height: 36, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--fp-ink-2)' }}>
          <Icon.Settings size={20} />
        </button>
        <button onClick={onAccount} aria-label="Account"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '5px 10px 5px 5px',
            borderRadius: 999, border: '1px solid var(--fp-line)',
            background: 'var(--fp-surface)',
          }}>
          <span style={{
            width: 24, height: 24, borderRadius: '50%',
            background: 'var(--fp-surface-2)', color: 'var(--fp-ink-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10.5, fontWeight: 600, letterSpacing: '0.02em',
          }}>
            <Icon.User size={13} c="var(--fp-ink-2)" />
          </span>
          <span style={{ fontSize: 12, color: 'var(--fp-ink-2)', paddingRight: 4 }}>
            <span className="fp-mono">{totalStars}</span> ★
          </span>
        </button>
      </div>

      {/* Hero — wordmark on a faint coordinate plane */}
      <div style={{
        flex: '0 0 auto',
        margin: `19px ${padX}px`,
        padding: '19px 0',
        position: 'relative',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        borderRadius: 16, overflow: 'hidden',
      }}>
        <PlaneBackdrop />
        <div style={{ position: 'relative', zIndex: 1, color: 'var(--fp-ink)' }}>
          <Wordmark size={0.95} />
        </div>
        <div style={{
          position: 'relative', zIndex: 1, marginTop: 2,
          fontSize: 12, color: 'var(--fp-ink-3)', letterSpacing: '0.02em',
          textAlign: 'center',
        }}>
          A puzzle game about <span className="fp-mono" style={{ fontSize: 11.5 }}>f(x)</span>
        </div>
      </div>

      {/* Play card */}
      <div style={{ padding: `0 ${padX}px`, flex: '0 0 auto' }}>
        <PlayCard
          onClick={onPlay}
          continuePoint={continuePoint}
          progress={progress}
          hasAnyProgress={hasAnyProgress}
        />
      </div>

      <div style={{ flex: 1 }} />

      {/* Tile row */}
      <div style={{ padding: `0 ${padX - 6}px 4px`, flex: '0 0 auto' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <IconTile icon={<Icon.Info size={20} c="var(--fp-ink)"/>} label="How to play" onClick={onInfo} />
          <IconTile icon={<Icon.Trophy size={20} c="var(--fp-ink)"/>} label="Achievements" onClick={onAchievements} />
          <IconTile icon={<Icon.Heart size={18} c="var(--fp-ink)"/>} label="Rate" onClick={onRate} />

        </div>
      </div>

      {/* Footer */}
      <div style={{
        textAlign: 'center', fontSize: 10, color: 'var(--fp-ink-4)',
        letterSpacing: '0.06em', textTransform: 'uppercase',
        paddingTop: 10, flex: '0 0 auto',
      }}>
        v 1.0 · build 1
      </div>

      {/* Rate — coming-soon popup */}
      {ratePopup && (
        <div onClick={() => setRatePopup(false)} style={{
          position: 'absolute', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px', backdropFilter: 'blur(3px)',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--fp-bg)', border: '1px solid var(--fp-line)',
            borderRadius: 22, padding: '28px 22px 22px',
            maxWidth: 300, width: '100%', textAlign: 'center',
            boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
          }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>🎮</div>
            <div style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontStyle: 'italic', fontSize: 23, letterSpacing: '-0.02em',
              color: 'var(--fp-ink)', marginBottom: 10,
            }}>Coming soon</div>
            <div style={{ fontSize: 13, color: 'var(--fp-ink-3)', lineHeight: 1.6, marginBottom: 22 }}>
              Function Plane isn't on Google Play yet — but it will be soon!
              Check back later to leave a rating.
            </div>
            <button onClick={() => setRatePopup(false)} style={{
              width: '100%', height: 44, borderRadius: 12,
              background: 'var(--fp-ink)', color: 'var(--fp-bg)',
              fontSize: 13.5, fontWeight: 500,
            }}>Got it</button>
          </div>
        </div>
      )}
    </div>
  );
}

function PlaneBackdrop() {
  return (
    <svg width="100%" height="140" viewBox="0 0 360 140" preserveAspectRatio="none"
      style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      <defs>
        <pattern id="grid-ms" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 24 0 L 0 0 0 24" fill="none" stroke="var(--fp-grid)" strokeWidth="1"/>
        </pattern>
        <linearGradient id="fade-ms" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--fp-bg)" stopOpacity="1"/>
          <stop offset="40%" stopColor="var(--fp-bg)" stopOpacity="0"/>
          <stop offset="60%" stopColor="var(--fp-bg)" stopOpacity="0"/>
          <stop offset="100%" stopColor="var(--fp-bg)" stopOpacity="1"/>
        </linearGradient>
        <mask id="m-ms">
          <rect width="100%" height="100%" fill="white"/>
          <rect width="100%" height="100%" fill="url(#fade-ms)"/>
        </mask>
      </defs>
      <g mask="url(#m-ms)">
        <rect width="100%" height="100%" fill="url(#grid-ms)"/>
        <path d="M0 70 H360 M180 0 V140" stroke="var(--fp-grid-axis)" strokeWidth="1"/>
      </g>
    </svg>
  );
}

function PlayCard({ onClick, continuePoint, progress, hasAnyProgress }) {
  const pack = continuePoint?.pack;
  const levelIndex = continuePoint?.levelIndex ?? 0;
  const pd = pack && progress ? progress[pack.id] : null;
  const starsCount = Math.max(0, pd?.stars?.[levelIndex] ?? 0);
  const best = pd?.best?.[levelIndex] ?? null;
  const packLabel = pack
    ? (pack.type === 'roman' ? `Pack ${pack.numeral}` : pack.name)
    : 'Pack I';

  return (
    <button onClick={onClick} style={{
      position: 'relative',
      width: '100%', borderRadius: 18,
      background: 'var(--fp-play-bg)', color: 'var(--fp-play-ink)',
      padding: '16px 16px 14px', textAlign: 'left', overflow: 'hidden',
      border: '1px solid var(--fp-play-line)',
    }}>
      {/* Curve illustration */}
      <svg width="100%" height="80" viewBox="0 0 320 80" preserveAspectRatio="none"
        style={{ display: 'block', position: 'absolute', right: 0, bottom: 0, opacity: 0.95, pointerEvents: 'none' }}>
        <defs>
          <pattern id="dots-pc" width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.7" fill="var(--fp-play-ink)" fillOpacity="0.06"/>
          </pattern>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="url(#dots-pc)"/>
        <path d="M0 62 C60 62 90 14 160 14 C220 14 250 62 320 62"
          stroke="var(--fp-play-ink)" strokeOpacity="0.55" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        <circle cx="40" cy="56" r="4.5" fill="var(--fp-play-ink)"/>
        <path d="M160 5 L162 11 L168 11.5 L163 15 L165 21 L160 18 L155 21 L157 15 L152 11.5 L158 11 Z"
          fill="var(--fp-play-ink)" fillOpacity="0.85"/>
        <path d="M260 50 L262 56 L268 56.5 L263 60 L265 66 L260 63 L255 66 L257 60 L252 56.5 L258 56 Z"
          fill="var(--fp-play-ink)" fillOpacity="0.45"/>
      </svg>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: 10.5, color: 'var(--fp-play-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {hasAnyProgress ? 'Continue' : 'Start playing'}
        </div>
        <div style={{
          fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: 'italic',
          fontSize: 27, lineHeight: 1.05, marginTop: 3, letterSpacing: '-0.02em',
        }}>
          {packLabel} · Level {levelIndex + 1}
        </div>
        <div style={{
          marginTop: 9,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Stars count={starsCount} total={3} size={10}
              c="var(--fp-play-ink)" empty="var(--fp-play-line)" />
            <span className="fp-mono" style={{ fontSize: 11, color: 'var(--fp-play-muted)' }}>
              {best != null ? `best ${best}` : '—'}
            </span>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px 6px 13px',
            background: 'var(--fp-play-pill-bg)', color: 'var(--fp-play-pill-ink)',
            borderRadius: 999, fontSize: 12.5, fontWeight: 500,
          }}>
            Play <Icon.Play size={10} c="var(--fp-play-pill-ink)"/>
          </div>
        </div>
      </div>
    </button>
  );
}

window.MainScreen = MainScreen;
