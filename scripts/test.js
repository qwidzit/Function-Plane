// Function Plane — test suite. No dependencies: node scripts/test.js
//
// Covers the three things ABOUT.md says must be re-checked by hand after a
// change, plus the release-integrity checks that are easy to forget:
//
//   1. Classifier parity + loopholes — a themed pack must not let a disguised
//      equation through, and ordinary expressions must keep their old scores
//      (level goals and past records were tuned against those numbers).
//   2. Physics regression — free fall, flat bounce and the slope roll that
//      dies instantly if the "energyRetention only on real bounces" gate is
//      broken. Also that the engine is deterministic, which server-side score
//      verification will depend on.
//   3. Sim clock — recorded times must come from tick count, not the wall
//      clock, or a 120Hz phone posts times a 60Hz phone can never match.
//   4. Shell integrity — a new source file has to land in BOTH index.html and
//      sw.js's SHELL, and every .jsx needs its compiled .js.
//
// Content coverage is reported but never fails the suite: levels are authored
// in Supabase while the app ships, so a gap is news, not breakage.

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC  = path.join(ROOT, 'function-plane', 'src');
const read = p => fs.readFileSync(p, 'utf8');

// ── Harness ────────────────────────────────────────────────────────────────

let passed = 0;
const failures = [];
let group = '';

const describe = name => { group = name; console.log(`\n${name}`); };

function it(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    failures.push({ group, name, message: e.message });
    console.log(`  FAIL ${name}\n         ${e.message}`);
  }
}

