// Function Plane — ball collision engine (window.FP_PHYSICS)
//
// Collides the ball against *sampled curve geometry* instead of analytic
// approximations. The previous engine modelled each curve as its tangent
// line at the ball's x (explicit) or as F/|∇F| (implicit); both blow up on
// high-frequency curves (y=sin(40x) teleported the ball), discontinuities
// (floor() staircases grew invisible walls) and sharp corners (the hitbox
// sank below the visual sprite). Here every equation is turned into short
// line segments — the same geometry the plot renderer draws — and the ball
// resolves against the true closest point on them:
//
//   - explicit y=f(x): adaptively-sampled polyline. Sampling is refined
//     wherever the curve deviates from a straight chord, down to MIN_DX,
//     so arbitrarily wiggly curves are followed faithfully.
//   - implicit F(x,y)=0: marching squares on a small fine grid around the
//     ball (the renderer uses the same algorithm for the whole viewport,
//     so the ball collides with what the player sees).
//
// The *response* is byte-for-byte the old rule set — same integrator, same
// bounciness on the normal component, same energyRetention applied only to
// real bounces (|vn| > threshold), tangential motion preserved — so gravity,
// bounciness and traction feel identical on curves that already worked.
//
// Discontinuity policy: "collide with what's drawn."
//   - A small jump (floor(x) risers, |Δy| ≤ JUMP_BREAK) renders as a solid
//     vertical stroke, so it is solid to the ball too.
//   - An asymptote-scale jump (tan, 1/x: |Δy| > JUMP_BREAK across one
//     MIN_DX step) is where the renderer lifts the pen — the ball passes
//     through the gap instead of hitting an invisible wall.
//   - NaN regions (out-of-domain, sqrt of negatives) are holes, exactly
//     like the renderer's pen breaks.

