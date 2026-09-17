// Function Plane — How to Play screen

// Maths inside the copy is typeset, not written out. The game asks players to
// read x² and √x; showing them x^2 and sqrt(x) in its own explanations teaches
// the wrong notation. MathExpr is resolved at render time because it lives in
// level-screen.js, which loads after this file.
function M({ e }) {
  return <span className="fp-mono" style={{ whiteSpace: 'nowrap' }}>
    {typeof MathExpr === 'function' ? <MathExpr src={e}/> : e}
  </span>;
}

const { useState: useHTS } = React;

function HowToPlayScreen({ onBack, density = 'comfortable' }) {
  const padX = density === 'compact' ? 22 : 26;
  const [advanced, setAdvanced] = useHTS(false);

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
          <CodeLine><M e="y=sin(x)"/></CodeLine>
          <CodeLine><M e="x^2+y^2=25"/></CodeLine>
          <CodeLine><M e="y=0.5x-1"/></CodeLine>
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
            Three stars, and each is earned on its own — any combination of them:
          </div>
          <RatingRow>You collected every star</RatingRow>
          <RatingRow>Your score is at or below the score goal</RatingRow>
          <RatingRow>You used no more equations than the equation goal</RatingRow>
          <div style={{ marginTop: 8 }}>
            So beating the equation goal while missing the score goal earns two, not three.
          </div>
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
              ['Constant (y = c)',       ' 0 pts'],
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
          <CodeLine><M e="y=arcsin(x)"/></CodeLine>
          <CodeLine><M e="y=sum(1,5,n*x^n)"/><Note>Σ from n=1..5</Note></CodeLine>
          <CodeLine><M e="y=deriv(sin(x))"/><Note>≈ cos(x)</Note></CodeLine>
          <CodeLine><M e="y=integ(x^2)"/><Note>∫₀ˣ t² dt = x³/3</Note></CodeLine>
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

        {!advanced && (
          <button onClick={() => setAdvanced(true)} style={{
            width: '100%', marginTop: 12, padding: '12px 16px',
            borderRadius: 14, border: '1px dashed var(--fp-line)',
            background: 'transparent', color: 'var(--fp-ink-3)',
            fontSize: 13, letterSpacing: '-0.01em',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            Advanced — the engine, exactly
            <Icon.Chevron dir="down" size={14}/>
          </button>
        )}

        {advanced && <Advanced/>}

      </div>
    </div>
  );
}

// ─── Advanced ────────────────────────────────────────────────
// Every number the simulation actually uses, for players who would rather
// solve a level than feel their way through it.
//
// Typeset the way the equation field typesets: upright variables, real
// fractions, real superscripts. A formula the game draws one way in a row and
// another way in its own manual is two notations to learn. MathExpr itself
// cannot be used — it knows the game's grammar and nothing about subscripts,
// vectors or hats — so these are the same conventions, built small.
const Sb  = ({ children }) => <sub style={{ fontSize: '0.72em' }}>{children}</sub>;
const Sp  = ({ children }) => <sup style={{ fontSize: '0.72em' }}>{children}</sup>;

// A fraction, stacked — the same shape mathFrac draws in an equation row.
function Frac({ n, d }) {
  return (
    <span style={{
      display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
      verticalAlign: 'middle', margin: '0 3px', fontSize: '0.9em', lineHeight: 1.1,
    }}>
      <span style={{ padding: '0 4px 1px' }}>{n}</span>
      <span style={{ padding: '1px 4px 0', borderTop: '1px solid currentColor', width: '100%', textAlign: 'center' }}>{d}</span>
    </span>
  );
}

// One law: the statement, and a short note on the right saying when it applies.
function Law({ note, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 10,
      padding: '5px 0', borderTop: '1px solid var(--fp-line)',
    }}>
      <div style={{ flex: '1 1 auto', fontSize: 14, lineHeight: 1.9, color: 'var(--fp-ink)' }}>{children}</div>
      {note && <div style={{
        flex: '0 0 auto', fontSize: 10.5, lineHeight: 1.4, textAlign: 'right',
        color: 'var(--fp-ink-4)', maxWidth: 100,
      }}>{note}</div>}
    </div>
  );
}

function FxGroup({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'var(--fp-ink-4)', marginBottom: 2,
      }}>{title}</div>
      {children}
    </div>
  );
}

// The key. Without it the rest is a wall of single letters.
function Key({ sym, children }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '2.5px 0' }}>
      <span style={{ flex: '0 0 44px', fontSize: 13.5, color: 'var(--fp-ink)', whiteSpace: 'nowrap' }}>{sym}</span>
      <span style={{ fontSize: 11.5, lineHeight: 1.45, color: 'var(--fp-ink-3)' }}>{children}</span>
    </div>
  );
}

