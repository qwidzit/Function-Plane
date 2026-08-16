// Function Plane — How to Play screen

function HowToPlayScreen({ onBack, density = 'comfortable' }) {
  const padX = density === 'compact' ? 22 : 26;

  return (
    <div className="fp-screen" style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
    }}>
      {/* Top bar */}
      <div style={{
        padding: `calc(14px + env(safe-area-inset-top, 0px)) ${padX}px 14px`,
        display: 'flex', alignItems: 'center', gap: 12, flex: '0 0 auto',
        borderBottom: '1px solid var(--fp-line)',
      }}>
        <button onClick={onBack} style={{
          width: 36, height: 36, borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--fp-ink-2)',
        }}>
          <Icon.Chevron dir="left" size={18}/>
        </button>
        <div style={{
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontStyle: 'italic', fontSize: 24, letterSpacing: '-0.02em', color: 'var(--fp-ink)',
        }}>How to play</div>
      </div>

      <div className="fp-scroll" style={{
        flex: 1, overflowY: 'auto',
        padding: `20px ${padX}px`,
        paddingBottom: 'max(32px, env(safe-area-inset-bottom, 0px))',
      }}>

        <HTPCard color="#2d70b3"
          icon={<svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <circle cx={12} cy={12} r={4} fill="currentColor"/>
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/>
          </svg>}
          title="The goal"
        >
          Guide the ball from its start position to collect every star. The ball rolls under
          gravity along curves you draw. <em>All stars must be collected</em> for a level to complete.
        </HTPCard>

        <HTPCard color="#388c46"
          icon={<svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <path d="M4 8H20M4 16H20" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/>
          </svg>}
          title="Write equations"
        >
          <div style={{ marginBottom: 8 }}>
            Tap <strong>Add</strong> in the panel and type an equation in any form:
          </div>
          <CodeLine>y = sin(x)</CodeLine>
          <CodeLine>x² + y² = 25</CodeLine>
          <CodeLine>y = 0.5x − 1</CodeLine>
          <div style={{ marginTop: 8 }}>
            On mobile the custom math keyboard appears automatically.
            Tap the <strong>⌨</strong> button to show or hide it.
          </div>
        </HTPCard>

        <HTPCard color="#6042a6"
          icon={<svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor">
            <path d="M5 3L19 12L5 21Z"/>
          </svg>}
          title="Press Play"
        >
          When your equations look right, press <strong>Play</strong>. The ball drops from its
          starting position (dashed circle) and rolls along your curves. Press <strong>Stop</strong> at
          any time to reset and adjust.
        </HTPCard>

        <HTPCard color="#c74440"
          icon={<svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <path d="M12 2 L15.1 8.3 L22 9.3 L17 14.1 L18.2 21 L12 17.8 L5.8 21 L7 14.1 L2 9.3 L8.9 8.3 Z"
              stroke="currentColor" strokeWidth={1.8} fill="currentColor" strokeLinejoin="round"/>
          </svg>}
          title="Star rating"
        >
          <div style={{ marginBottom: 8 }}>
            Collecting every star always clears the level. Which rating you get is
            decided by the first of these that holds:
          </div>
          <RatingRow n={3}>You used no more equations than the equation goal</RatingRow>
          <RatingRow n={2}>Otherwise — your score is at or below the score goal</RatingRow>
          <RatingRow n={1}>Otherwise — you cleared it</RatingRow>
        </HTPCard>

        {/* Scoring section — card with table */}
        <HTPCard color="#fa7e19"
          icon={<svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"
              stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"/>
          </svg>}
          title="Score & complexity"
        >
          <div style={{ marginBottom: 10 }}>
            Score = 20 pts per equation + that equation's complexity.
            <strong> Lower is better.</strong> Fewer, simpler equations score less.
          </div>
          <div style={{
            background: 'var(--fp-surface)',
            border: '1px solid var(--fp-line)',
            borderRadius: 10, overflow: 'hidden',
            marginBottom: 8,
          }}>
            {[
              ['Linear   (mx + b)',      '10 pts'],
              ['Quadratic (x²)',         '20 pts'],
              ['Piecewise (|x|, ⌊x⌋)',   '20 pts'],
              ['Trig (sin, cos, tan)',   '25 pts'],
              ['Cubic (x³)',             '30 pts'],
              ['Rational (1/x)',         '30 pts'],
              ['Log / ln',               '30 pts'],
              ['Exponential (eˣ)',       '35 pts'],
              ['Derivative (d/dx)',      '35 pts'],
              ['Inv. trig (arcsin…)',    '40 pts'],
              ['Sum (Σ)',                '50 pts'],
              ['Integral (∫)',           '55 pts'],
              ["Doesn't parse",          '60 pts'],
            ].map(([fn, pts], i, arr) => (
              <div key={fn} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '7px 12px',
                borderBottom: i < arr.length - 1 ? '1px solid var(--fp-line)' : 'none',
              }}>
                <span className="fp-mono" style={{ fontSize: 11.5, color: 'var(--fp-ink-2)' }}>{fn}</span>
                <span className="fp-mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--fp-ink)' }}>{pts}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--fp-ink-4)', lineHeight: 1.5 }}>
            Every transcendental function beyond the first in one equation adds 60% of the base —
            sin(cos(x)) costs far more than sin(x). Mixing a transcendental with a degree-2-or-higher
            polynomial (sin(x)·x²) then multiplies the total by 1.3, and polynomials above degree 3
            add 5 pts per extra power.
          </div>
        </HTPCard>

        <HTPCard color="#6042a6"
          icon={<svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <path d="M5 5h6M5 19l3.5-14M14 9c0-2.5 1.5-4 3-4s2 1.5 2 3v8c0 1.5 1 3 2.5 3"
              stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"/>
          </svg>}
          title="Advanced operators"
        >
          <div style={{ marginBottom: 8 }}>
            Switch the keyboard to the <strong>𝑓𝑥</strong> tab for inverse trig and higher-order operators.
            Each takes its body as the last argument, written as a normal expression in <span className="fp-mono">x</span> (and <span className="fp-mono">n</span> for sums).
          </div>
          <CodeLine>y = arcsin(x)</CodeLine>
          <CodeLine>y = sum(1, 5, n*x^n)        Σ from n=1..5</CodeLine>
          <CodeLine>y = deriv(sin(x))           ≈ cos(x)</CodeLine>
          <CodeLine>y = integ(x^2)              ∫₀ˣ t² dt = x³/3</CodeLine>
          <div style={{ fontSize: 11.5, color: 'var(--fp-ink-4)', lineHeight: 1.5, marginTop: 8 }}>
            Numerical operators — sums are capped at 200 terms, integrals use ~150 sample points.
            Powerful, but each one adds significant complexity to your score.
          </div>
        </HTPCard>

        <HTPCard color="#6042a6"
          icon={<svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <path d="M6 3v18M18 3v18M3 9h18M3 15h18" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"/>
          </svg>}
          title="Domain restrictions"
        >
          Tap the grid icon on any equation to restrict where it appears on the plane.
          Add segments like x ∈ [−3, 3] to show only part of a curve.
          Multiple segments are supported — useful for building ramps and platforms.
        </HTPCard>

        <HTPCard color="#2d70b3"
          icon={<svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <path d="M15 3H21V9M9 21H3V15M21 15V21H15M3 9V3H9" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
          </svg>}
          title="Pan & zoom"
          last
        >
          Drag the plane with one finger to pan. Pinch with two fingers (or use the +/− buttons)
          to zoom in and out. The crosshair button resets the view to the origin.
        </HTPCard>

      </div>
    </div>
  );
}