function eq(actual, expected, what) {
  if (!Object.is(actual, expected)) {
    throw new Error(`${what || 'value'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function near(actual, expected, tol, what) {
  if (!(Math.abs(actual - expected) <= tol)) {
    throw new Error(`${what || 'value'}: expected ${expected} ±${tol}, got ${actual}`);
  }
}

function ok(cond, what) {
  if (!cond) throw new Error(what || 'expected truthy');
}

// Load browser-globals modules (they assign onto `window`) into one namespace.
function loadBrowserModules(files) {
  const w = {};
  global.window = w;
  global.self = w;
  for (const f of files) {
    delete require.cache[require.resolve(path.join(SRC, f))];
    require(path.join(SRC, f));
  }
  return w;
}

// ── 1. Equation classifier ─────────────────────────────────────────────────

describe('Equation classifier');

const cls = loadBrowserModules(['equation-classifier.js']);
const { detectClass, classifyEquation } = cls;

// [expression, class, score] — scores are the pre-AST-rewrite values that
// level goals were tuned against. Changing one means retuning level data.
const CLASSIFIER_TABLE = [
  ['x',              'linear',      10],
  ['2x+3',           'linear',      10],
  ['y=0.5x-1',       'linear',      10],
  ['x/2+1',          'linear',      10],
  ['3',              'linear',      10],
  ['y=3',            'linear',      10],
  ['x^2-3',          'quadratic',   20],
  ['y=x^2',          'quadratic',   20],
  ['(x+1)(x-1)',     'quadratic',   20],
  ['x^3',            'cubic',       30],
  ['sin(x)',         'trig',        25],
  ['cos(2x)',        'trig',        25],
  ['tan(x)',         'trig',        25],
  ['y=sin(40x)',     'trig',        25],
  ['asin(x)',        'inverseTrig', 40],
  ['arcsin(x)',      'inverseTrig', 40],
  ['log(x)',         'log',         30],
  ['ln(x)',          'log',         30],
  ['e^x',            'exp',         35],
  ['abs(x)',         'piecewise',   20],
  ['1/x',            'rational',    30],
];

it('classifies and scores ordinary expressions as before', () => {
  for (const [expr, cl, score] of CLASSIFIER_TABLE) {
    eq(detectClass(expr), cl, `detectClass(${expr})`);
    eq(classifyEquation(expr), score, `classifyEquation(${expr})`);
  }
});

// The loophole set: every one of these read as 'linear' under the old regex
// scan, which let players sneak them past a themed pack's allowedClass.
const NOT_LINEAR = [
  ['x+y^2=1',    'y-power invisible to a regex'],
  ['x*y=1',      'product degree never counted'],
  ['x^2+y^2=9',  'implicit conic'],
  ['2^x',        'variable exponent without e^'],
  ['pow(x,7)',   'pow() call'],
  ['sqrt(x)',    'root'],
  ['abs(x)',     'piecewise'],
  ['floor(x)',   'piecewise'],
  ['ceil(x)',    'piecewise'],
  ['round(x)',   'piecewise'],
  ['min(x,2)',   'piecewise'],
  ['max(x,1)',   'piecewise'],
  ['1/x',        'rational'],
  ['x^2/y',      'rational in y'],
  ['2^(x+1)',    'disguised exponential'],
];

it('never reads a disguised equation as linear', () => {
  for (const [expr, why] of NOT_LINEAR) {
    const c = detectClass(expr);
    ok(c !== 'linear', `detectClass(${expr}) = ${c} — ${why} must not classify as linear`);
  }
});

it('folds constant subtrees instead of counting them as structure', () => {
  eq(detectClass('sin(1)*x'), 'linear', 'sin(1)*x is a constant times x');
  eq(detectClass('e^2'), 'linear', 'e^2 is just a number');
});

it('scores unparseable input high, never low', () => {
  eq(detectClass('!!bad(('), 'unknown');
  ok(classifyEquation('!!bad((') >= 50, 'unparseable must not score cheaply');
});

// classMatches lives at module scope in level-screen; pull it out of the
// shipped file so this tests the real gating logic rather than a copy.
const levelScreenJs = read(path.join(SRC, 'level-screen.js'));
const classMatchesSrc = levelScreenJs.match(/function classMatches\(allowed, detected\)[\s\S]*?\n}/);
ok(classMatchesSrc, 'could not extract classMatches from level-screen.js');
const classMatches = new Function(`${classMatchesSrc[0]}; return classMatches;`)();

it('gates themed packs on the grouped classes', () => {
  // Related classes travel together...
  ok(classMatches('exp',  detectClass('log(x)')),    'exp pack allows log');
  ok(classMatches('trig', detectClass('asin(x)')),   'trig pack allows inverse trig');
  ok(classMatches('trig', detectClass('sin(x)')),    'trig pack allows trig');
  // ...but the loopholes stay out.
  ok(!classMatches('linear', detectClass('x*y=1')),   'linear pack rejects a product');
  ok(!classMatches('linear', detectClass('2^x')),     'linear pack rejects an exponential');
  ok(!classMatches('linear', detectClass('abs(x)')),  'linear pack rejects piecewise');
  ok(!classMatches('linear', detectClass('!!bad((')), 'linear pack rejects unparseable input');
});

// ── 1b. Scoring & the leaderboard audit ────────────────────────────────────

describe('Scoring & leaderboard audit');

// level-screen.js needs React to parse; a stub is enough to reach the scoring
// functions it exports. Browser globals are real globals in a classic script,
// which require() doesn't reproduce — hence the Object.assign.
const scoring = (() => {
  const w = { React: new Proxy({}, { get: () => () => {} }) };
  global.window = w;
  global.React = w.React;
  global.document = { createElement: () => ({}) };
  for (const f of ['equation-classifier.js', 'level-screen.js']) {
    delete require.cache[require.resolve(path.join(SRC, f))];
    require(path.join(SRC, f));
    Object.assign(global, w);
  }
  return w;
})();

const parse = exprs => exprs.map(expr => ({ expr, ...scoring.parseEquation(expr) }));

it('scores a run as sum(complexity) + 20 per equation', () => {
  // The leaderboard guard's floor of 30 per equation depends on this shape.
  eq(scoring.computeScore(parse(['y=-x'])), 30, 'one linear');
  eq(scoring.computeScore(parse(['x', 'x+1', 'x+2'])), 90, 'three linears');
  ok(scoring.computeScore(parse(['sin(x)'])) >= 30, 'no run can score under 30');
});

it('rates stars by equation count first, then score', () => {
  eq(scoring.starRating(1, 30, 1, 40), 3, 'within the equation goal');
  eq(scoring.starRating(3, 40, 1, 40), 2, 'over on equations, within score');
  eq(scoring.starRating(3, 90, 1, 40), 1, 'over on both');
});

it('recomputes a forged submission to a different score', () => {
  // What the admin audit does: a row claiming a score its equations cannot
  // produce is the signal the database cannot check for itself.
  const exprs  = ['x', 'x+1', 'x+2'];
  const honest = scoring.computeScore(parse(exprs));
  eq(honest, 90, 'baseline');
  ok(honest !== 30, 'a 3-equation run cannot score what a 1-equation run scores');
  ok(scoring.starRating(exprs.length, 30, 1, 40) < 3,
    'claiming 3 stars with 3 equations against an eq_goal of 1 must not verify');
});

// ── 1c. Achievements ───────────────────────────────────────────────────────

describe('Achievements');

const ach = (() => {
  const w = { React: new Proxy({}, { get: () => () => {} }) };
  global.window = w;
  global.React = w.React;
  global.document = { createElement: () => ({}) };
  for (const f of ['data.js', 'achievements.js']) {
    delete require.cache[require.resolve(path.join(SRC, f))];
    require(path.join(SRC, f));
    Object.assign(global, w);
  }
  return w;
})();

const progressWith = patch => {
  const p = ach.freshProgress();
  for (const [k, v] of Object.entries(patch)) p[k] = { ...p[k], ...v };
  return p;
};
const nulls = n => Array(n).fill(null);
const packRun = extra => progressWith({
  'r-I': { stars: [1, ...Array(9).fill(-1)], best: [60, ...nulls(9)], ...extra },
});

it('unlocks nothing on a fresh save', () => {
  const unlocked = ach.getAchievementList().filter(a => a.check(ach.freshProgress()));
  eq(unlocked.length, 0, `unlocked on a brand new profile: ${unlocked.map(a => a.id).join(', ')}`);
});

it('keeps every built-in working after the move to data rows', () => {
  // The 17 built-ins used to be hand-written predicates. They are rows now so
  // the admin can edit them; each must still fire on exactly what it did
  // before, or players silently lose achievements they had earned.
  const list = ach.getAchievementList();
  const expectations = [
    ['first_roll',    packRun()],
    ['three_stars',   progressWith({ 'r-I': { stars: [3, ...Array(9).fill(-1)], best: [30, ...nulls(9)] } })],
    ['minimalist',    progressWith({ 'r-I': { stars: [1, ...Array(9).fill(-1)], best: [50, ...nulls(9)] } })],
    ['ten_levels',    progressWith({ 'r-I': { stars: Array(10).fill(1), best: Array(10).fill(60) } })],
    ['pack_complete', progressWith({ 'r-I': { stars: Array(10).fill(1), best: Array(10).fill(60) } })],
    ['pack_gold',     progressWith({ 'r-I': { stars: Array(10).fill(3), best: Array(10).fill(30) } })],
    ['pack_i_done',   progressWith({ 'r-I': { stars: Array(10).fill(1), best: Array(10).fill(60) } })],
    ['special_start', progressWith({ 's-lin': { stars: [1, ...Array(9).fill(-1)], best: [60, ...nulls(9)] } })],
    ['flash',         packRun({ bestTime: [0.55, ...nulls(9)] })],
    ['sunday_stroll', packRun({ bestTime: [3.5, ...nulls(9)] })],
    ['big_brain',     packRun({ best: [120, ...nulls(9)], maxScore: [120, ...nulls(9)] })],
  ];
  for (const [id, progress] of expectations) {
    const a = list.find(x => x.id === id);
    ok(a, `built-in ${id} disappeared`);
    ok(a.check(progress), `${id} should unlock on its own fixture`);
  }
  // Thresholds must be boundaries, not approximations.
  ok(!list.find(a => a.id === 'flash').check(packRun({ bestTime: [0.7, ...nulls(9)] })),
    'flash must not fire at 0.7s');
  ok(!list.find(a => a.id === 'sunday_stroll').check(packRun({ bestTime: [2.0, ...nulls(9)] })),
    'sunday_stroll must not fire at 2.0s');
});

it('lets an override edit a built-in and a delete restore it', () => {
  const before = ach.getAchievementRows().find(r => r.id === 'stars_200');
  eq(before.threshold, 200, 'shipped threshold');
  ach.FP_ACH_OVERRIDES = [{ id: 'stars_200', name: 'Star Lord', threshold: 150,
                            kind: null, description: null, pack_id: null, level_index: null }];
  const after = ach.getAchievementRows().find(r => r.id === 'stars_200');
  eq(after.threshold, 150, 'override threshold wins');
  eq(after.name, 'Star Lord', 'override name wins');
  // Null columns are "unset", not "clear it" — the row stores null for every
  // param its kind doesn't use, which must not wipe the built-in's own.
  eq(after.kind, 'total_stars', 'null in an override must not erase the kind');
  ach.FP_ACH_OVERRIDES = [];
  eq(ach.getAchievementRows().find(r => r.id === 'stars_200').threshold, 200, 'deleting restores the default');
});

it('hides an achievement when its override says so', () => {
  ach.FP_ACH_OVERRIDES = [{ id: 'stars_200', is_hidden: true }];
  ok(!ach.getAchievementList().some(a => a.id === 'stars_200'), 'hidden built-in must not be listed');
  ach.FP_ACH_OVERRIDES = [];
  ok(ach.getAchievementList().some(a => a.id === 'stars_200'), 'and must come back');
});

it('exposes every kind the built-ins use', () => {
  for (const row of ach.BUILTIN_ACH_ROWS) {
    ok(ach.ACH_KINDS[row.kind], `${row.id} uses unknown kind ${row.kind}`);
    ok(ach.buildAchievement(row), `${row.id} is missing a param its kind requires`);
  }
});

// ── 2. Physics engine ──────────────────────────────────────────────────────

describe('Physics engine');

const phys = loadBrowserModules(['physics-config.js', 'physics-engine.js']);
const FP_PHYSICS = phys.FP_PHYSICS;

// Must match the constants in level-screen.jsx.
const GRAVITY = 12, BALL_R = 0.22, SUB_STEPS = 20, TICK_DT = 1 / 60;
const STEP_DT = TICK_DT / SUB_STEPS;
// Must mirror physicsStep() in level-screen exactly. Anything missing here is
// a tuning knob the suite silently stops covering.
const CFG = {
  gravity:         GRAVITY,
  ballR:           BALL_R,
  bounciness:      phys.PHYSICS_CONFIG.bounciness,
  energyRetention: phys.PHYSICS_CONFIG.energyRetention,
  traction:        phys.PHYSICS_CONFIG.traction,
  bounceThreshold: 1.5,
};

it('passes the shipped physics config, not a subset of it', () => {
  const stepSrc = read(path.join(SRC, 'level-screen.js'))
    .match(/stepBall\(ph, colliders, dt, \{[\s\S]*?\}\)/)[0];
  for (const key of Object.keys(phys.PHYSICS_CONFIG)) {
    ok(stepSrc.includes(key), `level-screen must pass ${key} to stepBall`);
    ok(key in CFG, `this suite must exercise ${key}`);
  }
});

function simulate(colliderDefs, start, seconds) {
  const colliders = FP_PHYSICS.makeColliders(colliderDefs, BALL_R);
  const ph = { ...start };
  const steps = Math.round(seconds / STEP_DT);
  for (let i = 0; i < steps; i++) FP_PHYSICS.stepBall(ph, colliders, STEP_DT, CFG);
  return ph;
}

const flatGround = y => [{ fn: () => y, domain: null, isImplicit: false }];

it('free-falls at gravity', () => {
  const ph = simulate([], { x: 0, y: 5, vx: 0, vy: 0 }, 1.0);
  near(ph.vy, -GRAVITY, 1e-9, 'velocity after 1s');
  // Semi-implicit Euler trails the analytic solution by half a step of
  // gravity — a fixed, known bias, not drift.
  near(ph.y, 5 - 0.5 * GRAVITY, 0.01, 'height after 1s');
});

it('settles exactly one ball radius above flat ground', () => {
  const ph = simulate(flatGround(-2), { x: 0, y: 3, vx: 0, vy: 0 }, 6.0);
  near(ph.y, -2 + BALL_R, 0.01, 'resting height');
  ok(Math.abs(ph.vy) < 0.1, `should be at rest, vy=${ph.vy}`);
});

it('never lets the ball sink through the surface', () => {
  const colliders = FP_PHYSICS.makeColliders(flatGround(-2), BALL_R);
  const ph = { x: 0, y: 4, vx: 0, vy: 0 };
  let lowest = Infinity;
  for (let i = 0; i < Math.round(8 / STEP_DT); i++) {
    FP_PHYSICS.stepBall(ph, colliders, STEP_DT, CFG);
    lowest = Math.min(lowest, ph.y);
  }
  ok(lowest > -2 + BALL_R - 0.05, `ball reached y=${lowest}, below the surface`);
});

const slopeAt = deg => [{ fn: x => -x * Math.tan(deg * Math.PI / 180), domain: null, isImplicit: false }];

it('never stops a ball gliding down a slope', () => {
  // The regression guard for the energyRetention gate. If retention is ever
  // applied to sliding contact instead of real bounces only, a rolling ball
  // loses everything in about a second and every slope level breaks. Traction
  // is drag, not a brake: it caps speed, it must never cancel it.
  for (const deg of [20, 45]) {
    const terminal = GRAVITY * Math.sin(deg * Math.PI / 180) / CFG.traction;
    for (const secs of [2, 6, 12]) {
      const ph = simulate(slopeAt(deg), { x: -3, y: 3 * Math.tan(deg * Math.PI / 180) + 0.3, vx: 0, vy: 0 }, secs);
      const speed = Math.hypot(ph.vx, ph.vy);
      ok(speed > terminal * 0.6,
        `${deg}deg slope after ${secs}s: still gliding at ${speed.toFixed(2)} (terminal ${terminal.toFixed(2)})`);
    }
  }
});

it('caps slope speed at terminal instead of accelerating forever', () => {
  const terminal = GRAVITY * Math.SQRT1_2 / CFG.traction;
  const at4  = simulate(slopeAt(45), { x: -3, y: 3.3, vx: 0, vy: 0 }, 4);
  const at12 = simulate(slopeAt(45), { x: -3, y: 3.3, vx: 0, vy: 0 }, 12);
  near(Math.hypot(at4.vx,  at4.vy),  terminal, terminal * 0.15, 'speed at 4s');
  near(Math.hypot(at12.vx, at12.vy), terminal, terminal * 0.05, 'speed at 12s');
});

it('comes to rest on flat ground', () => {
  // The one place traction should fully stop the ball: no tangential gravity.
  const ph = simulate(flatGround(-2), { x: 0, y: 3, vx: 6, vy: 0 }, 10);
  ok(Math.abs(ph.vx) < 0.1, `should have stopped sliding, vx=${ph.vx}`);
});

it('applies traction by contact time, not per substep', () => {
  // stepBall subdivides into up to 8 passes at speed. A per-call factor would
  // make a fast ball lose 8x the grip of a slow one on identical geometry, and
  // would shift the moment MAX_TICKS clamped a stalled frame.
  const speeds = [10, 20, 40, 80].map(sub => {
    const stepDt = (1 / 60) / sub;
    const colliders = FP_PHYSICS.makeColliders(slopeAt(45), BALL_R);
    const ph = { x: -3, y: 3.3, vx: 0, vy: 0 };
    for (let i = 0; i < Math.round(3 / stepDt); i++) FP_PHYSICS.stepBall(ph, colliders, stepDt, CFG);
    return Math.hypot(ph.vx, ph.vy);
  });
  const spread = Math.max(...speeds) - Math.min(...speeds);
  ok(spread < 0.05, `speed must not depend on substep count: ${speeds.map(s => s.toFixed(3)).join(', ')}`);
});

it('loses energy on a real bounce', () => {
  const colliders = FP_PHYSICS.makeColliders(flatGround(-2), BALL_R);
  const ph = { x: 0, y: 3, vx: 0, vy: 0 };
  let impact = 0, rebound = 0;
  for (let i = 0; i < Math.round(3 / STEP_DT); i++) {
    const before = ph.vy;
    FP_PHYSICS.stepBall(ph, colliders, STEP_DT, CFG);
    if (before < -1.5 && ph.vy > 0) { impact = -before; rebound = ph.vy; break; }
  }
  ok(impact > 0, 'expected a bounce within 3s');
  ok(rebound < impact, `rebound ${rebound} should be slower than impact ${impact}`);
});

it('is deterministic', () => {
  // Server-side score verification will replay runs; identical inputs must
  // give bit-identical output.
  const curve = () => [{ fn: Math.sin, domain: null, isImplicit: false }];
  const a = simulate(curve(), { x: -2, y: 3, vx: 1, vy: 0 }, 3);
  const b = simulate(curve(), { x: -2, y: 3, vx: 1, vy: 0 }, 3);
  eq(a.x, b.x, 'x'); eq(a.y, b.y, 'y');
  eq(a.vx, b.vx, 'vx'); eq(a.vy, b.vy, 'vy');
});

// ── 3. Sim clock ───────────────────────────────────────────────────────────

describe('Sim clock');

// Constants read from the shipped file, so retuning them can't silently
// invalidate these expectations.
const tickDtSrc   = levelScreenJs.match(/const TICK_DT = ([\d.\/ ]+);/);
const maxTicksSrc = levelScreenJs.match(/const MAX_TICKS = (\d+);/);
ok(tickDtSrc && maxTicksSrc, 'could not read TICK_DT / MAX_TICKS from level-screen.js');
const tickDt   = eval(tickDtSrc[1]);
const maxTicks = Number(maxTicksSrc[1]);

// The accumulator from the frame loop, over synthetic rAF timestamps.
function runClock(refreshHz, wallSeconds) {
  const st = { acc: 0, simS: 0, lastTs: null };
  const frames = Math.round(wallSeconds * refreshHz);
  let ticks = 0;
  for (let i = 0; i <= frames; i++) {
    const ts = (i * 1000) / refreshHz;
    if (st.lastTs == null) st.lastTs = ts;
    st.acc += Math.min((ts - st.lastTs) / 1000, maxTicks * tickDt);
    st.lastTs = ts;
    while (st.acc >= tickDt) { st.acc -= tickDt; st.simS += tickDt; ticks++; }
  }
  return { ticks, simS: st.simS };
}

it('advances the same sim time at 30, 60 and 144Hz', () => {
  const wall = 3;
  const a = runClock(30, wall), b = runClock(60, wall), c = runClock(144, wall);
  for (const [hz, r] of [[30, a], [60, b], [144, c]]) {
    near(r.simS, wall, tickDt * 2, `sim time at ${hz}Hz over ${wall}s`);
  }
  ok(Math.abs(a.ticks - c.ticks) <= 2, `tick counts must match across refresh rates (30Hz=${a.ticks}, 144Hz=${c.ticks})`);
});

it('steps exactly once per frame at 60Hz', () => {
  // Preserves the pre-fix stepping cadence bit-for-bit on a 60Hz display.
  const { ticks } = runClock(60, 2);
  near(ticks, 120, 1, 'ticks in 2s at 60Hz');
});

it('caps catch-up after a stall instead of replaying lost time', () => {
  const st = { acc: 0, simS: 0, lastTs: 0 };
  const ts = 10000; // a 10s tab switch
  st.acc += Math.min((ts - st.lastTs) / 1000, maxTicks * tickDt);
  let ticks = 0;
  while (st.acc >= tickDt) { st.acc -= tickDt; ticks++; }
  ok(ticks <= maxTicks, `expected at most ${maxTicks} catch-up ticks, got ${ticks}`);
});

it('records finish time from the sim clock, not the wall clock', () => {
  ok(/const elapsedS = ph\.simS;/.test(levelScreenJs),
    'elapsed must come from ph.simS');
  ok(/ph\.wonAtS = ph\.simS;/.test(levelScreenJs),
    'wonAtS must be stamped from the sim clock');
  ok(!/ph\.startTs/.test(levelScreenJs),
    'ph.startTs is the old wall-clock timer — recorded times would depend on refresh rate');
});

// ── 4. Shell integrity ─────────────────────────────────────────────────────

describe('Shell integrity');

const indexHtml = read(path.join(ROOT, 'function-plane', 'index.html'));
const swJs      = read(path.join(ROOT, 'function-plane', 'sw.js'));

const scriptSrcs = [...indexHtml.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
const linkHrefs  = [...indexHtml.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(m => m[1]);
const shell      = [...swJs.match(/const SHELL = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);

it('precaches every script and stylesheet index.html loads', () => {
  const missing = [...scriptSrcs, ...linkHrefs].filter(s => !shell.includes('./' + s));
  eq(missing.length, 0, `files loaded by index.html but absent from sw.js SHELL: ${missing.join(', ')}`);
});

it('precaches every self-hosted font', () => {
  // Fonts are referenced from vendor/fonts.css, not index.html, so they are
  // easy to add without touching SHELL — and the miss only shows up as
  // fallback type on a cold offline launch.
  const fontsCss = read(path.join(ROOT, 'function-plane', 'vendor', 'fonts.css'));
  const faces = [...fontsCss.matchAll(/url\('([^']+)'\)/g)].map(m => m[1]);
  ok(faces.length > 0, 'vendor/fonts.css declares no @font-face sources');
  const missing = faces.filter(f => !shell.includes('./vendor/' + f));
  eq(missing.length, 0, `fonts absent from sw.js SHELL: ${missing.join(', ')}`);
  const absent = faces.filter(f => !fs.existsSync(path.join(ROOT, 'function-plane', 'vendor', f)));
  eq(absent.length, 0, `fonts.css references missing files: ${absent.join(', ')}`);
});

it('loads no third-party resources', () => {
  // The app must talk to nobody but Supabase: the native WebView has no
  // network on a cold first launch, and the privacy policy says so.
  const external = [...indexHtml.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map(m => m[1]);
  eq(external.length, 0, `index.html loads external resources: ${external.join(', ')}`);
});

it('points apple-touch-icon at a PNG', () => {
  // iOS ignores an SVG apple-touch-icon and falls back to a screenshot.
  const m = indexHtml.match(/rel="apple-touch-icon" href="([^"]+)"/);
  ok(m, 'no apple-touch-icon');
  ok(m[1].endsWith('.png'), `apple-touch-icon must be a PNG, got ${m[1]}`);
});

it('ships maskable and 192/512 PNG icons in the manifest', () => {
  const manifest = JSON.parse(read(path.join(ROOT, 'function-plane', 'manifest.json')));
  const pngs = manifest.icons.filter(i => i.type === 'image/png');
  for (const size of ['192x192', '512x512']) {
    ok(pngs.some(i => i.sizes === size && i.purpose.includes('any')),
      `manifest needs a ${size} PNG icon`);
  }
  ok(pngs.some(i => i.purpose === 'maskable'), 'manifest needs a maskable icon');
  for (const i of manifest.icons) {
    ok(fs.existsSync(path.join(ROOT, 'function-plane', i.src)), `manifest icon missing: ${i.src}`);
    ok(shell.includes('./' + i.src), `manifest icon not precached: ${i.src}`);
  }
});

it('does not precache files that no longer exist', () => {
  const gone = shell
    .filter(s => s !== './' && s !== './index.html')
    .filter(s => !fs.existsSync(path.join(ROOT, 'function-plane', s)));
  eq(gone.length, 0, `sw.js SHELL lists missing files: ${gone.join(', ')}`);
});

it('compiles every .jsx to a .js sibling', () => {
  const stale = fs.readdirSync(SRC)
    .filter(f => f.endsWith('.jsx'))
    .filter(f => !fs.existsSync(path.join(SRC, f.replace(/\.jsx$/, '.js'))));
  eq(stale.length, 0, `.jsx without a compiled .js: ${stale.join(', ')}`);
});

it('guards every screen it renders in mount()', () => {
  // The documented cold-load race: a screen added to the router but missing
  // from mount()'s typeof poll renders before its script has finished
  // parsing. Only reproduces on a slow first load, so it ships easily.
  const appJs = read(path.join(SRC, 'app.js'));
  const rendered = new Set(
    [...appJs.matchAll(/React\.createElement\((\w+Screen)[,)]/g)].map(m => m[1])
  );
  const guarded = new Set(
    [...appJs.matchAll(/typeof (\w+Screen) === 'undefined'/g)].map(m => m[1])
  );
  const unguarded = [...rendered]
    // Screens declared in app.js itself have no race to lose.
    .filter(n => !new RegExp(`function ${n}\\b`).test(appJs))
    .filter(n => !guarded.has(n));
  eq(unguarded.length, 0, `screens rendered without a mount() guard: ${unguarded.join(', ')}`);
});

it('loads app.js last', () => {
  eq(scriptSrcs[scriptSrcs.length - 1], 'src/app.js',
    'app.js calls createRoot().render() and must load after everything it renders');
});

it('reports one version per release', () => {
  const versions = new Set();
  for (const f of ['main-screen.js', 'settings-screen.js']) {
    const m = read(path.join(SRC, f)).match(/v 1\.0 \\?[xu]?\w* ?· ?build (\d+)|v 1\.0 [^"']*build (\d+)/);
    if (m) versions.add(m[1] || m[2]);
  }
  eq(versions.size, 1, `screens disagree on the build number: ${[...versions].join(' vs ')}`);
});

// ── 4b. Networking ─────────────────────────────────────────────────────────

describe('Networking');

const accountsJs = read(path.join(SRC, 'accounts.js'));

it('bounds every network call with a timeout', () => {
  // fetch() never times out on its own, so an unanswered request leaves its
  // promise pending and whatever spinner is waiting on it stays up forever.
  // This failure mode is invisible in a browser until you hit it in the wild.
  ok(/function _withTimeout\(/.test(accountsJs), 'accounts.js must define _withTimeout');
  const guarded = [
    [/_withTimeout\(fetchLive\(\)/,            'leaderboard fetches'],
    [/_withTimeout\(_sb\.from\('level_scores'\)\s*\n?\s*\.select/, 'the audit query'],
    [/_withTimeout\(Promise\.all\(\[/,         'the progress upload'],
    [/_withTimeout\(_sb\.from\('level_scores'\)\.upsert/, 'the score upload'],
  ];
  for (const [re, what] of guarded) {
    ok(re.test(accountsJs), `${what} must go through _withTimeout`);
  }
});

it('explains an empty leaderboard rather than implying there are no scores', () => {
  // "No scores yet — be the first!" is a lie when the real answer is "we
  // could not reach the server", and it hides outages from the one person
  // who could fix them.
  ok(/_emitSyncError\('Leaderboard unavailable: '/.test(accountsJs),
    'a failed leaderboard fetch with no cached copy must surface the reason');
});

// ── 5. Level data ──────────────────────────────────────────────────────────

describe('Level data');

const snapshot = loadBrowserModules(['overrides-snapshot.js']).FP_OVERRIDES_SNAPSHOT;

it('ships a parseable override snapshot', () => {
  ok(snapshot && snapshot.data, 'snapshot missing');
  ok(Array.isArray(snapshot.data.levels), 'snapshot.data.levels must be an array');
  ok(Array.isArray(snapshot.data.packs), 'snapshot.data.packs must be an array');
});

it('authors every level it ships with sane goals', () => {
  for (const l of snapshot.data.levels) {
    ok(Array.isArray(l.stars) && l.stars.length > 0, `${l.pack_id}-${l.level_index} has no stars`);
    ok(l.ball_x != null && l.ball_y != null, `${l.pack_id}-${l.level_index} has no ball position`);
    ok(l.eq_goal >= 1, `${l.pack_id}-${l.level_index} eq_goal must be at least 1`);
    ok(l.score_goal > 0, `${l.pack_id}-${l.level_index} needs a positive score goal`);
  }
});

it('keeps the fallback level goal on the authored scale', () => {
  // A _default far above the authored range makes any unauthored level
  // trivially 2-startable, which is how the 320 vs 30-90 gap went unnoticed.
  const dataJs = read(path.join(SRC, 'data.js'));
  const fallback = Number(dataJs.match(/_default:[\s\S]*?scoreGoal: (\d+)/)[1]);
  const authored = snapshot.data.levels.map(l => l.score_goal).filter(Boolean).sort((a, b) => a - b);
  const median = authored[Math.floor(authored.length / 2)];
  ok(fallback <= median * 3,
    `_default scoreGoal ${fallback} is far above the authored median ${median}`);
});

// ── Content coverage (informational) ───────────────────────────────────────

const PACK_SIZE = 10;
const hidden = new Set(snapshot.data.packs.filter(p => p.is_hidden).map(p => p.pack_id));
const ALL_PACKS = ['r-I','r-II','r-III','r-IV','r-V','r-VI','r-VII','r-VIII','r-IX','r-X',
                   's-lin','s-qua','s-trig','s-exp'];
const visible = ALL_PACKS.filter(p => !hidden.has(p));
const authoredPerPack = {};
for (const l of snapshot.data.levels) {
  authoredPerPack[l.pack_id] = (authoredPerPack[l.pack_id] || 0) + 1;
}

console.log('\nContent coverage (informational — does not fail the suite)');
console.log(`  visible packs: ${visible.length} (${visible.length * PACK_SIZE} levels)`);
const gaps = visible.filter(p => (authoredPerPack[p] || 0) < PACK_SIZE);
const authoredVisible = visible.reduce((n, p) => n + Math.min(authoredPerPack[p] || 0, PACK_SIZE), 0);
console.log(`  authored:      ${authoredVisible} / ${visible.length * PACK_SIZE}`);
if (gaps.length) {
  console.log('  placeholder levels remain in:');
  for (const p of gaps) {
    console.log(`    ${p.padEnd(7)} ${authoredPerPack[p] || 0}/${PACK_SIZE} authored`);
  }
} else {
  console.log('  every visible pack is fully authored');
}

// ── Build parity (skipped without Babel) ───────────────────────────────────

describe('Build parity');

let babel = null;
try { babel = require('@babel/core'); } catch { /* optional */ }

if (!babel) {
  console.log('  skip @babel/core not installed — run npm install to check .js/.jsx parity');
} else {
  it('keeps every compiled .js in sync with its .jsx', () => {
    // Babel versions differ in whether they escape non-ASCII in string
    // literals, so compare with escapes normalized (see CLAUDE.md).
    const norm = s => s
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    const drifted = [];
    for (const f of fs.readdirSync(SRC).filter(f => f.endsWith('.jsx'))) {
      const out = babel.transformSync(read(path.join(SRC, f)), {
        presets: [[require('@babel/preset-react'), { runtime: 'classic' }]],
        filename: f,
        babelrc: false, configFile: false,
      }).code;
      const committed = read(path.join(SRC, f.replace(/\.jsx$/, '.js')));
      if (norm(out).trim() !== norm(committed).trim()) drifted.push(f);
    }
    eq(drifted.length, 0, `compiled .js is stale — run npm run build:jsx: ${drifted.join(', ')}`);
  });
}

// ── Summary ────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
if (failures.length === 0) {
  console.log(`${passed} passed`);
  process.exit(0);
}
console.log(`${passed} passed, ${failures.length} failed\n`);
for (const f of failures) console.log(`  ${f.group} › ${f.name}\n    ${f.message}`);
process.exit(1);