function Advanced() {
  return (
    <div style={{
      marginTop: 12, padding: '16px 16px 6px',
      background: 'var(--fp-surface)',
      border: '1px solid var(--fp-line)', borderRadius: 18,
    }}>
      <div style={{
        fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: 'italic',
        fontSize: 21, color: 'var(--fp-ink)', marginBottom: 2,
      }}>The engine, exactly</div>
      <div style={{ fontSize: 11.5, color: 'var(--fp-ink-4)', marginBottom: 14 }}>
        Everything the simulation runs on. Bold letters are vectors.
      </div>

      <FxGroup title="What the letters mean">
        <Key sym={<strong>p</strong>}>position of the ball</Key>
        <Key sym={<strong>v</strong>}>velocity</Key>
        <Key sym={<strong>a</strong>}>acceleration from objects on the plane</Key>
        <Key sym={<strong>n</strong>}>unit normal of the curve, pointing at the ball</Key>
        <Key sym={<>v<Sb>n</Sb>, v<Sb>t</Sb></>}>parts of <strong>v</strong> along and across <strong>n</strong></Key>
        <Key sym="m">gravity multiplier — 0 inside a zero-gravity box, else 1</Key>
        <Key sym="h">one substep of time</Key>
        <Key sym="e">bounciness — how much of v<Sb>n</Sb> comes back</Key>
        <Key sym="ρ">fraction of speed kept through a real bounce</Key>
        <Key sym="k">traction — how fast contact bleeds v<Sb>t</Sb></Key>
        <Key sym={<strong>ŷ</strong>}>straight up</Key>
        <Key sym={<strong>q</strong>}>nearest point on a curve</Key>
        <Key sym={<strong>w</strong>}>centre of a gravity well</Key>
      </FxGroup>

      <FxGroup title="Constants">
        <Law note="units per second²">g = 12</Law>
        <Law note="ball radius">r = 0.22</Law>
        <Law note="one tick, 20 substeps">Δt = <Frac n="1" d="60"/> s</Law>
        <Law note="one substep">h = <Frac n="Δt" d="20"/></Law>
        <Law note="normal curve">e = 0.5&nbsp;&nbsp; ρ = 0.985&nbsp;&nbsp; k = 0.6</Law>
        <Law note="and 0.5 s more after the last star">T = 28 s</Law>
      </FxGroup>

      <FxGroup title="Every substep">
        <Law><strong>v</strong> ← <strong>v</strong> + (<strong>a</strong> − g·m·<strong>ŷ</strong>)·h</Law>
        <Law><strong>p</strong> ← <strong>p</strong> + <strong>v</strong>·h</Law>
      </FxGroup>

      <FxGroup title="What objects add">
        <Law note="inside the box">zero gravity:&nbsp; m = 0</Law>
        <Law note="F force, α angle">fan:&nbsp; <strong>a</strong> += F·c·(cos α, sin α)</Law>
        <Law note="c is how much of the ball is in the box; under ⅓ the fan does nothing">
          c = c<Sb>u</Sb>·c<Sb>v</Sb>,&nbsp; c &lt; <Frac n="1" d="3"/> → 0
        </Law>
        <Law note="S pull, D drag, inside radius R of the centre w">
          well:&nbsp; <strong>a</strong> += S·<Frac n={<><strong>w</strong>−<strong>p</strong></>} d={<>|<strong>w</strong>−<strong>p</strong>|</>}/> − D·<strong>v</strong>
        </Law>
      </FxGroup>

      <FxGroup title="Touching a curve">
        <Law note="q is the nearest point on it"><strong>n</strong> = <Frac n={<><strong>p</strong>−<strong>q</strong></>} d={<>|<strong>p</strong>−<strong>q</strong>|</>}/>,&nbsp; <strong>p</strong> ← <strong>q</strong> + r·<strong>n</strong></Law>
        <Law note="moving into the curve">v<Sb>n</Sb> &lt; 0:&nbsp; <strong>v</strong> ← <strong>v</strong> − (1+e)·v<Sb>n</Sb>·<strong>n</strong></Law>
        <Law note="a real bounce, not a roll">−v<Sb>n</Sb> &gt; 1.5:&nbsp; <strong>v</strong> ← ρ·<strong>v</strong></Law>
        <Law note="always, while touching">v<Sb>t</Sb> ← v<Sb>t</Sb>·e<Sp>−k·h</Sp></Law>
      </FxGroup>

      <FxGroup title="Materials">
        <Law note="the default">normal:&nbsp; e = 0.5,&nbsp; ρ = 0.985</Law>
        <Law note="lands and rolls">steel:&nbsp; e = 0</Law>
        <Law note="gives everything back">rubber:&nbsp; e = 1,&nbsp; ρ = 1</Law>
        <Law note="k never changes">k = 0.6</Law>
      </FxGroup>

      <FxGroup title="What follows">
        <Law note="normal 0.242·H, rubber H, steel 0">drop H, come back to (e·ρ)<Sp>2</Sp>·H</Law>
        <Law note="45° → 14.1,&nbsp; 10° → 3.5">slope θ settles at <Frac n="g·sin θ" d="k"/></Law>
        <Law note="c = ½ at the mouth, so F &gt; 24 lifts it off the base">a fan holds the ball:&nbsp; F·c &gt; g</Law>
        <Law note="nothing acts, so the path is straight">zero gravity:&nbsp; |<strong>v</strong>| constant</Law>
        <Law note="per tick that saw a real bounce, in packs that flip">g ← −g</Law>
      </FxGroup>

      <FxGroup title="Bounds">
        <Law note="s is the star">star taken:&nbsp; |<strong>p</strong> − <strong>s</strong>| &lt; 0.77</Law>
        <Law note="nudged, so it rolls off an apex instead of balancing there">spawn:&nbsp; (x + 0.025, y)</Law>
        <Law note="both must hold; with nothing placed, only the first">alive:&nbsp; |<strong>p</strong>| ≤ 20,&nbsp; ≤ 10 from an object</Law>
        <Law note="the ball's edge, not its centre">hazard kills:&nbsp; |<strong>p</strong> − box| ≤ r</Law>
      </FxGroup>

      <FxGroup title="Score">
        <Law note="n equations">score = Σ complexity + 20·n</Law>
        <Law note="each earned on its own">★ cleared&nbsp; ★ score ≤ goal&nbsp; ★ n ≤ goal</Law>
      </FxGroup>
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

// The aside beside a worked example — what it comes out as, not part of it.
function Note({ children }) {
  return <span style={{ marginLeft: 10, color: 'var(--fp-ink-4)' }}>{children}</span>;
}

// One star, one condition. It used to draw 3/2/1 for a ladder the game no
// longer uses: the three are independent bits, so a run that beats the
// equation goal and misses the score goal lights the first and the third.
function RatingRow({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 5 }}>
      <Stars count={1} total={1} size={9} c="var(--lv-star)" empty="var(--fp-ink-4)"/>
      <span style={{ fontSize: 12, color: 'var(--fp-ink-2)', lineHeight: 1.4 }}>{children}</span>
    </div>
  );
}