function HTPCard({ color, icon, title, children, last }) {
  return (
    <div style={{
      background: 'var(--fp-surface)',
      border: '1px solid var(--fp-line)',
      borderRadius: 18, overflow: 'hidden',
      marginBottom: last ? 0 : 12,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px 12px',
        borderBottom: '1px solid var(--fp-line)',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flex: '0 0 36px',
          background: color + '18',
          color: color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{icon}</div>
        <div style={{
          fontSize: 14, fontWeight: 600, color: 'var(--fp-ink)',
          letterSpacing: '-0.01em',
        }}>{title}</div>
      </div>
      <div style={{
        padding: '12px 16px',
        fontSize: 13, color: 'var(--fp-ink-3)', lineHeight: 1.65,
      }}>
        {children}
      </div>
    </div>
  );
}

function CodeLine({ children }) {
  return (
    <div className="fp-mono" style={{
      fontSize: 12.5, color: 'var(--fp-ink-2)',
      background: 'var(--fp-surface-2)', border: '1px solid var(--fp-line)',
      borderRadius: 7, padding: '5px 10px', marginBottom: 4,
      display: 'inline-block', width: '100%', boxSizing: 'border-box',
    }}>{children}</div>
  );
}

function RatingRow({ n, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 5 }}>
      <Stars count={n} total={3} size={9} c="var(--lv-star)" empty="var(--fp-ink-4)"/>
      <span style={{ fontSize: 12, color: 'var(--fp-ink-2)', lineHeight: 1.4 }}>{children}</span>
    </div>
  );
}

window.HowToPlayScreen = HowToPlayScreen;
