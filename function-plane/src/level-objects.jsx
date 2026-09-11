// Function Plane — level objects (window.FP_OBJECTS)
//
// Things a level designer places on the plane besides the ball and the stars:
// fans, antigravity zones, gravity wells, hazards. One registry so that a new
// kind is a new entry here — its physics, its hit-test, its editor fields and
// its picture — and nothing else in the app has to learn about it.
//
// Everything a kind does to the ball is a pure function of the ball's
// position. Never the wall clock, never Math.random(): recorded times are
// tick-counted so the leaderboard compares play rather than hardware, and
// one object that read performance.now() would undo that for every level it
// sat in. The wind streaks below are animated, but that is the *drawing* —
// the force is the same every tick.

const DEG = Math.PI / 180;

const KINDS = {
  fan: {
    label: 'Fan', color: '#1f9aa8',
    defaults: { x: 0, y: 0, angle: 90, len: 4, w: 2, strength: 14 },
    fields: [
      { k: 'x',        label: 'x' },
      { k: 'y',        label: 'y' },
      { k: 'angle',    label: 'angle°', min: -360, max: 360 },
      { k: 'len',      label: 'reach',  min: 0.5,  max: 30 },
      { k: 'w',        label: 'width',  min: 0.5,  max: 30 },
      { k: 'strength', label: 'force',  min: 1,    max: 80 },
    ],
  },
  antigrav: {
    label: 'Antigravity', color: '#7a4fd6',
    defaults: { x: 0, y: 0, w: 3, h: 3 },
    fields: [
      { k: 'x', label: 'x' }, { k: 'y', label: 'y' },
      { k: 'w', label: 'width',  min: 0.5, max: 30 },
      { k: 'h', label: 'height', min: 0.5, max: 30 },
    ],
  },
  well: {
    label: 'Gravity well', color: '#2f3e8f',
    defaults: { x: 0, y: 0, r: 2.5, strength: 18 },
    fields: [
      { k: 'x', label: 'x' }, { k: 'y', label: 'y' },
      { k: 'r',        label: 'radius', min: 0.5, max: 30 },
      { k: 'strength', label: 'pull',   min: 1,   max: 80 },
    ],
  },
  hazard: {
    label: 'Hazard', color: '#d13b3b',
    defaults: { x: 0, y: 0, w: 2, h: 1 },
    fields: [
      { k: 'x', label: 'x' }, { k: 'y', label: 'y' },
      { k: 'w', label: 'width',  min: 0.25, max: 30 },
      { k: 'h', label: 'height', min: 0.25, max: 30 },
    ],
  },
};

const KIND_ORDER = ['fan', 'antigrav', 'well', 'hazard'];

function makeObject(kind, at) {
  return { kind, ...KINDS[kind].defaults, ...(at || {}) };
}

// Clamp a field edit to the range the registry declares for it.
function setField(obj, k, v) {
  const f = KINDS[obj.kind].fields.find(f => f.k === k);
  if (!f || !isFinite(v)) return obj;
  const lo = f.min ?? -40, hi = f.max ?? 40;
  return { ...obj, [k]: Math.max(lo, Math.min(hi, v)) };
}

// ── Geometry ─────────────────────────────────────────────────────────
// A fan is a rectangle standing on its base at (x, y), reaching `len` along
// `angle` (0° = +x, 90° = +y) and `w` wide across it. Its local frame is
// (u, v): u along the wind, v across.
function fanLocal(o, x, y) {
  const a = o.angle * DEG, dx = x - o.x, dy = y - o.y;
  return { u: dx * Math.cos(a) + dy * Math.sin(a), v: -dx * Math.sin(a) + dy * Math.cos(a) };
}

const INSIDE = {
  fan:      (o, x, y) => { const { u, v } = fanLocal(o, x, y); return u >= 0 && u <= o.len && Math.abs(v) <= o.w / 2; },
  antigrav: (o, x, y) => Math.abs(x - o.x) <= o.w / 2 && Math.abs(y - o.y) <= o.h / 2,
  hazard:   (o, x, y) => Math.abs(x - o.x) <= o.w / 2 && Math.abs(y - o.y) <= o.h / 2,
  well:     (o, x, y) => Math.hypot(x - o.x, y - o.y) <= o.r,
};