// ─── Tutorial art ────────────────────────────────────────────
// Little animated diagrams for the popups below. SMIL, like the wind streaks
// on a real fan, so a page costs no state and no timers — and, like them, the
// motion is the drawing and never the physics.
const ART_W = 208, ART_H = 96;

function Art({ children }) {
  return (
    <svg viewBox={`0 0 ${ART_W} ${ART_H}`} width="100%" height={96}
      style={{ display: 'block', margin: '2px 0 12px' }} aria-hidden="true">
      <rect x={0} y={0} width={ART_W} height={ART_H} rx={12}
        fill="var(--fp-ink)" fillOpacity={0.035}/>
      {children}
    </svg>
  );
}

// A ball that runs a path and then waits before running it again. Two things
// matter here. It follows the *drawn* path rather than sliding between two
// points, because a ball cutting the corner off its own track is the one thing
// a picture of this game must not show. And the cycle holds at the end and
// hides itself on the way back, so a page that is read twice does not snap
// back to the start the instant it arrives.
//   0 → RUN     travelling
//   RUN → FADE  arrived, holding
//   FADE → 1    invisible, returning
const RUN = 0.66, FADE = 0.8;
function ArtBall({ path, dur = 3.2, r = 7, c = 'var(--fp-ink)' }) {
  return (
    <circle r={r} fill={c} opacity={0}>
      <animateMotion path={path} dur={`${dur}s`} repeatCount="indefinite"
        calcMode="linear" keyPoints={`0;1;1;0`} keyTimes={`0;${RUN};${FADE};1`}/>
      <animate attributeName="opacity" dur={`${dur}s`} repeatCount="indefinite"
        values="0;1;1;0;0" keyTimes={`0;0.05;${RUN};${FADE};1`}/>
    </circle>
  );
}

// Where a ball's motion *is* the thing being explained, walking a drawn path
// is not good enough: animateMotion's keyPoints are fractions of path length,
// so at a constant rate a bouncing ball crawls through the bottom of its arc
// and races over the top, which is backwards. `at(u)` is position against
// time, sampled straight out of the equations, and cx/cy are animated from it.
function ArtMotion({ at, dur = 3.4, r = 7, n = 44 }) {
  const ts = [], xs = [], ys = [];
  for (let k = 0; k <= n; k++) {
    const [x, y] = at(k / n);
    ts.push(+(RUN * (k / n)).toFixed(4));
    xs.push(+x.toFixed(2));
    ys.push(+y.toFixed(2));
  }
  const keyTimes = [...ts, FADE, 1].join(';');
  return (
    <circle r={r} fill="var(--fp-ink)" opacity={0}>
      <animate attributeName="cx" dur={`${dur}s`} repeatCount="indefinite"
        values={[...xs, xs[n], xs[0]].join(';')} keyTimes={keyTimes}/>
      <animate attributeName="cy" dur={`${dur}s`} repeatCount="indefinite"
        values={[...ys, ys[n], ys[0]].join(';')} keyTimes={keyTimes}/>
      <animate attributeName="opacity" dur={`${dur}s`} repeatCount="indefinite"
        values="0;1;1;0;0" keyTimes={`0;0.05;${RUN};${FADE};1`}/>
    </circle>
  );
}

// A perfectly elastic bounce. Horizontal speed never changes, and the drop
// from an apex is (g/2)t², so the height above the floor goes as the square of
// the time since the last apex — the ball hangs at the top and snaps through
// the bottom, and every apex is the same height as the last.
const bounceAt = (x0, x1, yApex, yFloor, hops) => u => {
  const s = (u * hops) % 1, f = Math.min(2 * s, 2 * (1 - s));
  return [x0 + (x1 - x0) * u, yApex + (yFloor - yApex) * f * f];
};

// A fall across a zero-gravity box. Nothing acts sideways anywhere, so x is
// linear in time throughout and the whole trajectory can be integrated against
// x: gravity adds to the downward slope outside the box and adds nothing
// inside it. The ball does not level off in there — it keeps the slope it
// arrived with, which is what makes the arc straighten rather than flatten.
const ZG = { x0: 8, x1: 192, y0: 14, boxL: 56, boxR: 152, g: 0.00625, v0: 0.1 };
const zgAt = u => {
  const { x0, x1, y0, boxL, boxR, g, v0 } = ZG;
  const x    = x0 + (x1 - x0) * u;
  const fall = Math.min(x, boxL) - x0;              // accelerating, before the box
  const free = Math.max(0, Math.min(x, boxR) - boxL); // weightless, inside it
  const out  = Math.max(0, x - boxR);               // accelerating again, after it
  const vIn  = v0 + g * fall;                       // the slope at the mouth
  return [x, y0 + v0 * fall + 0.5 * g * fall * fall
             + vIn * free
             + vIn * out + 0.5 * g * out * out];
};

// The same cadence for anything else that plays once and waits: a value that
// holds where it lands rather than easing straight back.
const holdTimes = `0;${RUN};1`;

const FAN_C = '#1f9aa8', HAZ_C = '#d13b3b', ZG_C = '#7a4fd6', WELL_C = '#2f3e8f';
const CURVE_C = '#2d70b3';

// A fan box lying on its base at x, blowing +y (up the picture, so -y in SVG).
const fanBox = (x, y, w, h, opts = {}) => (
  <>
    <rect x={x} y={y - h} width={w} height={h} rx={4}
      fill={FAN_C} fillOpacity={0.08} stroke={FAN_C} strokeWidth={1.2} strokeDasharray="5 4"/>
    <rect x={x} y={y - 4} width={w} height={5} rx={1.5} fill={FAN_C}/>
    {!opts.noArrow && (
      <path d={`M${x + w / 2 - 6} ${y - h + 11} L${x + w / 2} ${y - h + 3} L${x + w / 2 + 6} ${y - h + 11}`}
        fill="none" stroke={FAN_C} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
    )}
  </>
);

