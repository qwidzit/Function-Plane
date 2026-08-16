// Function Plane — Level Screen

const {
  useState: useSL,
  useRef: useRL,
  useEffect: useEL,
  useMemo: useML
} = React;
const EQ_COLORS = ['#c74440', '#2d70b3', '#388c46', '#6042a6', '#fa7e19', '#000000'];
const GRAVITY = 12;
const SUB_STEPS = 20;
// Simulated seconds advanced per tick. Real elapsed time is accumulated and
// drained in whole ticks, so the sim runs at the same speed and records the
// same finish time on a 30Hz, 60Hz or 120Hz display. Recorded times come from
// tick count, never the wall clock — otherwise a 120Hz phone posts times
// roughly half of a 60Hz phone's for identical play, and the leaderboard
// ranks hardware. At 60Hz this is exactly one tick per frame, i.e. identical
// stepping to before.
const TICK_DT = 1 / 60;
// Cap catch-up work after a stall (tab switch, GC pause) so the sim falls
// behind rather than freezing the UI trying to replay lost seconds.
const MAX_TICKS = 5;
const STAR_R = 0.55;
const BALL_R = 0.22;
const FALL_LIMIT = -13;
const TIME_LIMIT = 28;

// ─── Complexity scoring ───────────────────────────────────────
// classifyEquation and detectClass live in src/equation-classifier.js
// (loaded before this file) — an AST-based analyzer that understands
// implicit equations (x+y^2=1), variable exponents (2^x), pow()/sqrt(),
// products, rationals and piecewise ops. The regex version that used to
// live here mislabeled all of those as "linear".

// Some allowed-class values group multiple detected classes together — e.g.
// the 'exp' themed pack lets you use both exp() and log/ln.
function classMatches(allowed, detected) {
  if (!allowed) return true;
  if (!detected) return true;
  if (allowed === detected) return true;
  if (allowed === 'exp' && (detected === 'exp' || detected === 'log')) return true;
  if (allowed === 'trig' && (detected === 'trig' || detected === 'inverseTrig')) return true;
  return false;
}
function computeScore(equations) {
  const active = equations.filter(e => e.fn);
  if (active.length === 0) return 0;
  const complexity = active.reduce((s, e) => s + classifyEquation(e.expr), 0);
  return complexity + active.length * 20;
}
function starRating(eqsUsed, score, eqGoal, scoreGoal) {
  if (eqsUsed <= eqGoal) return 3;
  if (score <= scoreGoal) return 2;
  return 1;
}

