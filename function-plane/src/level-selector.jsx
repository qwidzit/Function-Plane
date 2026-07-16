// Function Plane — Level Selector (inside a pack)

function LevelSelector({ pack, progress, onBack, onPickLevel, density = 'comfortable' }) {
  const padX = density === 'compact' ? 18 : 22;
  const data = progress[pack.id] || { stars: Array(10).fill(-1), best: Array(10).fill(null) };
  const earned = data.stars.reduce((a, v) => a + (v > 0 ? v : 0), 0);
  const completed = data.stars.filter(v => v !== null && v >= 1).length;

  // Pack-level gating already happened in PackSelector (computePackLocked) —
  // inside an open pack the first level is always playable and each next
  // level unlocks by clearing the previous one. Never gate on stars[i]
  // itself: a freshly-unlocked pack still has null (untouched) entries,
  // which used to lock every level including the first.
  const isLevelUnlocked = (i) => {
    if (i === 0) return true;
    const prev = data.stars[i - 1];
    return prev != null && prev >= 1;
  };

  return (
    <div className="fp-screen" style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      boxSizing: 'border-box',
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `calc(14px + env(safe-area-inset-top, 0px)) ${padX}px 6px`,
        flex: '0 0 auto',
      }}>
        <button onClick={onBack} aria-label="Back" style={{
          width: 38, height: 38, borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--fp-ink-2)',
        }}>
          <Icon.Chevron dir="left" size={20} />
        </button>
        <div style={{
          fontSize: 11.5, color: 'var(--fp-ink-3)', letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}>
          {pack.type === 'roman' ? `Pack ${pack.numeral}` : 'Themed'}
        </div>
        <div style={{
          height: 32, padding: '0 12px', borderRadius: 999,
          border: '1px solid var(--fp-line)', display: 'flex', alignItems: 'center', gap: 6,
          color: 'var(--fp-ink-2)', fontSize: 12,
        }}>
          <Icon.Star size={11} c="var(--fp-ink)" />
          <span className="fp-mono" style={{ color: 'var(--fp-ink)' }}>{earned}</span>
          <span style={{ opacity: 0.5 }}>/ 30</span>
        </div>
      </div>

      {/* Pack header */}
      <div style={{
        padding: `12px ${padX}px 18px`,
        display: 'flex', alignItems: 'center', gap: 14, flex: '0 0 auto',
      }}>
        <div style={{
          width: 70, height: 70, borderRadius: 14, flex: '0 0 70px',
          background: 'var(--fp-surface-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.18,
          }}>
            <MiniGraph kind={pack.kind} w={68} h={48} c="var(--fp-ink)" dim="transparent"/>
          </div>
          <span style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontStyle: 'italic', fontWeight: 400,
            fontSize: pack.numeral.length > 2 ? 24 : 30,
            color: 'var(--fp-ink)', position: 'relative', letterSpacing: '-0.02em',
          }}>
            {pack.numeral}
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{
            margin: 0,
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontStyle: 'italic', fontWeight: 400,
            fontSize: 28, lineHeight: 1, letterSpacing: '-0.02em',
          }}>
            {pack.name}
          </h1>
          <div style={{
            marginTop: 6, fontSize: 12, color: 'var(--fp-ink-3)',
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          }}>
            {pack.tag
              ? <span className="fp-mono" style={{ fontSize: 11.5, color: 'var(--fp-ink-2)' }}>{pack.tag}</span>
              : <span>10 levels</span>
            }
            <span style={{ opacity: 0.4 }}>·</span>
            <span>{completed}/10 cleared</span>
          </div>
        </div>
      </div>

      {/* Level list */}
      <div className="fp-scroll" style={{
        flex: 1, overflowY: 'auto',
        padding: `0 ${padX}px calc(24px + env(safe-area-inset-bottom, 0px))`,
      }}>
        <div style={{
          fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
          color: 'var(--fp-ink-3)', fontWeight: 500,
          padding: '4px 2px 12px',
        }}>Levels</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 10 }).map((_, i) => {
            const stars = data.stars[i];
            const best = data.best[i];
            const unlocked = isLevelUnlocked(i);
            const attempted = stars !== null && stars >= 0;
            const cleared = stars !== null && stars >= 1;
            return (
              <LevelRow
                key={i} index={i} pack={pack}
                stars={stars} best={best}
                unlocked={unlocked} attempted={attempted} cleared={cleared}
                onClick={() => unlocked && onPickLevel(pack, i)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LevelRow({ index, pack, stars, best, unlocked, attempted, cleared, onClick }) {
  const num = String(index + 1).padStart(2, '0');
  const status = !unlocked ? 'locked' : !attempted ? 'fresh' : cleared ? 'cleared' : 'inprogress';

  return (
    <button onClick={onClick} disabled={!unlocked} style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '12px 14px',
      borderRadius: 14,
      border: '1px solid var(--fp-line)',
      background: 'var(--fp-surface)',
      textAlign: 'left',
      opacity: !unlocked ? 0.5 : 1,
      cursor: !unlocked ? 'not-allowed' : 'pointer',
      width: '100%',
    }}>
      <div style={{
        width: 40, flex: '0 0 40px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
      }}>
        <span className="fp-mono" style={{ fontSize: 18, fontWeight: 500, color: 'var(--fp-ink)', letterSpacing: '-0.01em', lineHeight: 1 }}>
          {num}
        </span>
        <span style={{ fontSize: 8.5, color: 'var(--fp-ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Lvl
        </span>
      </div>

      <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--fp-line)' }} />

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--fp-ink)' }}>
            {(window.getLevelName ? getLevelName(pack.id, index) : LEVEL_NAMES[index])}
          </span>
          {status === 'cleared' && stars === 3 && (
            <span style={{
              fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase',
              padding: '1px 5px', borderRadius: 3,
              background: 'var(--fp-ink)', color: 'var(--fp-bg)',
            }}>Perfect</span>
          )}
          {status === 'fresh' && (
            <span style={{ fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fp-ink-3)' }}>New</span>
          )}
          {status === 'inprogress' && (
            <span style={{ fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fp-ink-3)' }}>In progress</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--fp-ink-3)', fontSize: 11.5 }}>
          {!unlocked ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Icon.Lock size={11} /> Clear level {index} first
            </span>
          ) : !attempted ? (
            <>
              <Stars count={0} total={3} size={10} />
              <span className="fp-mono" style={{ color: 'var(--fp-ink-4)' }}>—</span>
            </>
          ) : (
            <>
              <Stars count={stars} total={3} size={10} />
              <span className="fp-mono" style={{ color: 'var(--fp-ink-2)' }}>
                best <span style={{ color: 'var(--fp-ink)' }}>{best}</span>
              </span>
            </>
          )}
        </div>
      </div>

      <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 6 }}>
        {unlocked && (
          <div style={{
            width: 44, height: 30, borderRadius: 6,
            background: 'var(--fp-surface-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <MiniGraph
              kind={LEVEL_GRAPH[(index + (pack.type === 'roman' ? pack.index : 0)) % LEVEL_GRAPH.length]}
              w={40} h={26}
              c={cleared ? 'var(--fp-ink)' : 'var(--fp-ink-3)'}
              dim="transparent"
            />
          </div>
        )}
        <Icon.Chevron size={15} c={unlocked ? 'var(--fp-ink-3)' : 'var(--fp-ink-4)'}/>
      </div>
    </button>
  );
}

window.LevelSelector = LevelSelector;