// One track, drawn once and ridden once: the ball's path is the curve lifted by
// its own radius, so it sits *on* the line instead of through it.
const TRACK   = 'M16 24 C 58 24, 104 60, 192 72';
const TRACK_B = 'M16 18 C 58 18, 104 54, 192 66';
// Points on TRACK, and roughly how far along it each one sits — so a star can
// light at the moment the ball reaches it.
const TRACK_STARS = [[49, 30, 0.18], [87, 43, 0.35], [144, 62, 0.55]];

// A collected star is *gone*, which is what the game does with one. It stays
// gone through the pause and comes back in the last breath of the cycle, with
// nothing else on screen to watch it return.
const artStar = (cx, cy, k = 0.74, taken = null) => (
  <path transform={`translate(${cx},${cy}) scale(${k})`}
    d="M0 -10 L3 -3 L11 -2 L5 3 L7 11 L0 6 L-7 11 L-5 3 L-11 -2 L-3 -3 Z"
    fill="none" stroke="var(--lv-star)" strokeWidth={2 / k}>
    {taken != null && (
      <animate attributeName="opacity" dur="3.2s" repeatCount="indefinite"
        values="1;1;0;0;1" keyTimes={`0;${taken};${Math.min(taken + 0.03, 0.9)};0.97;1`}/>
    )}
  </path>
);