// ─── Equation parser — explicit y=f(x) or implicit F(x,y)=G(x,y) ────
function normExpr(s) {
  s = s.replace(/\s+/g, '');
  // Aliases — accept full inverse-trig names that match how players write them.
  s = s.replace(/\barcsin\(/g, 'asin(');
  s = s.replace(/\barccos\(/g, 'acos(');
  s = s.replace(/\barctan\(/g, 'atan(');
  s = s.replace(/π/g, '(Math.PI)');
  s = s.replace(/\^/g, '**');
  s = s.replace(/(\d)([a-zA-Z(])/g, '$1*$2');
  s = s.replace(/\)([a-zA-Z(0-9])/g, ')*$1');
  const fns = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sqrt', 'abs', 'log', 'exp', 'floor', 'ceil', 'round', 'max', 'min', 'pow'];
  fns.forEach(f => {
    s = s.replace(new RegExp(`\\b${f}\\(`, 'g'), `Math.${f}(`);
  });
  s = s.replace(/\bln\(/g, 'Math.log(');
  s = s.replace(/\be\b/g, '(Math.E)');
  // JS forbids unary minus directly before ** ("-x**2" is a SyntaxError).
  // Maths convention is that -x^2 means -(x^2), so rewrite the offending
  // pattern as -(base**exp). Iterate so chained cases like "2*-x**2*-y**3"
  // all get fixed. Covers simple identifiers, numbers, parenthesised
  // groups and Math.fn(...) calls as the base/exponent.
  const TERM = '(?:Math\\.[a-zA-Z]+\\([^()]*\\)|[a-zA-Z_]\\w*\\([^()]*\\)|[a-zA-Z_]\\w*|\\d+(?:\\.\\d+)?|\\([^()]*\\))';
  const re = new RegExp(`(^|[^\\w)])-(${TERM})\\*\\*(${TERM})`, 'g');
  let prev;
  do {
    prev = s;
    s = s.replace(re, '$1-($2**$3)');
  } while (s !== prev);
  // Higher-order operators — sum, deriv, integ. Expanded *after* all Math.*
  // substitutions so the inner body is already valid JS. Safe (no eval of
  // user-supplied identifiers): the body is wrapped inside a closure that
  // exposes only `n` (sum loop var) or `x` (the integration / derivative
  // variable), and the JS evaluator's strict scope handles the rest.
  s = expandSpecialOps(s);
  return s;
}

// Find the first call to `name(args)` in s (with balanced parens) and rewrite
// it via build(args). Returns s unchanged if not found / arg count mismatch.
function expandSpecialOpOnce(s, name, argCount, build) {
  const re = new RegExp(`\\b${name}\\(`);
  const m = re.exec(s);
  if (!m) return s;
  const start = m.index;
  const openParen = start + name.length;
  let depth = 1,
    i = openParen + 1;
  while (i < s.length && depth > 0) {
    const c = s[i];
    if (c === '(') depth++;else if (c === ')') depth--;
    if (depth === 0) break;
    i++;
  }
  if (depth !== 0) return s;
  const inner = s.slice(openParen + 1, i);
  const args = splitTopLevelCommas(inner);
  if (args.length !== argCount) return s;
  return s.slice(0, start) + build(args) + s.slice(i + 1);
}
function splitTopLevelCommas(str) {
  const out = [];
  let depth = 0,
    last = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === '(') depth++;else if (c === ')') depth--;else if (c === ',' && depth === 0) {
      out.push(str.slice(last, i));
      last = i + 1;
    }
  }
  out.push(str.slice(last));
  return out.map(a => a.trim());
}
function expandSpecialOps(s) {
  let prev,
    safety = 16;
  do {
    prev = s;
    s = expandSpecialOpOnce(s, 'sum', 3, ([a, b, body]) =>
    // Iteration variable `n` ranges from a..b inclusive. Body sees both
    // n (loop) and x (the equation's free variable). Cap range at 200
    // iterations to keep render time bounded.
    `((function(){let _s=0;const _A=Math.round((${a})),_B=Math.round((${b}));` + `const _Lo=Math.min(_A,_B),_Hi=Math.max(_A,_B),_N=Math.min(200,_Hi-_Lo);` + `for(let n=_Lo;n<=_Lo+_N;n++){_s+=(${body});}return _s;})())`);
    s = expandSpecialOpOnce(s, 'deriv', 1, ([body]) =>
    // Numeric central-difference derivative w.r.t. x at the outer x.
    `((function(){const _f=function(x){return (${body});};` + `const _h=0.001;return (_f(x+_h)-_f(x-_h))/(2*_h);})())`);
    s = expandSpecialOpOnce(s, 'integ', 1, ([body]) =>
    // Definite integral from 0 to outer-x using midpoint rule. N is scaled
    // with |x| (more points for wider intervals) and capped so each render
    // stays under a few thousand evaluations.
    `((function(){const _f=function(x){return (${body});};const _xv=x;` + `const _N=Math.min(150,Math.max(8,Math.ceil(Math.abs(_xv)/0.05)));` + `const _dx=_xv/_N;let _s=0;` + `for(let _i=0;_i<_N;_i++)_s+=_f((_i+0.5)*_dx)*_dx;return _s;})())`);
  } while (s !== prev && --safety > 0);
  return s;
}
function parseEquation(raw) {
  if (!raw || !raw.trim()) return {
    fn: null,
    isImplicit: false
  };
  const eq = raw.trim();
  const eqIdx = eq.indexOf('=');
  if (eqIdx < 0) {
    try {
      const fn = new Function('x', `try{return(${normExpr(eq)});}catch(e){return NaN;}`);
      fn(0);
      return {
        fn,
        isImplicit: false
      };
    } catch {
      return {
        fn: null,
        isImplicit: false
      };
    }
  }
  const lhs = eq.slice(0, eqIdx).trim();
  const rhs = eq.slice(eqIdx + 1).trim();
  if (lhs === 'y') {
    try {
      const fn = new Function('x', `try{return(${normExpr(rhs)});}catch(e){return NaN;}`);
      fn(0);
      return {
        fn,
        isImplicit: false
      };
    } catch {
      return {
        fn: null,
        isImplicit: false
      };
    }
  }
  const nL = normExpr(lhs),
    nR = normExpr(rhs);
  try {
    const fn = new Function('x', 'y', `try{return(${nL})-(${nR});}catch(e){return NaN;}`);
    fn(0, 0);
    return {
      fn,
      isImplicit: true
    };
  } catch {
    return {
      fn: null,
      isImplicit: false
    };
  }
}

// ─── Marching squares (implicit curve) ───────────────────────
function marchingSquares(fn, xMin, xMax, yMin, yMax, res, m2p) {
  const dx = (xMax - xMin) / res;
  const dy = (yMax - yMin) / res;
  const W = res + 1;
  const vals = new Float32Array(W * W);
  for (let j = 0; j <= res; j++) for (let i = 0; i <= res; i++) {
    const v = fn(xMin + i * dx, yMin + j * dy);
    vals[j * W + i] = isFinite(v) ? v : NaN;
  }
  const lerp = (a, b, va, vb) => {
    const d = Math.abs(va) + Math.abs(vb);
    return d < 1e-12 ? (a + b) / 2 : a + (b - a) * Math.abs(va) / d;
  };
  const parts = [];
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const vbl = vals[j * W + i],
        vbr = vals[j * W + i + 1];
      const vtr = vals[(j + 1) * W + i + 1],
        vtl = vals[(j + 1) * W + i];
      if (isNaN(vbl) || isNaN(vbr) || isNaN(vtr) || isNaN(vtl)) continue;
      const cx0 = xMin + i * dx,
        cx1 = xMin + (i + 1) * dx;
      const cy0 = yMin + j * dy,
        cy1 = yMin + (j + 1) * dy;
      const sbl = vbl > 0 ? 1 : 0,
        sbr = vbr > 0 ? 1 : 0,
        str = vtr > 0 ? 1 : 0,
        stl = vtl > 0 ? 1 : 0;
      const crossB = sbl !== sbr,
        crossR = sbr !== str,
        crossT = stl !== str,
        crossL = sbl !== stl;
      const pts = [];
      if (crossB) pts.push(m2p(lerp(cx0, cx1, vbl, vbr), cy0));
      if (crossR) pts.push(m2p(cx1, lerp(cy0, cy1, vbr, vtr)));
      if (crossT) pts.push(m2p(lerp(cx0, cx1, vtl, vtr), cy1));
      if (crossL) pts.push(m2p(cx0, lerp(cy0, cy1, vbl, vtl)));
      const seg = (a, b) => `M${a.x.toFixed(1)},${a.y.toFixed(1)}L${b.x.toFixed(1)},${b.y.toFixed(1)}`;
      if (pts.length === 2) {
        parts.push(seg(pts[0], pts[1]));
      } else if (pts.length === 4) {
        const vctr = (vbl + vbr + vtr + vtl) / 4;
        if (vctr > 0 === sbl > 0) {
          parts.push(seg(pts[0], pts[3]));
          parts.push(seg(pts[1], pts[2]));
        } else {
          parts.push(seg(pts[0], pts[1]));
          parts.push(seg(pts[2], pts[3]));
        }
      }
    }
  }
  return parts.join(' ');
}

// ─── Domain helpers ───────────────────────────────────────────
function inDomain(x, domain) {
  if (!domain || domain.length === 0) return true;
  return domain.some(s => x >= s.xMin && x <= s.xMax);
}

// ─── Physics step ─────────────────────────────────────────────
// Ball integration + collision live in src/physics-engine.js
// (window.FP_PHYSICS). The engine collides the ball against *sampled*
// curve geometry — an adaptive polyline for y=f(x), local marching squares
// for implicit curves — using the true closest-point distance, so
// high-frequency curves (sin(40x)), floor() staircases, sharp corners and
// near-vertical slopes all resolve correctly, with no tangent-line or
// gradient approximations to blow up. The response tuning (GRAVITY,
// bounciness, energyRetention, real-bounce threshold) is unchanged, so
// the ball feels exactly as before on curves that already worked.
function physicsStep(ph, colliders, dt) {
  FP_PHYSICS.stepBall(ph, colliders, dt, {
    gravity: GRAVITY,
    ballR: BALL_R,
    bounciness: PHYSICS_CONFIG.bounciness,
    energyRetention: PHYSICS_CONFIG.energyRetention,
    bounceThreshold: 1.5
  });

  // ── Star collection ────────────────────────────────────────────────────
  for (let i = 0; i < ph.stars.length; i++) {
    if (!ph.stars[i].collected && Math.hypot(ph.x - ph.stars[i].x, ph.y - ph.stars[i].y) < STAR_R + BALL_R) {
      ph.stars[i] = {
        ...ph.stars[i],
        collected: true
      };
      ph.justCollected = true;
    }
  }
}

// ─── Coordinate plane ─────────────────────────────────────────
function CoordPlane({
  width,
  height,
  equations,
  ballPos,
  simStars,
  startPos,
  autoZoomTrigger,
  autoZoomEnabled,
  levelStars
}) {
  const [view, setView] = useSL({
    cx: 0,
    cy: 0,
    scale: 40
  });

  // Auto-zoom: when Play is pressed (autoZoomTrigger increments), fit the
  // ball start position + all target stars into view.
  useEL(() => {
    if (!autoZoomEnabled || !startPos || !levelStars || width <= 0 || height <= 0) return;
    if (autoZoomTrigger == null) return;
    const xs = [startPos.x, ...levelStars.map(s => s.x)];
    const ys = [startPos.y, ...levelStars.map(s => s.y)];
    const minX = Math.min(...xs),
      maxX = Math.max(...xs);
    const minY = Math.min(...ys),
      maxY = Math.max(...ys);
    const padX = Math.max(2, (maxX - minX) * 0.3);
    const padY = Math.max(2, (maxY - minY) * 0.4);
    const w = maxX - minX + padX * 2;
    const h = maxY - minY + padY * 2;
    const scale = Math.max(8, Math.min(120, Math.min(width / w, height / h)));
    setView({
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      scale
    });
  }, [autoZoomTrigger]);
  const svgRef = useRL(null);
  const ptrsRef = useRL({});
  const panRef = useRL(null); // { sx, sy, cx, cy }
  const pinchRef = useRL(null); // { dist, midPx, midPy, scale, cx, cy }

  const m2p = (mx, my) => ({
    x: width / 2 + (mx - view.cx) * view.scale,
    y: height / 2 - (my - view.cy) * view.scale
  });
  const range = useML(() => ({
    xMin: view.cx - width / (2 * view.scale),
    xMax: view.cx + width / (2 * view.scale),
    yMin: view.cy - height / (2 * view.scale),
    yMax: view.cy + height / (2 * view.scale)
  }), [view, width, height]);
  const gridStep = useML(() => {
    const t = 40 / view.scale;
    const p = Math.pow(10, Math.floor(Math.log10(t)));
    const n = t / p;
    return n < 1.5 ? p : n < 3 ? 2 * p : n < 7 ? 5 * p : 10 * p;
  }, [view.scale]);
  const onPointerDown = e => {
    e.currentTarget.setPointerCapture(e.pointerId);
    ptrsRef.current[e.pointerId] = {
      x: e.clientX,
      y: e.clientY
    };
    const ids = Object.keys(ptrsRef.current);
    if (ids.length === 1) {
      panRef.current = {
        sx: e.clientX,
        sy: e.clientY,
        cx: view.cx,
        cy: view.cy
      };
      pinchRef.current = null;
    } else if (ids.length === 2) {
      const [p1, p2] = Object.values(ptrsRef.current);
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      const rect = svgRef.current?.getBoundingClientRect();
      const midPx = (p1.x + p2.x) / 2 - (rect?.left ?? 0);
      const midPy = (p1.y + p2.y) / 2 - (rect?.top ?? 0);
      pinchRef.current = {
        dist,
        midPx,
        midPy,
        scale: view.scale,
        cx: view.cx,
        cy: view.cy
      };
      panRef.current = null;
    }
  };
  const onPointerMove = e => {
    if (!ptrsRef.current[e.pointerId]) return;
    ptrsRef.current[e.pointerId] = {
      x: e.clientX,
      y: e.clientY
    };
    const n = Object.keys(ptrsRef.current).length;
    if (n === 1 && panRef.current) {
      const {
        sx,
        sy,
        cx,
        cy
      } = panRef.current;
      const dx = e.clientX - sx,
        dy = e.clientY - sy;
      setView(v => ({
        ...v,
        cx: cx - dx / v.scale,
        cy: cy + dy / v.scale
      }));
    } else if (n === 2 && pinchRef.current) {
      const [p1, p2] = Object.values(ptrsRef.current);
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      const ps = pinchRef.current;
      const f = dist / ps.dist;
      const s = Math.max(8, Math.min(400, ps.scale * f));
      const {
        midPx,
        midPy
      } = ps;
      const mx = ps.cx + (midPx - width / 2) / ps.scale;
      const my = ps.cy - (midPy - height / 2) / ps.scale;
      setView({
        cx: mx - (midPx - width / 2) / s,
        cy: my + (midPy - height / 2) / s,
        scale: s
      });
    }
  };
  const onPointerUp = e => {
    delete ptrsRef.current[e.pointerId];
    const remaining = Object.entries(ptrsRef.current);
    if (remaining.length === 0) {
      panRef.current = null;
      pinchRef.current = null;
    } else if (remaining.length === 1) {
      const [, p] = remaining[0];
      panRef.current = {
        sx: p.x,
        sy: p.y,
        cx: view.cx,
        cy: view.cy
      };
      pinchRef.current = null;
    }
  };
  const onWheel = e => {
    e.preventDefault();
    const rect = svgRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left,
      py = e.clientY - rect.top;
    const f = Math.exp(-e.deltaY * 0.001);
    setView(v => {
      const s = Math.max(8, Math.min(400, v.scale * f));
      const mx = v.cx + (px - width / 2) / v.scale,
        my = v.cy - (py - height / 2) / v.scale;
      return {
        cx: mx - (px - width / 2) / s,
        cy: my + (py - height / 2) / s,
        scale: s
      };
    });
  };

  // Grid lines
  const lines = [];
  const minor = gridStep,
    major = gridStep * 5;
  for (let x = Math.floor(range.xMin / minor) * minor; x <= range.xMax; x += minor) {
    const isMj = Math.abs(Math.round(x / major) * major - x) < minor * 0.01;
    const px = m2p(x, 0).x;
    lines.push(/*#__PURE__*/React.createElement("line", {
      key: `v${x.toFixed(5)}`,
      x1: px,
      y1: 0,
      x2: px,
      y2: height,
      stroke: isMj ? 'var(--lv-grid-major)' : 'var(--lv-grid-minor)',
      strokeWidth: 1
    }));
  }
  for (let y = Math.floor(range.yMin / minor) * minor; y <= range.yMax; y += minor) {
    const isMj = Math.abs(Math.round(y / major) * major - y) < minor * 0.01;
    const py = m2p(0, y).y;
    lines.push(/*#__PURE__*/React.createElement("line", {
      key: `h${y.toFixed(5)}`,
      x1: 0,
      y1: py,
      x2: width,
      y2: py,
      stroke: isMj ? 'var(--lv-grid-major)' : 'var(--lv-grid-minor)',
      strokeWidth: 1
    }));
  }
  const ax = m2p(0, 0);
  const tickLabels = [];
  const ts = major;
  for (let x = Math.ceil(range.xMin / ts) * ts; x <= range.xMax; x += ts) {
    if (Math.abs(x) < ts * 0.01) continue;
    const p = m2p(x, 0);
    const ty = Math.max(12, Math.min(height - 4, ax.y + 12));
    tickLabels.push(/*#__PURE__*/React.createElement("text", {
      key: `tx${x.toFixed(3)}`,
      x: p.x,
      y: ty,
      fontSize: 10,
      fontFamily: "ui-monospace,monospace",
      fill: "var(--lv-tick)",
      textAnchor: "middle"
    }, gridStep >= 1 ? Math.round(x) : x.toFixed(1)));
  }
  for (let y = Math.ceil(range.yMin / ts) * ts; y <= range.yMax; y += ts) {
    if (Math.abs(y) < ts * 0.01) continue;
    const p = m2p(0, y);
    const tx = Math.max(4, Math.min(width - 20, ax.x + 6));
    tickLabels.push(/*#__PURE__*/React.createElement("text", {
      key: `ty${y.toFixed(3)}`,
      x: tx,
      y: p.y + 3,
      fontSize: 10,
      fontFamily: "ui-monospace,monospace",
      fill: "var(--lv-tick)",
      textAnchor: "start"
    }, gridStep >= 1 ? Math.round(y) : y.toFixed(1)));
  }
  const eqPaths = equations.filter(eq => eq.fn && eq.visible).map(eq => {
    if (eq.isImplicit) {
      const implFn = eq.domain ? (x, y) => inDomain(x, eq.domain) ? eq.fn(x, y) : NaN : eq.fn;
      const d = marchingSquares(implFn, range.xMin, range.xMax, range.yMin, range.yMax, 60, m2p);
      return /*#__PURE__*/React.createElement("path", {
        key: eq.id,
        d: d,
        stroke: eq.color,
        strokeWidth: 2.2,
        fill: "none",
        strokeLinecap: "round",
        strokeLinejoin: "round"
      });
    }
    let d = '',
      pen = false,
      prevY = NaN;
    const step = 2 / view.scale;
    for (let x = range.xMin; x <= range.xMax; x += step) {
      if (!inDomain(x, eq.domain)) {
        pen = false;
        prevY = NaN;
        continue;
      }
      const y = eq.fn(x);
      if (!isFinite(y) || Math.abs(y - prevY) * view.scale > 900) {
        pen = false;
        prevY = NaN;
        continue;
      }
      const p = m2p(x, y);
      d += pen ? `L${p.x.toFixed(1)} ${p.y.toFixed(1)}` : `M${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      pen = true;
      prevY = y;
    }
    return /*#__PURE__*/React.createElement("path", {
      key: eq.id,
      d: d,
      stroke: eq.color,
      strokeWidth: 2.2,
      fill: "none",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    });
  });
  const starsEl = simStars.map((s, i) => {
    if (s.collected) return null;
    const p = m2p(s.x, s.y);
    return /*#__PURE__*/React.createElement("g", {
      key: i,
      transform: `translate(${p.x},${p.y})`
    }, /*#__PURE__*/React.createElement("circle", {
      r: 14,
      fill: "var(--lv-bg)",
      opacity: 0.65
    }), /*#__PURE__*/React.createElement("path", {
      d: "M0 -10 L3 -3 L11 -2 L5 3 L7 11 L0 6 L-7 11 L-5 3 L-11 -2 L-3 -3 Z",
      fill: "none",
      stroke: "var(--lv-star)",
      strokeWidth: 1.5,
      strokeLinejoin: "round"
    }));
  });
  const bp = m2p(ballPos.x, ballPos.y);
  const sp = m2p(startPos.x, startPos.y);
  const br = Math.max(4, BALL_R * view.scale);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: '100%',
      height: '100%',
      background: 'var(--lv-bg)',
      overflow: 'hidden',
      touchAction: 'none',
      transform: 'translateZ(0)',
      WebkitTransform: 'translateZ(0)'
    },
    onWheel: onWheel
  }, /*#__PURE__*/React.createElement("svg", {
    ref: svgRef,
    width: width,
    height: height,
    overflow: "hidden",
    style: {
      display: 'block',
      cursor: 'grab',
      userSelect: 'none'
    },
    onPointerDown: onPointerDown,
    onPointerMove: onPointerMove,
    onPointerUp: onPointerUp,
    onPointerCancel: onPointerUp
  }, lines, /*#__PURE__*/React.createElement("line", {
    x1: 0,
    y1: ax.y,
    x2: width,
    y2: ax.y,
    stroke: "var(--lv-axis)",
    strokeWidth: 1.4
  }), /*#__PURE__*/React.createElement("line", {
    x1: ax.x,
    y1: 0,
    x2: ax.x,
    y2: height,
    stroke: "var(--lv-axis)",
    strokeWidth: 1.4
  }), /*#__PURE__*/React.createElement("text", {
    x: Math.min(ax.x - 4, width - 4),
    y: Math.max(12, ax.y + 12),
    fontSize: 10,
    fontFamily: "ui-monospace,monospace",
    fill: "var(--lv-tick)",
    textAnchor: "end"
  }, "0"), tickLabels, eqPaths, /*#__PURE__*/React.createElement("circle", {
    cx: sp.x,
    cy: sp.y,
    r: br,
    fill: "none",
    stroke: "var(--lv-ball)",
    strokeWidth: 1.5,
    strokeDasharray: "3 2",
    opacity: 0.35
  }), starsEl, /*#__PURE__*/React.createElement("g", {
    transform: `translate(${bp.x},${bp.y})`
  }, /*#__PURE__*/React.createElement("circle", {
    r: br,
    fill: "var(--lv-ball)",
    stroke: "var(--lv-ball-stroke)",
    strokeWidth: 1.5
  }), /*#__PURE__*/React.createElement("circle", {
    r: br * 0.31,
    cx: -br * 0.31,
    cy: -br * 0.31,
    fill: "var(--lv-ball-shine)"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: 10,
      bottom: 10,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: 'var(--lv-surface)',
      border: '1px solid var(--lv-line)',
      borderRadius: 10
    }
  }, /*#__PURE__*/React.createElement(ZBtn, {
    onClick: () => setView(v => ({
      ...v,
      scale: Math.min(400, v.scale * 1.4)
    }))
  }, "+"), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: 'var(--lv-line)'
    }
  }), /*#__PURE__*/React.createElement(ZBtn, {
    onClick: () => setView(v => ({
      ...v,
      scale: Math.max(6, v.scale / 1.4)
    }))
  }, "−"), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: 'var(--lv-line)'
    }
  }), /*#__PURE__*/React.createElement(ZBtn, {
    onClick: () => setView({
      cx: 0,
      cy: 0,
      scale: 40
    }),
    sm: true
  }, /*#__PURE__*/React.createElement("svg", {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: 12,
    cy: 12,
    r: 3,
    stroke: "currentColor",
    strokeWidth: 2
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 3V6M12 18V21M3 12H6M18 12H21",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round"
  })))));
}
function ZBtn({
  children,
  onClick,
  sm
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      width: 34,
      height: sm ? 28 : 32,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 18,
      color: 'var(--fp-ink)',
      cursor: 'pointer'
    }
  }, children);
}
function PlaneFiller({
  equations,
  ballPos,
  simStars,
  startPos,
  autoZoomTrigger,
  autoZoomEnabled,
  levelStars
}) {
  const ref = useRL(null);
  const [size, setSize] = useSL({
    w: 360,
    h: 300
  });
  useEL(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(entries => {
      const r = entries[0].contentRect;
      setSize({
        w: Math.round(r.width),
        h: Math.round(r.height)
      });
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    style: {
      position: 'absolute',
      inset: 0
    }
  }, /*#__PURE__*/React.createElement(CoordPlane, {
    width: size.w,
    height: size.h,
    equations: equations,
    ballPos: ballPos,
    simStars: simStars,
    startPos: startPos,
    autoZoomTrigger: autoZoomTrigger,
    autoZoomEnabled: autoZoomEnabled,
    levelStars: levelStars
  }));
}

// ─── HUD chips ────────────────────────────────────────────────
function GoalChip({
  stars,
  label
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      height: 22,
      padding: '0 8px',
      borderRadius: 6,
      background: 'var(--lv-surface)',
      border: '1px solid var(--lv-line)'
    }
  }, /*#__PURE__*/React.createElement(Stars, {
    count: stars,
    total: 3,
    size: 7,
    c: "var(--lv-star)",
    empty: "var(--fp-ink-4)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "fp-mono",
    style: {
      fontSize: 10,
      color: 'var(--fp-ink-3)'
    }
  }, label));
}
function HudChip({
  label,
  value
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: 28,
      padding: '0 10px',
      borderRadius: 8,
      background: 'var(--lv-surface)',
      border: '1px solid var(--lv-line)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9.5,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'var(--fp-ink-3)'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    className: "fp-mono",
    style: {
      fontSize: 12,
      color: 'var(--fp-ink)'
    }
  }, value));
}

// ─── Domain editor ────────────────────────────────────────────
// Domain value button — tapping opens the NumPad instead of the native keyboard.
function DomValBtn({
  segId,
  val,
  domKb,
  onTap
}) {
  const isActive = domKb?.id === segId;
  const display = isActive ? domKb.val : String(val);
  return /*#__PURE__*/React.createElement("button", {
    onPointerDown: e => {
      e.preventDefault();
      onTap();
    },
    style: {
      width: 52,
      minHeight: 28,
      fontSize: 12,
      textAlign: 'center',
      padding: '3px 4px',
      background: isActive ? 'color-mix(in srgb, var(--fp-accent) 18%, var(--fp-surface))' : 'var(--fp-surface)',
      border: `1px solid ${isActive ? 'var(--fp-accent)' : 'var(--lv-line)'}`,
      borderRadius: 6,
      color: 'var(--fp-ink)',
      fontFamily: "'Geist Mono','ui-monospace',monospace",
      cursor: 'pointer'
    }
  }, display);
}
function DomainEditor({
  domain,
  onChange,
  domKb,
  onDomInput
}) {
  const segs = domain || [];
  const add = () => onChange([...segs, {
    xMin: -5,
    xMax: 5
  }]);
  const remove = i => onChange(segs.filter((_, j) => j !== i));
  const update = (i, k, v) => onChange(segs.map((s, j) => j === i ? {
    ...s,
    [k]: v
  } : s));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '8px 12px 10px',
      background: 'var(--fp-surface-2)',
      borderTop: '1px solid var(--lv-line)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'var(--fp-ink-3)',
      marginBottom: 6
    }
  }, "Restrict domain"), segs.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--fp-ink-4)',
      marginBottom: 6
    }
  }, "No restriction — curve draws everywhere."), segs.map((seg, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginBottom: 5
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "fp-mono",
    style: {
      fontSize: 11,
      color: 'var(--fp-ink-3)'
    }
  }, "x ∈"), /*#__PURE__*/React.createElement(DomValBtn, {
    segId: `${i}-min`,
    val: seg.xMin,
    domKb: domKb,
    onTap: () => onDomInput(`${i}-min`, seg.xMin, v => update(i, 'xMin', v))
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--fp-ink-3)'
    }
  }, "to"), /*#__PURE__*/React.createElement(DomValBtn, {
    segId: `${i}-max`,
    val: seg.xMax,
    domKb: domKb,
    onTap: () => onDomInput(`${i}-max`, seg.xMax, v => update(i, 'xMax', v))
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => remove(i),
    style: {
      color: 'var(--fp-ink-3)',
      fontSize: 16,
      lineHeight: 1,
      padding: '0 4px'
    }
  }, "×"))), /*#__PURE__*/React.createElement("button", {
    onClick: add,
    style: {
      fontSize: 11.5,
      color: 'var(--fp-accent)',
      fontWeight: 500,
      padding: '2px 0'
    }
  }, "+ Add segment"));
}

// ─── Number pad (for domain segment values) ───────────────────
// Value-based (no DOM ref needed): the current string value is passed in,
// and onChange receives the updated string. The parent commits to state.
function NumPad({
  val,
  onChange,
  onDone
}) {
  const ins = ch => {
    // only one leading minus allowed
    if (ch === '-' && val !== '') return;
    onChange(val + ch);
  };
  const del = () => onChange(val.slice(0, -1));
  const clr = () => onChange('');
  const ROWS = [[{
    lbl: '7',
    act: () => ins('7'),
    t: 'num'
  }, {
    lbl: '8',
    act: () => ins('8'),
    t: 'num'
  }, {
    lbl: '9',
    act: () => ins('9'),
    t: 'num'
  }, {
    lbl: '⌫',
    act: del,
    t: 'del'
  }], [{
    lbl: '4',
    act: () => ins('4'),
    t: 'num'
  }, {
    lbl: '5',
    act: () => ins('5'),
    t: 'num'
  }, {
    lbl: '6',
    act: () => ins('6'),
    t: 'num'
  }, {
    lbl: '−',
    act: () => ins('-'),
    t: 'op'
  }], [{
    lbl: '1',
    act: () => ins('1'),
    t: 'num'
  }, {
    lbl: '2',
    act: () => ins('2'),
    t: 'num'
  }, {
    lbl: '3',
    act: () => ins('3'),
    t: 'num'
  }, {
    lbl: 'CLR',
    act: clr,
    t: 'util'
  }], [{
    lbl: '0',
    act: () => ins('0'),
    t: 'num'
  }, {
    lbl: '.',
    act: () => ins('.'),
    t: 'num'
  }, null, {
    lbl: 'Done',
    act: onDone,
    t: 'nav'
  }]];
  const bg = t => {
    if (t === 'num') return 'var(--fp-surface)';
    if (t === 'del') return 'var(--fp-surface-2)';
    if (t === 'util') return 'var(--fp-surface-2)';
    if (t === 'nav') return 'var(--fp-accent)';
    return 'var(--lv-bg)';
  };
  const fg = t => t === 'nav' ? 'var(--fp-accent-ink)' : 'var(--fp-ink)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--fp-surface)',
      borderTop: '1px solid var(--lv-line)',
      padding: '4px 5px',
      paddingBottom: 'max(5px, env(safe-area-inset-bottom, 0px))',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      touchAction: 'manipulation'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 4px 6px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: 'var(--fp-ink-3)',
      letterSpacing: '0.08em',
      textTransform: 'uppercase'
    }
  }, "x-value"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Geist Mono','ui-monospace',monospace",
      fontSize: 15,
      color: 'var(--fp-ink)',
      minWidth: 50,
      textAlign: 'right'
    }
  }, val || '0')), ROWS.map((row, ri) => /*#__PURE__*/React.createElement("div", {
    key: ri,
    style: {
      display: 'flex',
      gap: 3,
      marginBottom: ri < ROWS.length - 1 ? 3 : 0
    }
  }, row.map((k, ki) => k ? /*#__PURE__*/React.createElement("button", {
    key: ki,
    onPointerDown: e => {
      e.preventDefault();
      k.act();
    },
    style: {
      flex: 1,
      height: 38,
      borderRadius: 7,
      fontSize: k.lbl.length > 3 ? 10 : 13,
      fontWeight: k.t === 'nav' ? 600 : 400,
      background: bg(k.t),
      border: '1px solid var(--lv-line)',
      color: fg(k.t),
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, k.lbl) : /*#__PURE__*/React.createElement("div", {
    key: ki,
    style: {
      flex: 1
    }
  })))));
}

// ─── Pretty-print expressions ─────────────────────────────────
// Visually replace x^2 with x², sqrt() with √, *, pi etc.  The transformation
// is one-way (display-only) — the original raw string stays in eq.expr so
// the parser keeps working unchanged.
function prettifyExpr(s) {
  if (!s) return s;
  return s.replace(/\bsqrt\(/g, '√(').replace(/\bpi\b/g, 'π').replace(/\*/g, '·').replace(/<=/g, '≤').replace(/>=/g, '≥').replace(/\^(-?\d)/g, (_, d) => {
    const map = {
      '-': '⁻',
      '0': '⁰',
      '1': '¹',
      '2': '²',
      '3': '³',
      '4': '⁴',
      '5': '⁵',
      '6': '⁶',
      '7': '⁷',
      '8': '⁸',
      '9': '⁹'
    };
    return [...d].map(c => map[c] || '^' + c).join('');
  });
}
window.prettifyExpr = prettifyExpr;

// ─── Equation row ─────────────────────────────────────────────
function EqRow({
  idx,
  eq,
  onChange,
  onRemove,
  disabled,
  onActivate,
  notation,
  domKb,
  onDomInput
}) {
  const inputRef = useRL(null);
  const [domOpen, setDomOpen] = useSL(false);
  const [focused, setFocused] = useSL(false);
  const valid = !eq.expr.trim() || eq.fn != null;
  const showPretty = notation === 'pretty' && !focused && eq.expr;
  const locked = !!eq.preplaced;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--lv-line)',
      background: locked ? 'color-mix(in srgb, var(--fp-ink) 4%, transparent)' : 'transparent'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'stretch'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onPointerDown: e => {
      e.preventDefault();
      !disabled && onChange({
        visible: !eq.visible
      });
    },
    style: {
      width: 36,
      flex: '0 0 36px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 20,
      height: 20,
      borderRadius: '50%',
      background: eq.visible ? eq.color : 'transparent',
      border: `1.5px solid ${eq.color}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 10,
      fontWeight: 600,
      fontFamily: 'ui-monospace,monospace',
      color: eq.visible ? '#fff' : eq.color
    }
  }, idx + 1)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      position: 'relative'
    }
  }, showPretty && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      display: 'flex',
      alignItems: 'center',
      fontFamily: "'Geist Mono','ui-monospace',monospace",
      fontSize: 14,
      color: valid ? 'var(--fp-ink)' : '#c74440',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
      pointerEvents: 'none',
      zIndex: 0
    }
  }, prettifyExpr(eq.expr)), /*#__PURE__*/React.createElement("input", {
    ref: inputRef,
    value: eq.expr,
    onChange: e => !locked && onChange({
      expr: e.target.value
    }),
    onFocus: () => {
      setFocused(true);
      !disabled && !locked && onActivate(inputRef);
    },
    onBlur: () => setFocused(false),
    disabled: disabled || locked,
    readOnly: locked,
    inputMode: "none",
    spellCheck: false,
    placeholder: "e.g.  y = sin(x)",
    style: {
      width: '100%',
      background: 'transparent',
      border: 0,
      outline: 0,
      fontFamily: "'Geist Mono','ui-monospace',monospace",
      fontSize: 14,
      color: showPretty ? 'transparent' : locked ? 'var(--fp-ink-2)' : valid ? 'var(--fp-ink)' : '#c74440',
      caretColor: 'var(--fp-ink)',
      padding: '10px 0',
      position: 'relative',
      zIndex: 1
    }
  })), !locked && /*#__PURE__*/React.createElement("button", {
    onPointerDown: e => {
      e.preventDefault();
      setDomOpen(o => !o);
    },
    title: "Restrict domain",
    style: {
      width: 32,
      flex: '0 0 32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: domOpen ? 'var(--fp-accent)' : 'var(--fp-ink-4)'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M6 3v18M18 3v18M3 9h18M3 15h18",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round"
  }))), /*#__PURE__*/React.createElement("button", {
    onPointerDown: e => {
      e.preventDefault();
      if (locked || disabled) return;
      onRemove();
    },
    style: {
      width: 34,
      flex: '0 0 34px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: locked ? 'var(--fp-ink-4)' : 'var(--fp-ink-3)',
      cursor: locked ? 'default' : 'pointer'
    },
    title: locked ? 'Pre-placed by the level designer — locked' : 'Remove equation'
  }, locked ? /*#__PURE__*/React.createElement(Icon.Lock, {
    size: 12,
    c: "currentColor"
  }) : /*#__PURE__*/React.createElement("svg", {
    width: 13,
    height: 13,
    viewBox: "0 0 24 24",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M6 6L18 18M18 6L6 18",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round"
  })))), domOpen && /*#__PURE__*/React.createElement(DomainEditor, {
    domain: eq.domain,
    onChange: domain => onChange({
      domain: domain.length ? domain : null
    }),
    domKb: domKb,
    onDomInput: onDomInput
  }));
}

