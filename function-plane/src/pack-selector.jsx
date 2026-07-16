// Function Plane — Pack Selector

const { useState: usePSState } = React;

function PackSelector({ progress, onBack, onPickPack, density = 'comfortable' }) {
  const padX = density === 'compact' ? 18 : 22;
  // Count stars and the achievable maximum over *visible* packs only —
  // hidden (unreleased) packs must not inflate the "/ 420" style total.
  const visRoman   = visiblePacks(ROMAN_PACKS);
  const visSpecial = visiblePacks(SPECIAL_PACKS);
  const totalStars = [...visRoman, ...visSpecial]
    .reduce((a, p) => a + packTotalStars(progress, p.id), 0);
  const totalPossible = (visRoman.length + visSpecial.length) * 30;
  // Unlock progress must match computePackLocked, which counts ALL packs.
  const unlockStars = totalStarsAll(progress);
  const [lockedPack, setLockedPack] = usePSState(null);

  const handlePackClick = (pack, lockInfo) => {
    if (lockInfo.locked) {
      setLockedPack({ pack, lockInfo });
    } else {
      onPickPack(pack);
    }
  };

  return (
    <div className="fp-screen" style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      boxSizing: 'border-box',
      position: 'relative',
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
        <WordmarkSmall />
        <div style={{
          height: 32, padding: '0 12px', borderRadius: 999,
          border: '1px solid var(--fp-line)', display: 'flex', alignItems: 'center', gap: 6,
          color: 'var(--fp-ink-2)', fontSize: 12,
        }}>
          <Icon.Star size={11} c="var(--fp-ink)" />
          <span className="fp-mono" style={{ color: 'var(--fp-ink)' }}>{totalStars}</span>
          <span style={{ opacity: 0.5 }}>/ {totalPossible}</span>
        </div>
      </div>

      {/* Title */}
      <div style={{ padding: `6px ${padX}px 14px`, flex: '0 0 auto' }}>
        <h1 style={{
          margin: 0,
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontStyle: 'italic', fontWeight: 400,
          fontSize: 36, lineHeight: 1, letterSpacing: '-0.02em',
        }}>
          Packs
        </h1>
        <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--fp-ink-3)' }}>
          {visRoman.length} chapters · {visSpecial.length} themed
        </div>
      </div>

      {/* Scroll list */}
      <div className="fp-scroll" style={{
        flex: 1, overflowY: 'auto',
        padding: `0 ${padX}px calc(24px + env(safe-area-inset-bottom, 0px))`,
      }}>
        <PSectionLabel>Chapters</PSectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visiblePacks(ROMAN_PACKS).map(p => {
            const lockInfo = computePackLocked(progress, p);
            const stars    = packTotalStars(progress, p.id);
            const complete = packIsComplete(progress, p.id);
            return (
              <PackRow key={p.id} pack={p} stars={stars} locked={lockInfo.locked} complete={complete}
                lockInfo={lockInfo}
                onClick={() => handlePackClick(p, lockInfo)} />
            );
          })}
        </div>

        <div style={{ marginTop: 22 }}>
          <PSectionLabel sub="By function family">Themed</PSectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {visiblePacks(SPECIAL_PACKS).map(p => {
              const lockInfo = computePackLocked(progress, p);
              const stars    = packTotalStars(progress, p.id);
              const complete = packIsComplete(progress, p.id);
              return (
                <SpecialPackCard key={p.id} pack={p} stars={stars} locked={lockInfo.locked} complete={complete}
                  lockInfo={lockInfo} totalStars={unlockStars}
                  onClick={() => handlePackClick(p, lockInfo)} />
              );
            })}
          </div>
        </div>
        <div style={{ height: 12 }} />
      </div>

      {/* Lock popup */}
      {lockedPack && (
        <LockedPackPopup
          pack={lockedPack.pack}
          lockInfo={lockedPack.lockInfo}
          totalStars={unlockStars}
          onClose={() => setLockedPack(null)}
        />
      )}
    </div>
  );
}

