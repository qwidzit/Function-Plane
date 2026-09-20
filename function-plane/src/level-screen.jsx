// Function Plane — Level Screen

const { useState: useSL, useRef: useRL, useEffect: useEL, useMemo: useML } = React;

const EQ_COLORS = ['#c74440','#2d70b3','#388c46','#6042a6','#fa7e19','#000000'];

const GRAVITY    = 12;
const SUB_STEPS  = 20;
// Simulated seconds advanced per tick. Real elapsed time is accumulated and
// drained in whole ticks, so the sim runs at the same speed and records the
// same finish time on a 30Hz, 60Hz or 120Hz display. Recorded times come from
// tick count, never the wall clock — otherwise a 120Hz phone posts times
// roughly half of a 60Hz phone's for identical play, and the leaderboard
// ranks hardware. At 60Hz this is exactly one tick per frame, i.e. identical
// stepping to before.
const TICK_DT    = 1/60;
// Cap catch-up work after a stall (tab switch, GC pause) so the sim falls
// behind rather than freezing the UI trying to replay lost seconds.
const MAX_TICKS  = 5;
const STAR_R     = 0.55;
// How big a star is *drawn*, in world units — STAR_R over the margin the
// collection radius keeps over the artwork. It used to be 11/40, the size the
// old fixed 11px star had at the default scale, which left the hitbox twice
// the star: aiming looked generous to the point of feeling wrong. At 1.3 the
// hitbox is still forgiving, and now it is visibly so.
const STAR_HIT_MARGIN = 1.3;
const STAR_DRAW_R = STAR_R / STAR_HIT_MARGIN;
const BALL_R     = 0.22;
// Stroke widths, named because the ball's drawn radius has to subtract them:
// an SVG stroke straddles its path, so the curve covers EQ_STROKE/2 px either
// side of the true curve and the ball's outline reaches BALL_OUTLINE/2 px past
// its radius.
const EQ_STROKE    = 2.2;
const BALL_OUTLINE = 1.5;
// Where the world ends. It reaches WORLD_MARGIN past whatever the level
// actually holds — objects, stars and the spawn alike — and WORLD_RADIUS is
// the smallest the surrounding circle may be, not a cap; see makeWorld and
// outOfWorld. A fixed floor was wrong in both directions at once: it let a ball
// sail sideways for as long as the clock allowed, and a pack that turns gravity
// over needed a mirror-image ceiling bolted on to stop the same thing upward.
const WORLD_MARGIN = 10, WORLD_RADIUS = 20;
const TIME_LIMIT = 28;
// Pixels per unit below which a dragged object snaps to a half rather than a
// quarter — see onPointerMove in CoordPlane.
const SNAP_FINE_SCALE = 25;

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
  // A constant is a horizontal or vertical line — still a line.
  if (allowed === 'linear' && detected === 'const') return true;
  return false;
}

// A hidden row is not a collider (makeRunColliders drops it), so it is not
// part of the track and is not charged for either. Rows rebuilt from stored
// history carry no `visible` field and are all live.
function computeScore(equations) {
  const active = equations.filter(e => e.fn && e.visible !== false);
  if (active.length === 0) return 0;
  const complexity = active.reduce((s, e) => s + classifyEquation(e.expr, window.FP_PARAMS), 0);
  return complexity + active.length * 20;
}

// Which stars a run earns, as bits: 1 clearing the level, 2 the score goal,
// 4 the equation goal. Three separate awards, not a ladder — beating the
// equation goal while missing the score goal lights the first and the third
// and leaves the middle one dark. It used to return 3 for that, handing out a
// star the run had not earned.
const STAR_CLEAR = 1, STAR_SCORE = 2, STAR_EQS = 4;
function starRating(eqsUsed, score, eqGoal, scoreGoal) {
  return STAR_CLEAR
       | (score   <= scoreGoal ? STAR_SCORE : 0)
       | (eqsUsed <= eqGoal    ? STAR_EQS   : 0);
}

// ─── Equation parser — explicit y=f(x) or implicit F(x,y)=G(x,y) ────
// Single letters other than x, y and the sum's n are slider parameters. They
// resolve out of FP_PARAMS at call time, not compile time, so dragging a
// slider redraws the curve without recompiling anything.
const PARAM_LETTERS = 'abcdfghijklmopqrstuvwz';
window.FP_PARAMS = window.FP_PARAMS || {};

// Letter runs that are one identifier; every other run is a product of single
// letters, so "ax" is a·x the way it reads on paper. Each "name(" is swapped
// for a private-use character before the splitting happens, so a function
// name can never be torn into variables.
const FN_CALLS = {
  sin:'Math.sin', cos:'Math.cos', tan:'Math.tan',
  asin:'Math.asin', acos:'Math.acos', atan:'Math.atan',
  arcsin:'Math.asin', arccos:'Math.acos', arctan:'Math.atan',
  sqrt:'Math.sqrt', abs:'Math.abs', log:'Math.log', ln:'Math.log',
  exp:'Math.exp', floor:'Math.floor', ceil:'Math.ceil', round:'Math.round',
  max:'Math.max', min:'Math.min', pow:'Math.pow', sgn:'Math.sign',
  sum:'sum', deriv:'deriv', integ:'integ',
};
const FN_NAMES = Object.keys(FN_CALLS).sort((a, b) => b.length - a.length);
const PH_BASE = 0xE000;
const isPH = ch => ch >= '\uE000' && ch <= '\uE0FF';

// Juxtaposition is multiplication: 2x, x(x+1), (x+1)(x-1), 3sin(x).
function implicitMul(s) {
  let out = '';
  for (const c of s) {
    const p = out[out.length - 1];
    if (p !== undefined && !isPH(p) && /[a-zA-Z0-9.π)]/.test(p)
        && (isPH(c) || /[a-zA-Zπ(]/.test(c) || (p === ')' && /[0-9.]/.test(c)))) out += '*';
    out += c;
  }
  return out;
}

// Single letters left in compiled code that aren't x, y or a loop variable.
function freeParams(code) {
  const found = {};
  code.replace(/(^|[^A-Za-z0-9_.])([a-z])(?![A-Za-z0-9_])/g, (m, _pre, ch) => {
    if (PARAM_LETTERS.indexOf(ch) >= 0) found[ch] = 1;
    return m;
  });
  return Object.keys(found);
}

// Returns { code, params } — the JS source and the parameters it reads.
// JS forbids unary minus directly before ** ("-x**2" is a SyntaxError), while
// maths reads -x^2 as -(x^2). Rewriting those spans to -(base**exp) needs the
// base found by matching parentheses rather than by pattern: the regex this
// replaced only understood flat ones, so -(5*(x+1))^3 was handed to JS as
// written, threw, and came back as a broken equation.
function fixUnaryPow(s) {
  const WORD = /[\w.$]/;
  // Where the term ending at i begins: a balanced group, plus the name of the
  // call in front of it if there is one, or a bare identifier or number.
  const termStart = i => {
    let j = i;
    if (s[j - 1] === ')') {
      let depth = 0;
      while (--j >= 0) {
        if (s[j] === ')') depth++;
        else if (s[j] === '(' && --depth === 0) break;
      }
    }
    while (j > 0 && WORD.test(s[j - 1])) j--;
    return j;
  };
  // Where the term starting at i ends, following the whole ** chain: ** is
  // right-associative, so all of 2**3 belongs inside the parens of -x**2**3.
  const termEnd = i => {
    let j = i;
    while (s[j] === '-' || s[j] === '+') j++;
    while (WORD.test(s[j] || '')) j++;
    if (s[j] === '(') {
      for (let depth = 0; j < s.length; j++) {
        if (s[j] === '(') depth++;
        else if (s[j] === ')' && --depth === 0) { j++; break; }
      }
    }
    return s[j] === '*' && s[j + 1] === '*' ? termEnd(j + 2) : j;
  };

  // Right to left, so a span just rewritten is never rescanned.
  for (let i = s.length - 2; i >= 1; i--) {
    if (s[i] !== '*' || s[i + 1] !== '*') continue;
    const b = termStart(i);
    if (b === 0 || s[b - 1] !== '-') continue;
    // Binary minus if a value can sit to its left; only a unary one is the
    // syntax error, and only it means -(x^2) rather than a subtraction.
    const before = s[b - 2];
    if (before !== undefined && (WORD.test(before) || before === ')')) continue;
    const end = termEnd(i + 2);
    s = s.slice(0, b - 1) + '-(' + s.slice(b, end) + ')' + s.slice(end);
    i = b;
  }
  return s;
}

// The keyboard's function keys type "sin(" and leave the closer to the player,
// and the typeset layer draws a half-written expression as perfectly good
// maths — so "y=sin(x" *looked* finished and was rejected outright. Close
// whatever was left open; a surplus ")" is still an error.
function closeParens(s) {
  let depth = 0;
  for (const c of s) {
    if (c === '(') depth++;
    else if (c === ')' && --depth < 0) return s;
  }
  return depth > 0 ? s + ')'.repeat(depth) : s;
}