// ─── Equations panel ──────────────────────────────────────────
function EquationsPanel({
  equations,
  setEquations,
  expanded,
  onToggle,
  disabled,
  notation,
  allowedClass,
  classWarning
}) {
  const activeInputRef = useRL(null);
  const [activeId, setActiveId] = useSL(null);
  const [kbVisible, setKbVisible] = useSL(true);
  const kbOpen = activeId !== null && !disabled && kbVisible;

  // Domain value keyboard (NumPad) — active when user taps a domain-segment field.
  // null = closed; { id, val } = open with current string value.
  const [domKb, setDomKb] = useSL(null);
  const domKbCommitRef = useRL(null); // current commit fn (number → void)

  const onDomInput = (id, currentVal, commit) => {
    domKbCommitRef.current = commit;
    setDomKb({
      id,
      val: String(currentVal)
    });
  };
  const handleNumPadChange = v => {
    setDomKb(d => ({
      ...d,
      val: v
    }));
    const n = parseFloat(v);
    if (!isNaN(n) && domKbCommitRef.current) domKbCommitRef.current(n);
  };
  const handleNumPadDone = () => {
    const n = parseFloat(domKb?.val);
    if (!isNaN(n) && domKbCommitRef.current) domKbCommitRef.current(n);
    setDomKb(null);
    domKbCommitRef.current = null;
  };
  const anyKbOpen = kbOpen && !domKb || domKb !== null;
  const activate = (id, ref) => {
    activeInputRef.current = ref.current;
    setActiveId(id);
    setKbVisible(true);
  };
  const dismiss = () => {
    setActiveId(null);
    activeInputRef.current?.blur();
  };
  const handleKbChange = newVal => {
    setEquations(eqs => eqs.map(e => e.id === activeId ? {
      ...e,
      expr: newVal,
      ...parseEquation(newVal)
    } : e));
  };
  const addRow = () => setEquations(eqs => {
    const id = Math.max(0, ...eqs.map(e => e.id)) + 1;
    return [...eqs, {
      id,
      expr: '',
      fn: null,
      isImplicit: false,
      color: EQ_COLORS[eqs.length % EQ_COLORS.length],
      visible: true,
      domain: null
    }];
  });
  const update = (id, patch) => setEquations(eqs => eqs.map(e => {
    if (e.id !== id) return e;
    if (e.preplaced && 'expr' in patch) return e; // can't edit pre-placed
    const merged = {
      ...e,
      ...patch
    };
    if ('expr' in patch) Object.assign(merged, parseEquation(patch.expr));
    return merged;
  }));
  const remove = id => setEquations(eqs => eqs.filter(e => e.id !== id || e.preplaced));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--lv-surface)',
      borderTop: '1px solid var(--lv-line)',
      display: 'flex',
      flexDirection: 'column',
      // When any keyboard is open, remove the height cap so equations + keyboard
      // are both fully visible (the plane above shrinks to accommodate).
      maxHeight: anyKbOpen ? 'none' : expanded ? 300 : 188,
      transition: anyKbOpen ? 'none' : 'max-height .2s ease'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onToggle,
    style: {
      height: 22,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 4,
      borderRadius: 2,
      background: 'var(--fp-ink-4)'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 12px 8px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: 'var(--fp-ink-3)',
      fontWeight: 500
    }
  }, "Equations ", /*#__PURE__*/React.createElement("span", {
    className: "fp-mono",
    style: {
      color: 'var(--fp-ink-4)',
      marginLeft: 4
    }
  }, equations.filter(e => e.expr.trim()).length)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      alignItems: 'center'
    }
  }, activeId !== null && !disabled && /*#__PURE__*/React.createElement("button", {
    onPointerDown: e => {
      e.preventDefault();
      setKbVisible(v => !v);
    },
    title: kbVisible ? 'Hide keyboard' : 'Show keyboard',
    style: {
      width: 28,
      height: 28,
      borderRadius: 7,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: kbVisible ? 'var(--fp-surface-2)' : 'transparent',
      color: kbVisible ? 'var(--fp-ink-2)' : 'var(--fp-ink-4)'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: 15,
    height: 15,
    viewBox: "0 0 24 24",
    fill: "none"
  }, /*#__PURE__*/React.createElement("rect", {
    x: 2,
    y: 5,
    width: 20,
    height: 14,
    rx: 2,
    stroke: "currentColor",
    strokeWidth: 1.6
  }), /*#__PURE__*/React.createElement("path", {
    d: "M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M10 13h.01M14 13h.01M8 17h8",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round"
  }))), kbOpen && /*#__PURE__*/React.createElement("button", {
    onPointerDown: e => {
      e.preventDefault();
      dismiss();
    },
    style: {
      fontSize: 12,
      color: 'var(--fp-accent)',
      fontWeight: 500
    }
  }, "Done"), /*#__PURE__*/React.createElement("button", {
    onPointerDown: e => {
      e.preventDefault();
      !disabled && addRow();
    },
    disabled: disabled,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '4px 9px 4px 7px',
      borderRadius: 999,
      background: 'var(--fp-surface-2)',
      color: 'var(--fp-ink)',
      fontSize: 11.5,
      fontWeight: 500,
      opacity: disabled ? 0.5 : 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      lineHeight: 1,
      marginTop: -1
    }
  }, "+"), " Add"))), allowedClass && classWarning && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '8px 14px',
      fontSize: 11.5,
      lineHeight: 1.45,
      background: 'color-mix(in srgb, #e34 14%, transparent)',
      color: '#e34',
      borderTop: '1px solid var(--lv-line)'
    }
  }, classWarning), allowedClass && !classWarning && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '6px 14px',
      fontSize: 11,
      color: 'var(--fp-ink-3)',
      borderTop: '1px solid var(--lv-line)'
    }
  }, "This themed pack only allows ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: 'var(--fp-ink)'
    }
  }, allowedClass), " equations."), /*#__PURE__*/React.createElement("div", {
    className: "fp-scroll",
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 6
    }
  }, equations.map((e, i) => /*#__PURE__*/React.createElement(EqRow, {
    key: e.id,
    idx: i,
    eq: e,
    disabled: disabled,
    notation: notation,
    onChange: p => update(e.id, p),
    onRemove: () => remove(e.id),
    onActivate: ref => activate(e.id, ref),
    domKb: domKb,
    onDomInput: onDomInput
  })), equations.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 16px',
      fontSize: 12,
      color: 'var(--fp-ink-3)'
    }
  }, "Tap ", /*#__PURE__*/React.createElement("strong", null, "Add"), " to enter an equation, e.g. ", /*#__PURE__*/React.createElement("span", {
    className: "fp-mono"
  }, "y=sin(x)"))), kbOpen && !domKb && /*#__PURE__*/React.createElement(MathKeyboard, {
    inputRef: activeInputRef,
    onChange: handleKbChange
  }), domKb && /*#__PURE__*/React.createElement(NumPad, {
    val: domKb.val,
    onChange: handleNumPadChange,
    onDone: handleNumPadDone
  }));
}

