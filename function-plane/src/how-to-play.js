// Function Plane — How to Play screen

// Maths inside the copy is typeset, not written out. The game asks players to
// read x² and √x; showing them x^2 and sqrt(x) in its own explanations teaches
// the wrong notation. MathExpr is resolved at render time because it lives in
// level-screen.js, which loads after this file.
function M({
  e
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: "fp-mono",
    style: {
      whiteSpace: 'nowrap'
    }
  }, typeof MathExpr === 'function' ? /*#__PURE__*/React.createElement(MathExpr, {
    src: e
  }) : e);
}
function HowToPlayScreen({
  onBack,
  density = 'comfortable'
}) {
  const padX = density === 'compact' ? 22 : 26;
  return /*#__PURE__*/React.createElement("div", {
    className: "fp-screen",
    style: {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: `calc(14px + env(safe-area-inset-top, 0px)) ${padX}px 14px`,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flex: '0 0 auto',
      borderBottom: '1px solid var(--fp-line)'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    style: {
      width: 36,
      height: 36,
      borderRadius: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--fp-ink-2)'
    }
  }, /*#__PURE__*/React.createElement(Icon.Chevron, {
    dir: "left",
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Instrument Serif', Georgia, serif",
      fontStyle: 'italic',
      fontSize: 24,
      letterSpacing: '-0.02em',
      color: 'var(--fp-ink)'
    }
  }, "How to play")), /*#__PURE__*/React.createElement("div", {
    className: "fp-scroll",
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: `20px ${padX}px`,
      paddingBottom: 'max(32px, env(safe-area-inset-bottom, 0px))'
    }
  }, /*#__PURE__*/React.createElement(HTPCard, {
    color: "#2d70b3",
    icon: /*#__PURE__*/React.createElement("svg", {
      width: 20,
      height: 20,
      viewBox: "0 0 24 24",
      fill: "none"
    }, /*#__PURE__*/React.createElement("circle", {
      cx: 12,
      cy: 12,
      r: 4,
      fill: "currentColor"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M12 2v3M12 19v3M2 12h3M19 12h3",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round"
    })),
    title: "The goal"
  }, "Guide the ball from its start position to collect every star. The ball rolls under gravity along curves you draw. ", /*#__PURE__*/React.createElement("em", null, "All stars must be collected"), " for a level to complete."), /*#__PURE__*/React.createElement(HTPCard, {
    color: "#388c46",
    icon: /*#__PURE__*/React.createElement("svg", {
      width: 20,
      height: 20,
      viewBox: "0 0 24 24",
      fill: "none"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M4 8H20M4 16H20",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round"
    })),
    title: "Write equations"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 8
    }
  }, "Tap ", /*#__PURE__*/React.createElement("strong", null, "Add"), " in the panel and type an equation in any form:"), /*#__PURE__*/React.createElement(CodeLine, null, /*#__PURE__*/React.createElement(M, {
    e: "y=sin(x)"
  })), /*#__PURE__*/React.createElement(CodeLine, null, /*#__PURE__*/React.createElement(M, {
    e: "x^2+y^2=25"
  })), /*#__PURE__*/React.createElement(CodeLine, null, /*#__PURE__*/React.createElement(M, {
    e: "y=0.5x-1"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, "On mobile the custom math keyboard appears automatically. Tap the ", /*#__PURE__*/React.createElement("strong", null, "\u2328"), " button to show or hide it.")), /*#__PURE__*/React.createElement(HTPCard, {
    color: "#6042a6",
    icon: /*#__PURE__*/React.createElement("svg", {
      width: 20,
      height: 20,
      viewBox: "0 0 24 24",
      fill: "currentColor"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M5 3L19 12L5 21Z"
    })),
    title: "Press Play"
  }, "When your equations look right, press ", /*#__PURE__*/React.createElement("strong", null, "Play"), ". The ball drops from its starting position (dashed circle) and rolls along your curves. Press ", /*#__PURE__*/React.createElement("strong", null, "Stop"), " at any time to reset and adjust."), /*#__PURE__*/React.createElement(HTPCard, {
    color: "#c74440",
    icon: /*#__PURE__*/React.createElement("svg", {
      width: 20,
      height: 20,
      viewBox: "0 0 24 24",
      fill: "none"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M12 2 L15.1 8.3 L22 9.3 L17 14.1 L18.2 21 L12 17.8 L5.8 21 L7 14.1 L2 9.3 L8.9 8.3 Z",
      stroke: "currentColor",
      strokeWidth: 1.8,
      fill: "currentColor",
      strokeLinejoin: "round"
    })),
    title: "Star rating"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 8
    }
  }, "Collecting every star always clears the level. Which rating you get is decided by the first of these that holds:"), /*#__PURE__*/React.createElement(RatingRow, {
    n: 3
  }, "You used no more equations than the equation goal"), /*#__PURE__*/React.createElement(RatingRow, {
    n: 2
  }, "Otherwise \u2014 your score is at or below the score goal"), /*#__PURE__*/React.createElement(RatingRow, {
    n: 1
  }, "Otherwise \u2014 you cleared it")), /*#__PURE__*/React.createElement(HTPCard, {
    color: "#fa7e19",
    icon: /*#__PURE__*/React.createElement("svg", {
      width: 20,
      height: 20,
      viewBox: "0 0 24 24",
      fill: "none"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18",
      stroke: "currentColor",
      strokeWidth: 1.7,
      strokeLinecap: "round",
      strokeLinejoin: "round"
    })),
    title: "Score & complexity"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 10
    }
  }, "Score = 20 pts per equation + that equation's complexity.", /*#__PURE__*/React.createElement("strong", null, " Lower is better."), " Fewer, simpler equations score less."), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--fp-surface)',
      border: '1px solid var(--fp-line)',
      borderRadius: 10,
      overflow: 'hidden',
      marginBottom: 8
    }
  }, [['Constant (y = c)', ' 0 pts'], ['Linear   (mx + b)', '10 pts'], ['Quadratic (x²)', '20 pts'], ['Piecewise (|x|, ⌊x⌋)', '20 pts'], ['Trig (sin, cos, tan)', '25 pts'], ['Cubic (x³)', '30 pts'], ['Rational (1/x)', '30 pts'], ['Log / ln', '30 pts'], ['Exponential (eˣ)', '35 pts'], ['Derivative (d/dx)', '35 pts'], ['Inv. trig (arcsin…)', '40 pts'], ['Sum (Σ)', '50 pts'], ['Integral (∫)', '55 pts'], ["Doesn't parse", '60 pts']].map(([fn, pts], i, arr) => /*#__PURE__*/React.createElement("div", {
    key: fn,
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '7px 12px',
      borderBottom: i < arr.length - 1 ? '1px solid var(--fp-line)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "fp-mono",
    style: {
      fontSize: 11.5,
      color: 'var(--fp-ink-2)'
    }
  }, fn), /*#__PURE__*/React.createElement("span", {
    className: "fp-mono",
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--fp-ink)'
    }
  }, pts)))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--fp-ink-4)',
      lineHeight: 1.5
    }
  }, "Every transcendental function beyond the first in one equation adds 60% of the base \u2014 sin(cos(x)) costs far more than sin(x). Mixing a transcendental with a degree-2-or-higher polynomial (sin(x)\xB7x\xB2) then multiplies the total by 1.3, and polynomials above degree 3 add 5 pts per extra power.")), /*#__PURE__*/React.createElement(HTPCard, {
    color: "#6042a6",
    icon: /*#__PURE__*/React.createElement("svg", {
      width: 20,
      height: 20,
      viewBox: "0 0 24 24",
      fill: "none"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M5 5h6M5 19l3.5-14M14 9c0-2.5 1.5-4 3-4s2 1.5 2 3v8c0 1.5 1 3 2.5 3",
      stroke: "currentColor",
      strokeWidth: 1.7,
      strokeLinecap: "round",
      strokeLinejoin: "round"
    })),
    title: "Advanced operators"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 8
    }
  }, "Switch the keyboard to the ", /*#__PURE__*/React.createElement("strong", null, "\uD835\uDC53\uD835\uDC65"), " tab for inverse trig and higher-order operators. Each takes its body as the last argument, written as a normal expression in ", /*#__PURE__*/React.createElement("span", {
    className: "fp-mono"
  }, "x"), " (and ", /*#__PURE__*/React.createElement("span", {
    className: "fp-mono"
  }, "n"), " for sums)."), /*#__PURE__*/React.createElement(CodeLine, null, /*#__PURE__*/React.createElement(M, {
    e: "y=arcsin(x)"
  })), /*#__PURE__*/React.createElement(CodeLine, null, /*#__PURE__*/React.createElement(M, {
    e: "y=sum(1,5,n*x^n)"
  }), /*#__PURE__*/React.createElement(Note, null, "\u03A3 from n=1..5")), /*#__PURE__*/React.createElement(CodeLine, null, /*#__PURE__*/React.createElement(M, {
    e: "y=deriv(sin(x))"
  }), /*#__PURE__*/React.createElement(Note, null, "\u2248 cos(x)")), /*#__PURE__*/React.createElement(CodeLine, null, /*#__PURE__*/React.createElement(M, {
    e: "y=integ(x^2)"
  }), /*#__PURE__*/React.createElement(Note, null, "\u222B\u2080\u02E3 t\xB2 dt = x\xB3/3")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--fp-ink-4)',
      lineHeight: 1.5,
      marginTop: 8
    }
  }, "Numerical operators \u2014 sums are capped at 200 terms, integrals use ~150 sample points. Powerful, but each one adds significant complexity to your score.")), /*#__PURE__*/React.createElement(HTPCard, {
    color: "#6042a6",
    icon: /*#__PURE__*/React.createElement("svg", {
      width: 20,
      height: 20,
      viewBox: "0 0 24 24",
      fill: "none"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M6 3v18M18 3v18M3 9h18M3 15h18",
      stroke: "currentColor",
      strokeWidth: 1.8,
      strokeLinecap: "round"
    })),
    title: "Domain restrictions"
  }, "Tap the grid icon on any equation to restrict where it appears on the plane. Add segments like x \u2208 [\u22123, 3] to show only part of a curve. Multiple segments are supported \u2014 useful for building ramps and platforms."), /*#__PURE__*/React.createElement(HTPCard, {
    color: "#2d70b3",
    icon: /*#__PURE__*/React.createElement("svg", {
      width: 20,
      height: 20,
      viewBox: "0 0 24 24",
      fill: "none"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M15 3H21V9M9 21H3V15M21 15V21H15M3 9V3H9",
      stroke: "currentColor",
      strokeWidth: 1.8,
      strokeLinecap: "round",
      strokeLinejoin: "round"
    })),
    title: "Pan & zoom",
    last: true
  }, "Drag the plane with one finger to pan. Pinch with two fingers (or use the +/\u2212 buttons) to zoom in and out. The crosshair button resets the view to the origin.")));
}
function HTPCard({
  color,
  icon,
  title,
  children,
  last
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--fp-surface)',
      border: '1px solid var(--fp-line)',
      borderRadius: 18,
      overflow: 'hidden',
      marginBottom: last ? 0 : 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '14px 16px 12px',
      borderBottom: '1px solid var(--fp-line)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 10,
      flex: '0 0 36px',
      background: color + '18',
      color: color,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, icon), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--fp-ink)',
      letterSpacing: '-0.01em'
    }
  }, title)), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 16px',
      fontSize: 13,
      color: 'var(--fp-ink-3)',
      lineHeight: 1.65
    }
  }, children));
}
function CodeLine({
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "fp-mono",
    style: {
      fontSize: 12.5,
      color: 'var(--fp-ink-2)',
      background: 'var(--fp-surface-2)',
      border: '1px solid var(--fp-line)',
      borderRadius: 7,
      padding: '5px 10px',
      marginBottom: 4,
      display: 'inline-block',
      width: '100%',
      boxSizing: 'border-box'
    }
  }, children);
}