// ── Forces ───────────────────────────────────────────────────────────
// Accumulate into `out` — ax/ay in units/s², gMul scales gravity. The engine
// calls this every substep, so it must not allocate.
const FORCE = {
  fan(o, x, y, out) {
    if (!INSIDE.fan(o, x, y)) return;
    const a = o.angle * DEG;
    out.ax += o.strength * Math.cos(a);
    out.ay += o.strength * Math.sin(a);
  },
  antigrav(o, x, y, out) {
    if (INSIDE.antigrav(o, x, y)) out.gMul = -out.gMul;
  },
  well(o, x, y, out) {
    const dx = o.x - x, dy = o.y - y;
    const d = Math.hypot(dx, dy);
    if (d > o.r || d < 1e-6) return;
    // Constant pull inside the radius: predictable enough to aim with, and no
    // singularity at the centre for the integrator to blow up on.
    out.ax += o.strength * dx / d;
    out.ay += o.strength * dy / d;
  },
};

// The field the engine samples. Null when nothing pushes, so a level without
// objects pays nothing.
function makeField(objects) {
  const fs = (objects || []).filter(o => FORCE[o.kind]);
  if (!fs.length) return null;
  const out = { ax: 0, ay: 0, gMul: 1 };
  return (x, y) => {
    out.ax = 0; out.ay = 0; out.gMul = 1;
    for (let i = 0; i < fs.length; i++) FORCE[fs[i].kind](fs[i], x, y, out);
    return out;
  };
}

// A hazard kills the ball on contact — circle against axis-aligned box.
function hazardHit(hazards, x, y, r) {
  for (let i = 0; i < hazards.length; i++) {
    const o = hazards[i];
    const cx = Math.max(o.x - o.w / 2, Math.min(o.x + o.w / 2, x));
    const cy = Math.max(o.y - o.h / 2, Math.min(o.y + o.h / 2, y));
    if (Math.hypot(x - cx, y - cy) <= r) return true;
  }
  return false;
}

function hitTest(o, x, y) { return !!INSIDE[o.kind]?.(o, x, y); }

function bounds(o) {
  if (o.kind === 'well') return { minX: o.x - o.r, maxX: o.x + o.r, minY: o.y - o.r, maxY: o.y + o.r };
  if (o.kind === 'fan') {
    const a = o.angle * DEG, c = Math.cos(a), s = Math.sin(a);
    const xs = [], ys = [];
    for (const [u, v] of [[0, -o.w / 2], [0, o.w / 2], [o.len, -o.w / 2], [o.len, o.w / 2]]) {
      xs.push(o.x + u * c - v * s); ys.push(o.y + u * s + v * c);
    }
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  }
  return { minX: o.x - o.w / 2, maxX: o.x + o.w / 2, minY: o.y - o.h / 2, maxY: o.y + o.h / 2 };
}

// ── Drawing ──────────────────────────────────────────────────────────
// Every kind is a tinted, dashed region so it reads as "a zone" rather than
// a wall, plus one glyph that says which zone. Fills stay under 10% so the
// grid, the curves and the ball all stay legible through them.