// ─── Level screen ─────────────────────────────────────────────
function LevelScreen({
  pack,
  levelIndex,
  progress,
  onBack,
  onComplete,
  onNext,
  density = 'comfortable',
  settings
}) {
  const levelData = getLevelData(pack.id, levelIndex);
  const totalStars = levelData.stars.length;
  const scoreGoal = levelData.scoreGoal ?? 320;
  const eqGoal = levelData.eqGoal ?? 1;
  const soundEnabled = settings?.sound !== false;
  const volume = (settings?.volume ?? 70) / 100;
  const sfx = name => {
    if (soundEnabled && window.FP_AUDIO) window.FP_AUDIO[name]?.(volume);
  };

  // Pre-placed equations come from the level data (admin-authored). They are
  // shown first, can't be removed, and are excluded from score / eqsUsed.
  const [equations, setEquations] = useSL(() => {
    const pre = (levelData.preplaced || []).map((expr, i) => {
      const parsed = parseEquation(expr);
      return {
        id: -(i + 1),
        // negative id so user-added rows (positive) never clash
        expr,
        ...parsed,
        color: EQ_COLORS[i % EQ_COLORS.length],
        visible: true,
        domain: null,
        preplaced: true
      };
    });
    return [...pre, {
      id: 1,
      expr: '',
      fn: null,
      isImplicit: false,
      color: EQ_COLORS[pre.length % EQ_COLORS.length],
      visible: true,
      domain: null,
      preplaced: false
    }];
  });
  const [panelOpen, setPanelOpen] = useSL(true);
  const [running, setRunning] = useSL(false);
  const [ballPos, setBallPos] = useSL({
    ...levelData.ball
  });
  const [simStars, setSimStars] = useSL(levelData.stars.map(s => ({
    ...s,
    collected: false
  })));
  const [collectedCount, setCollectedCount] = useSL(0);
  const [completed, setCompleted] = useSL(null);
  const [missMsg, setMissMsg] = useSL(false);
  const physRef = useRL(null);
  const animRef = useRL(null);
  const equationsRef = useRL(equations);
  equationsRef.current = equations;
  const best = progress?.[pack.id]?.best?.[levelIndex] ?? null;
  const bestTime = progress?.[pack.id]?.bestTime?.[levelIndex] ?? null;
  const prevStars = progress?.[pack.id]?.stars?.[levelIndex] ?? -1;
  // Pre-placed equations don't count toward score / equation-budget.
  const userEquations = equations.filter(e => !e.preplaced);
  const eqsUsed = userEquations.filter(e => e.fn).length;
  const liveScore = computeScore(userEquations);
  const [elapsed, setElapsed] = useSL(0);
  const resetSim = () => {
    setBallPos({
      ...levelData.ball
    });
    setSimStars(levelData.stars.map(s => ({
      ...s,
      collected: false
    })));
    setCollectedCount(0);
    setElapsed(0);
  };
  const [autoZoomTrigger, setAutoZoomTrigger] = useSL(0);
  const [historyOpen, setHistoryOpen] = useSL(false);
  const loadFromHistory = exprs => {
    setHistoryOpen(false);
    setEquations(eqs => {
      const pre = eqs.filter(e => e.preplaced);
      const rows = exprs.map((expr, i) => {
        const parsed = parseEquation(expr);
        return {
          id: i + 1,
          expr,
          ...parsed,
          color: EQ_COLORS[(pre.length + i) % EQ_COLORS.length],
          visible: true,
          domain: null,
          preplaced: false
        };
      });
      return [...pre, ...rows];
    });
  };

  // Themed-pack equation-class enforcement
  const packAllowedClass = (window.getPack ? getPack(pack.id)?.allowedClass : pack.allowedClass) || null;
  const classWarning = useML(() => {
    if (!packAllowedClass) return null;
    const offenders = equations.filter(e => e.fn && !e.preplaced).map(e => ({
      expr: e.expr,
      cls: detectClass(e.expr)
    })).filter(({
      cls
    }) => !classMatches(packAllowedClass, cls));
    if (offenders.length === 0) return null;
    return `Only ${packAllowedClass} equations are allowed in this pack — please remove or change the others.`;
  }, [equations, packAllowedClass]);
  const handlePlay = () => {
    if (running) {
      cancelAnimationFrame(animRef.current);
      setRunning(false);
      resetSim();
      return;
    }
    if (classWarning) {
      setMissMsg(true);
      setTimeout(() => setMissMsg(false), 2200);
      return;
    }
    physRef.current = {
      x: levelData.ball.x,
      y: levelData.ball.y,
      vx: 0,
      vy: 0,
      stars: levelData.stars.map(s => ({
        ...s,
        collected: false
      })),
      lastTs: null,
      acc: 0,
      simS: 0,
      bounced: false,
      justCollected: false,
      wonAtS: null
    };
    setSimStars(levelData.stars.map(s => ({
      ...s,
      collected: false
    })));
    setCollectedCount(0);
    setElapsed(0);
    setCompleted(null);
    setRunning(true);
    if (settings?.autoZoom) setAutoZoomTrigger(t => t + 1);
  };
  const handleReplay = () => {
    setCompleted(null);
    resetSim();
  };
  useEL(() => {
    if (!running) return;
    const ph = physRef.current;
    const dt = TICK_DT / SUB_STEPS;

    // Equations are locked while the sim runs, so colliders are built once
    // per run. Each collider lazily samples + caches curve geometry around
    // the ball and re-samples as the ball travels. Explicit curves first,
    // then implicit — same resolution order as always.
    const activeEqs = equationsRef.current.filter(e => e.fn && e.visible);
    const colliders = FP_PHYSICS.makeColliders([...activeEqs.filter(e => !e.isImplicit), ...activeEqs.filter(e => e.isImplicit)].map(e => ({
      fn: e.fn,
      domain: e.domain,
      isImplicit: e.isImplicit
    })), BALL_R);
    const frame = ts => {
      if (ph.lastTs == null) ph.lastTs = ts;
      ph.acc += Math.min((ts - ph.lastTs) / 1000, MAX_TICKS * TICK_DT);
      ph.lastTs = ts;
      ph.bounced = false;
      ph.justCollected = false;
      while (ph.acc >= TICK_DT) {
        ph.acc -= TICK_DT;
        for (let s = 0; s < SUB_STEPS; s++) physicsStep(ph, colliders, dt);
        ph.simS += TICK_DT;
        // Checked per tick, not per frame, so the recorded finish time has
        // the same resolution however many ticks a frame happens to drain.
        if (ph.wonAtS == null && ph.stars.every(s => s.collected)) ph.wonAtS = ph.simS;
      }
      const elapsedS = ph.simS;
      setElapsed(elapsedS);
      if (ph.bounced) {
        sfx('bounce');
      }
      if (ph.justCollected) {
        sfx('collectStar');
      }
      setBallPos({
        x: ph.x,
        y: ph.y
      });
      const collected = ph.stars.filter(s => s.collected).length;
      setCollectedCount(collected);
      setSimStars([...ph.stars]);

      // wonAtS is locked in above, the instant the last star is collected, so
      // the recorded finish time reflects the player's actual play (not the
      // 0.5s wind-down). The level then ends 0.5s later regardless of where
      // the ball wanders to.
      const wonElapsed = ph.wonAtS != null ? elapsedS - ph.wonAtS : -1;
      const failed = ph.wonAtS == null && (ph.y < FALL_LIMIT || elapsedS > TIME_LIMIT);
      const succeeded = ph.wonAtS != null && wonElapsed >= 0.5;
      if (failed || succeeded) {
        cancelAnimationFrame(animRef.current);
        setRunning(false);
        if (failed) {
          resetSim();
          setMissMsg(true);
          sfx('levelFail');
          setTimeout(() => setMissMsg(false), 1800);
          return;
        }
        const userEqs = equationsRef.current.filter(e => !e.preplaced);
        const exprs = userEqs.filter(e => e.fn).map(e => e.expr);
        const eqsN = exprs.length;
        const sc = computeScore(userEqs);
        const finishT = +ph.wonAtS.toFixed(2);
        const rating = starRating(eqsN, sc, eqGoal, scoreGoal);
        const isNew = best == null || sc < best;
        const isNewT = bestTime == null || finishT < bestTime;
        sfx('levelComplete');
        // Save this successful run to local history so the player can reload
        // their previous equations next time they revisit the level. Stores
        // up to 10 most-recent runs per (packId, levelIndex), de-duplicated
        // by the equation strings.
        try {
          const key = `fp-history-${pack.id}-${levelIndex}`;
          const prev = JSON.parse(localStorage.getItem(key) || '[]');
          const sig = exprs.join('||');
          const entry = {
            exprs,
            score: sc,
            time: finishT,
            stars: rating,
            ts: Date.now()
          };
          const filtered = prev.filter(p => (p.exprs || []).join('||') !== sig);
          const next = [entry, ...filtered].slice(0, 10);
          localStorage.setItem(key, JSON.stringify(next));
        } catch {}
        setCompleted({
          score: sc,
          starsRating: rating,
          prevBest: best,
          isNewBest: isNew,
          time: finishT,
          prevBestTime: bestTime,
          isNewBestTime: isNewT
        });
        onComplete(rating, sc, finishT, exprs);
        return;
      }
      animRef.current = requestAnimationFrame(frame);
    };
    animRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animRef.current);
  }, [running]);
  return /*#__PURE__*/React.createElement("div", {
    className: "fp-screen",
    style: {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 'env(safe-area-inset-top, 0px)',
      flex: '0 0 auto',
      background: 'var(--lv-bg)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 14px 8px',
      flex: '0 0 auto',
      background: 'var(--lv-bg)'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    "aria-label": "Back",
    style: {
      width: 36,
      height: 36,
      borderRadius: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--lv-surface)',
      border: '1px solid var(--lv-line)',
      color: 'var(--fp-ink-2)'
    }
  }, /*#__PURE__*/React.createElement(Icon.Chevron, {
    dir: "left",
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 2,
      minWidth: 0,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: 'var(--fp-ink-3)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      maxWidth: '100%'
    }
  }, pack.type === 'roman' ? `Pack ${pack.numeral}` : getPack(pack.id)?.name || pack.name, " · Level ", levelIndex + 1), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Instrument Serif',Georgia,serif",
      fontStyle: 'italic',
      fontSize: 16,
      lineHeight: 1,
      color: 'var(--fp-ink)',
      letterSpacing: '-0.02em',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      maxWidth: '100%'
    }
  }, getLevelName(pack.id, levelIndex))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      height: 36,
      padding: '0 12px',
      borderRadius: 999,
      border: '1px solid var(--lv-line)',
      background: 'var(--lv-surface)'
    }
  }, /*#__PURE__*/React.createElement(Stars, {
    count: Math.max(0, prevStars),
    total: 3,
    size: 11
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 14px 6px',
      flex: '0 0 auto',
      background: 'var(--lv-bg)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement(HudChip, {
    label: "Score",
    value: eqsUsed > 0 ? liveScore : '—'
  }), /*#__PURE__*/React.createElement(HudChip, {
    label: "Stars",
    value: `${collectedCount}/${totalStars}`
  }), /*#__PURE__*/React.createElement(HudChip, {
    label: "Time",
    value: running ? elapsed.toFixed(1) + 's' : bestTime == null ? '—' : bestTime.toFixed(1) + 's'
  }), /*#__PURE__*/React.createElement("button", {
    onClick: handlePlay,
    style: {
      marginLeft: 'auto',
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      padding: '8px 14px 8px 16px',
      borderRadius: 999,
      background: running ? '#c74440' : 'var(--fp-accent)',
      color: running ? '#fff' : 'var(--fp-accent-ink)',
      fontSize: 13,
      fontWeight: 500
    }
  }, running ? 'Stop' : 'Play', " ", running ? /*#__PURE__*/React.createElement("svg", {
    width: 10,
    height: 10,
    viewBox: "0 0 24 24",
    fill: "currentColor"
  }, /*#__PURE__*/React.createElement("rect", {
    x: 4,
    y: 4,
    width: 6,
    height: 16,
    rx: 1
  }), /*#__PURE__*/React.createElement("rect", {
    x: 14,
    y: 4,
    width: 6,
    height: 16,
    rx: 1
  })) : /*#__PURE__*/React.createElement(Icon.Play, {
    size: 11,
    c: "currentColor"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(GoalChip, {
    stars: 2,
    label: `score ≤ ${scoreGoal}`
  }), /*#__PURE__*/React.createElement(GoalChip, {
    stars: 3,
    label: `≤ ${eqGoal} eq`
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => setHistoryOpen(true),
    disabled: running,
    style: {
      marginLeft: 'auto',
      height: 24,
      padding: '0 10px',
      borderRadius: 999,
      background: 'transparent',
      border: '1px solid var(--lv-line)',
      color: 'var(--fp-ink-2)',
      fontSize: 11,
      fontWeight: 500,
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      opacity: running ? 0.4 : 1
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: 11,
    height: 11,
    viewBox: "0 0 24 24",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })), "History"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      position: 'relative',
      minHeight: 0,
      // Borders kept at 1px (avoids sub-pixel rounding seams between
      // the HUD/equations panel and the plane) but recolored to match
      // the surrounding theme bg so they're invisible.
      borderTop: '1px solid var(--lv-bg)',
      borderBottom: '1px solid var(--lv-bg)'
    }
  }, /*#__PURE__*/React.createElement(PlaneFiller, {
    equations: equations,
    ballPos: ballPos,
    simStars: simStars,
    startPos: levelData.ball,
    autoZoomTrigger: autoZoomTrigger,
    autoZoomEnabled: settings?.autoZoom !== false,
    levelStars: levelData.stars
  }), missMsg && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 8,
      left: 0,
      right: 0,
      display: 'flex',
      justifyContent: 'center',
      pointerEvents: 'none',
      fontSize: 12,
      fontWeight: 500,
      color: '#c74440',
      textShadow: '0 1px 2px rgba(0,0,0,0.35)'
    }
  }, classWarning ? 'Wrong equation type for this pack' : 'Collect all stars!')), /*#__PURE__*/React.createElement(EquationsPanel, {
    equations: equations,
    setEquations: setEquations,
    expanded: panelOpen,
    onToggle: () => setPanelOpen(o => !o),
    disabled: running,
    notation: settings?.notation || 'standard',
    allowedClass: packAllowedClass,
    classWarning: classWarning
  }), completed && /*#__PURE__*/React.createElement(LevelCompletePopup, {
    pack: pack,
    levelIndex: levelIndex,
    starsRating: completed.starsRating,
    score: completed.score,
    prevBest: completed.prevBest,
    isNewBest: completed.isNewBest,
    time: completed.time,
    prevBestTime: completed.prevBestTime,
    isNewBestTime: completed.isNewBestTime,
    totalStars: totalStars,
    onReplay: handleReplay,
    onNext: onNext,
    onClose: () => {
      setCompleted(null);
      resetSim();
    }
  }), historyOpen && /*#__PURE__*/React.createElement(HistoryPopup, {
    packId: pack.id,
    levelIndex: levelIndex,
    onClose: () => setHistoryOpen(false),
    onLoad: loadFromHistory
  }));
}