// The aside beside a worked example — what it comes out as, not part of it.
function Note({
  children
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 10,
      color: 'var(--fp-ink-4)'
    }
  }, children);
}
function RatingRow({
  n,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
      marginBottom: 5
    }
  }, /*#__PURE__*/React.createElement(Stars, {
    count: n,
    total: 3,
    size: 9,
    c: "var(--lv-star)",
    empty: "var(--fp-ink-4)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--fp-ink-2)',
      lineHeight: 1.4
    }
  }, children));
}

// ─── Tutorial art ────────────────────────────────────────────
// Little animated diagrams for the popups below. SMIL, like the wind streaks
// on a real fan, so a page costs no state and no timers — and, like them, the
// motion is the drawing and never the physics.
const ART_W = 208,
  ART_H = 96;
function Art({
  children
}) {
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${ART_W} ${ART_H}`,
    width: "100%",
    height: 96,
    style: {
      display: 'block',
      margin: '2px 0 12px'
    },
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("rect", {
    x: 0,
    y: 0,
    width: ART_W,
    height: ART_H,
    rx: 12,
    fill: "var(--fp-ink)",
    fillOpacity: 0.035
  }), children);
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
const RUN = 0.66,
  FADE = 0.8;
function ArtBall({
  path,
  dur = 3.2,
  r = 7,
  c = 'var(--fp-ink)'
}) {
  return /*#__PURE__*/React.createElement("circle", {
    r: r,
    fill: c,
    opacity: 0
  }, /*#__PURE__*/React.createElement("animateMotion", {
    path: path,
    dur: `${dur}s`,
    repeatCount: "indefinite",
    calcMode: "linear",
    keyPoints: `0;1;1;0`,
    keyTimes: `0;${RUN};${FADE};1`
  }), /*#__PURE__*/React.createElement("animate", {
    attributeName: "opacity",
    dur: `${dur}s`,
    repeatCount: "indefinite",
    values: "0;1;1;0;0",
    keyTimes: `0;0.05;${RUN};${FADE};1`
  }));
}

// The same cadence for anything else that plays once and waits: a value that
// holds where it lands rather than easing straight back.
const holdTimes = `0;${RUN};1`;
const FAN_C = '#1f9aa8',
  HAZ_C = '#d13b3b',
  ZG_C = '#7a4fd6',
  WELL_C = '#2f3e8f';
const CURVE_C = '#2d70b3';

// A fan box lying on its base at x, blowing +y (up the picture, so -y in SVG).
const fanBox = (x, y, w, h, opts = {}) => /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
  x: x,
  y: y - h,
  width: w,
  height: h,
  rx: 4,
  fill: FAN_C,
  fillOpacity: 0.08,
  stroke: FAN_C,
  strokeWidth: 1.2,
  strokeDasharray: "5 4"
}), /*#__PURE__*/React.createElement("rect", {
  x: x,
  y: y - 4,
  width: w,
  height: 5,
  rx: 1.5,
  fill: FAN_C
}), !opts.noArrow && /*#__PURE__*/React.createElement("path", {
  d: `M${x + w / 2 - 6} ${y - h + 11} L${x + w / 2} ${y - h + 3} L${x + w / 2 + 6} ${y - h + 11}`,
  fill: "none",
  stroke: FAN_C,
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round"
}));

// One track, drawn once and ridden once: the ball's path is the curve lifted by
// its own radius, so it sits *on* the line instead of through it.
const TRACK = 'M16 24 C 58 24, 104 60, 192 72';
const TRACK_B = 'M16 18 C 58 18, 104 54, 192 66';
// Points on TRACK, and roughly how far along it each one sits — so a star can
// light at the moment the ball reaches it.
const TRACK_STARS = [[49, 30, 0.18], [87, 43, 0.35], [144, 62, 0.55]];

// A collected star is *gone*, which is what the game does with one. It stays
// gone through the pause and comes back in the last breath of the cycle, with
// nothing else on screen to watch it return.
const artStar = (cx, cy, k = 0.74, taken = null) => /*#__PURE__*/React.createElement("path", {
  transform: `translate(${cx},${cy}) scale(${k})`,
  d: "M0 -10 L3 -3 L11 -2 L5 3 L7 11 L0 6 L-7 11 L-5 3 L-11 -2 L-3 -3 Z",
  fill: "none",
  stroke: "var(--lv-star)",
  strokeWidth: 2 / k
}, taken != null && /*#__PURE__*/React.createElement("animate", {
  attributeName: "opacity",
  dur: "3.2s",
  repeatCount: "indefinite",
  values: "1;1;0;0;1",
  keyTimes: `0;${taken};${Math.min(taken + 0.03, 0.9)};0.97;1`
}));

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
    icon: /*#__PURE__*/React.createElement("svg", {
      width: 20,
      height: 20,
      viewBox: "0 0 24 24",
      fill: "none"
    }, /*#__PURE__*/React.createElement("circle", {
      cx: 6,
      cy: 6,
      r: 2.6,
      fill: "currentColor"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M3 19C8 19 15 12 21 5",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round"
    })),
    pages: [{
      heading: 'Write an equation',
      art: /*#__PURE__*/React.createElement(Art, null, /*#__PURE__*/React.createElement("text", {
        x: 104,
        y: 17,
        textAnchor: "middle",
        fontSize: 12,
        fontFamily: "ui-monospace,monospace",
        fill: CURVE_C,
        opacity: 0.75
      }, "y=\u2212x"), /*#__PURE__*/React.createElement("path", {
        d: TRACK,
        fill: "none",
        stroke: CURVE_C,
        strokeWidth: 2.4,
        strokeLinecap: "round"
      }), /*#__PURE__*/React.createElement(ArtBall, {
        path: TRACK_B
      })),
      body: /*#__PURE__*/React.createElement(React.Fragment, null, "Tap ", /*#__PURE__*/React.createElement("strong", null, "+"), " and write anything you can graph \u2014 ", /*#__PURE__*/React.createElement(M, {
        e: "y=-x"
      }), ",", ' ', /*#__PURE__*/React.createElement(M, {
        e: "y=x^2-3"
      }), ", ", /*#__PURE__*/React.createElement(M, {
        e: "y=sin(x)"
      }), ". The curve becomes a solid track and the ball rolls along it under gravity.")
    }, {
      heading: 'Collect every star',
      art: /*#__PURE__*/React.createElement(Art, null, /*#__PURE__*/React.createElement("path", {
        d: TRACK,
        fill: "none",
        stroke: CURVE_C,
        strokeWidth: 2.4,
        strokeLinecap: "round"
      }), TRACK_STARS.map(([cx, cy, at]) => /*#__PURE__*/React.createElement(React.Fragment, {
        key: cx
      }, artStar(cx, cy, 0.74, at))), /*#__PURE__*/React.createElement(ArtBall, {
        path: TRACK_B
      })),
      body: /*#__PURE__*/React.createElement(React.Fragment, null, "The run ends half a second after the last star. Miss one and the ball simply falls out of the world \u2014 press ", /*#__PURE__*/React.createElement("strong", null, "Play"), " again and adjust.")
    }, {
      heading: 'Keep it cheap',
      art: /*#__PURE__*/React.createElement(Art, null, /*#__PURE__*/React.createElement("text", {
        x: 53,
        y: 44,
        textAnchor: "middle",
        fontSize: 13,
        fontFamily: "ui-monospace,monospace",
        fill: "var(--fp-ink-2)"
      }, "y=\u2212x"), /*#__PURE__*/React.createElement("line", {
        x1: 104,
        y1: 18,
        x2: 104,
        y2: 82,
        stroke: "var(--fp-ink)",
        strokeOpacity: 0.13,
        strokeWidth: 1
      }), /*#__PURE__*/React.createElement("text", {
        x: 126,
        y: 36,
        fontSize: 13,
        fontFamily: "ui-monospace,monospace",
        fill: "var(--fp-ink-2)"
      }, "y=sin(x)"), /*#__PURE__*/React.createElement("text", {
        x: 126,
        y: 54,
        fontSize: 13,
        fontFamily: "ui-monospace,monospace",
        fill: "var(--fp-ink-2)"
      }, "y=x\xB2"), /*#__PURE__*/React.createElement("text", {
        x: 53,
        y: 78,
        textAnchor: "middle",
        fontSize: 13,
        fontWeight: 600,
        fontFamily: "ui-monospace,monospace",
        fill: "#388c46"
      }, "30"), /*#__PURE__*/React.createElement("text", {
        x: 155,
        y: 78,
        textAnchor: "middle",
        fontSize: 13,
        fontWeight: 600,
        fontFamily: "ui-monospace,monospace",
        fill: "#c74440"
      }, "85")),
      body: /*#__PURE__*/React.createElement(React.Fragment, null, "Fewer and simpler equations score better, so a line beats a parabola and one curve beats two. The two goal chips above the plane say what this level is asking for.")
    }]
  },
  domain: {
    title: 'Stop the track early',
    color: '#6042a6',
    icon: /*#__PURE__*/React.createElement("svg", {
      width: 20,
      height: 20,
      viewBox: "0 0 24 24",
      fill: "none"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M6 4v16M18 4v16",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M9 12h6",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round"
    })),
    pages: [{
      heading: 'The bracket button',
      art: /*#__PURE__*/React.createElement(Art, null, /*#__PURE__*/React.createElement("rect", {
        x: 22,
        y: 30,
        width: 164,
        height: 36,
        rx: 9,
        fill: "var(--fp-surface)",
        stroke: "var(--fp-ink)",
        strokeOpacity: 0.14
      }), /*#__PURE__*/React.createElement("circle", {
        cx: 40,
        cy: 48,
        r: 8,
        fill: CURVE_C
      }), /*#__PURE__*/React.createElement("text", {
        x: 40,
        y: 52,
        textAnchor: "middle",
        fontSize: 9,
        fontWeight: 600,
        fontFamily: "ui-monospace,monospace",
        fill: "#fff"
      }, "1"), /*#__PURE__*/React.createElement("text", {
        x: 57,
        y: 53,
        fontSize: 12.5,
        fontFamily: "ui-monospace,monospace",
        fill: "var(--fp-ink-2)"
      }, "y=x\xB2\u22122"), /*#__PURE__*/React.createElement("g", {
        transform: "translate(165,48)",
        stroke: "#6042a6",
        strokeWidth: 1.8,
        strokeLinecap: "round",
        fill: "none"
      }, /*#__PURE__*/React.createElement("path", {
        d: "M-6 -7v14M6 -7v14M-9 -2.5h18M-9 3.5h18"
      }), /*#__PURE__*/React.createElement("circle", {
        r: 10,
        strokeWidth: 1.4
      }, /*#__PURE__*/React.createElement("animate", {
        attributeName: "r",
        dur: "2.6s",
        repeatCount: "indefinite",
        values: "9;19;19",
        keyTimes: holdTimes
      }), /*#__PURE__*/React.createElement("animate", {
        attributeName: "stroke-opacity",
        dur: "2.6s",
        repeatCount: "indefinite",
        values: "0.75;0;0",
        keyTimes: holdTimes
      })))),
      body: /*#__PURE__*/React.createElement(React.Fragment, null, "Every equation row has a bracket button. It restricts the curve's", /*#__PURE__*/React.createElement("strong", null, " domain"), " \u2014 the range of x where it exists at all.")
    }, {
      heading: 'A track with an end',
      art: /*#__PURE__*/React.createElement(Art, null, /*#__PURE__*/React.createElement("path", {
        d: "M14 76 C 46 76, 70 34, 100 28",
        fill: "none",
        stroke: "#6042a6",
        strokeWidth: 2.4,
        strokeLinecap: "round"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M100 28 C 130 22, 156 62, 192 74",
        fill: "none",
        stroke: "#6042a6",
        strokeWidth: 2.4,
        strokeLinecap: "round",
        strokeDasharray: "3 5",
        opacity: 0.28
      }), /*#__PURE__*/React.createElement("line", {
        x1: 100,
        y1: 10,
        x2: 100,
        y2: 88,
        stroke: "#6042a6",
        strokeWidth: 1.4,
        strokeDasharray: "4 3",
        opacity: 0.55
      }), /*#__PURE__*/React.createElement(ArtBall, {
        dur: 3.4,
        path: "M14,69 C 46,69 70,27 100,21 C 124,16 148,30 176,74"
      })),
      body: /*#__PURE__*/React.createElement(React.Fragment, null, "Past the limit the curve is not drawn and not solid, so the ball flies off the end of it instead of riding on into trouble.")
    }, {
      heading: 'It is free',
      art: /*#__PURE__*/React.createElement(Art, null, /*#__PURE__*/React.createElement("path", {
        d: "M22 26 C 60 92, 148 92, 186 26",
        fill: "none",
        stroke: "#6042a6",
        strokeWidth: 2.2,
        strokeLinecap: "round",
        strokeDasharray: "3 5",
        opacity: 0.3
      }), /*#__PURE__*/React.createElement("path", {
        d: "M22 26 C 44 64, 72 78, 104 78",
        fill: "none",
        stroke: "#6042a6",
        strokeWidth: 2.6,
        strokeLinecap: "round"
      }), /*#__PURE__*/React.createElement("line", {
        x1: 104,
        y1: 14,
        x2: 104,
        y2: 90,
        stroke: "#6042a6",
        strokeWidth: 1.4,
        strokeDasharray: "4 3",
        opacity: 0.55
      }), /*#__PURE__*/React.createElement("text", {
        x: 60,
        y: 20,
        textAnchor: "middle",
        fontSize: 11,
        fontWeight: 600,
        fontFamily: "ui-monospace,monospace",
        fill: "#388c46"
      }, "20"), /*#__PURE__*/React.createElement("text", {
        x: 152,
        y: 20,
        textAnchor: "middle",
        fontSize: 11,
        fontWeight: 600,
        fontFamily: "ui-monospace,monospace",
        fill: "#388c46"
      }, "20")),
      body: /*#__PURE__*/React.createElement(React.Fragment, null, "A restricted curve scores exactly what the full one does. When one shaped track can be cut into the two you need, that is one equation instead of two.")
    }]
  }
};

// ─── Object tutorials ────────────────────────────────────────
// Keyed by object kind. The first time a level puts one of these on the plane
// the level screen runs the deck once and remembers it per device — a reading
// state, not progress, so it is deliberately not synced.
const FP_OBJECT_TUTORIALS = {
  fan: {
    title: 'Fan',
    color: FAN_C,
    icon: /*#__PURE__*/React.createElement("svg", {
      width: 20,
      height: 20,
      viewBox: "0 0 24 24",
      fill: "none"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M4 8h10a3 3 0 1 0-3-3",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M4 14h13a3 3 0 1 1-3 3",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round"
    })),
    pages: [{
      heading: 'A box of wind',
      art: /*#__PURE__*/React.createElement(Art, null, fanBox(74, 84, 60, 66), [0, 1, 2, 3].map(k => /*#__PURE__*/React.createElement("line", {
        key: k,
        x1: 84 + k * 14,
        y1: 70,
        x2: 84 + k * 14,
        y2: 58,
        stroke: FAN_C,
        strokeWidth: 1.6,
        strokeLinecap: "round",
        opacity: 0.5
      }, /*#__PURE__*/React.createElement("animate", {
        attributeName: "y1",
        values: "76;34",
        dur: "1.6s",
        begin: `${k * 0.4}s`,
        repeatCount: "indefinite"
      }), /*#__PURE__*/React.createElement("animate", {
        attributeName: "y2",
        values: "64;22",
        dur: "1.6s",
        begin: `${k * 0.4}s`,
        repeatCount: "indefinite"
      }), /*#__PURE__*/React.createElement("animate", {
        attributeName: "opacity",
        values: "0;0.6;0",
        dur: "1.6s",
        begin: `${k * 0.4}s`,
        repeatCount: "indefinite"
      })))),
      body: /*#__PURE__*/React.createElement(React.Fragment, null, "A fan is the shaded box, not the bar at its base. It blows the way the arrow points, the whole time the ball is in there \u2014 and the number on it is how hard.")
    }, {
      heading: 'Wind and gravity add up',
      art: /*#__PURE__*/React.createElement(Art, null, fanBox(74, 84, 60, 66), /*#__PURE__*/React.createElement(ArtBall, {
        path: "M12,26 C 52,58 74,78 104,52 C 126,32 140,40 196,74"
      })),
      body: /*#__PURE__*/React.createElement(React.Fragment, null, "It does not care what your track is doing. The ball keeps the speed it arrived with and the wind is simply added to gravity while it is inside.", /*#__PURE__*/React.createElement("div", {
        style: {
          marginTop: 8
        }
      }, "Clip the edge and you get part of the push: it builds from about a third of the ball being inside up to the full force once it is properly in."))
    }, {
      heading: 'The base is a wall',
      art: /*#__PURE__*/React.createElement(Art, null, fanBox(74, 84, 60, 60, {
        noArrow: true
      }), /*#__PURE__*/React.createElement(ArtBall, {
        dur: 2.6,
        path: "M104,8 L104,73"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M74 80h60",
        stroke: FAN_C,
        strokeWidth: 3,
        strokeLinecap: "round"
      })),
      body: /*#__PURE__*/React.createElement(React.Fragment, null, "The solid bar at the fan's base is part of it. That edge is a wall \u2014 the ball lands on it, and cannot be rolled into the fan from behind.")
    }]
  },
  hazard: {
    title: 'Hazard',
    color: HAZ_C,
    icon: /*#__PURE__*/React.createElement("svg", {
      width: 20,
      height: 20,
      viewBox: "0 0 24 24",
      fill: "none"
    }, /*#__PURE__*/React.createElement("rect", {
      x: 4,
      y: 7,
      width: 16,
      height: 10,
      rx: 1.5,
      stroke: "currentColor",
      strokeWidth: 2,
      strokeDasharray: "3 2.5"
    })),
    pages: [{
      heading: 'Do not touch the red',
      art: /*#__PURE__*/React.createElement(Art, null, /*#__PURE__*/React.createElement("rect", {
        x: 62,
        y: 34,
        width: 84,
        height: 30,
        rx: 3,
        fill: HAZ_C,
        fillOpacity: 0.09,
        stroke: HAZ_C,
        strokeWidth: 1.6,
        strokeDasharray: "5 3"
      }), [0, 1, 2, 3].map(k => /*#__PURE__*/React.createElement("line", {
        key: k,
        x1: 66 + k * 19,
        y1: 62,
        x2: 80 + k * 19,
        y2: 36,
        stroke: HAZ_C,
        strokeWidth: 1.4,
        opacity: 0.5
      }))),
      body: /*#__PURE__*/React.createElement(React.Fragment, null, "The dashed red areas are hazards. They do nothing to your curve and everything to your ball.")
    }, {
      heading: 'One touch ends the run',
      art: /*#__PURE__*/React.createElement(Art, null, /*#__PURE__*/React.createElement("rect", {
        x: 62,
        y: 40,
        width: 84,
        height: 30,
        rx: 3,
        fill: HAZ_C,
        fillOpacity: 0.09,
        stroke: HAZ_C,
        strokeWidth: 1.6,
        strokeDasharray: "5 3"
      }), /*#__PURE__*/React.createElement(ArtBall, {
        path: "M14,14 C 50,20 80,34 100,40"
      }), /*#__PURE__*/React.createElement("g", {
        transform: "translate(100,40)",
        stroke: HAZ_C,
        strokeWidth: 2,
        strokeLinecap: "round"
      }, /*#__PURE__*/React.createElement("path", {
        d: "M-9 -9L9 9M9 -9L-9 9",
        opacity: 0
      }, /*#__PURE__*/React.createElement("animate", {
        attributeName: "opacity",
        values: "0;0;1;1;0",
        dur: "3.2s",
        repeatCount: "indefinite",
        keyTimes: `0;${RUN - 0.03};${RUN + 0.02};${FADE};1`
      })))),
      body: /*#__PURE__*/React.createElement(React.Fragment, null, "The moment the ball's edge meets one, the run fails \u2014 it does not matter how many stars you had already collected.")
    }, {
      heading: 'Route around it',
      art: /*#__PURE__*/React.createElement(Art, null, /*#__PURE__*/React.createElement("rect", {
        x: 62,
        y: 52,
        width: 84,
        height: 26,
        rx: 3,
        fill: HAZ_C,
        fillOpacity: 0.09,
        stroke: HAZ_C,
        strokeWidth: 1.6,
        strokeDasharray: "5 3"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M10 66 C 60 66, 60 20, 104 20 C 148 20, 148 66, 198 66",
        fill: "none",
        stroke: "#2d70b3",
        strokeWidth: 2.4,
        strokeLinecap: "round"
      }), /*#__PURE__*/React.createElement(ArtBall, {
        path: "M10,59 C 60,59 60,13 104,13 C 148,13 148,59 198,59"
      })),
      body: /*#__PURE__*/React.createElement(React.Fragment, null, "Your curve may cross a hazard; only the ", /*#__PURE__*/React.createElement("em", null, "ball"), " must not. Watch where it bounces, not just where the track goes \u2014 and remember you can cut a curve short.")
    }]
  },
  zerog: {
    title: 'Zero gravity',
    color: ZG_C,
    icon: /*#__PURE__*/React.createElement("svg", {
      width: 20,
      height: 20,
      viewBox: "0 0 24 24",
      fill: "none"
    }, /*#__PURE__*/React.createElement("rect", {
      x: 4,
      y: 4,
      width: 16,
      height: 16,
      rx: 2,
      stroke: "currentColor",
      strokeWidth: 2,
      strokeDasharray: "3 2.5"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: 12,
      cy: 12,
      r: 2,
      fill: "currentColor"
    })),
    pages: [{
      heading: 'A box with no weight in it',
      art: /*#__PURE__*/React.createElement(Art, null, /*#__PURE__*/React.createElement("rect", {
        x: 56,
        y: 22,
        width: 96,
        height: 54,
        rx: 6,
        fill: ZG_C,
        fillOpacity: 0.08,
        stroke: ZG_C,
        strokeWidth: 1.4,
        strokeDasharray: "5 4"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: 104,
        cy: 49,
        r: 14,
        fill: "none",
        stroke: ZG_C,
        strokeWidth: 1.4,
        strokeDasharray: "3 3",
        opacity: 0.6
      }), /*#__PURE__*/React.createElement("circle", {
        cx: 101,
        cy: 46,
        r: 4,
        fill: ZG_C,
        opacity: 0.7
      }, /*#__PURE__*/React.createElement("animate", {
        attributeName: "cy",
        values: "46;52;46",
        dur: "3s",
        repeatCount: "indefinite"
      }))),
      body: /*#__PURE__*/React.createElement(React.Fragment, null, "Inside this box gravity is switched off. Nothing pulls the ball down and nothing pushes it up.")
    }, {
      heading: 'It keeps whatever it arrived with',
      art: /*#__PURE__*/React.createElement(Art, null, /*#__PURE__*/React.createElement("rect", {
        x: 56,
        y: 22,
        width: 96,
        height: 54,
        rx: 6,
        fill: ZG_C,
        fillOpacity: 0.08,
        stroke: ZG_C,
        strokeWidth: 1.4,
        strokeDasharray: "5 4"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M8 18 C 30 28, 44 38, 56 42",
        fill: "none",
        stroke: "var(--fp-ink)",
        strokeOpacity: 0.2,
        strokeWidth: 1.4,
        strokeDasharray: "3 3"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M56 42 L152 42",
        fill: "none",
        stroke: ZG_C,
        strokeOpacity: 0.45,
        strokeWidth: 1.4,
        strokeDasharray: "3 3"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M152 42 C 166 48, 178 62, 190 84",
        fill: "none",
        stroke: "var(--fp-ink)",
        strokeOpacity: 0.2,
        strokeWidth: 1.4,
        strokeDasharray: "3 3"
      }), /*#__PURE__*/React.createElement(ArtBall, {
        dur: 3.2,
        path: "M8,18 C 30,28 44,38 56,42 L152,42 C 166,48 178,62 190,84"
      })),
      body: /*#__PURE__*/React.createElement(React.Fragment, null, "Its speed and direction stay exactly as they were on the way in \u2014 a curve straight through the box, and the fall picked up again on the way out.")
    }, {
      heading: 'Weightless, not upward',
      art: /*#__PURE__*/React.createElement(Art, null, /*#__PURE__*/React.createElement("rect", {
        x: 56,
        y: 22,
        width: 96,
        height: 54,
        rx: 6,
        fill: ZG_C,
        fillOpacity: 0.08,
        stroke: ZG_C,
        strokeWidth: 1.4,
        strokeDasharray: "5 4"
      }), /*#__PURE__*/React.createElement("g", {
        transform: "translate(104,49)",
        stroke: ZG_C,
        strokeWidth: 2,
        strokeLinecap: "round",
        fill: "none"
      }, /*#__PURE__*/React.createElement("path", {
        d: "M-11 -14 L11 14M11 -14L-11 14",
        opacity: 0.35
      }), /*#__PURE__*/React.createElement("path", {
        d: "M0 -20 L0 20",
        opacity: 0
      })), /*#__PURE__*/React.createElement("text", {
        x: 104,
        y: 88,
        textAnchor: "middle",
        fontSize: 10,
        fill: "var(--fp-ink-4)"
      }, "no arrows: there is no direction")),
      body: /*#__PURE__*/React.createElement(React.Fragment, null, "It will not lift the ball, and two overlapping boxes do not cancel back to normal. A ball that enters with nothing left simply drifts to a stop and stays there.")
    }]
  },
  well: {
    title: 'Gravity well',
    color: WELL_C,
    icon: /*#__PURE__*/React.createElement("svg", {
      width: 20,
      height: 20,
      viewBox: "0 0 24 24",
      fill: "none"
    }, /*#__PURE__*/React.createElement("circle", {
      cx: 12,
      cy: 12,
      r: 9,
      stroke: "currentColor",
      strokeWidth: 2,
      strokeDasharray: "3 2.5"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: 12,
      cy: 12,
      r: 2,
      fill: "currentColor"
    })),
    pages: [{
      heading: 'A steady pull, out to the ring',
      art: /*#__PURE__*/React.createElement(Art, null, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("radialGradient", {
        id: "fp-tut-well"
      }, /*#__PURE__*/React.createElement("stop", {
        offset: "0%",
        stopColor: WELL_C,
        stopOpacity: 0.3
      }), /*#__PURE__*/React.createElement("stop", {
        offset: "100%",
        stopColor: WELL_C,
        stopOpacity: 0.03
      }))), /*#__PURE__*/React.createElement("circle", {
        cx: 104,
        cy: 48,
        r: 36,
        fill: "url(#fp-tut-well)"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: 104,
        cy: 48,
        r: 36,
        fill: "none",
        stroke: WELL_C,
        strokeWidth: 1.3,
        strokeDasharray: "5 4",
        opacity: 0.7
      }), /*#__PURE__*/React.createElement("circle", {
        cx: 104,
        cy: 48,
        r: 3.5,
        fill: WELL_C
      }), [0, 90, 180, 270].map(a => /*#__PURE__*/React.createElement("line", {
        key: a,
        x1: 104,
        y1: 12,
        x2: 104,
        y2: 20,
        stroke: WELL_C,
        strokeWidth: 1.6,
        strokeLinecap: "round",
        opacity: 0.6,
        transform: `rotate(${a} 104 48)`
      }))),
      body: /*#__PURE__*/React.createElement(React.Fragment, null, "Anywhere inside the ring the ball is pulled toward the centre by the same amount \u2014 the number on it. Outside the ring it does nothing at all.")
    }, {
      heading: 'It bends the flight',
      art: /*#__PURE__*/React.createElement(Art, null, /*#__PURE__*/React.createElement("circle", {
        cx: 116,
        cy: 52,
        r: 32,
        fill: WELL_C,
        fillOpacity: 0.07,
        stroke: WELL_C,
        strokeWidth: 1.3,
        strokeDasharray: "5 4",
        opacity: 0.8
      }), /*#__PURE__*/React.createElement("circle", {
        cx: 116,
        cy: 52,
        r: 3.5,
        fill: WELL_C
      }), /*#__PURE__*/React.createElement("path", {
        d: "M8 20 C 60 26, 96 26, 116 52",
        fill: "none",
        stroke: "var(--fp-ink)",
        strokeOpacity: 0.18,
        strokeWidth: 1.4,
        strokeDasharray: "3 3"
      }), /*#__PURE__*/React.createElement(ArtBall, {
        path: "M8,20 C 60,26 96,26 116,52"
      })),
      body: /*#__PURE__*/React.createElement(React.Fragment, null, "A pull from the side turns a straight throw into an arc. Aim past a well and it will curve the ball round for you \u2014 no extra equation needed.")
    }, {
      heading: 'Crossing one costs speed',
      art: /*#__PURE__*/React.createElement(Art, null, /*#__PURE__*/React.createElement("circle", {
        cx: 104,
        cy: 48,
        r: 34,
        fill: WELL_C,
        fillOpacity: 0.07,
        stroke: WELL_C,
        strokeWidth: 1.3,
        strokeDasharray: "5 4",
        opacity: 0.8
      }), /*#__PURE__*/React.createElement("circle", {
        cx: 104,
        cy: 48,
        r: 3.5,
        fill: WELL_C
      }), /*#__PURE__*/React.createElement("path", {
        d: "M10 48 C 60 48, 70 84, 104 84 C 138 84, 148 48, 104 48",
        fill: "none",
        stroke: WELL_C,
        strokeOpacity: 0.35,
        strokeWidth: 1.4,
        strokeDasharray: "3 3"
      }), /*#__PURE__*/React.createElement(ArtBall, {
        path: "M10,48 C 60,48 70,84 104,84 C 138,84 148,48 104,48"
      })),
      body: /*#__PURE__*/React.createElement(React.Fragment, null, "A well drags as well as pulls, so the ball never leaves with as much as it brought. Fall too deep into one and it will not climb back out.")
    }]
  }
};
window.FP_EXPLAINERS = FP_EXPLAINERS;
window.FP_OBJECT_TUTORIALS = FP_OBJECT_TUTORIALS;
window.HowToPlayScreen = HowToPlayScreen;