(function () {
  'use strict';

  // ── Geometry sampling tuning ─────────────────────────────────────────
  // These only control how accurately curve geometry is extracted — they
  // do NOT change how the ball responds to contact (see PHYSICS_CONFIG
  // and the cfg passed to stepBall for that).
  const BASE_DX    = 0.05;  // base sample spacing for explicit curves
  const TOL        = 0.005; // max chord↔curve deviation before subdividing
  const MIN_DX     = 1e-4;  // finest subdivision (jump localization width)
  const MAX_DEPTH  = 9;     // log2(BASE_DX / MIN_DX)
  const NAN_DEPTH  = 3;     // bisection levels spent hunting domain edges
                            // inside fully-NaN intervals before giving up
  const JUMP_BREAK = 20;    // |Δy| across one MIN_DX step above this is an
                            // asymptote (pen break), not a solid wall
  const MAX_NODES  = 6000;  // per-curve node budget per resample

  // Spatial caching: geometry is sampled in a window around the ball and
  // reused until the ball nears the window edge. PAD is how far beyond the
  // ball radius we sample; a rebuild triggers when the ball has travelled
  // PAD − REBUILD_SLACK from the window center, so the cached geometry
  // always covers everything within one ball radius of the ball.
  const PAD_X         = 0.8;  // explicit: half-window beyond ballR
  const PAD_BOX       = 0.5;  // implicit: box padding beyond ballR
  const CELL          = 0.03; // implicit marching-squares cell size
  const REBUILD_SLACK = 0.1;

  // ── Domain helper (x-restriction segments, same shape as level data) ──
  function inDomain(x, domain) {
    if (!domain || domain.length === 0) return true;
    return domain.some(s => x >= s.xMin && x <= s.xMax);
  }

  // Intersect [lo, hi] with the domain segments → sorted [a, b] intervals.
  function domainIntervals(domain, lo, hi) {
    if (!domain || domain.length === 0) return [[lo, hi]];
    const out = [];
    for (const s of domain) {
      const a = Math.max(lo, s.xMin), b = Math.min(hi, s.xMax);
      if (a < b) out.push([a, b]);
    }
    out.sort((p, q) => p[0] - q[0]);
    return out;
  }

  // ── Explicit y = f(x) → polyline ─────────────────────────────────────
  // Returns { xs, ys } node arrays in ascending x. A NaN entry in ys is a
  // pen break: the segments on either side of it are not connected.
  function buildExplicit(fn, domain, xLo, xHi) {
    const xs = [], ys = [];
    let lastFinite = false, lastX = 0, lastY = 0;

    const pushNode = (x, y) => {
      if (isFinite(y)) {
        // Asymptote check: a huge jump squeezed into one MIN_DX step means
        // the curve is discontinuous with a gap the renderer doesn't draw.
        // Wide steep chords (a genuinely steep straight line) stay solid.
        if (lastFinite && x - lastX <= MIN_DX * 2 &&
            Math.abs(y - lastY) > JUMP_BREAK) {
          xs.push(x); ys.push(NaN);
        }
        xs.push(x); ys.push(y);
        lastFinite = true; lastX = x; lastY = y;
      } else if (lastFinite) {
        xs.push(x); ys.push(NaN);
        lastFinite = false;
      }
    };

    // Invariant: the (xa, ya) end has already been emitted; subdiv decides
    // how finely to sample (xa, xb] and emits up to (xb, yb).
    function subdiv(xa, ya, xb, yb, depth) {
      const finA = isFinite(ya), finB = isFinite(yb);
      // Fully-NaN interval: probe a few levels for hidden domain islands
      // (e.g. sqrt(sin(10x))), then give up — matches the renderer, which
      // also can't see islands narrower than its sample step.
      if (!finA && !finB && depth <= MAX_DEPTH - NAN_DEPTH) return;
      if (depth <= 0 || xb - xa <= MIN_DX || xs.length > MAX_NODES) {
        pushNode(xb, yb);
        return;
      }
      const xm = 0.5 * (xa + xb), ym = fn(xm);
      if (finA && finB && isFinite(ym) &&
          Math.abs(ym - 0.5 * (ya + yb)) <= TOL) {
        pushNode(xb, yb);   // chord is within tolerance — accept
        return;
      }
      subdiv(xa, ya, xm, ym, depth - 1);
      subdiv(xm, ym, xb, yb, depth - 1);
    }

    for (const [a, b] of domainIntervals(domain, xLo, xHi)) {
      // Disjoint intervals never connect — force a pen break between them.
      if (xs.length) { xs.push(a); ys.push(NaN); }
      lastFinite = false;
      let xPrev = a, yPrev = fn(a);
      pushNode(xPrev, yPrev);
      // Interior base nodes sit on global multiples of BASE_DX (index-based,
      // not accumulated) so a resample from a shifted window reproduces
      // identical geometry — a resting ball never feels the surface move.
      for (let k = Math.floor(a / BASE_DX) + 1; k * BASE_DX < b - 1e-12; k++) {
        const x = k * BASE_DX, y = fn(x);
        subdiv(xPrev, yPrev, x, y, MAX_DEPTH);
        xPrev = x; yPrev = y;
      }
      subdiv(xPrev, yPrev, b, fn(b), MAX_DEPTH);
    }
    return { xs, ys };
  }

  // ── Implicit F(x,y) = 0 → segment soup ───────────────────────────────
  // Marching squares over a local grid; mirrors the renderer's algorithm
  // (including NaN-cell skipping and the ambiguous-cell rule) so physics
  // and visuals agree. Returns flat [ax,ay,bx,by, ...].
  function buildImplicit(fn, domain, x0, y0, x1, y1) {
    const nx = Math.max(2, Math.round((x1 - x0) / CELL));
    const ny = Math.max(2, Math.round((y1 - y0) / CELL));
    const dx = (x1 - x0) / nx, dy = (y1 - y0) / ny;
    const W = nx + 1;
    const vals = new Float64Array(W * (ny + 1));
    for (let j = 0; j <= ny; j++) {
      const y = y0 + j * dy;
      for (let i = 0; i <= nx; i++) {
        const x = x0 + i * dx;
        let v = NaN;
        if (inDomain(x, domain)) {
          v = fn(x, y);
          if (!isFinite(v)) v = NaN;
        }
        vals[j * W + i] = v;
      }
    }

    const lerp = (a, b, va, vb) => {
      const d = Math.abs(va) + Math.abs(vb);
      return d < 1e-12 ? (a + b) / 2 : a + (b - a) * Math.abs(va) / d;
    };

    const segs = [];
    const pts = new Float64Array(8);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const vbl = vals[j * W + i],       vbr = vals[j * W + i + 1];
        const vtr = vals[(j + 1) * W + i + 1], vtl = vals[(j + 1) * W + i];
        if (isNaN(vbl) || isNaN(vbr) || isNaN(vtr) || isNaN(vtl)) continue;
        const cx0 = x0 + i * dx, cx1 = x0 + (i + 1) * dx;
        const cy0 = y0 + j * dy, cy1 = y0 + (j + 1) * dy;
        const sbl = vbl > 0 ? 1 : 0, sbr = vbr > 0 ? 1 : 0;
        const str = vtr > 0 ? 1 : 0, stl = vtl > 0 ? 1 : 0;
        let np = 0;
        if (sbl !== sbr) { pts[np++] = lerp(cx0, cx1, vbl, vbr); pts[np++] = cy0; }
        if (sbr !== str) { pts[np++] = cx1; pts[np++] = lerp(cy0, cy1, vbr, vtr); }
        if (stl !== str) { pts[np++] = lerp(cx0, cx1, vtl, vtr); pts[np++] = cy1; }
        if (sbl !== stl) { pts[np++] = cx0; pts[np++] = lerp(cy0, cy1, vbl, vtl); }
        if (np === 4) {
          segs.push(pts[0], pts[1], pts[2], pts[3]);
        } else if (np === 8) {
          const vctr = (vbl + vbr + vtr + vtl) / 4;
          if ((vctr > 0) === (sbl > 0)) {
            segs.push(pts[0], pts[1], pts[6], pts[7]);
            segs.push(pts[2], pts[3], pts[4], pts[5]);
          } else {
            segs.push(pts[0], pts[1], pts[2], pts[3]);
            segs.push(pts[4], pts[5], pts[6], pts[7]);
          }
        }
      }
    }
    return segs;
  }

  // ── Closest-point queries ────────────────────────────────────────────
  // Both return { d2, qx, qy } for the closest curve point strictly within
  // R of (px, py), or null when there is no contact.

  function lowerBound(xs, v) {
    let lo = 0, hi = xs.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] < v) lo = mid + 1; else hi = mid;
    }
    return lo;
  }

  function closestOnPolyline(xs, ys, px, py, R) {
    // Any curve point within R of the ball has |x − px| ≤ R, and no
    // segment is wider than BASE_DX, so this x-window covers every
    // candidate segment. Nodes are ascending in x → binary search.
    const hiX = px + R + BASE_DX;
    let i = lowerBound(xs, px - R - BASE_DX);
    if (i > 0) i--;
    let bestD2 = R * R, qx = 0, qy = 0, found = false;
    for (; i + 1 < xs.length && xs[i] <= hiX; i++) {
      const ya = ys[i], yb = ys[i + 1];
      if (!isFinite(ya) || !isFinite(yb)) continue;
      const ax = xs[i];
      const sdx = xs[i + 1] - ax, sdy = yb - ya;
      const len2 = sdx * sdx + sdy * sdy;
      let t = len2 > 1e-18 ? ((px - ax) * sdx + (py - ya) * sdy) / len2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const cx = ax + t * sdx, cy = ya + t * sdy;
      const ddx = px - cx, ddy = py - cy;
      const d2 = ddx * ddx + ddy * ddy;
      if (d2 < bestD2) { bestD2 = d2; qx = cx; qy = cy; found = true; }
    }
    return found ? { d2: bestD2, qx, qy } : null;
  }

  function closestOnSegs(segs, px, py, R) {
    let bestD2 = R * R, qx = 0, qy = 0, found = false;
    for (let i = 0; i < segs.length; i += 4) {
      const ax = segs[i], ay = segs[i + 1];
      const sdx = segs[i + 2] - ax, sdy = segs[i + 3] - ay;
      const len2 = sdx * sdx + sdy * sdy;
      let t = len2 > 1e-18 ? ((px - ax) * sdx + (py - ay) * sdy) / len2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const cx = ax + t * sdx, cy = ay + t * sdy;
      const ddx = px - cx, ddy = py - cy;
      const d2 = ddx * ddx + ddy * ddy;
      if (d2 < bestD2) { bestD2 = d2; qx = cx; qy = cy; found = true; }
    }
    return found ? { d2: bestD2, qx, qy } : null;
  }

  // ── Colliders (geometry cache + query) ───────────────────────────────
  function makeExplicitCollider(def, ballR) {
    let cache = null;
    return {
      query(px, py) {
        if (!cache || Math.abs(px - cache.cx) > PAD_X - REBUILD_SLACK) {
          const halfW = ballR + PAD_X;
          const g = buildExplicit(def.fn, def.domain, px - halfW, px + halfW);
          cache = { cx: px, xs: g.xs, ys: g.ys };
        }
        return closestOnPolyline(cache.xs, cache.ys, px, py, ballR);
      },
    };
  }

  function makeImplicitCollider(def, ballR) {
    let cache = null;
    return {
      query(px, py) {
        if (!cache ||
            Math.max(Math.abs(px - cache.cx), Math.abs(py - cache.cy)) >
              PAD_BOX - REBUILD_SLACK) {
          const half = ballR + PAD_BOX;
          // Box corners snap to the global CELL grid so resamples yield
          // identical segments no matter where the ball is.
          const x0 = Math.floor((px - half) / CELL) * CELL;
          const y0 = Math.floor((py - half) / CELL) * CELL;
          const x1 = Math.ceil((px + half) / CELL) * CELL;
          const y1 = Math.ceil((py + half) / CELL) * CELL;
          cache = {
            cx: px, cy: py,
            segs: buildImplicit(def.fn, def.domain, x0, y0, x1, y1),
          };
        }
        return closestOnSegs(cache.segs, px, py, ballR);
      },
    };
  }

  // ── Contact resolution — identical response law to the old engine ────
  function resolve(ph, col, cfg) {
    const R = cfg.ballR;
    const hit = col.query(ph.x, ph.y);
    if (!hit) return;
    const d = Math.sqrt(hit.d2);
    let nx, ny;
    if (d > 1e-9) {
      nx = (ph.x - hit.qx) / d;
      ny = (ph.y - hit.qy) / d;
    } else {
      // Ball center exactly on the curve (e.g. spawned there): push back
      // against the velocity, or straight up when at rest.
      const sp = Math.hypot(ph.vx, ph.vy);
      if (sp > 1e-9) { nx = -ph.vx / sp; ny = -ph.vy / sp; }
      else           { nx = 0;           ny = 1;           }
    }
    // Place the ball exactly R from the closest point, on its own side.
    ph.x = hit.qx + nx * R;
    ph.y = hit.qy + ny * R;

    // Reflect the inward normal velocity. energyRetention only on *real*
    // bounces — rolling contact (tiny vn every substep) must not bleed
    // momentum, that's the traction feel.
    const vn = ph.vx * nx + ph.vy * ny;
    if (vn < 0) {
      ph.vx -= (1 + cfg.bounciness) * vn * nx;
      ph.vy -= (1 + cfg.bounciness) * vn * ny;
      if (-vn > cfg.bounceThreshold) {
        ph.vx *= cfg.energyRetention;
        ph.vy *= cfg.energyRetention;
        ph.bounced = true;
      }
    }
  }

  // ── Public API ───────────────────────────────────────────────────────
  // makeColliders(defs, ballR): defs = [{ fn, domain, isImplicit }] — one
  //   collider per equation, with its own geometry cache. Build once per
  //   run (equations are locked while the sim is running).
  // stepBall(ph, colliders, dt, cfg): one integration substep. cfg =
  //   { gravity, ballR, bounciness, energyRetention, bounceThreshold }.
  window.FP_PHYSICS = {
    makeColliders(defs, ballR) {
      return defs.map(d =>
        d.isImplicit ? makeImplicitCollider(d, ballR)
                     : makeExplicitCollider(d, ballR));
    },

    stepBall(ph, colliders, dt, cfg) {
      // Semi-implicit Euler, same order as before: gravity → move → collide.
      // At normal play speeds one pass runs per call, preserving the old
      // trajectories exactly; only when a single substep would move the
      // ball a sizable fraction of its radius (extreme speeds where the
      // old engine tunneled) is the substep subdivided further.
      const speed = Math.hypot(ph.vx, ph.vy);
      let n = Math.ceil((speed * dt) / (0.35 * cfg.ballR));
      if (!isFinite(n) || n < 1) n = 1;
      if (n > 8) n = 8;
      const h = dt / n;
      for (let k = 0; k < n; k++) {
        ph.vy -= cfg.gravity * h;
        ph.x  += ph.vx * h;
        ph.y  += ph.vy * h;
        for (let c = 0; c < colliders.length; c++) {
          resolve(ph, colliders[c], cfg);
        }
      }
    },
  };
})();