// ─── History popup ────────────────────────────────────────────────────────
function HistoryPopup({
  packId,
  levelIndex,
  onClose,
  onLoad
}) {
  const key = `fp-history-${packId}-${levelIndex}`;
  let entries = [];
  try {
    entries = JSON.parse(localStorage.getItem(key) || '[]');
  } catch {}
  const fmtAgo = ts => {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  };
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 80,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'flex-end',
      backdropFilter: 'blur(2px)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: '100%',
      background: 'var(--fp-bg)',
      borderRadius: '22px 22px 0 0',
      padding: '18px 0 max(18px, env(safe-area-inset-bottom, 0px))',
      boxShadow: '0 -8px 40px rgba(0,0,0,0.3)',
      maxHeight: '72vh',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 4,
      borderRadius: 2,
      background: 'var(--fp-ink-4)',
      margin: '0 auto 14px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 22px 12px',
      fontFamily: "'Instrument Serif', Georgia, serif",
      fontStyle: 'italic',
      fontSize: 24,
      color: 'var(--fp-ink)',
      letterSpacing: '-0.02em'
    }
  }, "Previous successful runs"), /*#__PURE__*/React.createElement("div", {
    className: "fp-scroll",
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '0 22px'
    }
  }, entries.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '18px 0',
      fontSize: 13,
      color: 'var(--fp-ink-3)',
      textAlign: 'center',
      lineHeight: 1.55
    }
  }, "No completed runs yet.", /*#__PURE__*/React.createElement("br", null), "Solve the level once and your equations will be saved here."), entries.map((e, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      border: '1px solid var(--fp-line)',
      borderRadius: 14,
      padding: '12px 14px',
      marginBottom: 8,
      background: 'var(--fp-surface)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 10,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement(Stars, {
    count: e.stars,
    total: 3,
    size: 11
  }), /*#__PURE__*/React.createElement("span", {
    className: "fp-mono",
    style: {
      fontSize: 12,
      color: 'var(--fp-ink-2)'
    }
  }, e.score, " pts"), /*#__PURE__*/React.createElement("span", {
    className: "fp-mono",
    style: {
      fontSize: 12,
      color: 'var(--fp-ink-3)'
    }
  }, e.time?.toFixed?.(2) ?? '—', "s"), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      fontSize: 11,
      color: 'var(--fp-ink-4)'
    }
  }, fmtAgo(e.ts))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 10,
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, (e.exprs || []).map((expr, j) => /*#__PURE__*/React.createElement("div", {
    key: j,
    className: "fp-mono",
    style: {
      fontSize: 12,
      color: 'var(--fp-ink)',
      background: 'var(--fp-surface-2)',
      borderRadius: 8,
      padding: '5px 9px',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, expr))), /*#__PURE__*/React.createElement("button", {
    onClick: () => onLoad(e.exprs),
    style: {
      width: '100%',
      height: 36,
      borderRadius: 10,
      background: 'var(--fp-ink)',
      color: 'var(--fp-bg)',
      fontSize: 12.5,
      fontWeight: 500
    }
  }, "Load these equations"))))));
}
window.LevelScreen = LevelScreen;
window.parseEquation = parseEquation;
window.computeScore = computeScore;
window.starRating = starRating;
