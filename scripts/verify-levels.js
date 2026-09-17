// Function Plane — headless level verifier
//
// Replays a candidate solution through the *real* run loop — the same
// parseEquation, makeWorld, makeRunColliders, drainTicks and outOfWorld the
// level screen exports — so a level that verifies here is a level that plays.
// A lookalike loop would drift the first time physics changed.
//
// The browser modules need a window, a React object to destructure hooks off
// at load time, and nothing else: every function used below is pure.
//
//   node scripts/verify-levels.js [spec.json ...] [--svg <dir>] [--json <file>] [--trail]
//
// Specs default to levels/*.json. Each holds { packId, modifier?, levels: [] },
// and each level mirrors a level_overrides row plus optional `solutions` — the first is
// what the author intends the player to write, the rest are other answers the
// level is meant to accept. A level passes when the intended solution earns all
// three stars AND every alternative still clears: a level only one curve can
// solve is a level with no room for a better time on the leaderboard.

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC  = path.join(ROOT, 'function-plane', 'src');

// ── The game, headless ─────────────────────────────────────────────────────
function loadGame() {
  // `window` is the global object, the way it is in a browser: these modules
  // assign to `window.FP_OBJECTS` and then read bare `FP_OBJECTS`, which only
  // resolves if the two are the same object.
  const w = globalThis;
  global.window = w;
  global.self   = w;
  // Hooks are destructured off React at module load. Nothing verified here
  // renders, so a stub that answers every property with a no-op is enough.
  global.React = w.React = new Proxy({}, { get: () => () => {} });
  global.document  = { createElement: () => ({ style: {} }), addEventListener() {}, body: {} };
  global.navigator = { userAgent: 'node' };
  for (const f of ['physics-config.js', 'physics-engine.js', 'equation-classifier.js',
                   'level-objects.js', 'level-screen.js']) {
    delete require.cache[require.resolve(path.join(SRC, f))];
    require(path.join(SRC, f));
  }
  return w;
}

const G = loadGame();
const { TICK_DT, BALL_R } = G.SIM;
const TIME_LIMIT = 28;   // mirrors level-screen; the run loop below is its rAF

// ── One run ────────────────────────────────────────────────────────────────
// Mirrors LevelScreen's animation frame: drain a frame's worth of time, then
// test the same fail/succeed pair it tests. Timestamps are synthetic and
// exactly one tick apart, so a verified run is bit-reproducible.
function runLevel(level, modifier, which = 0) {
  window.FP_PARAMS = {};

  const row = (expr, i, preplaced) => {
    const spec   = typeof expr === 'string' ? { expr } : expr;
    const parsed = G.parseEquation(spec.expr);
    return {
      id: preplaced ? -(i + 1) : i + 1,
      expr: spec.expr, ...parsed,
      visible: true,
      domain: spec.domain || null,
      material: spec.material || null,
      preplaced,
    };
  };

  const pre  = (level.preplaced || []).map((e, i) => row(e, i, true));
  const user = (level.solutions[which].eqs || []).map((e, i) => row(e, i, false));
  const equations = [...pre, ...user];

  const unparsed = equations.filter(e => !e.fn && !e.param);
  if (unparsed.length) {
    return { ok: false, why: `did not parse: ${unparsed.map(e => e.expr).join(', ')}` };
  }
  if (level.materials !== true && user.some(e => e.material)) {
    return { ok: false, why: 'solution sets a material on a level without materials enabled' };
  }

  const world     = G.makeWorld(level.objects || [], modifier === 'gravityFlip');
  const colliders = G.makeRunColliders(equations, world);
  const ph        = G.freshPh(level.ball, level.stars);

  let ts = 0, outcome = null;
  while (outcome == null) {
    ts += TICK_DT * 1000;
    G.drainTicks(ph, colliders, world, ts);
    const wonElapsed = ph.wonAtS != null ? ph.simS - ph.wonAtS : -1;
    if (ph.wonAtS == null && (ph.dead || G.outOfWorld(ph) || ph.simS > TIME_LIMIT)) {
      outcome = ph.dead ? 'hazard' : G.outOfWorld(ph) ? 'left the world' : 'ran out of time';
    } else if (ph.wonAtS != null && wonElapsed >= 0.5) {
      outcome = 'cleared';
    }
  }

  const curves = user.filter(e => e.fn);
  const score  = G.computeScore(user);
  const bits   = G.starRating(curves.length, score, level.eqGoal, level.scoreGoal);

  return {
    ok: outcome === 'cleared',
    why: outcome,
    time: ph.wonAtS != null ? +ph.wonAtS.toFixed(2) : null,
    collected: ph.stars.filter(s => s.collected).length,
    total: ph.stars.length,
    bounces: ph.bounces,
    eqs: curves.length,
    score, bits,
    stars: G.starCount ? G.starCount(bits) : ((bits & 1) + ((bits >> 1) & 1) + ((bits >> 2) & 1)),
    trail: ph.trail,
    equations,
  };
}