function PSectionLabel({ children, sub }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      padding: '6px 2px 10px',
    }}>
      <div style={{
        fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
        color: 'var(--fp-ink-3)', fontWeight: 500,
      }}>{children}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--fp-ink-4)' }}>{sub}</div>}
    </div>
  );
}

function PackRow({ pack, stars, locked, complete, onClick, lockInfo }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'stretch', gap: 14,
      padding: '14px',
      borderRadius: 16,
      border: '1px solid var(--fp-line)',
      background: 'var(--fp-surface)',
      textAlign: 'left',
      opacity: locked ? 0.55 : 1,
      cursor: 'pointer',
      width: '100%',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 12, flex: '0 0 64px',
        background: locked ? 'var(--fp-locked)' : 'var(--fp-surface-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: locked ? 0 : 0.18,
        }}>
          <MiniGraph kind={pack.kind} w={64} h={42} c="var(--fp-ink)" dim="transparent"/>
        </div>
        <span style={{
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontStyle: 'italic', fontWeight: 400,
          fontSize: pack.numeral.length > 2 ? 22 : 26,
          color: 'var(--fp-ink)', position: 'relative', letterSpacing: '-0.02em',
          opacity: locked ? 0.4 : 1,
        }}>
          {pack.numeral}
        </span>
        {locked && (
          <div style={{
            position: 'absolute', right: 4, bottom: 4,
            width: 22, height: 22, borderRadius: 6,
            background: 'var(--fp-ink)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
          }}>
            <Icon.Lock size={11} c="var(--fp-bg)"/>
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fp-ink-3)' }}>
              Pack {pack.numeral}
            </span>
            {complete && (
              <span style={{
                fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase',
                padding: '1px 6px', borderRadius: 4,
                background: 'var(--fp-ink)', color: 'var(--fp-bg)',
              }}>Complete</span>
            )}
          </div>
          <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--fp-ink)', marginTop: 2, letterSpacing: '-0.01em' }}>
            {pack.name}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          {locked ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--fp-ink-3)', fontSize: 11.5 }}>
              <Icon.Lock size={12} /> Complete previous pack
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Stars count={Math.min(3, Math.round(stars / 10))} total={3} size={11} />
              <span className="fp-mono" style={{ fontSize: 11.5, color: 'var(--fp-ink-2)' }}>
                {stars}<span style={{ color: 'var(--fp-ink-4)' }}>/30</span>
              </span>
            </span>
          )}
          {!locked && <Icon.Chevron size={16} c="var(--fp-ink-3)"/>}
        </div>
      </div>
    </button>
  );
}