// ─── Level explainers ────────────────────────────────────────
// A level that introduces a mechanic names one of these in its `explain`
// column; the level screen shows it once, on the player's first visit. Kept
// here beside How to Play because it is the same teaching copy, written
// shorter — a player who is mid-level wants a sentence, not a chapter.
//
// Each is a small deck: `pages` is what the popup steps through, and the
// popup itself is in level-screen.jsx. Objects are not listed here — they
// teach themselves through FP_OBJECT_TUTORIALS below, keyed by kind, so a
// level that puts a new kind on the plane explains it without an admin having
// to remember to tick a box.
const FP_EXPLAINERS = {
  'how-to-play': {
    title: 'Draw a track',
    color: '#2d70b3',
    icon: <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <circle cx={6} cy={6} r={2.6} fill="currentColor"/>
      <path d="M3 19C8 19 15 12 21 5" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/>
    </svg>,
    pages: [
      {
        heading: 'Write an equation',
        art: (
          <Art>
            <text x={104} y={17} textAnchor="middle" fontSize={12}
              fontFamily="ui-monospace,monospace" fill={CURVE_C} opacity={0.75}>y=−x</text>
            <path d={TRACK} fill="none" stroke={CURVE_C} strokeWidth={2.4} strokeLinecap="round"/>
            <ArtBall path={TRACK_B}/>
          </Art>
        ),
        body: <>
          Tap <strong>+</strong> and write anything you can graph — <M e="y=-x"/>,{' '}
          <M e="y=x^2-3"/>, <M e="y=sin(x)"/>. The curve becomes a solid track and
          the ball rolls along it under gravity.
        </>,
      },
      {
        heading: 'Collect every star',
        art: (
          <Art>
            <path d={TRACK} fill="none" stroke={CURVE_C} strokeWidth={2.4} strokeLinecap="round"/>
            {/* Each star goes as the ball reaches it — the track and the
                collecting are one motion, which is what the level is. */}
            {TRACK_STARS.map(([cx, cy, at]) => <React.Fragment key={cx}>{artStar(cx, cy, 0.74, at)}</React.Fragment>)}
            <ArtBall path={TRACK_B}/>
          </Art>
        ),
        body: <>
          The run ends half a second after the last star. Miss one and the ball simply falls
          out of the world — press <strong>Play</strong> again and adjust.
        </>,
      },
      {
        heading: 'Keep it cheap',
        art: (
          <Art>
            {/* Two answers, as the answers — what you would have written, and
                what each one costs. */}
            <text x={53} y={44} textAnchor="middle" fontSize={13}
              fontFamily="ui-monospace,monospace" fill="var(--fp-ink-2)">y=−x</text>
            <line x1={104} y1={18} x2={104} y2={82} stroke="var(--fp-ink)" strokeOpacity={0.13} strokeWidth={1}/>
            <text x={126} y={36} fontSize={13}
              fontFamily="ui-monospace,monospace" fill="var(--fp-ink-2)">y=sin(x)</text>
            <text x={126} y={54} fontSize={13}
              fontFamily="ui-monospace,monospace" fill="var(--fp-ink-2)">y=x²</text>
            {/* both totals on one baseline, so the comparison reads across */}
            <text x={53} y={78} textAnchor="middle" fontSize={13} fontWeight={600}
              fontFamily="ui-monospace,monospace" fill="#388c46">30</text>
            <text x={155} y={78} textAnchor="middle" fontSize={13} fontWeight={600}
              fontFamily="ui-monospace,monospace" fill="#c74440">85</text>
          </Art>
        ),
        body: <>
          Fewer and simpler equations score better, so a line beats a parabola and one curve
          beats two. The two goal chips above the plane say what this level is asking for.
        </>,
      },
    ],
  },
  domain: {
    title: 'Stop the track early',
    color: '#6042a6',
    icon: <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <path d="M6 4v16M18 4v16" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/>
      <path d="M9 12h6" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/>
    </svg>,
    pages: [
      {
        heading: 'The bracket button',
        art: (
          <Art>
            {/* An equation row, with the one button on it that matters here. */}
            <rect x={22} y={30} width={164} height={36} rx={9}
              fill="var(--fp-surface)" stroke="var(--fp-ink)" strokeOpacity={0.14}/>
            <circle cx={40} cy={48} r={8} fill={CURVE_C}/>
            <text x={40} y={52} textAnchor="middle" fontSize={9} fontWeight={600}
              fontFamily="ui-monospace,monospace" fill="#fff">1</text>
            <text x={57} y={53} fontSize={12.5} fontFamily="ui-monospace,monospace" fill="var(--fp-ink-2)">y=x²−2</text>
            <g transform="translate(165,48)" stroke="#6042a6" strokeWidth={1.8} strokeLinecap="round" fill="none">
              <path d="M-6 -7v14M6 -7v14M-9 -2.5h18M-9 3.5h18"/>
              {/* One ring, expanding and gone — then a beat before the next. */}
              <circle r={10} strokeWidth={1.4}>
                <animate attributeName="r" dur="2.6s" repeatCount="indefinite"
                  values="9;19;19" keyTimes={holdTimes}/>
                <animate attributeName="stroke-opacity" dur="2.6s" repeatCount="indefinite"
                  values="0.75;0;0" keyTimes={holdTimes}/>
              </circle>
            </g>
          </Art>
        ),
        body: <>
          Every equation row has a bracket button. It restricts the curve's
          <strong> domain</strong> — the range of x where it exists at all.
        </>,
      },
      {
        heading: 'A track with an end',
        art: (
          <Art>
            {/* Solid to the limit, ghosted past it — and the ball leaves the
                track where the track stops, instead of riding on round. */}
            <path d="M14 76 C 46 76, 70 34, 100 28" fill="none" stroke="#6042a6" strokeWidth={2.4} strokeLinecap="round"/>
            <path d="M100 28 C 130 22, 156 62, 192 74" fill="none" stroke="#6042a6" strokeWidth={2.4}
              strokeLinecap="round" strokeDasharray="3 5" opacity={0.28}/>
            <line x1={100} y1={10} x2={100} y2={88} stroke="#6042a6" strokeWidth={1.4} strokeDasharray="4 3" opacity={0.55}/>
            <ArtBall dur={3.4} path="M14,69 C 46,69 70,27 100,21 C 124,16 148,30 176,74"/>
          </Art>
        ),
        body: <>
          Past the limit the curve is not drawn and not solid, so the ball flies off the end
          of it instead of riding on into trouble.
        </>,
      },
      {
        heading: 'It is free',
        art: (
          <Art>
            {/* The whole parabola, and the piece of it you kept. They cost the
                same, which is the entire point of the page. */}
            <path d="M22 26 C 60 92, 148 92, 186 26" fill="none"
              stroke="#6042a6" strokeWidth={2.2} strokeLinecap="round" strokeDasharray="3 5" opacity={0.3}/>
            <path d="M22 26 C 44 64, 72 78, 104 78" fill="none"
              stroke="#6042a6" strokeWidth={2.6} strokeLinecap="round"/>
            <line x1={104} y1={14} x2={104} y2={90} stroke="#6042a6" strokeWidth={1.4} strokeDasharray="4 3" opacity={0.55}/>
            <text x={60} y={20} textAnchor="middle" fontSize={11} fontWeight={600}
              fontFamily="ui-monospace,monospace" fill="#388c46">20</text>
            <text x={152} y={20} textAnchor="middle" fontSize={11} fontWeight={600}
              fontFamily="ui-monospace,monospace" fill="#388c46">20</text>
          </Art>
        ),
        body: <>
          A restricted curve scores exactly what the full one does. When one shaped track can
          be cut into the two you need, that is one equation instead of two.
        </>,
      },
    ],
  },
  // Two cards, not one: a level teaches rubber or steel, never both at once,
  // and the button page belongs with the first of them a player meets.
  rubber: {
    title: 'Rubber',
    color: '#388c46',
    icon: <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <path d="M3 20h18" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/>
      <path d="M7 17 Q12 3 17 17" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeDasharray="3 2.5"/>
      <circle cx={7} cy={14} r={2.6} fill="currentColor"/>
    </svg>,
    pages: [
      {
        heading: 'A third button on the row',
        art: (
          <Art>
            {/* The row, and the one button this card is about. The button face
                is MaterialIcon's own geometry so the drawing and the control
                cannot drift apart. */}
            <rect x={22} y={30} width={164} height={36} rx={9}
              fill="var(--fp-surface)" stroke="var(--fp-ink)" strokeOpacity={0.14}/>
            <circle cx={40} cy={48} r={8} fill={CURVE_C}/>
            <text x={40} y={52} textAnchor="middle" fontSize={9} fontWeight={600}
              fontFamily="ui-monospace,monospace" fill="#fff">1</text>
            <text x={57} y={53} fontSize={12.5} fontFamily="ui-monospace,monospace" fill="var(--fp-ink-2)">y=−0.1x−2</text>
            <g transform="translate(155,40) scale(1.05)" fill="none">
              <path d="M1.5 13.5H14.5" stroke="#388c46" strokeWidth={1.6} strokeLinecap="round"/>
              <path d="M4 13 Q8 -1 12 13" stroke="#388c46" strokeWidth={1.3} strokeLinecap="round" strokeDasharray="2 1.5"/>
              <circle cx={4} cy={10.5} r={2.4} fill="#388c46"/>
            </g>
            <g transform="translate(163,48)" fill="none">
              {/* One ring, expanding and gone — the beat the domain card uses. */}
              <circle r={10} stroke="#388c46" strokeWidth={1.4}>
                <animate attributeName="r" dur="2.6s" repeatCount="indefinite"
                  values="9;19;19" keyTimes={holdTimes}/>
                <animate attributeName="stroke-opacity" dur="2.6s" repeatCount="indefinite"
                  values="0.75;0;0" keyTimes={holdTimes}/>
              </circle>
            </g>
          </Art>
        ),
        body: <>
          On this level every equation carries a <strong>bounce</strong> button. It cycles the
          curve through three states: normal, <strong>steel</strong>, and <strong>rubber</strong>.
        </>,
      },
      {
        heading: 'Rubber keeps everything',
        art: (
          <Art>
            {/* Dashed, the way a rubber curve is drawn on the plane. The ball is
                not walked along a drawn arc — it is the bounce equations
                sampled against time, so it slows into each apex and drops
                through the floor at speed, and every apex is the same height. */}
            <line x1={10} y1={22} x2={198} y2={22} stroke="var(--fp-ink)" strokeOpacity={0.18}
              strokeWidth={1.2} strokeDasharray="4 4"/>
            <path d="M10 74H198" fill="none" stroke={CURVE_C} strokeWidth={2.4}
              strokeLinecap="round" strokeDasharray="7 4"/>
            <ArtMotion at={bounceAt(24, 192, 22, 67, 3)} dur={3.6} n={72}/>
          </Art>
        ),
        body: <>
          A rubber curve returns the ball at exactly the speed it arrived with. Every hop
          reaches the height of the one before it, and it never runs down.
        </>,
      },
      {
        heading: 'It is free',
        art: (
          <Art>
            {/* The same curve twice, plain and rubber, priced the same. */}
            <path d="M16 40H96" fill="none" stroke={CURVE_C} strokeWidth={2.4} strokeLinecap="round"/>
            <path d="M112 40H192" fill="none" stroke={CURVE_C} strokeWidth={2.4}
              strokeLinecap="round" strokeDasharray="7 4"/>
            <text x={56} y={70} textAnchor="middle" fontSize={11} fontWeight={600}
              fontFamily="ui-monospace,monospace" fill="#388c46">30</text>
            <text x={152} y={70} textAnchor="middle" fontSize={11} fontWeight={600}
              fontFamily="ui-monospace,monospace" fill="#388c46">30</text>
          </Art>
        ),
        body: <>
          The bounce is a property of the curve, not another equation. A rubber line scores
          exactly what the same plain line scores.
        </>,
      },
    ],
  },
  steel: {
    title: 'Steel',
    color: '#5b6670',
    icon: <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <path d="M3 20h18" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round"/>
      <circle cx={8} cy={16} r={2.6} fill="currentColor"/>
    </svg>,
    pages: [
      {
        heading: 'Steel does not bounce',
        art: (
          <Art>
            {/* Drawn heavier, the way a steel curve is drawn on the plane. The
                ball falls, meets it, and turns the corner without leaving it —
                the normal part of its speed is gone, the part along the curve
                is not. */}
            <path d="M12 26 L196 76" fill="none" stroke={CURVE_C} strokeWidth={4.4} strokeLinecap="round"/>
            <ArtBall dur={3.4} path="M60,10 L60,32 L196,69"/>
          </Art>
        ),
        body: <>
          The ball lands on a steel curve and rolls along it. It keeps the speed it had
          <em> along</em> the curve and loses the part that would have thrown it back up.
        </>,
      },
      {
        heading: 'Which is how you get under things',
        art: (
          <Art>
            {/* The lid, and the two answers to it: the bounce that meets it, and
                the roll that does not. */}
            <rect x={30} y={8} width={166} height={16} rx={3} fill={HAZ_C} fillOpacity={0.09}
              stroke={HAZ_C} strokeWidth={1.4} strokeDasharray="5 3"/>
            {[0, 1, 2, 3, 4, 5].map(k => (
              <line key={k} x1={36 + k * 28} y1={22} x2={44 + k * 28} y2={10}
                stroke={HAZ_C} strokeWidth={1.2} opacity={0.45}/>
            ))}
            <path d="M8 40 L196 80" fill="none" stroke={CURVE_C} strokeWidth={4.4} strokeLinecap="round"/>
            {/* What a normal bounce would do instead, ghosted, and where it ends.
                The ball itself drops clear of the lid — it starts to the left of
                where the lid begins. */}
            <path d="M16,35 C 21,28 27,25 33,29" fill="none" stroke="var(--fp-ink)" strokeOpacity={0.22}
              strokeWidth={1.4} strokeDasharray="3 3"/>
            <g transform="translate(26,25)" stroke={HAZ_C} strokeWidth={1.8} strokeLinecap="round">
              <path d="M-5 -5L5 5M5 -5L-5 5" opacity={0.6}/>
            </g>
            <ArtBall dur={3.4} path="M16,8 L16,35 L196,73"/>
          </Art>
        ),
        body: <>
          A normal curve throws the ball up off the landing, and there is not always room for
          that. Steel takes the first bounce out of the run entirely.
        </>,
      },
    ],
  },
};