// Every answer a level is meant to accept, intended first.
function runAll(level, modifier) {
  return level.solutions.map((_, i) => runLevel(level, modifier, i));
}

// ── Rendering ──────────────────────────────────────────────────────────────
// A picture of the level as authored plus the path the intended solution
// actually takes. Reviewing 72 levels as coordinate lists is not reviewing.
const INK = '#18181a', GRID = '#ececea', AXIS = '#c8c8c2', BG = '#fafaf7';
const EQ_COLORS = G.SIM.EQ_COLORS;
const OBJ = G.FP_OBJECTS.KINDS;

function renderSVG(level, res, title) {
  const pad = 0.8;
  const xs = [level.ball.x, ...level.stars.map(s => s.x), ...(res.trail || []).map(p => p.x)];
  const ys = [level.ball.y, ...level.stars.map(s => s.y), ...(res.trail || []).map(p => p.y)];
  for (const o of level.objects || []) {
    const r = o.kind === 'well' ? o.r : Math.max(o.w || 0, o.h || 0, o.len || 0);
    xs.push(o.x - r, o.x + r); ys.push(o.y - r, o.y + r);
  }
  let x0 = Math.floor(Math.min(...xs) - pad), x1 = Math.ceil(Math.max(...xs) + pad);
  let y0 = Math.floor(Math.min(...ys) - pad), y1 = Math.ceil(Math.max(...ys) + pad);
  // Square the view so circles look like circles.
  const span = Math.max(x1 - x0, y1 - y0);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  x0 = cx - span / 2; x1 = cx + span / 2; y0 = cy - span / 2; y1 = cy + span / 2;

  const W = 560, H = 560, k = W / span;
  const X = x => (x - x0) * k, Y = y => H - (y - y0) * k;
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${title.replace(/[<>&"]/g, '')}">`);
  out.push(`<rect width="${W}" height="${H}" fill="${BG}"/>`);

  for (let gx = Math.ceil(x0); gx <= x1; gx++)
    out.push(`<line x1="${X(gx).toFixed(1)}" y1="0" x2="${X(gx).toFixed(1)}" y2="${H}" stroke="${gx === 0 ? AXIS : GRID}" stroke-width="${gx === 0 ? 1.4 : 1}"/>`);
  for (let gy = Math.ceil(y0); gy <= y1; gy++)
    out.push(`<line x1="0" y1="${Y(gy).toFixed(1)}" x2="${W}" y2="${Y(gy).toFixed(1)}" stroke="${gy === 0 ? AXIS : GRID}" stroke-width="${gy === 0 ? 1.4 : 1}"/>`);

  // Objects sit under the curves: they are regions, not walls.
  for (const o of level.objects || []) {
    const c = OBJ[o.kind].color;
    if (o.kind === 'well') {
      out.push(`<circle cx="${X(o.x)}" cy="${Y(o.y)}" r="${o.r * k}" fill="${c}" fill-opacity="0.09" stroke="${c}" stroke-width="1.6" stroke-dasharray="6 4"/>`);
    } else if (o.kind === 'fan') {
      const a = o.angle * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a);
      const px = -uy, py = ux, hw = o.w / 2;
      const pts = [[o.x + px * hw, o.y + py * hw], [o.x + px * hw + ux * o.len, o.y + py * hw + uy * o.len],
                   [o.x - px * hw + ux * o.len, o.y - py * hw + uy * o.len], [o.x - px * hw, o.y - py * hw]];
      out.push(`<polygon points="${pts.map(p => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ')}" fill="${c}" fill-opacity="0.09" stroke="${c}" stroke-width="1.6" stroke-dasharray="6 4"/>`);
      out.push(`<line x1="${X(pts[0][0])}" y1="${Y(pts[0][1])}" x2="${X(pts[3][0])}" y2="${Y(pts[3][1])}" stroke="${c}" stroke-width="5" stroke-linecap="round"/>`);
      // Which way the wind blows is the whole point of a fan; without an arrow
      // the box says nothing.
      // Sized in world units, not as a fraction of `len`: a long fan is not a
      // fan with a bigger arrow, and two fans facing each other must not have
      // their heads overlap into a blob.
      const hl = 0.42, hw2 = Math.min(0.26, o.w * 0.22), tail = Math.min(1.1, o.len * 0.3);
      const mx = o.x + ux * (o.len * 0.5), my = o.y + uy * (o.len * 0.5);
      out.push(`<line x1="${X(mx - ux * tail).toFixed(1)}" y1="${Y(my - uy * tail).toFixed(1)}" x2="${X(mx).toFixed(1)}" y2="${Y(my).toFixed(1)}" stroke="${c}" stroke-width="2" stroke-linecap="round" opacity="0.85"/>`);
      const head = [[mx + ux * hl, my + uy * hl],
                    [mx + px * hw2, my + py * hw2],
                    [mx - px * hw2, my - py * hw2]];
      out.push(`<polygon points="${head.map(p => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ')}" fill="${c}" opacity="0.85"/>`);
    } else {
      out.push(`<rect x="${X(o.x - o.w / 2).toFixed(1)}" y="${Y(o.y + o.h / 2).toFixed(1)}" width="${(o.w * k).toFixed(1)}" height="${(o.h * k).toFixed(1)}" fill="${c}" fill-opacity="0.1" stroke="${c}" stroke-width="1.6" stroke-dasharray="6 4"/>`);
    }
  }

  // Curves, sampled the way the renderer samples them.
  (res.equations || []).forEach((e, i) => {
    if (!e.fn) return;
    const col = EQ_COLORS[i % EQ_COLORS.length];
    const dash = e.material === 'rubber' ? ' stroke-dasharray="7 4"' : '';
    const wid  = e.material === 'dead' ? 4.4 : 3;
    if (e.isImplicit) {
      // Marching-squares-free approximation: mark the sign changes on a grid.
      const N = 360, d = [];
      for (let ix = 0; ix <= N; ix++) for (let iy = 0; iy <= N; iy++) {
        const wx = x0 + (ix / N) * span, wy = y0 + (iy / N) * span;
        const v = e.fn(wx, wy), vx = e.fn(wx + span / N, wy), vy = e.fn(wx, wy + span / N);
        if (!isFinite(v)) continue;
        if (isFinite(vx) && v * vx < 0) d.push(`M${X(wx).toFixed(1)} ${Y(wy).toFixed(1)}h1.6`);
        else if (isFinite(vy) && v * vy < 0) d.push(`M${X(wx).toFixed(1)} ${Y(wy).toFixed(1)}v1.6`);
      }
      out.push(`<path d="${d.join('')}" stroke="${col}" stroke-width="${wid}" fill="none"${dash}/>`);
    } else {
      let d = '', pen = false;
      for (let px = 0; px <= W; px++) {
        const wx = x0 + (px / W) * span;
        const inDom = !e.domain || e.domain.some(s => wx >= s.xMin && wx <= s.xMax);
        const wy = inDom ? e.fn(wx) : NaN;
        if (!isFinite(wy) || wy < y0 - span || wy > y1 + span) { pen = false; continue; }
        d += `${pen ? 'L' : 'M'}${px} ${Y(wy).toFixed(1)}`;
        pen = true;
      }
      out.push(`<path d="${d}" stroke="${col}" stroke-width="${wid}" fill="none"${dash}/>`);
    }
  });

  // The path the ball actually took.
  if (res.trail && res.trail.length > 1) {
    out.push(`<path d="${res.trail.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`).join('')}" stroke="${INK}" stroke-width="2" fill="none" opacity="0.32" stroke-dasharray="3 3"/>`);
  }

  level.stars.forEach((s, i) => {
    const r = 11;
    const pts = [];
    for (let p = 0; p < 10; p++) {
      const ang = -Math.PI / 2 + p * Math.PI / 5, rr = p % 2 ? r * 0.44 : r;
      pts.push(`${(X(s.x) + rr * Math.cos(ang)).toFixed(1)},${(Y(s.y) + rr * Math.sin(ang)).toFixed(1)}`);
    }
    out.push(`<polygon points="${pts.join(' ')}" fill="${INK}" opacity="0.9"/>`);
    out.push(`<text x="${X(s.x) + 14}" y="${Y(s.y) - 9}" font-family="ui-monospace,monospace" font-size="11" fill="${INK}" opacity="0.55">${i + 1}</text>`);
  });

  out.push(`<circle cx="${X(level.ball.x)}" cy="${Y(level.ball.y)}" r="${BALL_R * k}" fill="${BG}" stroke="${INK}" stroke-width="2.4"/>`);
  out.push(`<text x="${X(level.ball.x) + BALL_R * k + 6}" y="${Y(level.ball.y) + 4}" font-family="ui-monospace,monospace" font-size="11" fill="${INK}" opacity="0.55">start</text>`);

  out.push('</svg>');
  return out.join('\n');
}

// ── CLI ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const svgAt = args.indexOf('--svg');
const svgDir = svgAt >= 0 ? args[svgAt + 1] : null;
const specs = args.filter((a, i) => !a.startsWith('--')
  && !(svgAt >= 0 && i === svgAt + 1) && !(args.indexOf('--json') >= 0 && i === args.indexOf('--json') + 1));

const files = specs.length ? specs
  : fs.existsSync(path.join(ROOT, 'levels'))
    ? fs.readdirSync(path.join(ROOT, 'levels')).filter(f => f.endsWith('.json')).map(f => path.join(ROOT, 'levels', f))
    : [];

if (!files.length) {
  console.error('No level specs found. Pass a file, or put one in levels/.');
  process.exit(1);
}
if (svgDir) fs.mkdirSync(svgDir, { recursive: true });

const jsonAt  = args.indexOf('--json');
const jsonOut = jsonAt >= 0 ? args[jsonAt + 1] : null;
const report  = [];

let failures = 0, total = 0;
for (const file of files) {
  const spec = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(`\n${spec.packId}${spec.modifier ? ` (${spec.modifier})` : ''} — ${path.basename(file)}`);
  console.log('  #  name                 outcome        time   eqs  score/goal  stars');
  for (const level of spec.levels) {
    // A level with no `solutions` has no answer to replay — either it was
    // playtested by hand, or it is geometry authored before anyone solved it.
    // Say which of those is unknowable from here, so say neither: pretending to
    // verify it would be worse than admitting we didn't.
    if (!level.solutions || !level.solutions.length) {
      console.log(`  – ${level.index}. ${(level.name || '').padEnd(20).slice(0, 20)} no answer recorded, not replayed`);
      report.push({ packId: spec.packId, level, results: [] });
      continue;
    }
    total++;
    const all = runAll(level, spec.modifier);
    const res = all[0];
    const brokenAlt = all.slice(1).some(r => !r.ok);
    const tag = res.ok && res.stars === 3 && !brokenAlt ? '✓' : res.ok ? '~' : '✗';
    if (!res.ok || res.stars !== 3 || brokenAlt) failures++;
    const goal = `${String(res.score ?? '—').padStart(3)}/${String(level.scoreGoal).padEnd(3)}`;
    console.log(`  ${tag} ${String(level.index).padStart(1)}. ${(level.name || '').padEnd(20).slice(0, 20)} ` +
      `${(res.why || '').padEnd(14)} ${String(res.time ?? '—').padStart(5)}  ` +
      `${String(res.eqs ?? '—').padStart(2)}/${level.eqGoal}  ${goal}  ${res.ok ? '★'.repeat(res.stars) + '☆'.repeat(3 - res.stars) : '—'}`);
    if (res.ok && res.collected !== res.total) console.log(`      collected ${res.collected}/${res.total}`);
    if (!res.ok && res.why && res.collected != null) console.log(`      collected ${res.collected}/${res.total} before failing`);
    all.forEach((r, i) => {
      const name = level.solutions[i].name;
      const mark = r.ok ? (r.stars === 3 ? '·' : '~') : '✗';
      console.log(`      ${mark} ${name.padEnd(22).slice(0, 22)} ${(r.why || '').padEnd(14)} ` +
        `${String(r.time ?? '—').padStart(5)}  ${String(r.eqs ?? '—').padStart(2)} eq  ` +
        `${String(r.score ?? '—').padStart(3)}  ${r.ok ? '★'.repeat(r.stars) : ''}`);
    });
    // Authoring aid: a star belongs where the ball actually goes, not where it
    // looked like it would.
    if (args.includes('--trail') && res.trail) {
      console.log('      trail: ' + res.trail.filter((_, i) => i % 4 === 0)
        .map(p => `(${p.x.toFixed(1)},${p.y.toFixed(1)})`).join(' '));
    }
    report.push({
      packId: spec.packId, level,
      results: all.map((r, i) => ({
        name: level.solutions[i].name,
        ok: r.ok, why: r.why, time: r.time, eqs: r.eqs,
        score: r.score, stars: r.stars, bounces: r.bounces,
        collected: r.collected, total: r.total,
      })),
    });
    if (svgDir) {
      const name = `${spec.packId}-${level.index}.svg`;
      const caption = `${spec.packId} · ${level.index}. ${level.name}   —   ${level.solutions[0].eqs.map(s => typeof s === 'string' ? s : s.expr).join('   ')}`;
      fs.writeFileSync(path.join(svgDir, name), renderSVG(level, res, caption));
    }
  }
}

if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(report, null, 2));
console.log(`\n${total - failures}/${total} levels verified: intended answer at three stars, every alternative clears.`);
if (svgDir) console.log(`Renders in ${svgDir}`);
process.exit(failures ? 1 : 0);