function SpecialPackCard({ pack, stars, locked, complete, onClick, lockInfo, totalStars }) {
  const starsNeeded = locked && lockInfo?.reason === 'stars' ? lockInfo.need : null;
  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      padding: '14px',
      borderRadius: 16,
      border: '1px solid var(--fp-line)',
      background: 'var(--fp-surface)',
      textAlign: 'left',
      minHeight: 140,
      opacity: locked ? 0.55 : 1,
      cursor: 'pointer',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fp-ink-3)' }}>
          Themed
        </span>
        {locked
          ? <Icon.Lock size={12} c="var(--fp-ink-3)"/>
          : complete
            ? <span style={{
                fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase',
                padding: '1px 5px', borderRadius: 3,
                background: 'var(--fp-ink)', color: 'var(--fp-bg)',
              }}>100%</span>
            : null
        }
      </div>

      <div style={{
        margin: '8px 0',
        background: 'var(--fp-surface-2)', borderRadius: 10,
        height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        <MiniGraph kind={pack.kind} w={88} h={40}
          c={locked ? 'var(--fp-ink-4)' : 'var(--fp-ink)'} dim="var(--fp-line)"/>
        {locked && (
          <div style={{
            position: 'absolute', right: 6, bottom: 6,
            width: 22, height: 22, borderRadius: 6,
            background: 'var(--fp-ink)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
          }}>
            <Icon.Lock size={11} c="var(--fp-bg)"/>
          </div>
        )}
      </div>

      <div>
        <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--fp-ink)', letterSpacing: '-0.01em' }}>{pack.name}</div>
        <div className="fp-mono" style={{ fontSize: 10.5, color: 'var(--fp-ink-3)', marginTop: 1 }}>{pack.tag}</div>
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {locked ? (
            <span style={{ fontSize: 10.5, color: 'var(--fp-ink-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
              {starsNeeded != null
                ? <><Icon.Star size={10} c="var(--fp-ink-4)"/> {starsNeeded}★ to unlock</>
                : 'Locked'}
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Stars count={Math.min(3, Math.round(stars / 10))} total={3} size={10} />
              <span className="fp-mono" style={{ fontSize: 10.5, color: 'var(--fp-ink-2)' }}>
                {stars}<span style={{ color: 'var(--fp-ink-4)' }}>/30</span>
              </span>
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function LockedPackPopup({ pack, lockInfo, totalStars, onClose }) {
  const { reason, need, have, prevPackName } = lockInfo;
  const isPrevPack = reason === 'prev_pack';
  const isStars    = reason === 'stars';

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-end',
      backdropFilter: 'blur(2px)',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%',
        background: 'var(--fp-bg)',
        borderRadius: '22px 22px 0 0',
        padding: '28px 24px',
        paddingBottom: 'max(28px, env(safe-area-inset-bottom, 0px))',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.3)',
        boxSizing: 'border-box',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--fp-ink-4)', margin: '-16px auto 20px' }}/>

        {/* Icon */}
        <div style={{
          width: 56, height: 56, borderRadius: 18,
          background: 'var(--fp-surface-2)', border: '1px solid var(--fp-line)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <Icon.Lock size={24} c="var(--fp-ink-3)"/>
        </div>

        <div style={{
          textAlign: 'center',
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontStyle: 'italic', fontSize: 26, letterSpacing: '-0.02em',
          color: 'var(--fp-ink)', marginBottom: 8,
        }}>
          {pack.name} is locked
        </div>

        {isPrevPack && (
          <div style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--fp-ink-3)', lineHeight: 1.55, marginBottom: 20 }}>
            Earn <strong style={{ color: 'var(--fp-ink)' }}>{need}/30★</strong> in <strong style={{ color: 'var(--fp-ink)' }}>{prevPackName}</strong> to unlock this chapter.
            <br/>
            <span style={{ fontSize: 12, color: 'var(--fp-ink-4)', display: 'block', marginTop: 4 }}>
              You have {have}/{need} so far.
            </span>
          </div>
        )}

        {isStars && (
          <div style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--fp-ink-3)', lineHeight: 1.55, marginBottom: 20 }}>
            Earn <strong style={{ color: 'var(--fp-ink)' }}>{need} total stars</strong> to unlock this pack.
            <br/>
            <span style={{ fontSize: 12, color: 'var(--fp-ink-4)', display: 'block', marginTop: 4 }}>
              You have {totalStars} / {need} so far.
            </span>
            {/* Progress bar */}
            <div style={{ height: 5, background: 'var(--fp-line)', borderRadius: 3, margin: '12px auto 0', maxWidth: 200 }}>
              <div style={{
                height: '100%', borderRadius: 3, background: 'var(--fp-accent)',
                width: `${Math.min(100, (totalStars / need) * 100)}%`,
                transition: 'width .4s ease',
              }}/>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, height: 50, borderRadius: 14,
            background: 'var(--fp-surface)', border: '1px solid var(--fp-line)',
            color: 'var(--fp-ink)', fontSize: 14, fontWeight: 500,
          }}>
            Got it
          </button>
          <button onClick={onClose} style={{
            flex: 2, height: 50, borderRadius: 14,
            background: 'var(--fp-ink)', color: 'var(--fp-bg)',
            fontSize: 14, fontWeight: 500,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                fill="currentColor"/>
            </svg>
            Upgrade to Premium
          </button>
        </div>
      </div>
    </div>
  );
}

window.PackSelector = PackSelector;