// Deterministic per-streak offsets, so the wind pattern doesn't reshuffle on
// every re-render.
function hash01(i, k) {
  let h = (i * 7919 + k * 104729) | 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function Fan({ o, i, m2p, scale, selected }) {
  const c = KINDS.fan.color;
  const p = m2p(o.x, o.y);
  const L = o.len * scale, W = o.w * scale;
  const clip = `fp-fan-${i}`;
  // Streaks over [0, L) drawn twice, one copy a full length downwind, and the
  // group slid by exactly L per cycle — so the loop is seamless.
  const n = Math.max(4, Math.min(40, Math.round(o.len * o.w * 1.2)));
  const streaks = [];
  for (let k = 0; k < n; k++) {
    const sx = hash01(i, k) * L, sy = (hash01(i, k + 500) - 0.5) * W * 0.9;
    const sl = 8 + hash01(i, k + 1000) * 10;
    for (const off of [0, L]) {
      streaks.push(<line key={`${k}-${off}`} x1={sx + off} y1={sy} x2={sx + off + sl} y2={sy}
        stroke={c} strokeWidth={1.3} strokeLinecap="round" opacity={0.45}/>);
    }
  }
  // A quicker cycle for a stronger fan, so the picture says how hard it blows.
  const dur = Math.max(0.6, 2.2 - o.strength / 40).toFixed(2);
  return (
    <g transform={`translate(${p.x},${p.y}) rotate(${-o.angle})`}>
      <defs>
        <clipPath id={clip}><rect x={0} y={-W / 2} width={L} height={W}/></clipPath>
      </defs>
      <rect x={0} y={-W / 2} width={L} height={W} rx={4}
        fill={c} fillOpacity={selected ? 0.13 : 0.07}
        stroke={c} strokeWidth={selected ? 2 : 1.2} strokeDasharray={selected ? undefined : '5 4'} opacity={0.75}/>
      <g clipPath={`url(#${clip})`}>
        <g>
          <animateTransform attributeName="transform" type="translate"
            from={`${-L} 0`} to="0 0" dur={`${dur}s`} repeatCount="indefinite"/>
          {streaks}
        </g>
      </g>
      {/* housing at the base, arrowhead at the mouth */}
      <rect x={-3} y={-W / 2} width={5} height={W} rx={2} fill={c} opacity={0.85}/>
      <path d={`M${L - 9} ${-6} L${L - 1} 0 L${L - 9} 6`} fill="none" stroke={c} strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round" opacity={0.9}/>
    </g>
  );
}

function Antigrav({ o, m2p, scale, selected }) {
  const c = KINDS.antigrav.color;
  const p = m2p(o.x, o.y);
  const W = o.w * scale, H = o.h * scale;
  const chev = Math.min(10, W * 0.25, H * 0.2);
  return (
    <g transform={`translate(${p.x},${p.y})`}>
      <rect x={-W / 2} y={-H / 2} width={W} height={H} rx={6}
        fill={c} fillOpacity={selected ? 0.14 : 0.08}
        stroke={c} strokeWidth={selected ? 2 : 1.2} strokeDasharray={selected ? undefined : '5 4'} opacity={0.75}/>
      {[1, 0, -1].map(k => (
        <path key={k} d={`M${-chev} ${k * chev * 1.2 + chev / 2} L0 ${k * chev * 1.2 - chev / 2} L${chev} ${k * chev * 1.2 + chev / 2}`}
          fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" opacity={0.55}/>
      ))}
    </g>
  );
}

function Well({ o, i, m2p, scale, selected }) {
  const c = KINDS.well.color;
  const p = m2p(o.x, o.y);
  const R = o.r * scale;
  const grad = `fp-well-${i}`;
  const tick = Math.min(8, R * 0.3);
  return (
    <g transform={`translate(${p.x},${p.y})`}>
      <defs>
        <radialGradient id={grad}>
          <stop offset="0%"   stopColor={c} stopOpacity={0.28}/>
          <stop offset="100%" stopColor={c} stopOpacity={0.03}/>
        </radialGradient>
      </defs>
      <circle r={R} fill={`url(#${grad})`}/>
      <circle r={R} fill="none" stroke={c} strokeWidth={selected ? 2 : 1.2}
        strokeDasharray={selected ? undefined : '5 4'} opacity={0.7}/>
      {[0, 90, 180, 270].map(a => (
        <line key={a} x1={0} y1={-R} x2={0} y2={-R + tick} stroke={c} strokeWidth={1.6}
          strokeLinecap="round" opacity={0.6} transform={`rotate(${a})`}/>
      ))}
      <circle r={3} fill={c} opacity={0.9}/>
    </g>
  );
}

function Hazard({ o, i, m2p, scale, selected }) {
  const c = KINDS.hazard.color;
  const p = m2p(o.x, o.y);
  const W = o.w * scale, H = o.h * scale;
  const pat = `fp-hz-${i}`;
  return (
    <g transform={`translate(${p.x},${p.y})`}>
      <defs>
        <pattern id={pat} patternUnits="userSpaceOnUse" width={8} height={8}>
          <path d="M-2 2 L2 -2 M0 8 L8 0 M6 10 L10 6" stroke={c} strokeWidth={1.4} opacity={0.5}/>
        </pattern>
      </defs>
      <rect x={-W / 2} y={-H / 2} width={W} height={H} rx={3} fill={c} fillOpacity={0.07}/>
      <rect x={-W / 2} y={-H / 2} width={W} height={H} rx={3} fill={`url(#${pat})`}
        stroke={c} strokeWidth={selected ? 2.2 : 1.4} opacity={0.85}/>
    </g>
  );
}

const DRAW = { fan: Fan, antigrav: Antigrav, well: Well, hazard: Hazard };

function LevelObject({ o, i, m2p, scale, selected }) {
  const C = DRAW[o.kind];
  return C ? <C o={o} i={i} m2p={m2p} scale={scale} selected={selected}/> : null;
}

window.FP_OBJECTS = {
  KINDS, KIND_ORDER, makeObject, setField,
  makeField, hazardHit, hitTest, bounds,
  LevelObject,
};