// ─── Object tutorials ────────────────────────────────────────
// Keyed by object kind. The first time a level puts one of these on the plane
// the level screen runs the deck once and remembers it per device — a reading
// state, not progress, so it is deliberately not synced.
const FP_OBJECT_TUTORIALS = {
  fan: {
    title: 'Fan',
    color: FAN_C,
    icon: <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <path d="M4 8h10a3 3 0 1 0-3-3" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/>
      <path d="M4 14h13a3 3 0 1 1-3 3" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/>
    </svg>,
    pages: [
      {
        heading: 'A box of wind',
        art: (
          <Art>
            {fanBox(74, 84, 60, 66)}
            {[0, 1, 2, 3].map(k => (
              <line key={k} x1={84 + k * 14} y1={70} x2={84 + k * 14} y2={58} stroke={FAN_C}
                strokeWidth={1.6} strokeLinecap="round" opacity={0.5}>
                <animate attributeName="y1" values="76;34" dur="1.6s" begin={`${k * 0.4}s`} repeatCount="indefinite"/>
                <animate attributeName="y2" values="64;22" dur="1.6s" begin={`${k * 0.4}s`} repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0;0.6;0" dur="1.6s" begin={`${k * 0.4}s`} repeatCount="indefinite"/>
              </line>
            ))}
          </Art>
        ),
        body: <>
          A fan is the shaded box, not the bar at its base. It blows the way the arrow points,
          the whole time the ball is in there — and the number on it is how hard.
        </>,
      },
      {
        heading: 'Wind and gravity add up',
        art: (
          <Art>
            {fanBox(74, 84, 60, 66)}
            <ArtBall path="M12,26 C 52,58 74,78 104,52 C 126,32 140,40 196,74"/>
          </Art>
        ),
        body: <>
          It does not care what your track is doing. The ball keeps the speed it arrived with
          and the wind is simply added to gravity while it is inside.
          <div style={{ marginTop: 8 }}>
            Clip the edge and you get part of the push: it builds from about a third of the
            ball being inside up to the full force once it is properly in.
          </div>
        </>,
      },
      {
        heading: 'The base is a wall',
        art: (
          <Art>
            {fanBox(74, 84, 60, 60, { noArrow: true })}
            <ArtBall dur={2.6} path="M104,8 L104,73"/>
            <path d="M74 80h60" stroke={FAN_C} strokeWidth={3} strokeLinecap="round"/>
          </Art>
        ),
        body: <>
          The solid bar at the fan's base is part of it. That edge is a wall — the ball lands
          on it, and cannot be rolled into the fan from behind.
        </>,
      },
    ],
  },
  hazard: {
    title: 'Hazard',
    color: HAZ_C,
    icon: <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <rect x={4} y={7} width={16} height={10} rx={1.5} stroke="currentColor" strokeWidth={2} strokeDasharray="3 2.5"/>
    </svg>,
    pages: [
      {
        heading: 'Do not touch the red',
        art: (
          <Art>
            <rect x={62} y={34} width={84} height={30} rx={3} fill={HAZ_C} fillOpacity={0.09}
              stroke={HAZ_C} strokeWidth={1.6} strokeDasharray="5 3"/>
            {[0, 1, 2, 3].map(k => (
              <line key={k} x1={66 + k * 19} y1={62} x2={80 + k * 19} y2={36} stroke={HAZ_C} strokeWidth={1.4} opacity={0.5}/>
            ))}
          </Art>
        ),
        body: <>
          The dashed red areas are hazards. They do nothing to your curve and everything to
          your ball.
        </>,
      },
      {
        heading: 'One touch ends the run',
        art: (
          <Art>
            <rect x={62} y={40} width={84} height={30} rx={3} fill={HAZ_C} fillOpacity={0.09}
              stroke={HAZ_C} strokeWidth={1.6} strokeDasharray="5 3"/>
            <ArtBall path="M14,14 C 50,20 80,34 100,40"/>
            <g transform="translate(100,40)" stroke={HAZ_C} strokeWidth={2} strokeLinecap="round">
              <path d="M-9 -9L9 9M9 -9L-9 9" opacity={0}>
                <animate attributeName="opacity" values="0;0;1;1;0" dur="3.2s" repeatCount="indefinite"
                  keyTimes={`0;${RUN - 0.03};${RUN + 0.02};${FADE};1`}/>
              </path>
            </g>
          </Art>
        ),
        body: <>
          The moment the ball's edge meets one, the run fails — it does not matter how many
          stars you had already collected.
        </>,
      },
      {
        heading: 'Route around it',
        art: (
          <Art>
            <rect x={62} y={52} width={84} height={26} rx={3} fill={HAZ_C} fillOpacity={0.09}
              stroke={HAZ_C} strokeWidth={1.6} strokeDasharray="5 3"/>
            <path d="M10 66 C 60 66, 60 20, 104 20 C 148 20, 148 66, 198 66"
              fill="none" stroke="#2d70b3" strokeWidth={2.4} strokeLinecap="round"/>
            <ArtBall path="M10,59 C 60,59 60,13 104,13 C 148,13 148,59 198,59"/>
          </Art>
        ),
        body: <>
          Your curve may cross a hazard; only the <em>ball</em> must not. Watch where it
          bounces, not just where the track goes — and remember you can cut a curve short.
        </>,
      },
    ],
  },
  zerog: {
    title: 'Zero gravity',
    color: ZG_C,
    icon: <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <rect x={4} y={4} width={16} height={16} rx={2} stroke="currentColor" strokeWidth={2} strokeDasharray="3 2.5"/>
      <circle cx={12} cy={12} r={2} fill="currentColor"/>
    </svg>,
    pages: [
      {
        heading: 'A box with no weight in it',
        art: (
          <Art>
            <rect x={56} y={22} width={96} height={54} rx={6} fill={ZG_C} fillOpacity={0.08}
              stroke={ZG_C} strokeWidth={1.4} strokeDasharray="5 4"/>
            <circle cx={104} cy={49} r={14} fill="none" stroke={ZG_C} strokeWidth={1.4} strokeDasharray="3 3" opacity={0.6}/>
            <circle cx={101} cy={46} r={4} fill={ZG_C} opacity={0.7}>
              <animate attributeName="cy" values="46;52;46" dur="3s" repeatCount="indefinite"/>
            </circle>
          </Art>
        ),
        body: <>
          Inside this box gravity is switched off. Nothing pulls the ball down and nothing
          pushes it up.
        </>,
      },
      {
        heading: 'It keeps whatever it arrived with',
        art: (
          <Art>
            <rect x={56} y={16} width={96} height={66} rx={6} fill={ZG_C} fillOpacity={0.08}
              stroke={ZG_C} strokeWidth={1.4} strokeDasharray="5 4"/>
            {/* The trace is the same trajectory zgAt walks, drawn exactly: the
                two parabolas are quadratic Béziers, whose control point is the
                start plus half the run along the starting slope. */}
            <path d="M8 14 Q32 16.4 56 26" fill="none" stroke="var(--fp-ink)" strokeOpacity={0.2} strokeWidth={1.4} strokeDasharray="3 3"/>
            <path d="M56 26 L152 64.4" fill="none" stroke={ZG_C} strokeOpacity={0.45} strokeWidth={1.4} strokeDasharray="3 3"/>
            <path d="M152 64.4 Q172 72.4 192 85.4" fill="none" stroke="var(--fp-ink)" strokeOpacity={0.2} strokeWidth={1.4} strokeDasharray="3 3"/>
            <ArtMotion at={zgAt} dur={3.2}/>
          </Art>
        ),
        body: <>
          Its speed and direction stay exactly as they were on the way in. It does not level
          off; it stops <em>gaining</em> speed downward, so the arc becomes the straight line it
          was already heading along — and the fall picks up again on the way out.
        </>,
      },
      {
        heading: 'It cannot start the ball',
        art: (
          <Art>
            <rect x={56} y={22} width={96} height={54} rx={6} fill={ZG_C} fillOpacity={0.08}
              stroke={ZG_C} strokeWidth={1.4} strokeDasharray="5 4"/>
            {/* Where the fall would have gone, ghosted, and the ball that is
                not taking it: standing still is the whole behaviour, so the
                picture holds and nothing moves. */}
            <path d="M104 49 C 104 64, 108 78, 118 92" fill="none" stroke="var(--fp-ink)"
              strokeOpacity={0.24} strokeWidth={1.4} strokeDasharray="3 3"/>
            <circle cx={104} cy={49} r={7} fill="var(--fp-ink)"/>
          </Art>
        ),
        body: <>
          It will not lift the ball, and two overlapping boxes do not cancel back to normal.
          A ball with no speed of its own does not start moving inside one — it sits exactly
          where it is until something outside the box gives it a push.
        </>,
      },
    ],
  },
  well: {
    title: 'Gravity well',
    color: WELL_C,
    icon: <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <circle cx={12} cy={12} r={9} stroke="currentColor" strokeWidth={2} strokeDasharray="3 2.5"/>
      <circle cx={12} cy={12} r={2} fill="currentColor"/>
    </svg>,
    pages: [
      {
        heading: 'A steady pull, out to the ring',
        art: (
          <Art>
            <defs>
              <radialGradient id="fp-tut-well">
                <stop offset="0%" stopColor={WELL_C} stopOpacity={0.3}/>
                <stop offset="100%" stopColor={WELL_C} stopOpacity={0.03}/>
              </radialGradient>
            </defs>
            <circle cx={104} cy={48} r={36} fill="url(#fp-tut-well)"/>
            <circle cx={104} cy={48} r={36} fill="none" stroke={WELL_C} strokeWidth={1.3} strokeDasharray="5 4" opacity={0.7}/>
            <circle cx={104} cy={48} r={3.5} fill={WELL_C}/>
            {/* The pull runs inward the whole time the ball is in there, so the
                marks travel rather than point: a still arrow reads as a label. */}
            {[0, 90, 180, 270].map((a, k) => (
              <line key={a} x1={104} y1={12} x2={104} y2={20} stroke={WELL_C} strokeWidth={1.6}
                strokeLinecap="round" opacity={0} transform={`rotate(${a} 104 48)`}>
                <animate attributeName="y1" values="12;38" dur="1.8s" begin={`${k * 0.45}s`} repeatCount="indefinite"/>
                <animate attributeName="y2" values="20;46" dur="1.8s" begin={`${k * 0.45}s`} repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0;0.65;0" dur="1.8s" begin={`${k * 0.45}s`} repeatCount="indefinite"/>
              </line>
            ))}
          </Art>
        ),
        body: <>
          Anywhere inside the ring the ball is pulled toward the centre by the same amount —
          the number on it. Outside the ring it does nothing at all.
        </>,
      },
      {
        heading: 'It bends the flight',
        art: (
          <Art>
            <circle cx={104} cy={62} r={28} fill={WELL_C} fillOpacity={0.07}
              stroke={WELL_C} strokeWidth={1.3} strokeDasharray="5 4" opacity={0.8}/>
            <circle cx={104} cy={62} r={3.5} fill={WELL_C}/>
            {/* The throw it would have been, flat, against the one it becomes:
                the ball has to come out the far side, or the picture says the
                well swallows everything, which is the next page's job. */}
            <path d="M8 22 L200 22" fill="none" stroke="var(--fp-ink)" strokeOpacity={0.18}
              strokeWidth={1.4} strokeDasharray="3 3"/>
            <ArtBall path="M8,22 C 56,22 78,36 104,42 C 130,48 158,40 200,30"/>
          </Art>
        ),
        body: <>
          A pull from the side turns a straight throw into an arc. Aim past a well and it will
          curve the ball round for you — no extra equation needed.
        </>,
      },
      {
        heading: 'Crossing one costs speed',
        art: (
          <Art>
            <circle cx={104} cy={48} r={34} fill={WELL_C} fillOpacity={0.07}
              stroke={WELL_C} strokeWidth={1.3} strokeDasharray="5 4" opacity={0.8}/>
            <circle cx={104} cy={48} r={3.5} fill={WELL_C}/>
            <path d="M10 48 C 60 48, 70 84, 104 84 C 138 84, 148 48, 104 48" fill="none"
              stroke={WELL_C} strokeOpacity={0.35} strokeWidth={1.4} strokeDasharray="3 3"/>
            <ArtBall path="M10,48 C 60,48 70,84 104,84 C 138,84 148,48 104,48"/>
          </Art>
        ),
        body: <>
          A well drags as well as pulls, so the ball never leaves with as much as it brought.
          Fall too deep into one and it will not climb back out.
        </>,
      },
    ],
  },
};

window.FP_EXPLAINERS = FP_EXPLAINERS;
window.FP_OBJECT_TUTORIALS = FP_OBJECT_TUTORIALS;
window.HowToPlayScreen = HowToPlayScreen;