function normExpr(s) {
  s = s.replace(/\s+/g,'');
  // "pi" is π wherever it isn't glued to other letters. \b cannot see a
  // boundary between a digit and a letter, so 2pi used to compile to p*i —
  // two undeclared parameters — and drew nothing at all.
  s = s.replace(/(^|[^a-zA-Z])pi(?![a-zA-Z])/g, '$1π');
  s = closeParens(s);
  // A function name is the *tail* of a letter run that "(" follows: "asin(" is
  // one name, "xsin(" is x times sin. A \b can't tell those apart — there is
  // no word boundary between two letters — so match the longest known tail.
  const calls = [];
  s = s.replace(/([a-zA-Z]+)\(/g, (m, run) => {
    const fn = FN_NAMES.find(f => run.endsWith(f));
    if (!fn) return m;
    return run.slice(0, run.length - fn.length)
         + String.fromCharCode(PH_BASE + calls.push(fn) - 1);
  });
  s = s.replace(/[a-zA-Z]{2,}/g, run => run.split('').join('*'));
  s = implicitMul(s);
  s = s.replace(/π/g,'(Math.PI)');
  s = s.replace(/\^/g,'**');
  s = s.replace(/[\uE000-\uE0FF]/g, ch => FN_CALLS[calls[ch.charCodeAt(0) - PH_BASE]] + '(');
  s = s.replace(/\be\b/g,'(Math.E)');
  s = fixUnaryPow(s);
  // Higher-order operators — sum, deriv, integ. Expanded *after* all Math.*
  // substitutions so the inner body is already valid JS. Safe (no eval of
  // user-supplied identifiers): the body is wrapped inside a closure that
  // exposes only `n` (sum loop var) or `x` (the integration / derivative
  // variable), and the JS evaluator's strict scope handles the rest.
  const params = freeParams(s);
  s = expandSpecialOps(s);
  return { code: s, params };
}

// Find the first call to `name(args)` in s (with balanced parens) and rewrite
// it via build(args). Returns s unchanged if not found / arg count mismatch.
function expandSpecialOpOnce(s, name, argCount, build) {
  const re = new RegExp(`\\b${name}\\(`);
  const m = re.exec(s);
  if (!m) return s;
  const start = m.index;
  const openParen = start + name.length;
  let depth = 1, i = openParen + 1;
  while (i < s.length && depth > 0) {
    const c = s[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
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
  let depth = 0, last = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) { out.push(str.slice(last, i)); last = i + 1; }
  }
  out.push(str.slice(last));
  return out.map(a => a.trim());
}

function expandSpecialOps(s) {
  let prev, safety = 16;
  do {
    prev = s;
    s = expandSpecialOpOnce(s, 'sum', 3, ([a, b, body]) =>
      // Iteration variable `n` ranges from a..b inclusive. Body sees both
      // n (loop) and x (the equation's free variable). Cap range at 200
      // iterations to keep render time bounded.
      `((function(){let _s=0;const _A=Math.round((${a})),_B=Math.round((${b}));`
      + `const _Lo=Math.min(_A,_B),_Hi=Math.max(_A,_B),_N=Math.min(200,_Hi-_Lo);`
      + `for(let n=_Lo;n<=_Lo+_N;n++){_s+=(${body});}return _s;})())`);
    s = expandSpecialOpOnce(s, 'deriv', 1, ([body]) =>
      // Numeric central-difference derivative w.r.t. x at the outer x.
      `((function(){const _f=function(x){return (${body});};`
      + `const _h=0.001;return (_f(x+_h)-_f(x-_h))/(2*_h);})())`);
    s = expandSpecialOpOnce(s, 'integ', 1, ([body]) =>
      // Definite integral from 0 to outer-x using midpoint rule. N is scaled
      // with |x| (more points for wider intervals) and capped so each render
      // stays under a few thousand evaluations.
      `((function(){const _f=function(x){return (${body});};const _xv=x;`
      + `const _N=Math.min(150,Math.max(8,Math.ceil(Math.abs(_xv)/0.05)));`
      + `const _dx=_xv/_N;let _s=0;`
      + `for(let _i=0;_i<_N;_i++)_s+=_f((_i+0.5)*_dx)*_dx;return _s;})())`);
  } while (s !== prev && --safety > 0);
  return s;
}

const PARAM_DEF_RE = new RegExp(`^([${PARAM_LETTERS}])=(-?\\d+(?:\\.\\d+)?)$`);

// Only the parameters an expression actually reads are pulled in, so the
// hot path stays two property reads rather than twenty-two.
function compileFn(args, params, body) {
  const decl = params.length ? `const{${params.join(',')}}=window.FP_PARAMS||{};` : '';
  return new Function(...args, `${decl}try{return(${body});}catch(e){return NaN;}`);
}

// A shifted curve is the same curve moved: y=f(x−a)+b, or F(x−a, y−b)=0 for
// an implicit one. Done here, on the compiled function, so everything that
// reads eq.fn — the plane, the colliders, a run — moves with it, and nothing
// about the text, its class or its price changes.
function parseEquation(raw, shift) {
  const r = compileEquation(raw);
  const sx = Number(shift?.x) || 0, sy = Number(shift?.y) || 0;
  if (!r.fn || (!sx && !sy)) return r;
  const f = r.fn;
  return { ...r, fn: r.isImplicit ? (x, y) => f(x - sx, y - sy) : x => f(x - sx) + sy };
}

function compileEquation(raw) {
  const none = { fn: null, isImplicit: false, param: null };
  if (!raw || !raw.trim()) return none;
  const eq = raw.trim();

  // "a=3.4" declares a slider parameter instead of a curve. It lands in
  // FP_PARAMS synchronously, so the render this edit triggers already sees
  // the new value through every curve that reads it.
  const pd = PARAM_DEF_RE.exec(eq.replace(/\s+/g, ''));
  if (pd) {
    const value = parseFloat(pd[2]);
    window.FP_PARAMS[pd[1]] = value;
    return { fn: null, isImplicit: false, param: { name: pd[1], value } };
  }

  const eqIdx = eq.indexOf('=');

  if (eqIdx < 0) {
    try {
      const n = normExpr(eq);
      const fn = compileFn(['x'], n.params, n.code);
      fn(0);
      return { fn, isImplicit: false, param: null };
    } catch { return none; }
  }

  const lhs = eq.slice(0, eqIdx).trim();
  const rhs = eq.slice(eqIdx + 1).trim();

  if (lhs === 'y') {
    try {
      const n = normExpr(rhs);
      const fn = compileFn(['x'], n.params, n.code);
      fn(0);
      return { fn, isImplicit: false, param: null };
    } catch { return none; }
  }

  const nL = normExpr(lhs), nR = normExpr(rhs);
  try {
    const fn = compileFn(['x','y'],
      [...new Set([...nL.params, ...nR.params])], `(${nL.code})-(${nR.code})`);
    fn(0, 0);
    return { fn, isImplicit: true, param: null };
  } catch { return none; }
}

// The parameters an expression reads but nothing has declared yet — what the
// "add slider" prompt offers.
function undeclaredParams(raw) {
  if (!raw || !raw.trim()) return [];
  try {
    return normExpr(raw).params.filter(p => !(p in window.FP_PARAMS));
  } catch { return []; }
}

// ─── Marching squares (implicit curve) ───────────────────────
function marchingSquares(fn, xMin, xMax, yMin, yMax, res, m2p) {
  const dx = (xMax - xMin) / res;
  const dy = (yMax - yMin) / res;
  const W = res + 1;
  const vals = new Float32Array(W * W);
  for (let j = 0; j <= res; j++)
    for (let i = 0; i <= res; i++) {
      const v = fn(xMin + i*dx, yMin + j*dy);
      vals[j*W + i] = isFinite(v) ? v : NaN;
    }

  const lerp = (a,b,va,vb) => {
    const d = Math.abs(va) + Math.abs(vb);
    return d < 1e-12 ? (a+b)/2 : a + (b-a)*Math.abs(va)/d;
  };

  const parts = [];
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const vbl = vals[j*W+i], vbr = vals[j*W+i+1];
      const vtr = vals[(j+1)*W+i+1], vtl = vals[(j+1)*W+i];
      if (isNaN(vbl)||isNaN(vbr)||isNaN(vtr)||isNaN(vtl)) continue;
      const cx0 = xMin+i*dx, cx1 = xMin+(i+1)*dx;
      const cy0 = yMin+j*dy, cy1 = yMin+(j+1)*dy;
      const sbl=vbl>0?1:0, sbr=vbr>0?1:0, str=vtr>0?1:0, stl=vtl>0?1:0;
      const crossB=sbl!==sbr, crossR=sbr!==str, crossT=stl!==str, crossL=sbl!==stl;
      const pts = [];
      if (crossB) pts.push(m2p(lerp(cx0,cx1,vbl,vbr),cy0));
      if (crossR) pts.push(m2p(cx1,lerp(cy0,cy1,vbr,vtr)));
      if (crossT) pts.push(m2p(lerp(cx0,cx1,vtl,vtr),cy1));
      if (crossL) pts.push(m2p(cx0,lerp(cy0,cy1,vbl,vtl)));
      const seg=(a,b)=>`M${a.x.toFixed(1)},${a.y.toFixed(1)}L${b.x.toFixed(1)},${b.y.toFixed(1)}`;
      if (pts.length===2) {
        parts.push(seg(pts[0],pts[1]));
      } else if (pts.length===4) {
        const vctr=(vbl+vbr+vtr+vtl)/4;
        if ((vctr>0)===(sbl>0)) { parts.push(seg(pts[0],pts[3])); parts.push(seg(pts[1],pts[2])); }
        else                    { parts.push(seg(pts[0],pts[1])); parts.push(seg(pts[2],pts[3])); }
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
// world = { field, hazards, gravityFlip } — what the level puts on the plane
// besides curves. Built once per run from the level's objects.
function physicsStep(ph, colliders, dt, world) {
  FP_PHYSICS.stepBall(ph, colliders, dt, {
    gravity:         GRAVITY * (ph.gSign || 1),
    ballR:           BALL_R,
    bounciness:      PHYSICS_CONFIG.bounciness,
    energyRetention: PHYSICS_CONFIG.energyRetention,
    traction:        PHYSICS_CONFIG.traction,
    bounceThreshold: 1.5,
    field:           world?.field || null,
  });

  // ── Star collection ────────────────────────────────────────────────────
  for (let i = 0; i < ph.stars.length; i++) {
    if (!ph.stars[i].collected &&
        Math.hypot(ph.x-ph.stars[i].x, ph.y-ph.stars[i].y) < STAR_R+BALL_R) {
      ph.stars[i] = { ...ph.stars[i], collected: true };
      ph.justCollected = true;
    }
  }

  if (world?.hazards?.length && FP_OBJECTS.hazardHit(world.hazards, ph.x, ph.y, BALL_R)) ph.dead = true;
}

// Left the world. The bound is the level's own contents grown by
// WORLD_MARGIN, inside a circle that clears those contents by the same margin:
// a run ends once the ball is further than the margin from everything the
// level holds, or simply too far out for the level to be about anything any
// more. Being radial, it handles a flipped pack without a special case.
function outOfWorld(ph, world) {
  const radius = world?.radius || WORLD_RADIUS;
  if (ph.x * ph.x + ph.y * ph.y > radius * radius) return true;
  const b = world?.bounds;
  if (!b) return false;   // nothing placed: the circle is the whole rule
  const dx = Math.max(b.minX - ph.x, 0, ph.x - b.maxX);
  const dy = Math.max(b.minY - ph.y, 0, ph.y - b.maxY);
  return dx * dx + dy * dy > WORLD_MARGIN * WORLD_MARGIN;
}

// Drains one frame's elapsed time into whole ticks. Shared by the level and
// the studio so a run behaves identically in both.
function drainTicks(ph, colliders, world, ts) {
  if (ph.lastTs == null) ph.lastTs = ts;
  ph.acc += Math.min((ts - ph.lastTs) / 1000, MAX_TICKS * TICK_DT);
  ph.lastTs = ts;
  ph.bounced = false;
  ph.justCollected = false;
  const dt = TICK_DT / SUB_STEPS;
  while (ph.acc >= TICK_DT) {
    ph.acc -= TICK_DT;
    const bounces = ph.bounces;
    for (let s = 0; s < SUB_STEPS; s++) physicsStep(ph, colliders, dt, world);
    // Flipped once per *tick* that saw a real bounce, never per frame: a frame
    // can drain several ticks, and two curves hit in one corner would
    // otherwise flip twice into a no-op.
    if (world?.gravityFlip && ph.bounces !== bounces) ph.gSign = -ph.gSign;
    ph.simS += TICK_DT;
    // Sampled every third tick (20/s): dense enough that a bounce reads as
    // a corner, sparse enough that a full 28s run stays under 200 points.
    if (ph.tick++ % 3 === 0) ph.trail.push({ x: ph.x, y: ph.y });
    // Checked per tick, not per frame, so the recorded finish time has
    // the same resolution however many ticks a frame happens to drain.
    if (ph.wonAtS == null && ph.stars.every(s => s.collected)) ph.wonAtS = ph.simS;
  }
}

// What the level's objects mean to a run: forces, the solid parts curves
// collide against, what kills the ball, and the pack's rule. Built once per
// run, like the colliders.
//
// The stars and the spawn size the world alongside the objects. They used not
// to, which cost a run the level it was on twice over: a star reaching past
// every object sat outside the edge it had to be collected through
// (Constellation's far column missed by 0.05), and a level with no objects had
// no bound but the circle. A star is a point, so its box is one.
//
// One box around the lot, not a box each. A margin around every item
// separately leaves a hole wherever two of them are further apart than two
// margins, and the hole is exactly where the ball has to fly: Tunnel vision
// asks for a star 26 units from the rest of the level and killed the ball
// halfway there, at (7.6, 4.4), with both ends of the journey in bounds.
function makeWorld(objects, gravityFlip, stars, ball) {
  const bounds = [
    ...objects.map(o => FP_OBJECTS.bounds(o)),
    ...[...stars, ball].map(p => ({ minX: p.x, maxX: p.x, minY: p.y, maxY: p.y })),
  ].reduce((a, b) => ({
    minX: Math.min(a.minX, b.minX), maxX: Math.max(a.maxX, b.maxX),
    minY: Math.min(a.minY, b.minY), maxY: Math.max(a.maxY, b.maxY),
  }));
  // How far the level itself reaches from the origin — the circle has to clear
  // that by the margin too, or it cuts inside the box on a wide level.
  const reach = Math.hypot(Math.max(Math.abs(bounds.minX), Math.abs(bounds.maxX)),
                           Math.max(Math.abs(bounds.minY), Math.abs(bounds.maxY)));
  return {
    field:   FP_OBJECTS.makeField(objects, BALL_R),
    solids:  FP_OBJECTS.solidSegs(objects),
    hazards: objects.filter(o => o.kind === 'hazard'),
    // What the world is built around — outOfWorld measures against it.
    bounds,
    radius:  Math.max(WORLD_RADIUS, reach + WORLD_MARGIN),
    gravityFlip: !!gravityFlip,
  };
}

// Curves first, then implicit ones, then the objects' solid parts — the same
// resolution order every run, so a run is reproducible.
function makeRunColliders(equations, world) {
  const active = equations.filter(e => e.fn && e.visible);
  const defs = [...active.filter(e => !e.isImplicit), ...active.filter(e => e.isImplicit)]
    .map(e => ({ fn: e.fn, domain: e.domain, isImplicit: e.isImplicit, material: e.material }));
  if (world.solids.length) defs.push({ segs: world.solids });
  return FP_PHYSICS.makeColliders(defs, BALL_R);
}

// One pixel at the plane's default scale, in world units. The ball starts
// there rather than exactly on its mark so that landing on the apex of a
// circle — or the vertex of a parabola — rolls off instead of balancing
// forever. Fixed in world units, never read off the live zoom: the sim has to
// run the same on every screen for the time leaderboard to mean anything.
const START_NUDGE = 1 / 40;

function freshPh(ball, stars) {
  return {
    x: ball.x + START_NUDGE, y: ball.y, vx: 0, vy: 0,
    stars: stars.map(s => ({ ...s, collected: false })),
    lastTs: null, acc: 0, simS: 0, tick: 0,
    bounced: false, bounces: 0, justCollected: false, gSign: 1, dead: false,
    wonAtS: null, trail: [{ x: ball.x + START_NUDGE, y: ball.y }],
  };
}

// ─── Coordinate plane ─────────────────────────────────────────
function CoordPlane({ width, height, equations, ballPos, simStars, startPos, autoZoomTrigger, autoZoomEnabled, levelStars, trail, editable, selected, onSelect, onMove, gridLabels = true, objects = [], outline = [], gravityDir = null, viewRef = null }) {
  const [view, setView] = useSL({ cx:0, cy:0, scale:40 });
  // The studio places a new object at the centre of whatever the player is
  // looking at, which only the plane knows.
  if (viewRef) viewRef.current = view;

  // The box the last auto-zoom was asked to frame, kept until the player takes
  // manual control of the view. Non-null means "this fit is still mine to
  // maintain".
  const fitRef = useRL(null);

  const applyFit = (box, w, h) => {
    const padX = Math.max(2, (box.maxX - box.minX) * 0.3);
    const padY = Math.max(2, (box.maxY - box.minY) * 0.4);
    const bw = (box.maxX - box.minX) + padX*2;
    const bh = (box.maxY - box.minY) + padY*2;
    const scale = Math.max(8, Math.min(120, Math.min(w / bw, h / bh)));
    setView({ cx: (box.minX + box.maxX) / 2, cy: (box.minY + box.maxY) / 2, scale });
  };

  // Auto-zoom: when Play is pressed (autoZoomTrigger increments), fit the
  // ball start position + all target stars into view.
  useEL(() => {
    if (!autoZoomEnabled || !startPos || !levelStars || width <= 0 || height <= 0) return;
    if (autoZoomTrigger == null) return;
    const xs = [startPos.x, ...levelStars.map(s => s.x)];
    const ys = [startPos.y, ...levelStars.map(s => s.y)];
    for (const o of objects) {
      const b = FP_OBJECTS.bounds(o);
      xs.push(b.minX, b.maxX); ys.push(b.minY, b.maxY);
    }
    const box = {
      minX: Math.min(...xs), maxX: Math.max(...xs),
      minY: Math.min(...ys), maxY: Math.max(...ys),
    };
    fitRef.current = box;
    applyFit(box, width, height);
  }, [autoZoomTrigger]);

  // Pressing Play also closes the equation keyboard, so at the instant the fit
  // above runs the plane is still the squeezed height it had underneath the
  // panel — which fitted the level into a sliver and read as "zoomed way out".
  // Re-fit as the plane grows back into the space the panel gave up.
  useEL(() => {
    if (!fitRef.current || width <= 0 || height <= 0) return;
    applyFit(fitRef.current, width, height);
  }, [width, height]);
  const svgRef    = useRL(null);
  const ptrsRef   = useRL({});
  const panRef    = useRL(null);  // { sx, sy, cx, cy }
  const pinchRef  = useRL(null);  // { dist, midPx, midPy, scale, cx, cy }
  const dragRef   = useRL(null);  // sandbox: { id, ox, oy } of what is being dragged

  const m2p = (mx,my) => ({
    x: width/2  + (mx-view.cx)*view.scale,
    y: height/2 - (my-view.cy)*view.scale,
  });

  const range = useML(() => ({
    xMin: view.cx - width /(2*view.scale),
    xMax: view.cx + width /(2*view.scale),
    yMin: view.cy - height/(2*view.scale),
    yMax: view.cy + height/(2*view.scale),
  }), [view, width, height]);

  const gridStep = useML(() => {
    const t = 40/view.scale;
    const p = Math.pow(10, Math.floor(Math.log10(t)));
    const n = t/p;
    return n<1.5?p : n<3?2*p : n<7?5*p : 10*p;
  }, [view.scale]);

  // Sandbox editing: grab whichever object is under the finger instead of
  // panning. Hit-testing in pixels keeps the target the same physical size at
  // every zoom level, so a star stays grabbable when zoomed far out.
  // Returns { id, ox, oy } — the offset from the finger to the thing's own
  // anchor, so a fan grabbed by its far edge keeps that edge under the finger
  // instead of teleporting its base there.
  const grabAt = (clientX, clientY) => {
    if (!editable) return null;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const px = clientX - rect.left, py = clientY - rect.top;
    const mx = view.cx + (px - width / 2) / view.scale;
    const my = view.cy - (py - height / 2) / view.scale;
    const grab = (id, ax, ay) => ({ id, ox: ax - mx, oy: ay - my });
    const near = (ax, ay) => Math.hypot(px - m2p(ax, ay).x, py - m2p(ax, ay).y) <= 26;
    for (let i = 0; i < (levelStars?.length ?? 0); i++) {
      if (near(levelStars[i].x, levelStars[i].y)) return grab(`star-${i}`, levelStars[i].x, levelStars[i].y);
    }
    if (near(startPos.x, startPos.y)) return grab('ball', startPos.x, startPos.y);
    // Objects are regions, so they're grabbed anywhere inside — in world
    // units, and last, so a star sitting inside a zone stays grabbable.
    for (let i = objects.length - 1; i >= 0; i--) {
      if (FP_OBJECTS.hitTest(objects[i], mx, my)) return grab(`obj-${i}`, objects[i].x, objects[i].y);
    }
    return null;
  };

  const onPointerDown = e => {
    e.currentTarget.setPointerCapture(e.pointerId);
    ptrsRef.current[e.pointerId] = { x: e.clientX, y: e.clientY };
    const ids = Object.keys(ptrsRef.current);
    if (ids.length === 1) {
      const grabbed = grabAt(e.clientX, e.clientY);
      if (grabbed) {
        dragRef.current = grabbed;
        onSelect?.(grabbed.id);
        panRef.current = null;
        pinchRef.current = null;
        return;
      }
      dragRef.current = null;
    }
    if (ids.length === 1) {
      panRef.current  = { sx: e.clientX, sy: e.clientY, cx: view.cx, cy: view.cy };
      pinchRef.current = null;
    } else if (ids.length === 2) {
      const [p1, p2] = Object.values(ptrsRef.current);
      const dist = Math.hypot(p1.x-p2.x, p1.y-p2.y);
      const rect  = svgRef.current?.getBoundingClientRect();
      const midPx = (p1.x+p2.x)/2 - (rect?.left ?? 0);
      const midPy = (p1.y+p2.y)/2 - (rect?.top  ?? 0);
      pinchRef.current = { dist, midPx, midPy, scale: view.scale, cx: view.cx, cy: view.cy };
      panRef.current   = null;
    }
  };

  const onPointerMove = e => {
    if (!ptrsRef.current[e.pointerId]) return;
    ptrsRef.current[e.pointerId] = { x: e.clientX, y: e.clientY };
    const n = Object.keys(ptrsRef.current).length;

    if (dragRef.current) {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const px = e.clientX - rect.left, py = e.clientY - rect.top;
      // Snapped so a drag lands on a round number instead of 2.0713. A
      // quarter is right while a unit is a comfortable distance on screen;
      // zoomed out past 25px per unit it is finer than the finger can aim, so
      // the step doubles rather than pretending to that precision.
      const step = view.scale >= SNAP_FINE_SCALE ? 4 : 2;
      const q = v => Math.round(v * step) / step;
      const { id, ox, oy } = dragRef.current;
      onMove?.(id, {
        x: q(view.cx + (px - width  / 2) / view.scale + ox),
        y: q(view.cy - (py - height / 2) / view.scale + oy),
      });
      return;
    }

    if (n === 1 && panRef.current) {
      const { sx, sy, cx, cy } = panRef.current;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      fitRef.current = null;
      setView(v => ({ ...v, cx: cx - dx/v.scale, cy: cy + dy/v.scale }));
    } else if (n === 2 && pinchRef.current) {
      const [p1, p2] = Object.values(ptrsRef.current);
      const dist = Math.hypot(p1.x-p2.x, p1.y-p2.y);
      const ps   = pinchRef.current;
      const f    = dist / ps.dist;
      const s    = Math.max(8, Math.min(400, ps.scale * f));
      const { midPx, midPy } = ps;
      const mx = ps.cx + (midPx - width/2)  / ps.scale;
      const my = ps.cy - (midPy - height/2) / ps.scale;
      fitRef.current = null;
      setView({ cx: mx - (midPx - width/2)/s, cy: my + (midPy - height/2)/s, scale: s });
    }
  };

  const onPointerUp = e => {
    delete ptrsRef.current[e.pointerId];
    dragRef.current = null;
    const remaining = Object.entries(ptrsRef.current);
    if (remaining.length === 0) {
      panRef.current   = null;
      pinchRef.current = null;
    } else if (remaining.length === 1) {
      const [,p] = remaining[0];
      panRef.current   = { sx: p.x, sy: p.y, cx: view.cx, cy: view.cy };
      pinchRef.current = null;
    }
  };

  const onWheel = e => {
    e.preventDefault();
    const rect = svgRef.current.getBoundingClientRect();
    const px = e.clientX-rect.left, py = e.clientY-rect.top;
    const f = Math.exp(-e.deltaY*0.001);
    fitRef.current = null;
    setView(v => {
      const s = Math.max(8, Math.min(400, v.scale*f));
      const mx = v.cx+(px-width/2)/v.scale, my = v.cy-(py-height/2)/v.scale;
      return { cx:mx-(px-width/2)/s, cy:my+(py-height/2)/s, scale:s };
    });
  };

  // Grid lines
  const lines = [];
  const minor = gridStep, major = gridStep*5;
  for (let x = Math.floor(range.xMin/minor)*minor; x<=range.xMax; x+=minor) {
    const isMj = Math.abs(Math.round(x/major)*major-x) < minor*0.01;
    const px = m2p(x,0).x;
    lines.push(<line key={`v${x.toFixed(5)}`} x1={px} y1={0} x2={px} y2={height}
      stroke={isMj?'var(--lv-grid-major)':'var(--lv-grid-minor)'} strokeWidth={1}/>);
  }
  for (let y = Math.floor(range.yMin/minor)*minor; y<=range.yMax; y+=minor) {
    const isMj = Math.abs(Math.round(y/major)*major-y) < minor*0.01;
    const py = m2p(0,y).y;
    lines.push(<line key={`h${y.toFixed(5)}`} x1={0} y1={py} x2={width} y2={py}
      stroke={isMj?'var(--lv-grid-major)':'var(--lv-grid-minor)'} strokeWidth={1}/>);
  }

  const ax = m2p(0,0);
  const tickLabels = [];
  const ts = major;
  if (gridLabels) {
    for (let x = Math.ceil(range.xMin/ts)*ts; x<=range.xMax; x+=ts) {
      if (Math.abs(x)<ts*0.01) continue;
      const p = m2p(x,0);
      const ty = Math.max(12, Math.min(height-4, ax.y+12));
      tickLabels.push(<text key={`tx${x.toFixed(3)}`} x={p.x} y={ty} fontSize={10}
        fontFamily="ui-monospace,monospace" fill="var(--lv-tick)" textAnchor="middle">
        {gridStep>=1?Math.round(x):x.toFixed(1)}</text>);
    }
    for (let y = Math.ceil(range.yMin/ts)*ts; y<=range.yMax; y+=ts) {
      if (Math.abs(y)<ts*0.01) continue;
      const p = m2p(0,y);
      const tx = Math.max(4, Math.min(width-20, ax.x+6));
      tickLabels.push(<text key={`ty${y.toFixed(3)}`} x={tx} y={p.y+3} fontSize={10}
        fontFamily="ui-monospace,monospace" fill="var(--lv-tick)" textAnchor="start">
        {gridStep>=1?Math.round(y):y.toFixed(1)}</text>);
    }
  }

  // A dead curve is drawn heavy, a rubber one dashed like a spring, so the
  // material reads from the plane and not only from the row's toggle.
  const strokeFor = eq => ({
    strokeWidth: eq.material === 'dead' ? EQ_STROKE + 1.4 : EQ_STROKE,
    strokeDasharray: eq.material === 'rubber' ? '7 4' : undefined,
  });
  const eqPaths = equations.filter(eq => eq.fn && eq.visible).map(eq => {
    if (eq.isImplicit) {
      const implFn = eq.domain
        ? (x,y) => inDomain(x,eq.domain) ? eq.fn(x,y) : NaN
        : eq.fn;
      const d = marchingSquares(implFn, range.xMin, range.xMax, range.yMin, range.yMax, 60, m2p);
      return <path key={eq.id} d={d} stroke={eq.color} {...strokeFor(eq)}
        fill="none" strokeLinecap="round" strokeLinejoin="round"/>;
    }
    let d = '', pen = false, prevY = NaN;
    const step = 2/view.scale;
    for (let x = range.xMin; x <= range.xMax; x += step) {
      if (!inDomain(x, eq.domain)) { pen=false; prevY=NaN; continue; }
      const y = eq.fn(x);
      if (!isFinite(y) || Math.abs(y-prevY)*view.scale>900) { pen=false; prevY=NaN; continue; }
      const p = m2p(x,y);
      d += pen?`L${p.x.toFixed(1)} ${p.y.toFixed(1)}`:`M${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      pen=true; prevY=y;
    }
    return <path key={eq.id} d={d} stroke={eq.color} {...strokeFor(eq)}
      fill="none" strokeLinecap="round" strokeLinejoin="round"/>;
  });

  const objectsEl = objects.map((o, i) => (
    <FP_OBJECTS.LevelObject key={i} o={o} i={i} m2p={m2p} scale={view.scale} selected={selected === `obj-${i}`}/>
  ));

  // The figure a level's stars are arranged in — a list of polylines over star
  // indices, joined faintly so the shape reads as a shape. It is decoration
  // and nothing else: it is not an equation, it never reaches makeColliders,
  // and the ball passes straight through it.
  const outlineEl = outline.length ? (
    <g fill="none" stroke="var(--lv-tick)" strokeWidth={1.2}
       strokeDasharray="3 4" strokeLinecap="round" strokeLinejoin="round" opacity={0.55}>
      {outline.map((path, i) => {
        let d = '';
        for (const idx of path) {
          const s = levelStars[idx];
          if (!s) return null;
          const p = m2p(s.x, s.y);
          d += `${d ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
        }
        return <path key={i} d={d}/>;
      })}
    </g>
  ) : null;

  // Stars are authored at an outer radius of 11 units in the path below, and
  // STAR_DRAW_R is that radius expressed in *world* units, so a star zooms
  // with the plane exactly as the ball and the curves do. Drawing them at a
  // fixed pixel size made them balloon relative to everything else the moment
  // Play framed the level. The floor keeps a star findable when zoomed right
  // out; there is deliberately no ceiling, because "as big as the maths says"
  // is the correct answer when zoomed in.
  const starK = Math.max(5, STAR_DRAW_R * view.scale) / 11;
  const starsEl = simStars.map((s,i) => {
    if (s.collected) return null;
    const p = m2p(s.x,s.y);
    const isSel = selected === `star-${i}`;
    return (
      <g key={i} transform={`translate(${p.x},${p.y}) scale(${starK.toFixed(3)})`}>
        <circle r={14} fill="var(--lv-bg)" opacity={0.65}/>
        {isSel && <circle r={19} fill="none" stroke="var(--lv-star)" strokeWidth={1.4/starK} opacity={0.9}/>}
        <path d="M0 -10 L3 -3 L11 -2 L5 3 L7 11 L0 6 L-7 11 L-5 3 L-11 -2 L-3 -3 Z"
          fill={isSel ? 'var(--lv-star)' : 'none'} fillOpacity={0.25}
          stroke="var(--lv-star)" strokeWidth={1.5/starK} strokeLinejoin="round"/>
      </g>
    );
  });

  const bp = m2p(ballPos.x, ballPos.y);
  const sp = m2p(startPos.x, startPos.y);
  // The physics rests the ball exactly BALL_R from the curve's true centreline,
  // but the curve is *drawn* EQ_STROKE wide about that centreline, so a ball
  // drawn at the full BALL_R*scale visibly sinks into the line by both
  // half-strokes. Subtracting them makes the ball's edge kiss the top of the
  // stroke, which is what "resting on the line" looks like.
  const br = Math.max(3, BALL_R * view.scale - (EQ_STROKE + BALL_OUTLINE) / 2);

  // Where the ball actually went on the last run. A failed attempt otherwise
  // tells the player nothing about why it failed. Drawn as one path with a
  // gradient so the start fades out and the end — the part that matters — is
  // the most visible.
  // Anchored to the path's own ends, not to the ball: a failed run resets the
  // ball to its start, which would collapse the gradient to zero length.
  const trailPath = useML(() => {
    if (!trail || trail.length < 2) return null;
    const pts = trail.map(p => m2p(p.x, p.y));
    const d = pts.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join('');
    const a = pts[0], z = pts[pts.length - 1];
    return { d, x1: a.x, y1: a.y, x2: z.x, y2: z.y };
  }, [trail, view.cx, view.cy, view.scale, width, height]);

  return (
    <div style={{
      position:'relative', width:'100%', height:'100%',
      background:'var(--lv-bg)', overflow:'hidden', touchAction:'none',
      transform:'translateZ(0)', WebkitTransform:'translateZ(0)',
    }} onWheel={onWheel}>
      <svg ref={svgRef} width={width} height={height}
        overflow="hidden"
        style={{ display:'block', cursor:'grab', userSelect:'none' }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        {lines}
        <line x1={0} y1={ax.y} x2={width} y2={ax.y}
          stroke="var(--lv-axis)" strokeWidth={1.4}/>
        <line x1={ax.x} y1={0} x2={ax.x} y2={height}
          stroke="var(--lv-axis)" strokeWidth={1.4}/>
        {gridLabels && (
          <text x={Math.min(ax.x-4,width-4)} y={Math.max(12,ax.y+12)}
            fontSize={10} fontFamily="ui-monospace,monospace"
            fill="var(--lv-tick)" textAnchor="end">0</text>
        )}
        {tickLabels}
        {outlineEl}
        {objectsEl}
        {eqPaths}
        {trailPath && (
          <>
            <defs>
              <linearGradient id="fp-trail" gradientUnits="userSpaceOnUse"
                x1={trailPath.x1} y1={trailPath.y1} x2={trailPath.x2} y2={trailPath.y2}>
                <stop offset="0%"   stopColor="var(--lv-ball)" stopOpacity={0.08}/>
                <stop offset="100%" stopColor="var(--lv-ball)" stopOpacity={0.6}/>
              </linearGradient>
            </defs>
            <path d={trailPath.d} fill="none" stroke="url(#fp-trail)"
              strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"/>
          </>
        )}
        {selected === 'ball' && (
          <circle cx={sp.x} cy={sp.y} r={Math.max(br + 7, 14)}
            fill="none" stroke="var(--lv-ball)" strokeWidth={1.4} opacity={0.9}/>
        )}
        <circle cx={sp.x} cy={sp.y} r={br}
          fill="none" stroke="var(--lv-ball)" strokeWidth={1.5}
          strokeDasharray="3 2" opacity={selected === 'ball' ? 0.8 : 0.35}/>
        {starsEl}
        <g transform={`translate(${bp.x},${bp.y})`}>
          <circle r={br} fill="var(--lv-ball)" stroke="var(--lv-ball-stroke)" strokeWidth={BALL_OUTLINE}/>
          <circle r={br * 0.31} cx={-br * 0.31} cy={-br * 0.31} fill="var(--lv-ball-shine)"/>
          {/* Which way is down right now — only drawn where gravity can flip */}
          {gravityDir != null && (
            <path d={`M-5 ${gravityDir * (br + 5)} L0 ${gravityDir * (br + 11)} L5 ${gravityDir * (br + 5)}`}
              fill="none" stroke="var(--lv-ball)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.85}/>
          )}
        </g>
      </svg>
      <div style={{
        position:'absolute', right:10, bottom:10,
        display:'flex', flexDirection:'column', overflow:'hidden',
        background:'var(--lv-surface)', border:'1px solid var(--lv-line)', borderRadius:10,
      }}>
        <ZBtn onClick={()=>{fitRef.current=null; setView(v=>({...v,scale:Math.min(400,v.scale*1.4)}));}}>+</ZBtn>
        <div style={{height:1,background:'var(--lv-line)'}}/>
        <ZBtn onClick={()=>{fitRef.current=null; setView(v=>({...v,scale:Math.max(6,v.scale/1.4)}));}}>−</ZBtn>
        <div style={{height:1,background:'var(--lv-line)'}}/>
        <ZBtn onClick={()=>{fitRef.current=null; setView({cx:0,cy:0,scale:40});}} sm>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <circle cx={12} cy={12} r={3} stroke="currentColor" strokeWidth={2}/>
            <path d="M12 3V6M12 18V21M3 12H6M18 12H21"
              stroke="currentColor" strokeWidth={2} strokeLinecap="round"/>
          </svg>
        </ZBtn>
      </div>
    </div>
  );
}

function ZBtn({ children, onClick, sm }) {
  return (
    <button onClick={onClick} style={{
      width:34, height:sm?28:32,
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:18, color:'var(--fp-ink)', cursor:'pointer',
    }}>{children}</button>
  );
}

function PlaneFiller({ equations, ballPos, simStars, startPos, autoZoomTrigger, autoZoomEnabled, levelStars, trail, editable, selected, onSelect, onMove, gridLabels = true, objects, outline, gravityDir, viewRef }) {
  const ref = useRL(null);
  const [size, setSize] = useSL({ w:360, h:300 });
  useEL(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(entries => {
      const r = entries[0].contentRect;
      setSize({ w:Math.round(r.width), h:Math.round(r.height) });
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ position:'absolute', inset:0 }}>
      <CoordPlane width={size.w} height={size.h}
        equations={equations} ballPos={ballPos}
        simStars={simStars} startPos={startPos}
        autoZoomTrigger={autoZoomTrigger} autoZoomEnabled={autoZoomEnabled}
        levelStars={levelStars} trail={trail} gridLabels={gridLabels}
        editable={editable} selected={selected} onSelect={onSelect} onMove={onMove}
        objects={objects} outline={outline} gravityDir={gravityDir} viewRef={viewRef}/>
    </div>
  );
}

// ─── HUD chips ────────────────────────────────────────────────
function GoalChip({ bits, label }) {
  return (
    <div style={{
      display:'inline-flex', alignItems:'center', gap:5,
      height:22, padding:'0 8px', borderRadius:6,
      background:'var(--lv-surface)', border:'1px solid var(--lv-line)',
    }}>
      <Stars bits={bits} total={3} size={7} c="var(--lv-star)" empty="var(--fp-ink-4)"/>
      <span className="fp-mono" style={{ fontSize:10, color:'var(--fp-ink-3)' }}>{label}</span>
    </div>
  );
}
function HudChip({ label, value }) {
  return (
    <div style={{
      display:'inline-flex', alignItems:'center', gap:6,
      height:28, padding:'0 10px', borderRadius:8,
      background:'var(--lv-surface)', border:'1px solid var(--lv-line)',
    }}>
      <span style={{ fontSize:9.5, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--fp-ink-3)' }}>{label}</span>
      <span className="fp-mono" style={{ fontSize:12, color:'var(--fp-ink)' }}>{value}</span>
    </div>
  );
}

// ─── Domain editor ────────────────────────────────────────────
// Domain value button — tapping opens the NumPad instead of the native keyboard.
function DomValBtn({ segId, val, domKb, onTap, label }) {
  const isActive = domKb?.id === segId;
  const display  = isActive ? domKb.val : String(val);
  return (
    <button aria-label={label}
      onPointerDown={e => { e.preventDefault(); onTap(); }}
      style={{
        width:52, minHeight:28, fontSize:12, textAlign:'center', padding:'3px 4px',
        background: isActive
          ? 'color-mix(in srgb, var(--fp-accent) 18%, var(--fp-surface))'
          : 'var(--fp-surface)',
        border: `1px solid ${isActive ? 'var(--fp-accent)' : 'var(--lv-line)'}`,
        borderRadius:6, color:'var(--fp-ink)',
        fontFamily:"'Geist Mono','ui-monospace',monospace",
        cursor:'pointer',
      }}>
      {display}
    </button>
  );
}

// eqId scopes each segment's NumPad id. Without it two equations' first
// segments both answer to "0-min", so opening one highlighted and echoed the
// keypad value into every equation's matching field at once.
function DomainEditor({ eqId, domain, disabled, onChange, domKb, onDomInput }) {
  const segs = domain || [];
  const add    = () => !disabled && onChange([...segs, { xMin:-5, xMax:5 }]);
  const remove = i => !disabled && onChange(segs.filter((_,j)=>j!==i));
  const update = (i, k, v) => onChange(segs.map((s,j)=>j===i?{...s,[k]:v}:s));

  return (
    <div style={{ flex:1, minWidth:0 }}>
      {segs.length === 0 && (
        <div style={{ fontSize:11, color:'var(--fp-ink-4)', padding:'7px 0 6px' }}>
          No restriction — the curve exists everywhere.
        </div>
      )}
      {segs.map((seg,i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5 }}>
          <span className="fp-mono" style={{ fontSize:11, color:'var(--fp-ink-3)' }}>x ∈</span>
          <DomValBtn segId={`${eqId}-${i}-min`} val={seg.xMin} domKb={domKb}
            onTap={() => !disabled && onDomInput(`${eqId}-${i}-min`, seg.xMin, v => update(i,'xMin',v))}/>
          <span style={{ fontSize:11, color:'var(--fp-ink-3)' }}>to</span>
          <DomValBtn segId={`${eqId}-${i}-max`} val={seg.xMax} domKb={domKb}
            onTap={() => !disabled && onDomInput(`${eqId}-${i}-max`, seg.xMax, v => update(i,'xMax',v))}/>
          <button onClick={()=>remove(i)} style={{ color:'var(--fp-ink-3)', fontSize:16, lineHeight:1, padding:'0 4px' }}>×</button>
        </div>
      ))}
      <button onClick={add} style={{
        fontSize:11.5, color:'var(--fp-accent)', fontWeight:500, padding:'2px 0',
      }}>+ Add segment</button>
    </div>
  );
}

// ─── Number pad (for domain segment values) ───────────────────
// Value-based (no DOM ref needed): the current string value is passed in,
// and onChange receives the updated string. The parent commits to state.
function NumPad({ val, label = 'x-value', onChange, onDone }) {
  const { start: holdStart, stop: holdStop } = useKeyRepeat();
  // Held backspace repeats, so it must read the *current* value each tick — a
  // closure over `val` would delete the same character forever.
  const valRef = useRL(val);
  valRef.current = val;

  const ins = ch => {
    // The minus toggles the sign rather than being typed. It used to be
    // accepted only into an empty field, and the field opens holding the
    // value it is editing — so reaching -0.5 meant clearing first, and the
    // minus you pressed on "0" simply vanished.
    if (ch === '-') { onChange(val.startsWith('-') ? val.slice(1) : '-' + val); return; }
    onChange(val + ch);
  };
  const del = () => onChange(valRef.current.slice(0, -1));
  const clr = () => onChange('');

  const ROWS = [
    [{ lbl:'7', act:()=>ins('7'), t:'num' }, { lbl:'8', act:()=>ins('8'), t:'num' },
     { lbl:'9', act:()=>ins('9'), t:'num' }, { lbl:'⌫', act:del, t:'del' }],
    [{ lbl:'4', act:()=>ins('4'), t:'num' }, { lbl:'5', act:()=>ins('5'), t:'num' },
     { lbl:'6', act:()=>ins('6'), t:'num' }, { lbl:'−', act:()=>ins('-'), t:'op' }],
    [{ lbl:'1', act:()=>ins('1'), t:'num' }, { lbl:'2', act:()=>ins('2'), t:'num' },
     { lbl:'3', act:()=>ins('3'), t:'num' }, { lbl:'CLR', act:clr, t:'util' }],
    [{ lbl:'0', act:()=>ins('0'), t:'num' }, { lbl:'.', act:()=>ins('.'), t:'num' },
     null,
     { lbl:'Done', act:onDone, t:'nav' }],
  ];

  const bg = t => {
    if (t === 'num')  return 'var(--fp-surface)';
    if (t === 'del')  return 'var(--fp-surface-2)';
    if (t === 'util') return 'var(--fp-surface-2)';
    if (t === 'nav')  return 'var(--fp-accent)';
    return 'var(--lv-bg)';
  };
  const fg = t => t === 'nav' ? 'var(--fp-accent-ink)' : 'var(--fp-ink)';

  return (
    <div style={{
      background:'var(--fp-surface)', borderTop:'1px solid var(--lv-line)',
      padding:'4px 5px', paddingBottom:'max(5px, env(safe-area-inset-bottom, 0px))',
      userSelect:'none', WebkitUserSelect:'none', touchAction:'manipulation',
      flexShrink:0,
    }}>
      <div style={{ padding:'4px 4px 6px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontSize:10, color:'var(--fp-ink-3)', letterSpacing:'0.08em', textTransform:'uppercase' }}>
          {label}
        </span>
        <span style={{ fontFamily:"'Geist Mono','ui-monospace',monospace", fontSize:15,
          color: val ? 'var(--fp-ink)' : 'var(--fp-ink-4)', minWidth:50, textAlign:'right' }}>
          {val || 'empty'}
        </span>
      </div>
      {ROWS.map((row, ri) => (
        <div key={ri} style={{ display:'flex', gap:3, marginBottom: ri < ROWS.length-1 ? 3 : 0 }}>
          {row.map((k, ki) => k ? (
            <button key={ki}
              onPointerDown={e => {
                e.preventDefault();
                if (k.t === 'del') holdStart(k.act); else k.act();
              }}
              onPointerUp={holdStop}
              onPointerCancel={holdStop}
              onPointerLeave={holdStop}
              style={{
                flex:1, height:38, borderRadius:7,
                fontSize: k.lbl.length > 3 ? 10 : 13,
                fontWeight: k.t === 'nav' ? 600 : 400,
                background: bg(k.t), border:'1px solid var(--lv-line)',
                color: fg(k.t), cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
              {k.lbl}
            </button>
          ) : (
            <div key={ki} style={{ flex:1 }}/>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Equation row ─────────────────────────────────────────────
// Three states, one button: how the curve returns the ball. Drawn as the ball
// over a floor with the arc it would take, so the state reads without words.
// The three states have names, because the hints and the explainer cards use
// them: `dead` is steel and `rubber` is rubber. The stored values stay as they
// are — run history and every saved level are written in terms of them.
const MAT_OPTS = [
  { v: null,     label: 'Normal', title: 'Bounce: normal' },
  { v: 'dead',   label: 'Steel',  title: 'Steel — the ball lands and rolls' },
  { v: 'rubber', label: 'Rubber', title: 'Rubber — the ball keeps all its speed' },
];
function MaterialIcon({ m }) {
  const arc = m === 'dead' ? null : m === 'rubber' ? 'M4 13 Q8 -1 12 13' : 'M4 13 Q8 6 12 13';
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <path d="M1.5 13.5H14.5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round"/>
      {arc && <path d={arc} stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeDasharray="2 1.5"/>}
      <circle cx={4} cy={m === 'dead' ? 11 : 10.5} r={2.4} fill="currentColor"/>
    </svg>
  );
}

// Everything about a curve that is not its equation: bounce (where the level
// allows it), where it is moved to, and where it exists. Opens in the row in
// place of the field, with the equation kept in view above, so the numbers,
// the equation and the curve stay on screen together.
const SHIFT_STEP = 0.5;
function EqSettings({ eq, onChange, disabled, materialsOn, domKb, onDomInput }) {
  const shift = eq.shift || { x: 0, y: 0 };
  const setShift = (k, v) => {
    const next = { ...shift, [k]: Math.round(v * 100) / 100 };
    onChange({ shift: next.x || next.y ? next : null });
  };
  const label = { fontSize:10, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--fp-ink-3)',
    width:52, flex:'0 0 52px' };
  const nudge = (k, d) => (
    <button onPointerDown={e=>{e.preventDefault(); if (!disabled) setShift(k, shift[k] + d);}}
      aria-label={`${k} ${d > 0 ? 'plus' : 'minus'}`} style={{
      width:26, height:28, borderRadius:6, border:'1px solid var(--lv-line)',
      background:'var(--fp-surface)', color:'var(--fp-ink-2)', fontSize:15, lineHeight:1,
    }}>{d > 0 ? '+' : '−'}</button>
  );
  return (
    <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:8, padding:'8px 8px 8px 0' }}>
      <div style={{ fontFamily:"'Geist Mono','ui-monospace',monospace", fontSize:13, color:'var(--fp-ink-2)',
        whiteSpace:'nowrap', overflow:'hidden', display:'flex', alignItems:'center', minHeight:22 }}>
        <MathExpr src={eq.expr}/>
      </div>
      {materialsOn && (
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={label}>Bounce</span>
          <div style={{ display:'flex', flex:1, minWidth:0, gap:3 }}>
            {MAT_OPTS.map(o => {
              const on = (eq.material || null) === o.v;
              return (
                <button key={o.label} title={o.title}
                  onPointerDown={e=>{e.preventDefault(); if (!disabled) onChange({ material: o.v });}}
                  style={{
                    flex:1, minWidth:0, height:28, borderRadius:6, display:'flex', alignItems:'center',
                    justifyContent:'center', gap:4, fontSize:11, fontWeight:500,
                    border:`1px solid ${on ? 'var(--fp-accent)' : 'var(--lv-line)'}`,
                    background: on ? 'color-mix(in srgb, var(--fp-accent) 16%, var(--fp-surface))' : 'var(--fp-surface)',
                    color: on ? 'var(--fp-accent)' : 'var(--fp-ink-2)',
                  }}>
                  <MaterialIcon m={o.v}/>{o.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {/* One axis per line: both on one would not fit a phone beside the row's buttons. */}
      <div style={{ display:'flex', alignItems:'flex-start', gap:6 }}>
        <span style={{ ...label, paddingTop:7 }} title="Moves the whole curve: y=f(x−a)+b">Move</span>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {['x', 'y'].map(k => (
            <div key={k} style={{ display:'flex', alignItems:'center', gap:3 }}>
              <span className="fp-mono" style={{ fontSize:11, color:'var(--fp-ink-3)', width:12 }}>{k}</span>
              {nudge(k, -SHIFT_STEP)}
              <DomValBtn segId={`${eq.id}-shift-${k}`} val={shift[k]} domKb={domKb} label={`move along ${k}`}
                onTap={() => !disabled && onDomInput(`${eq.id}-shift-${k}`, shift[k], v => setShift(k, v), `move along ${k}`)}/>
              {nudge(k, SHIFT_STEP)}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'flex-start', gap:6 }}>
        <span style={{ ...label, paddingTop:7 }}>Domain</span>
        <DomainEditor eqId={eq.id} domain={eq.domain} disabled={disabled}
          onChange={domain => onChange({ domain: domain.length ? domain : null })}
          domKb={domKb} onDomInput={onDomInput}/>
      </div>
    </div>
  );
}

function EqRow({ idx, eq, onChange, onRemove, disabled, onActivate, domKb, onDomInput, missing, onAddSliders, materialsOn }) {
  const [settingsOpen, setSettingsOpen] = useSL(false);
  const [focused, setFocused] = useSL(false);
  const [, bump] = useSL(0);
  const valid = !eq.expr.trim() || eq.fn != null || !!eq.param;
  const locked = !!eq.preplaced;
  const slots = missing || [];

  // The field is the source of truth while it is being edited; eq.expr is
  // what it last wrote. A change that arrives from anywhere else — the
  // slider rewriting a=1.0, a loaded run — is re-read into it.
  const onChangeRef = useRL(onChange);
  onChangeRef.current = onChange;
  const emitted = useRL(eq.expr);
  const fieldRef = useRL(null);
  if (!fieldRef.current) {
    fieldRef.current = new MathField(eq.expr, () => {
      bump(t => t + 1);
      const text = fieldRef.current.text();
      if (text === emitted.current) return;
      emitted.current = text;
      onChangeRef.current({ expr: text });
    });
  }
  const field = fieldRef.current;
  if (eq.expr !== emitted.current) { emitted.current = eq.expr; field.setText(eq.expr); }

  return (
    <div style={{ borderTop:'1px solid var(--lv-line)',
      background: locked ? 'color-mix(in srgb, var(--fp-ink) 4%, transparent)' : 'transparent' }}>
      <div style={{ display:'flex', alignItems:'stretch' }}>
        <button onPointerDown={e=>{e.preventDefault(); !disabled && !eq.param && onChange({ visible:!eq.visible });}}
          style={{ width:36, flex:'0 0 36px', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <span style={{
            width:20, height:20, borderRadius:'50%',
            background: eq.param ? 'transparent' : (eq.visible ? eq.color : 'transparent'),
            border:`1.5px solid ${eq.param ? 'var(--fp-ink-4)' : eq.color}`,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:10, fontWeight:600, fontFamily:'ui-monospace,monospace',
            color: eq.param ? 'var(--fp-ink-3)' : (eq.visible ? '#fff' : eq.color),
          }}>{eq.param ? eq.param.name : idx+1}</span>
        </button>

        {settingsOpen && !locked && !eq.param ? (
          <EqSettings eq={eq} onChange={onChange} disabled={disabled} materialsOn={materialsOn}
            domKb={domKb} onDomInput={onDomInput}/>
        ) : locked ? (
          <div style={{ flex:1, minWidth:0, display:'flex', alignItems:'center', minHeight:38, padding:'8px 0',
            fontFamily:"'Geist Mono','ui-monospace',monospace", fontSize:14, color:'var(--fp-ink-2)',
            overflow:'hidden', whiteSpace:'nowrap' }}>
            <MathExpr src={eq.expr}/>
          </div>
        ) : (
          <MathFieldView field={field} focused={focused} disabled={disabled}
            // Half-written is not wrong: an expression only reads as an
            // error once you have stopped typing it.
            color={(valid || focused) ? 'var(--fp-ink)' : '#c74440'}
            placeholder={<span style={{ color:'var(--fp-ink-4)' }}>e.g.  <MathExpr src="y=sin(x)"/></span>}
            onFocus={() => { setFocused(true); if (!disabled) onActivate(field); }}
            onBlur={() => setFocused(false)}
            onDone={() => field.blur()}/>
        )}

        {!locked && !eq.param && (
          // Lit while open, and while anything in it is set, so a moved or cut
          // curve says so from the row.
          <button onPointerDown={e=>{e.preventDefault(); field.blur(); setSettingsOpen(o=>!o);}}
            title={settingsOpen ? 'Back to the equation' : 'Curve settings: bounce, move, domain'}
            aria-label="Curve settings"
            style={{
              width:32, flex:'0 0 32px', display:'flex', alignItems:'center', justifyContent:'center',
              color: settingsOpen || eq.material || eq.shift || eq.domain ? 'var(--fp-accent)' : 'var(--fp-ink-4)',
            }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor">
              <circle cx={5} cy={12} r={2.1}/><circle cx={12} cy={12} r={2.1}/><circle cx={19} cy={12} r={2.1}/>
            </svg>
          </button>
        )}

        <button
          onPointerDown={e=>{e.preventDefault(); if (locked || disabled) return; onRemove();}}
          style={{ width:34, flex:'0 0 34px', display:'flex', alignItems:'center', justifyContent:'center',
            color: locked ? 'var(--fp-ink-4)' : 'var(--fp-ink-3)', cursor: locked ? 'default' : 'pointer' }}
          title={locked ? 'Pre-placed by the level designer — locked' : 'Remove equation'}>
          {locked
            ? <Icon.Lock size={12} c="currentColor"/>
            : <svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round"/>
              </svg>
          }
        </button>
      </div>

      {eq.param && (
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0 12px 9px 36px' }}>
          <span className="fp-mono" style={{ fontSize:10.5, color:'var(--fp-ink-4)' }}>−10</span>
          <input type="range" min={-10} max={10} step={0.1} value={eq.param.value} disabled={disabled}
            onChange={e => onChange({ expr: `${eq.param.name}=${(+e.target.value).toFixed(1)}` })}
            style={{ flex:1, minWidth:0, height:20, accentColor:'var(--fp-accent)' }}/>
          <span className="fp-mono" style={{ fontSize:10.5, color:'var(--fp-ink-4)' }}>10</span>
        </div>
      )}

      {!eq.param && slots.length > 0 && (
        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap',
          padding:'0 12px 9px 36px' }}>
          <span style={{ fontSize:11, color:'var(--fp-ink-3)' }}>add slider:</span>
          {slots.map(nm => (
            <button key={nm} onPointerDown={e=>{e.preventDefault(); onAddSliders([nm]);}} style={{
              minWidth:26, height:24, padding:'0 8px', borderRadius:6,
              border:'1px solid var(--lv-line)', background:'var(--fp-surface)',
              color:'var(--fp-ink)', fontSize:12.5,
              fontFamily:"'Geist Mono','ui-monospace',monospace",
            }}>{nm}</button>
          ))}
          {slots.length > 1 && (
            <button onPointerDown={e=>{e.preventDefault(); onAddSliders(slots);}} style={{
              height:24, padding:'0 10px', borderRadius:6, border:0,
              background:'var(--fp-accent)', color:'var(--fp-accent-ink)',
              fontSize:11.5, fontWeight:500,
            }}>all</button>
          )}
        </div>
      )}

    </div>
  );
}

// ─── Equations panel ──────────────────────────────────────────
// One row per placed object: its kind, and every number the registry says it
// has, each opening the NumPad. Tapping the row selects it on the plane.
function ObjRow({ idx, o, selected, disabled, onSelect, onRemove, onField, domKb, onDomInput }) {
  const K = FP_OBJECTS.KINDS[o.kind];
  return (
    <div style={{ borderTop:'1px solid var(--lv-line)',
      background: selected ? 'color-mix(in srgb, var(--fp-accent) 10%, transparent)' : 'transparent' }}>
      <div style={{ display:'flex', alignItems:'center' }}>
        <button onPointerDown={e=>{e.preventDefault(); onSelect();}}
          style={{ flex:1, minWidth:0, display:'flex', alignItems:'center', gap:8, padding:'9px 12px', textAlign:'left' }}>
          <span style={{ width:11, height:11, borderRadius:3, background:K.color, flex:'0 0 11px' }}/>
          <span style={{ fontSize:13, color:'var(--fp-ink)' }}>{K.label}</span>
          <span className="fp-mono" style={{ fontSize:10.5, color:'var(--fp-ink-4)' }}>#{idx+1}</span>
        </button>
        <button onPointerDown={e=>{e.preventDefault(); if (!disabled) onRemove();}} title="Remove"
          style={{ width:34, flex:'0 0 34px', display:'flex', alignItems:'center', justifyContent:'center',
            color:'var(--fp-ink-3)', opacity: disabled ? 0.4 : 1 }}>
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none">
            <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round"/>
          </svg>
        </button>
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:'6px 10px', padding:'0 12px 10px 31px' }}>
        {K.fields.map(f => (
          <div key={f.k} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ fontSize:10.5, color:'var(--fp-ink-3)' }}>{f.label}</span>
            <DomValBtn segId={`obj-${idx}-${f.k}`} val={o[f.k]} domKb={domKb} label={`${K.label} #${idx+1} ${f.label}`}
              onTap={() => !disabled && onDomInput(`obj-${idx}-${f.k}`, o[f.k], v => onField(f.k, v), f.label)}/>
          </div>
        ))}
      </div>
    </div>
  );
}

// objects/setObjects turn on the Objects tab (the studio); extraTab is one
// more tab with arbitrary content (the admin's level settings).
function EquationsPanel({ equations, setEquations, expanded, onToggle, disabled, allowedClass, classWarning,
                          materialsOn, objects, setObjects, selectedObj, onSelectObj, placeAt, extraTab,
                          suppressKeyboard }) {
  const activeFieldRef = useRL(null);
  const [activeId,  setActiveId]  = useSL(null);
  const [kbVisible, setKbVisible] = useSL(true);
  const [tab, setTab] = useSL('eq');   // 'eq' | 'obj' | 'extra'
  // Hidden is a third state below "collapsed": the whole panel drops away so
  // the plane is the screen, and only the tab that brings it back is left.
  const [hidden, setHidden] = useSL(false);
  const objectsEditable = !!setObjects;
  // suppressKeyboard is the studio saying it has a keypad of its own open;
  // two custom keyboards covering each other is the one thing this panel must
  // never do.
  const kbOpen = tab === 'eq' && activeId !== null && !disabled && kbVisible && !hidden && !suppressKeyboard;

  // Domain value keyboard (NumPad) — active when user taps a domain-segment field.
  // null = closed; { id, val } = open with current string value.
  const [domKb, setDomKb] = useSL(null);
  const domKbCommitRef    = useRL(null); // current commit fn (number → void)

  const onDomInput = (id, currentVal, commit, label) => {
    domKbCommitRef.current = commit;
    setDomKb({ id, val: String(currentVal), label });
  };

  const handleNumPadChange = v => {
    setDomKb(d => ({ ...d, val: v }));
    const n = parseFloat(v);
    if (!isNaN(n) && domKbCommitRef.current) domKbCommitRef.current(n);
  };

  const handleNumPadDone = () => {
    const n = parseFloat(domKb?.val);
    if (!isNaN(n) && domKbCommitRef.current) domKbCommitRef.current(n);
    setDomKb(null);
    domKbCommitRef.current = null;
  };

  const anyKbOpen = ((kbOpen && !domKb) || domKb !== null) && !suppressKeyboard;

  const activate = (id, field) => {
    activeFieldRef.current = field;
    setActiveId(id);
    setKbVisible(true);
  };
  const dismiss = () => { setActiveId(null); activeFieldRef.current?.blur(); };
  const switchTab = id => { if (id !== 'eq') dismiss(); setDomKb(null); setTab(id); };
  const hide = () => { dismiss(); setDomKb(null); setHidden(true); };

  const eqCount  = equations.filter(e => e.expr.trim() && !e.param && e.visible !== false).length;

  const addObject = kind => {
    if (disabled) return;
    setObjects(objs => [...objs, FP_OBJECTS.makeObject(kind, placeAt?.())]);
    onSelectObj?.(`obj-${objects.length}`);
  };
  const setObjField = (i, k, v) => setObjects(objs => objs.map((o, j) => j === i ? FP_OBJECTS.setField(o, k, v) : o));
  const removeObject = i => {
    setObjects(objs => objs.filter((_, j) => j !== i));
    onSelectObj?.(null);
  };

  const addRow = () => setEquations(eqs => {
    const id = Math.max(0,...eqs.map(e=>e.id)) + 1;
    return [...eqs, { id, expr:'', fn:null, isImplicit:false, color:EQ_COLORS[eqs.length%EQ_COLORS.length], visible:true, domain:null }];
  });

  const update = (id, patch) => setEquations(eqs => eqs.map(e => {
    if (e.id !== id) return e;
    if (e.preplaced && 'expr' in patch) return e;  // can't edit pre-placed
    const merged = { ...e, ...patch };
    if ('expr' in patch || 'shift' in patch) {
      Object.assign(merged, parseEquation(merged.expr, merged.shift));
      // Editing "a=3" into something else retires the parameter, or every
      // curve reading `a` would keep the value of a row that is gone.
      if (e.param && merged.param?.name !== e.param.name) delete window.FP_PARAMS[e.param.name];
    }
    return merged;
  }));

  // Slider rows land directly under the equation that asked for them, the
  // way Desmos does it.
  const addSliders = (afterId, names) => setEquations(eqs => {
    let id = Math.max(0, ...eqs.map(e => e.id));
    const rows = names.map(nm => {
      const expr = `${nm}=1`;
      return { id: ++id, expr, ...parseEquation(expr),
        color: EQ_COLORS[0], visible: true, domain: null, preplaced: false };
    });
    const at = eqs.findIndex(e => e.id === afterId);
    return at < 0 ? [...eqs, ...rows] : [...eqs.slice(0, at+1), ...rows, ...eqs.slice(at+1)];
  });

  const remove = id => setEquations(eqs => eqs.filter(e => {
    if (e.id !== id || e.preplaced) return true;
    if (e.param) delete window.FP_PARAMS[e.param.name];
    return false;
  }));

  if (hidden) {
    return (
      <div style={{
        background:'var(--lv-surface)', borderTop:'1px solid var(--lv-line)',
        flex:'0 0 auto', paddingBottom:'env(safe-area-inset-bottom, 0px)',
      }}>
        <button onPointerDown={e=>{e.preventDefault(); setHidden(false);}}
          aria-label="Show equations" style={{
            width:'100%', height:38, display:'flex', alignItems:'center',
            justifyContent:'center', gap:8, color:'var(--fp-ink-2)',
          }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <path d="M6 15l6-6 6 6" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize:11, letterSpacing:'0.08em', textTransform:'uppercase', fontWeight:500 }}>
            Equations <span className="fp-mono" style={{ color:'var(--fp-ink-4)' }}>{eqCount}</span>
            {objectsEditable && <> · Objects <span className="fp-mono" style={{ color:'var(--fp-ink-4)' }}>{objects.length}</span></>}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div style={{
      background:'var(--lv-surface)', borderTop:'1px solid var(--lv-line)',
      display:'flex', flexDirection:'column', overflow:'hidden',
      // With a keyboard open the cap is raised so rows and keyboard both fit
      // (the plane above shrinks to accommodate) — but it stays a cap, because
      // removing it let the panel grow with every equation until the keyboard
      // was off the bottom of the screen. A share of the *screen*, not of the
      // window: #root is capped at 844px on a desktop-width viewport, where
      // 80vh overflowed it and pushed the keypad past the edge. 62% rather
      // than 80% because the point of opening a keyboard is to watch what
      // typing does to the curve.
      maxHeight: anyKbOpen ? '62%' : (expanded ? 300 : 188),
      transition: anyKbOpen ? 'none' : 'max-height .2s ease',
    }}>
      {/* Handle */}
      <button onClick={onToggle} style={{ height:22, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:36, height:4, borderRadius:2, background:'var(--fp-ink-4)' }}/>
      </button>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6, padding:'0 12px 8px' }}>
        {(objectsEditable || extraTab) ? (
          // The studio puts three tabs left of the same controls, which is more
          // than a narrow phone has room for: below about 400px the row ran off
          // the edge and took Add equation with it. The strip takes whatever is
          // left over and scrolls; the controls never shrink, because a button
          // you cannot reach is worse than a label you have to scroll to.
          <div className="fp-scroll" style={{ display:'flex', gap:3, minWidth:0, overflowX:'auto' }}>
            {[{ id:'eq', label:'Equations', n: eqCount },
              ...(objectsEditable ? [{ id:'obj', label:'Objects', n: objects.length }] : []),
              ...(extraTab ? [{ id:'extra', label: extraTab.label }] : [])].map(t => (
              <button key={t.id} onPointerDown={e=>{e.preventDefault(); switchTab(t.id);}} style={{
                padding:'4px 6px', borderRadius:999, fontSize:10, letterSpacing:'0.02em', textTransform:'uppercase', fontWeight:500,
                flex:'0 0 auto', whiteSpace:'nowrap',
                background: tab === t.id ? 'var(--fp-ink)' : 'transparent',
                color: tab === t.id ? 'var(--fp-bg)' : 'var(--fp-ink-3)',
                border: `1px solid ${tab === t.id ? 'var(--fp-ink)' : 'var(--lv-line)'}`,
              }}>{t.label}{t.n != null && <span className="fp-mono" style={{ marginLeft:3, opacity:0.7 }}>{t.n}</span>}</button>
            ))}
          </div>
        ) : (
          <div style={{ fontSize:11, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--fp-ink-3)', fontWeight:500 }}>
            Equations <span className="fp-mono" style={{ color:'var(--fp-ink-4)', marginLeft:4 }}>
              {eqCount}
            </span>
          </div>
        )}
        <div style={{ display:'flex', gap:3, alignItems:'center', flex:'0 0 auto' }}>
          {tab === 'eq' && activeId !== null && !disabled && (
            <button onPointerDown={e=>{e.preventDefault(); setKbVisible(v=>!v);}}
              title={kbVisible ? 'Hide keyboard' : 'Show keyboard'}
              style={{
                width:28, height:28, borderRadius:7,
                display:'flex', alignItems:'center', justifyContent:'center',
                background: kbVisible ? 'var(--fp-surface-2)' : 'transparent',
                color: kbVisible ? 'var(--fp-ink-2)' : 'var(--fp-ink-4)',
              }}>
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                <rect x={2} y={5} width={20} height={14} rx={2} stroke="currentColor" strokeWidth={1.6}/>
                <path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M10 13h.01M14 13h.01M8 17h8"
                  stroke="currentColor" strokeWidth={1.6} strokeLinecap="round"/>
              </svg>
            </button>
          )}
          {kbOpen && (
            <button onPointerDown={e=>{e.preventDefault(); dismiss();}}
              style={{ fontSize:12, color:'var(--fp-accent)', fontWeight:500 }}>
              Done
            </button>
          )}
          <button onPointerDown={e=>{e.preventDefault(); hide();}}
            title="Hide panel" aria-label="Hide panel" style={{
              width:28, height:28, borderRadius:7,
              display:'flex', alignItems:'center', justifyContent:'center',
              color:'var(--fp-ink-3)',
            }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none">
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {tab === 'eq' && <button onPointerDown={e=>{e.preventDefault(); !disabled && addRow();}} disabled={disabled}
            title="Add equation" aria-label="Add equation" style={{
            width:30, height:30, borderRadius:'50%',
            display:'flex', alignItems:'center', justifyContent:'center',
            background:'var(--fp-accent)', color:'var(--fp-accent-ink)',
            opacity:disabled?0.45:1, boxShadow:'0 1px 3px rgba(0,0,0,0.18)',
          }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"/>
            </svg>
          </button>}
        </div>
      </div>

      {/* Every list below is `1 1 auto`, never flex:1 — a zero basis contributes
          nothing to the panel's own height, so the panel sized itself to header
          plus keypad and the rows underneath collapsed to a sliver. */}
      {tab === 'obj' && (
        <div className="fp-scroll" style={{ flex:'1 1 auto', minHeight:0, overflowY:'auto', paddingBottom:6 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', padding:'2px 12px 10px' }}>
            <span style={{ fontSize:11, color:'var(--fp-ink-3)' }}>Add</span>
            {FP_OBJECTS.KIND_ORDER.map(kind => (
              <button key={kind} onPointerDown={e=>{e.preventDefault(); addObject(kind);}} disabled={disabled} style={{
                display:'flex', alignItems:'center', gap:6, padding:'5px 10px', borderRadius:999,
                border:'1px solid var(--lv-line)', background:'var(--fp-surface)', color:'var(--fp-ink)',
                fontSize:12, fontWeight:500, opacity: disabled ? 0.5 : 1,
              }}>
                <span style={{ width:9, height:9, borderRadius:2, background:FP_OBJECTS.KINDS[kind].color }}/>
                {FP_OBJECTS.KINDS[kind].label}
              </button>
            ))}
          </div>
          {objects.map((o, i) => (
            <ObjRow key={i} idx={i} o={o} disabled={disabled} selected={selectedObj === `obj-${i}`}
              onSelect={() => onSelectObj?.(selectedObj === `obj-${i}` ? null : `obj-${i}`)}
              onRemove={() => removeObject(i)} onField={(k, v) => setObjField(i, k, v)}
              domKb={domKb} onDomInput={onDomInput}/>
          ))}
          {objects.length === 0 && (
            <div style={{ padding:'6px 16px 14px', fontSize:12, color:'var(--fp-ink-3)', lineHeight:1.5 }}>
              Tap a kind to place it at the centre of the view. Drag it on the plane, or edit its numbers here.
            </div>
          )}
        </div>
      )}

      {tab === 'extra' && (
        <div className="fp-scroll" style={{ flex:'1 1 auto', minHeight:0, overflowY:'auto', paddingBottom:6 }}>
          {extraTab.content}
        </div>
      )}

      {/* Allowed-class banner for themed packs */}
      {tab === 'eq' && allowedClass && classWarning && (
        <div style={{
          padding: '8px 14px', fontSize: 11.5, lineHeight: 1.45,
          background: 'color-mix(in srgb, #e34 14%, transparent)',
          color: '#e34', borderTop: '1px solid var(--lv-line)',
        }}>{classWarning}</div>
      )}
      {tab === 'eq' && allowedClass && !classWarning && (
        <div style={{
          padding: '6px 14px', fontSize: 11, color: 'var(--fp-ink-3)',
          borderTop: '1px solid var(--lv-line)',
        }}>This themed pack only allows <strong style={{ color:'var(--fp-ink)' }}>{allowedClass}</strong> equations.</div>
      )}

      {/* Rows */}
      {tab === 'eq' && (
        <div className="fp-scroll" style={{ flex:'1 1 auto', minHeight:0, overflowY:'auto', paddingBottom:6 }}>
          {equations.map((e,i) => (
            <EqRow key={e.id} idx={i} eq={e} disabled={disabled}
              onChange={p=>update(e.id,p)} onRemove={()=>remove(e.id)}
              onActivate={field=>activate(e.id,field)}
              missing={undeclaredParams(e.expr)} onAddSliders={nms=>addSliders(e.id,nms)}
              materialsOn={materialsOn}
              domKb={domKb} onDomInput={onDomInput}/>
          ))}
          {equations.length === 0 && (
            <div style={{ padding:'14px 16px', fontSize:12, color:'var(--fp-ink-3)' }}>
              Tap <strong>+</strong> to enter an equation, e.g. <MathExpr src="y=sin(x)"/>
            </div>
          )}
        </div>
      )}

      {/* Custom keyboard — math for equations, numpad for domain values */}
      {kbOpen && !domKb && <MathKeyboard field={activeFieldRef} onDone={dismiss}/>}
      {domKb && <NumPad val={domKb.val} label={domKb.label} onChange={handleNumPadChange} onDone={handleNumPadDone}/>}
    </div>
  );
}

// ─── Level screen ─────────────────────────────────────────────
function LevelScreen({ pack, levelIndex, progress, onBack, onComplete, onNext, density='comfortable', settings }) {
  const levelData  = getLevelData(pack.id, levelIndex);
  const totalStars = levelData.stars.length;
  const scoreGoal  = levelData.scoreGoal ?? 320;
  const eqGoal     = levelData.eqGoal    ?? 1;

  const soundEnabled   = settings?.sound   !== false;
  const volume         = (settings?.volume ?? 70) / 100;

  const sfx = (name) => { if (soundEnabled && window.FP_AUDIO) window.FP_AUDIO[name]?.(volume); };

  // Pre-placed equations come from the level data (admin-authored). They are
  // shown first, can't be removed, and are excluded from score / eqsUsed.
  const [equations, setEquations] = useSL(() => {
    window.FP_PARAMS = {};   // sliders belong to the level being played
    const pre = (levelData.preplaced || []).map((expr, i) => {
      const parsed = parseEquation(expr);
      return {
        id: -(i + 1),  // negative id so user-added rows (positive) never clash
        expr, ...parsed,
        color: EQ_COLORS[i % EQ_COLORS.length],
        visible: true, domain: null,
        preplaced: true,
      };
    });
    return [
      ...pre,
      { id:1, expr:'', fn:null, isImplicit:false, color:EQ_COLORS[pre.length % EQ_COLORS.length], visible:true, domain:null, preplaced: false },
    ];
  });
  const [panelOpen, setPanelOpen] = useSL(true);
  const [running,   setRunning]   = useSL(false);
  const [ballPos,   setBallPos]   = useSL({ ...levelData.ball });
  const [simStars,  setSimStars]  = useSL(levelData.stars.map(s=>({...s,collected:false})));
  const [collectedCount, setCollectedCount] = useSL(0);
  const [completed,  setCompleted]  = useSL(null);
  // false | true (missed) | 'hazard'
  const [missMsg,    setMissMsg]    = useSL(false);
  // Which way gravity points, for the HUD and the arrow on the ball. Only
  // shown where the pack can flip it.
  const gravityFlip = !!(window.getPack ? getPack(pack.id)?.modifier === 'gravityFlip' : pack.modifier === 'gravityFlip');
  const [gravityDir, setGravityDir] = useSL(1);
  // Path of the last run, kept on screen after it ends so a miss is readable.
  const [trail,      setTrail]      = useSL(null);

  const physRef      = useRL(null);
  const animRef      = useRL(null);
  const equationsRef = useRL(equations);
  equationsRef.current = equations;

  const best      = progress?.[pack.id]?.best?.[levelIndex]      ?? null;
  const bestTime  = progress?.[pack.id]?.bestTime?.[levelIndex]  ?? null;
  const prevStars = progress?.[pack.id]?.stars?.[levelIndex]     ?? -1;
  const prevBits  = prevStars > 0
    ? starBitsOf(prevStars, progress?.[pack.id]?.starBits?.[levelIndex]) : 0;
  // Pre-placed equations don't count toward score / equation-budget.
  const userEquations = equations.filter(e => !e.preplaced);
  const eqsUsed   = userEquations.filter(e => e.fn && e.visible !== false).length;
  const liveScore = computeScore(userEquations);
  const [elapsed, setElapsed] = useSL(0);

  const resetSim = () => {
    setBallPos({ ...levelData.ball });
    setSimStars(levelData.stars.map(s=>({...s,collected:false})));
    setCollectedCount(0);
    setElapsed(0);
    setGravityDir(1);
  };

  const [autoZoomTrigger, setAutoZoomTrigger] = useSL(0);
  const [historyOpen, setHistoryOpen] = useSL(false);
  const [hintOpen,    setHintOpen]    = useSL(false);
  // Everything this level still has to teach, oldest debt first. Shown one
  // after another on the first visit, then never again.
  const [tips, setTips] = useSL(() => pendingTutorials(levelData));
  const closeTip = () => {
    const done = tips[0];
    setTips(t => t.slice(1));
    if (done) { try { localStorage.setItem(`fp-tip-${done.key}`, '1'); } catch {} }
  };

  const loadFromHistory = (exprs, mats = [], shifts = []) => {
    setHistoryOpen(false);
    setEquations(eqs => {
      const pre = eqs.filter(e => e.preplaced);
      let curve = 0;
      const rows = exprs.map((expr, i) => {
        // mats and shifts are aligned to the curves, not to the slider rows
        // ahead of them.
        const isCurve = !!compileEquation(expr).fn;
        const shift = isCurve ? (shifts[curve] || null) : null;
        const material = isCurve ? (mats[curve++] || null) : null;
        return {
          id: i + 1, expr, ...parseEquation(expr, shift), material, shift,
          color: EQ_COLORS[(pre.length + i) % EQ_COLORS.length],
          visible: true, domain: null, preplaced: false,
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
      expr: e.expr, cls: detectClass(e.expr, window.FP_PARAMS),
    })).filter(({ cls }) => !classMatches(packAllowedClass, cls));
    if (offenders.length === 0) return null;
    return offenders.length === 1
      ? `One equation is not ${packAllowedClass}.`
      : `${offenders.length} equations are not ${packAllowedClass}.`;
  }, [equations, packAllowedClass]);

  const handlePlay = () => {
    if (running) {
      cancelAnimationFrame(animRef.current);
      setRunning(false);
      resetSim();
      // Keep the path, exactly as a run that ended on its own does. Stopping
      // early is usually *because* the ball went somewhere unexpected, which
      // is precisely when seeing where it went is worth most.
      setTrail(physRef.current?.trail?.length > 1 ? physRef.current.trail : null);
      return;
    }
    if (classWarning) {
      setMissMsg(true);
      setTimeout(() => setMissMsg(false), 2200);
      return;
    }
    physRef.current = freshPh(levelData.ball, levelData.stars);
    setGravityDir(1);
    setSimStars(levelData.stars.map(s=>({...s,collected:false})));
    setCollectedCount(0);
    setElapsed(0);
    setCompleted(null);
    setTrail(null);
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

    // Equations are locked while the sim runs, so colliders are built once
    // per run. Each curve collider lazily samples + caches geometry around
    // the ball and re-samples as it travels.
    const world = makeWorld(levelData.objects, gravityFlip, levelData.stars, levelData.ball);
    const colliders = makeRunColliders(equationsRef.current, world);

    const frame = ts => {
      drainTicks(ph, colliders, world, ts);
      const elapsedS = ph.simS;
      setElapsed(elapsedS);
      if (gravityFlip) setGravityDir(ph.gSign);

      if (ph.bounced) { sfx('bounce'); }
      if (ph.justCollected) { sfx('collectStar'); }

      setBallPos({ x:ph.x, y:ph.y });
      const collected = ph.stars.filter(s=>s.collected).length;
      setCollectedCount(collected);
      setSimStars([...ph.stars]);

      // wonAtS is locked in above, the instant the last star is collected, so
      // the recorded finish time reflects the player's actual play (not the
      // 0.5s wind-down). The level then ends 0.5s later regardless of where
      // the ball wanders to.
      const wonElapsed = ph.wonAtS != null ? (elapsedS - ph.wonAtS) : -1;
      const failed = ph.wonAtS == null && (ph.dead || outOfWorld(ph, world) || elapsedS > TIME_LIMIT);
      const succeeded = ph.wonAtS != null && wonElapsed >= 0.5;
      if (failed || succeeded) {
        cancelAnimationFrame(animRef.current);
        setRunning(false);
        setTrail(ph.trail);

        if (failed) {
          resetSim();
          setMissMsg(ph.dead ? 'hazard' : true);
          sfx('levelFail');
          setTimeout(()=>setMissMsg(false), 1800);
          return;
        }

        const userEqs  = equationsRef.current.filter(e => !e.preplaced);
        const curves   = userEqs.filter(e => e.fn && e.visible !== false);
        const eqsN     = curves.length;
        // Slider definitions ride along, first, so reloading the run — or
        // auditing it — resolves the parameters the player actually graphed
        // with. They are not equations and don't count toward eqsN.
        const exprs    = [...userEqs.filter(e => e.param).map(e => e.expr),
                          ...curves.map(e => e.expr)];
        const sc       = computeScore(userEqs);
        const finishT  = +ph.wonAtS.toFixed(2);
        const rating   = starRating(eqsN, sc, eqGoal, scoreGoal);
        const isNew    = best == null || sc < best;
        const isNewT   = bestTime == null || finishT < bestTime;

        sfx('levelComplete');
        // The run goes into progress, not into a localStorage key of its own,
        // so it rides the same merge and upload every other score does and is
        // still there after a reinstall or on another device.
        const runEntry = {
          exprs, mats: curves.map(e => e.material || null), shifts: curves.map(e => e.shift || null),
          score: sc, time: finishT, stars: starCount(rating), bits: rating,
          ts: Date.now(),
        };
        setCompleted({
          score: sc, starBits: rating,
          prevBest: best, isNewBest: isNew,
          time: finishT, prevBestTime: bestTime, isNewBestTime: isNewT,
        });
        onComplete(rating, sc, finishT, exprs, runEntry);
        return;
      }
      animRef.current = requestAnimationFrame(frame);
    };

    animRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animRef.current);
  }, [running]);

  return (
    <div className="fp-screen" style={{
      width:'100%', height:'100%', display:'flex', flexDirection:'column',
      position:'relative',
    }}>
      <div style={{ height:'env(safe-area-inset-top, 0px)', flex:'0 0 auto', background:'var(--lv-bg)' }}/>

      {/* Top bar */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'10px 14px 8px', flex:'0 0 auto', background:'var(--lv-bg)',
      }}>
        <button onClick={onBack} aria-label="Back" style={{
          width:36, height:36, borderRadius:10,
          display:'flex', alignItems:'center', justifyContent:'center',
          background:'var(--lv-surface)', border:'1px solid var(--lv-line)', color:'var(--fp-ink-2)',
        }}>
          <Icon.Chevron dir="left" size={18}/>
        </button>

        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, minWidth:0, flex:1 }}>
          <div style={{ fontSize:10, letterSpacing:'0.1em', textTransform:'uppercase',
            color:'var(--fp-ink-3)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'100%' }}>
            {pack.type==='roman'?`Pack ${pack.numeral}`:(getPack(pack.id)?.name || pack.name)} · Level {levelIndex+1}
          </div>
          <div style={{ fontFamily:"'Instrument Serif',Georgia,serif", fontStyle:'italic',
            fontSize:16, lineHeight:1, color:'var(--fp-ink)', letterSpacing:'-0.02em',
            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'100%' }}>
            {getLevelName(pack.id, levelIndex)}
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:6,
          height:36, padding:'0 12px', borderRadius:999,
          border:'1px solid var(--lv-line)', background:'var(--lv-surface)' }}>
          <Stars bits={prevBits} total={3} size={11}/>
        </div>
      </div>

      {/* HUD */}
      <div style={{ padding:'0 14px 6px', flex:'0 0 auto', background:'var(--lv-bg)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
          <HudChip label="Score" value={eqsUsed>0?liveScore:'—'}/>
          <HudChip label="Stars" value={`${collectedCount}/${totalStars}`}/>
          <HudChip label="Time"  value={running ? elapsed.toFixed(1)+'s' : (bestTime==null?'—':bestTime.toFixed(1)+'s')}/>
          {gravityFlip && <HudChip label="g" value={gravityDir < 0 ? '↑' : '↓'}/>}
          <button onClick={handlePlay} style={{
            marginLeft:'auto',
            display:'flex', alignItems:'center', gap:7,
            padding:'8px 14px 8px 16px', borderRadius:999,
            background: running?'#c74440':'var(--fp-accent)',
            color: running?'#fff':'var(--fp-accent-ink)',
            fontSize:13, fontWeight:500,
          }}>
            {running?'Stop':'Play'} {running
              ? <svg width={10} height={10} viewBox="0 0 24 24" fill="currentColor">
                  <rect x={4} y={4} width={6} height={16} rx={1}/>
                  <rect x={14} y={4} width={6} height={16} rx={1}/>
                </svg>
              : <Icon.Play size={11} c="currentColor"/>}
          </button>
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <GoalChip bits={STAR_SCORE} label={`score ≤ ${scoreGoal}`}/>
          <GoalChip bits={STAR_EQS}   label={`≤ ${eqGoal} eq`}/>
          <button onClick={() => setHistoryOpen(true)} disabled={running} style={{
            marginLeft: 'auto',
            height: 24, padding: '0 10px', borderRadius: 999,
            background: 'transparent', border: '1px solid var(--lv-line)',
            color: 'var(--fp-ink-2)', fontSize: 11, fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: 5,
            opacity: running ? 0.4 : 1,
          }}>
            <svg width={11} height={11} viewBox="0 0 24 24" fill="none">
              <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            History
          </button>
        </div>
      </div>

      {/* Plane */}
      <div style={{
        flex:1, position:'relative', minHeight:0,
        // Borders kept at 1px (avoids sub-pixel rounding seams between
        // the HUD/equations panel and the plane) but recolored to match
        // the surrounding theme bg so they're invisible.
        borderTop:'1px solid var(--lv-bg)', borderBottom:'1px solid var(--lv-bg)',
      }}>
        <PlaneFiller
          equations={equations} ballPos={ballPos}
          simStars={simStars} startPos={levelData.ball}
          autoZoomTrigger={autoZoomTrigger} autoZoomEnabled={settings?.autoZoom !== false}
          gridLabels={settings?.gridLabels !== false}
          levelStars={levelData.stars} trail={trail}
          objects={levelData.objects} outline={levelData.outline}
          gravityDir={gravityFlip && running ? gravityDir : null}/>
        {/* Floating on the plane, opposite the zoom stack: the two goal chips
            plus History already fill their row, and a fourth chip wrapped it
            onto a second line. */}
        {!pack.noHints && <button onClick={() => setHintOpen(true)} disabled={running} aria-label="Hint" style={{
          position:'absolute', left:10, bottom:10,
          width:34, height:34, borderRadius:10,
          display:'flex', alignItems:'center', justifyContent:'center',
          background:'var(--lv-surface)', border:'1px solid var(--lv-line)',
          color:'var(--fp-ink)', opacity: running ? 0.4 : 1,
        }}>
          <svg width={17} height={17} viewBox="0 0 24 24" fill="none">
            <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.5.4.8 1 .9 1.6h5.4c.1-.6.4-1.2.9-1.6A6 6 0 0 0 12 3z"
              stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>}
        {missMsg && (
          <div style={{
            position:'absolute', top:8, left:0, right:0,
            display:'flex', justifyContent:'center', pointerEvents:'none',
            fontSize:12, fontWeight:500, color:'#c74440',
            textShadow:'0 1px 2px rgba(0,0,0,0.35)',
          }}>
            {classWarning ? 'Wrong equation type for this pack' : missMsg === 'hazard' ? 'The ball hit a hazard' : 'Collect all stars!'}
          </div>
        )}
      </div>

      {/* Equations panel */}
      <EquationsPanel
        equations={equations} setEquations={setEquations}
        expanded={panelOpen} onToggle={()=>setPanelOpen(o=>!o)}
        disabled={running}
        materialsOn={levelData.materials}
        allowedClass={packAllowedClass}
        classWarning={classWarning}/>

      {/* Completion popup */}
      {completed && (
        <LevelCompletePopup
          pack={pack} levelIndex={levelIndex}
          starBits={completed.starBits}
          score={completed.score}
          prevBest={completed.prevBest}
          isNewBest={completed.isNewBest}
          time={completed.time}
          prevBestTime={completed.prevBestTime}
          isNewBestTime={completed.isNewBestTime}
          onReplay={handleReplay}
          onNext={onNext}
          onClose={()=>{ setCompleted(null); resetSim(); }}/>
      )}

      {historyOpen && (
        <HistoryPopup
          entries={progress?.[pack.id]?.history?.[levelIndex] || []}
          onClose={() => setHistoryOpen(false)}
          onLoad={loadFromHistory}/>
      )}

      {hintOpen && <HintPopup hint={levelData.hint} onClose={() => setHintOpen(false)}/>}

      {tips.length > 0 && <TutorialPopup tip={tips[0].tip} onClose={closeTip}/>}
    </div>
  );
}

// ─── Tutorial popup ───────────────────────────────────────────────────────
// A small deck: what the thing is, what it does to the ball, and how to use
// it. The X closes it on the first page for a player who already knows, and
// the last page turns the Next button into the one that finishes — so there
// is always exactly one obvious way forward.
function TutorialPopup({ tip, onClose }) {
  const [page, setPage] = useSL(0);
  // Where a drag began, so a horizontal one turns the page. Cards that step
  // sideways invite a swipe whether or not one is offered, and the Next button
  // is a long reach from the thumb that is already on the picture.
  const swipeRef = useRL(null);
  const n = tip?.pages?.length || 0;
  const go = d => setPage(p => Math.max(0, Math.min(n - 1, p + d)));
  const onDown = e => { swipeRef.current = { x: e.clientX, y: e.clientY }; };
  const onUp = e => {
    const s = swipeRef.current;
    swipeRef.current = null;
    if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    go(dx < 0 ? 1 : -1);
  };
  if (!n) return null;
  const last = page === n - 1;
  const p = tip.pages[page];
  return (
    <div onClick={onClose} style={{
      position:'absolute', inset:0, zIndex:85,
      background:'rgba(0,0,0,0.5)',
      display:'flex', alignItems:'flex-end',
      backdropFilter:'blur(2px)',
    }}>
      <div onClick={e => e.stopPropagation()}
        onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => { swipeRef.current = null; }}
        style={{
          width:'100%', background:'var(--fp-bg)',
          borderRadius:'22px 22px 0 0',
          padding:'14px 22px max(18px, env(safe-area-inset-bottom, 0px))',
          boxShadow:'0 -8px 40px rgba(0,0,0,0.3)',
          touchAction:'pan-y',
        }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
          <div style={{
            width:36, height:36, borderRadius:10, flex:'0 0 36px',
            background:tip.color + '18', color:tip.color,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>{tip.icon}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{
              fontFamily:"'Instrument Serif', Georgia, serif", fontStyle:'italic',
              fontSize:23, color:'var(--fp-ink)', letterSpacing:'-0.02em',
              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
            }}>{tip.title}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{
            width:32, height:32, borderRadius:'50%', flex:'0 0 32px',
            display:'flex', alignItems:'center', justifyContent:'center',
            background:'var(--fp-surface-2)', color:'var(--fp-ink-3)',
          }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none">
              <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {p.art}

        <div style={{ fontSize:14, fontWeight:500, color:'var(--fp-ink)', marginBottom:5 }}>{p.heading}</div>
        <div style={{ fontSize:13.5, color:'var(--fp-ink-3)', lineHeight:1.65, minHeight:72 }}>{p.body}</div>

        <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:16 }}>
          <div style={{ display:'flex', gap:6, flex:'0 0 auto' }}>
            {tip.pages.map((_, i) => (
              <button key={i} onClick={() => setPage(i)} aria-label={`Page ${i+1}`} style={{
                width:7, height:7, borderRadius:'50%', padding:0,
                background: i === page ? tip.color : 'var(--fp-ink-4)',
                opacity: i === page ? 1 : 0.45,
              }}/>
            ))}
          </div>
          <button onClick={() => last ? onClose() : go(1)} style={{
            flex:1, height:44, borderRadius:12,
            background: last ? 'var(--fp-accent)' : 'var(--fp-surface-2)',
            color: last ? 'var(--fp-accent-ink)' : 'var(--fp-ink)',
            fontSize:14, fontWeight:500,
          }}>{last ? 'Got it' : 'Next'}</button>
        </div>
      </div>
    </div>
  );
}

// Which decks this level owes the player, in the order they meet them: the
// objects on the plane first — a new kind explains itself, so no one has to
// remember to set a level's `explain` — then whatever mechanic the level was
// authored to introduce. Seen-ness is per device and deliberately not part of
// progress: it is a reading state, not something worth syncing or restoring.
// Admins are the people writing these decks, and a card you can only look at
// again by clearing site data is a card nobody proofreads. For them it is not
// a reading state at all: every deck runs on every visit. The flag is still
// written, so the moment an account stops being an admin it picks up where the
// stored state left off.
const tutorialSeen = key => {
  if (window.FP_AUTH?.isAdmin?.()) return false;
  try { return !!localStorage.getItem(`fp-tip-${key}`); } catch { return false; }
};
function pendingTutorials(levelData) {
  const out = [];
  const seenKinds = {};
  for (const o of levelData.objects || []) {
    const tip = window.FP_OBJECT_TUTORIALS?.[o.kind];
    if (!tip || seenKinds[o.kind] || tutorialSeen(o.kind)) continue;
    seenKinds[o.kind] = 1;
    out.push({ key: o.kind, tip });
  }
  const ex = levelData.explain;
  if (ex && !tutorialSeen(ex) && window.FP_EXPLAINERS?.[ex]) out.push({ key: ex, tip: FP_EXPLAINERS[ex] });
  return out;
}

// ─── Hint popup ───────────────────────────────────────────────
// What kind of function the level was built around — never the numbers, so a
// hint points at the shape of the answer and leaves the puzzle standing.
function HintPopup({ hint, onClose }) {
  return (
    <div onClick={onClose} style={{
      position:'absolute', inset:0, zIndex:82,
      background:'rgba(0,0,0,0.5)',
      display:'flex', alignItems:'flex-end',
      backdropFilter:'blur(2px)',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width:'100%', background:'var(--fp-bg)',
        borderRadius:'22px 22px 0 0',
        padding:'18px 22px max(18px, env(safe-area-inset-bottom, 0px))',
        boxShadow:'0 -8px 40px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{
            width:42, height:42, borderRadius:12, flex:'0 0 42px',
            background:'color-mix(in srgb, var(--fp-accent) 15%, transparent)', color:'var(--fp-accent)',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <svg width={21} height={21} viewBox="0 0 24 24" fill="none">
              <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.5.4.8 1 .9 1.6h5.4c.1-.6.4-1.2.9-1.6A6 6 0 0 0 12 3z"
                stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:10.5, letterSpacing:'0.1em', textTransform:'uppercase',
              color:'var(--fp-ink-3)', marginBottom:3 }}>Hint</div>
            <div style={{
              fontFamily:"'Instrument Serif', Georgia, serif", fontStyle:'italic',
              fontSize:28, lineHeight:1.05, letterSpacing:'-0.02em',
              color: hint ? 'var(--fp-ink)' : 'var(--fp-ink-4)',
            }}>{hint || 'No hint'}</div>
          </div>
        </div>
        <button onClick={onClose} style={{
          width:'100%', height:44, borderRadius:12, marginTop:18,
          background:'var(--fp-surface-2)', color:'var(--fp-ink)',
          fontSize:14, fontWeight:500,
        }}>Close</button>
      </div>
    </div>
  );
}

// ─── History popup ────────────────────────────────────────────────────────
// Successful runs ride in the progress blob, so they merge and upload with
// every other score and are still there on the next device.
function HistoryPopup({ entries = [], onClose, onLoad }) {

  const fmtAgo = ts => {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s/60) + 'm ago';
    if (s < 86400) return Math.floor(s/3600) + 'h ago';
    return Math.floor(s/86400) + 'd ago';
  };

  return (
    <div onClick={onClose} style={{
      position:'absolute', inset:0, zIndex:80,
      background:'rgba(0,0,0,0.5)',
      display:'flex', alignItems:'flex-end',
      backdropFilter:'blur(2px)',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width:'100%', background:'var(--fp-bg)',
        borderRadius:'22px 22px 0 0',
        padding:'18px 0 max(18px, env(safe-area-inset-bottom, 0px))',
        boxShadow:'0 -8px 40px rgba(0,0,0,0.3)',
        maxHeight:'72vh', display:'flex', flexDirection:'column',
      }}>
        <div style={{ width:36, height:4, borderRadius:2, background:'var(--fp-ink-4)', margin:'0 auto 14px' }}/>
        <div style={{
          padding:'0 22px 12px',
          fontFamily:"'Instrument Serif', Georgia, serif", fontStyle:'italic',
          fontSize:24, color:'var(--fp-ink)', letterSpacing:'-0.02em',
        }}>Previous successful runs</div>

        <div className="fp-scroll" style={{ flex:1, overflowY:'auto', padding:'0 22px' }}>
          {entries.length === 0 && (
            <div style={{ padding:'18px 0', fontSize:13, color:'var(--fp-ink-3)', textAlign:'center', lineHeight:1.55 }}>
              No completed runs yet.<br/>Clear the level once and its equations are kept here.
            </div>
          )}
          {entries.map((e, i) => (
            <div key={i} style={{
              border:'1px solid var(--fp-line)', borderRadius:14,
              padding:'12px 14px', marginBottom:8, background:'var(--fp-surface)',
            }}>
              <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:8 }}>
                <Stars bits={starBitsOf(e.stars, e.bits)} total={3} size={11}/>
                <span className="fp-mono" style={{ fontSize:12, color:'var(--fp-ink-2)' }}>{e.score} pts</span>
                <span className="fp-mono" style={{ fontSize:12, color:'var(--fp-ink-3)' }}>{e.time?.toFixed?.(2) ?? '—'}s</span>
                <span style={{ marginLeft:'auto', fontSize:11, color:'var(--fp-ink-4)' }}>{fmtAgo(e.ts)}</span>
              </div>
              <div style={{ marginBottom:10, display:'flex', flexDirection:'column', gap:4 }}>
                {(e.exprs || []).map((expr, j) => (
                  <div key={j} className="fp-mono" style={{
                    fontSize:12, color:'var(--fp-ink)',
                    background:'var(--fp-surface-2)', borderRadius:8,
                    padding:'5px 9px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                  }}><MathExpr src={expr}/></div>
                ))}
              </div>
              <button onClick={() => onLoad(e.exprs, e.mats, e.shifts)} style={{
                width:'100%', height:36, borderRadius:10,
                background:'var(--fp-ink)', color:'var(--fp-bg)',
                fontSize:12.5, fontWeight:500,
              }}>Load these equations</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

window.LevelScreen = LevelScreen;
window.parseEquation = parseEquation;
window.computeScore = computeScore;
window.starRating = starRating;
// Shared with the sandbox so it runs the same plane, panel and physics as a
// real level rather than a lookalike that can drift.
window.PlaneFiller = PlaneFiller;
window.EquationsPanel = EquationsPanel;
// The studio edits the selected object's coordinates with the same keypad the
// domain and object fields use, rather than the device's own.
window.NumPad = NumPad;
window.DomValBtn = DomValBtn;
window.HudChip = HudChip;
window.physicsStep = physicsStep;
window.drainTicks = drainTicks;
window.makeWorld = makeWorld;
window.makeRunColliders = makeRunColliders;
window.freshPh = freshPh;
window.outOfWorld = outOfWorld;
window.SIM = { TICK_DT, SUB_STEPS, MAX_TICKS, BALL_R, WORLD_MARGIN, WORLD_RADIUS, EQ_COLORS };
