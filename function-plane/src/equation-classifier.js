// Function Plane — equation classifier (window.classifyEquation / detectClass)
//
// Replaces the old regex-on-raw-string classifier, which analyzed only
// x-powers and so mislabeled implicit and disguised equations:
//   x+y^2=1        → "linear"  (y-powers were invisible)
//   x*y=1          → "linear"  (product degree never counted)
//   y=2^x          → "linear"  (only e^ and letter^letter matched)
//   y=pow(x,7)     → "linear"  (pow() never matched)
//   y=(x+1)*(x-1)*x→ "linear"  (degree only counted through ^)
//   y=sqrt(x)      → "linear"  (roots invisible)
//   y=abs(x)/floor(x) → "linear" (piecewise invisible)
// ...all of which slipped past themed-pack restrictions and were underscored.
//
// This version tokenizes the expression (mirroring the runtime parser's
// conventions in normExpr: implicit multiplication after digits and closing
// parens, arcsin→asin aliases, π, ** and ^) and walks a real AST:
//   - polynomial degree is tracked through +,-,*,/,^ in BOTH x and y,
//     so implicit conics classify correctly (x+y^2=1 → quadratic),
//   - constant subtrees fold numerically (sin(1)*x stays linear, e^2 is
//     just a number, x^(1/2) is a root),
//   - variable exponents (2^x, x^y), roots, rationals (variable
//     denominators / negative powers), and piecewise ops (abs, floor,
//     ceil, round, min, max) each get their own class so they can't hide
//     inside themed packs.
//
// Scoring reproduces the old formula exactly on everything the old
// classifier got right (verified by test corpus), so existing level goals
// and records stay meaningful.

(function () {
  'use strict';

  const FN_TRIG    = { sin: 1, cos: 1, tan: 1 };
  const FN_INVTRIG = { asin: 1, acos: 1, atan: 1 };
  const FN_LOG     = { log: 1, ln: 1 };
  const FN_PIECE   = { abs: 1, floor: 1, ceil: 1, round: 1, min: 1, max: 1 };
  const CONSTS     = { e: Math.E, pi: Math.PI };

  function preprocess(raw) {
    return raw.toLowerCase().replace(/\s+/g, '')
      .replace(/arcsin/g, 'asin').replace(/arccos/g, 'acos').replace(/arctan/g, 'atan')
      .replace(/π/g, 'pi')
      .replace(/\*\*/g, '^');
  }

  function tokenize(s) {
    const toks = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if ((c >= '0' && c <= '9') || c === '.') {
        let j = i;
        while (j < s.length && ((s[j] >= '0' && s[j] <= '9') || s[j] === '.')) j++;
        const v = parseFloat(s.slice(i, j));
        if (!isFinite(v)) throw new Error('bad number');
        toks.push({ t: 'num', v });
        i = j; continue;
      }
      if ((c >= 'a' && c <= 'z') || c === '_') {
        let j = i;
        while (j < s.length && (((s[j] >= 'a' && s[j] <= 'z')) || (s[j] >= '0' && s[j] <= '9') || s[j] === '_')) j++;
        toks.push({ t: 'name', v: s.slice(i, j) });
        i = j; continue;
      }
      if ('+-*/^(),='.indexOf(c) >= 0) { toks.push({ t: c }); i++; continue; }
      throw new Error('bad char');
    }
    // Implicit multiplication, mirroring normExpr: after a digit before a
    // name/paren, and after a closing paren before a name/number/paren.
    const out = [];
    for (const tk of toks) {
      const prev = out[out.length - 1];
      if (prev && (
        (prev.t === 'num' && (tk.t === 'name' || tk.t === '(')) ||
        (prev.t === ')'   && (tk.t === 'name' || tk.t === 'num' || tk.t === '('))
      )) out.push({ t: '*' });
      out.push(tk);
    }
    return out;
  }

  // ── Parse + analyze in one pass ─────────────────────────────────────────
  // Nodes evaluate to { deg, val, frac }:
  //   deg  — polynomial degree in {x, y}, or null when not polynomial
  //   val  — numeric value when the subtree is a foldable constant
  //   frac — true when a fractional power (root) contributed to deg
  // Feature counts accumulate in ctx.
  function analyze(expr) {
    const ctx = {
      trig: 0, invTrig: 0, log: 0, expFn: 0, varExp: 0,
      sum: 0, deriv: 0, integ: 0, piecewise: 0,
      rational: false, unknown: false, frac: false,
      maxDeg: 0,
    };
    const toks = tokenize(preprocess(expr));
    let pos = 0;
    const bound = {};       // bound loop variables (sum's n)

    const peek = () => toks[pos];
    const eat  = t => { if (!toks[pos] || toks[pos].t !== t) throw new Error('expected ' + t); return toks[pos++]; };

    const CONST = v => ({ deg: 0, val: v, frac: false });
    const NONPOLY = () => ({ deg: null, val: undefined, frac: false });
    const bumpDeg = d => { if (d != null && isFinite(d) && d > ctx.maxDeg) ctx.maxDeg = d; };

    function isConstNode(n) { return n.deg === 0; }

    function parseExpr() {
      let a = parseTerm();
      while (peek() && (peek().t === '+' || peek().t === '-')) {
        const op = toks[pos++].t;
        const b = parseTerm();
        if (a.deg != null && b.deg != null) {
          const deg = Math.max(a.deg, b.deg);
          const val = (a.val != null && b.val != null)
            ? (op === '+' ? a.val + b.val : a.val - b.val) : undefined;
          a = { deg, val: deg === 0 ? val : undefined, frac: a.frac || b.frac };
        } else a = NONPOLY();
      }
      return a;
    }

    function parseTerm() {
      let a = parseUnary();
      while (peek() && (peek().t === '*' || peek().t === '/')) {
        const op = toks[pos++].t;
        const b = parseUnary();
        if (op === '*') {
          if (a.deg != null && b.deg != null) {
            const deg = a.deg + b.deg;
            bumpDeg(deg);
            const val = (a.val != null && b.val != null) ? a.val * b.val : undefined;
            a = { deg, val: deg === 0 ? val : undefined, frac: a.frac || b.frac };
          } else a = NONPOLY();
        } else { // '/'
          if (b.deg === 0) {
            const val = (a.val != null && b.val != null && b.val !== 0) ? a.val / b.val : undefined;
            a = { deg: a.deg, val: a.deg === 0 ? val : undefined, frac: a.frac };
          } else {
            // variable denominator — rational curve (1/x, x/(x-1), ...)
            ctx.rational = true;
            a = NONPOLY();
          }
        }
      }
      return a;
    }

    function parseUnary() {
      if (peek() && peek().t === '-') {
        pos++;
        const a = parseUnary();
        return { deg: a.deg, val: a.val != null ? -a.val : undefined, frac: a.frac };
      }
      if (peek() && peek().t === '+') { pos++; return parseUnary(); }
      return parsePower();
    }

    function parsePower() {
      const base = parseAtom();
      if (peek() && peek().t === '^') {
        pos++;
        const exp = parseUnary();   // right-associative, allows x^-2
        return powNode(base, exp);
      }
      return base;
    }

    function powNode(base, exp) {
      if (isConstNode(exp)) {
        const p = exp.val;
        if (isConstNode(base)) {
          const val = (base.val != null && p != null) ? Math.pow(base.val, p) : undefined;
          return { deg: 0, val, frac: false };
        }
        if (p == null) {
          // constant exponent of unknown value (e.g. sum's n): can't tell
          // integer from fractional — treat as a variable exponent so it's
          // never underclassified.
          ctx.varExp++;
          return NONPOLY();
        }
        if (base.deg != null) {
          if (Number.isInteger(p) && p >= 0) {
            const deg = base.deg * p;
            bumpDeg(deg);
            return { deg, val: undefined, frac: base.frac };
          }
          if (p < 0) { ctx.rational = true; return NONPOLY(); }   // x^-2 = 1/x^2
          // fractional exponent — a root (x^0.5, x^1.5, x^(1/2))
          ctx.frac = true;
          const deg = base.deg * p;
          bumpDeg(Math.ceil(deg));
          return { deg, val: undefined, frac: true };
        }
        return NONPOLY();       // e.g. sin(x)^2
      }
      // variable exponent: 2^x / e^x are exponential; x^y is doubly so
      if (isConstNode(base)) ctx.expFn++;
      else ctx.varExp++;
      return NONPOLY();
    }

    function parseArgs(n) {
      eat('(');
      const args = [];
      for (let k = 0; k < n; k++) {
        if (k > 0) eat(',');
        args.push(parseExpr());
      }
      eat(')');
      return args;
    }

    function parseAtom() {
      const tk = peek();
      if (!tk) throw new Error('unexpected end');
      if (tk.t === 'num') { pos++; return CONST(tk.v); }
      if (tk.t === '(') { pos++; const a = parseExpr(); eat(')'); return a; }
      if (tk.t === 'name') {
        const name = tk.v; pos++;
        const isCall = peek() && peek().t === '(';

        if (isCall) {
          if (FN_TRIG[name] || FN_INVTRIG[name] || FN_LOG[name] || name === 'exp' || name === 'sqrt') {
            const [a] = parseArgs(1);
            if (isConstNode(a) && a.val != null) {
              // constant argument — fold, don't count the feature
              const f = { sin: Math.sin, cos: Math.cos, tan: Math.tan,
                          asin: Math.asin, acos: Math.acos, atan: Math.atan,
                          log: Math.log, ln: Math.log, exp: Math.exp, sqrt: Math.sqrt }[name];
              return CONST(f(a.val));
            }
            if (FN_TRIG[name])    { ctx.trig++;    return NONPOLY(); }
            if (FN_INVTRIG[name]) { ctx.invTrig++; return NONPOLY(); }
            if (FN_LOG[name])     { ctx.log++;     return NONPOLY(); }
            if (name === 'exp')   { ctx.expFn++;   return NONPOLY(); }
            // sqrt(poly) — a root: half the degree, at least quadratic-class
            if (a.deg != null) {
              ctx.frac = true;
              const deg = a.deg * 0.5;
              bumpDeg(Math.ceil(deg));
              return { deg, val: undefined, frac: true };
            }
            ctx.frac = true;
            return NONPOLY();
          }
          if (name === 'abs' || name === 'floor' || name === 'ceil' || name === 'round') {
            const [a] = parseArgs(1);
            if (isConstNode(a) && a.val != null) {
              const f = { abs: Math.abs, floor: Math.floor, ceil: Math.ceil, round: Math.round }[name];
              return CONST(f(a.val));
            }
            ctx.piecewise++;
            return NONPOLY();
          }
          if (name === 'min' || name === 'max') {
            const [a, b] = parseArgs(2);
            if (isConstNode(a) && a.val != null && isConstNode(b) && b.val != null) {
              return CONST(name === 'min' ? Math.min(a.val, b.val) : Math.max(a.val, b.val));
            }
            ctx.piecewise++;
            return NONPOLY();
          }
          if (name === 'pow') {
            const [a, b] = parseArgs(2);
            return powNode(a, b);
          }
          if (name === 'sum') {
            ctx.sum++;
            eat('(');
            parseExpr(); eat(','); parseExpr(); eat(',');
            const wasBound = bound.n; bound.n = true;
            parseExpr();
            bound.n = wasBound;
            eat(')');
            return NONPOLY();
          }
          if (name === 'deriv' || name === 'integ') {
            ctx[name]++;
            parseArgs(1);
            return NONPOLY();
          }
          // unknown function
          ctx.unknown = true;
          parseArgs(1);
          return NONPOLY();
        }

        if (name === 'x' || name === 'y') { bumpDeg(1); return { deg: 1, val: undefined, frac: false }; }
        if (name in CONSTS) return CONST(CONSTS[name]);
        if (bound[name]) return { deg: 0, val: undefined, frac: false };   // sum's n
        ctx.unknown = true;
        return NONPOLY();
      }
      throw new Error('unexpected token');
    }

    // equation := expr ('=' expr)?
    const lhs = parseExpr();
    let deg = lhs.deg, frac = lhs.frac;
    if (peek() && peek().t === '=') {
      pos++;
      const rhs = parseExpr();
      deg = (deg != null && rhs.deg != null) ? Math.max(deg, rhs.deg) : null;
      frac = frac || rhs.frac;
    }
    if (peek()) throw new Error('trailing tokens');

    ctx.eqDeg = deg;
    ctx.eqFrac = frac || ctx.frac;
    return ctx;
  }

  // Effective polynomial degree for scoring/classing: overall equation
  // degree or the largest power seen anywhere; roots count as at least
  // quadratic (y=sqrt(x) is half a parabola).
  function effectiveDeg(ctx) {
    let d = Math.max(ctx.eqDeg != null ? ctx.eqDeg : 0, ctx.maxDeg);
    if (ctx.eqFrac) d = Math.max(Math.ceil(d), 2);
    return d;
  }

  // ── Public: detectClass ─────────────────────────────────────────────────
  // 'linear' | 'quadratic' | 'cubic' | 'trig' | 'exp' | 'inverseTrig' |
  // 'log' | 'advanced' | 'piecewise' | 'rational' | 'unknown' | null
  function detectClass(expr) {
    if (!expr || !expr.trim()) return null;
    let ctx;
    try { ctx = analyze(expr); }
    catch { return 'unknown'; }

    if (ctx.sum || ctx.deriv || ctx.integ) return 'advanced';
    if (ctx.invTrig)                       return 'inverseTrig';
    if (ctx.expFn || ctx.varExp)           return 'exp';
    if (ctx.log)                           return 'log';
    if (ctx.trig)                          return 'trig';
    if (ctx.piecewise)                     return 'piecewise';
    if (ctx.rational)                      return 'rational';
    if (ctx.unknown)                       return 'unknown';

    const d = effectiveDeg(ctx);
    if (d >= 3) return 'cubic';
    if (d >= 2 || ctx.eqFrac) return 'quadratic';
    return 'linear';    // degree 1 — and constants (y=5 is a flat line)
  }

  // ── Public: classifyEquation (complexity score) ─────────────────────────
  // Reproduces the old scoring on everything it classified correctly:
  // base score from the dominant feature, +60% of base per extra
  // transcendental, ×1.3 when mixing transcendentals with degree ≥ 2
  // polynomials, +5 per degree above 3.
  function classifyEquation(expr) {
    if (!expr || !expr.trim()) return 0;
    let ctx;
    try { ctx = analyze(expr); }
    catch { return 60; }   // unparseable — score high, never underscore

    const d = effectiveDeg(ctx);

    let score;
    if (ctx.integ > 0)        score = 55;  // numeric integral — most expensive
    else if (ctx.sum > 0)     score = 50;  // bounded series
    else if (ctx.varExp > 0)  score = 40;  // truly exponential (x^y, x^x)
    else if (ctx.invTrig > 0) score = 40;
    else if (ctx.deriv > 0)   score = 35;
    else if (ctx.expFn > 0)   score = 35;  // exp(), e^x, 2^x
    else if (ctx.log > 0)     score = 30;
    else if (ctx.trig > 0)    score = 25;
    else if (ctx.rational)    score = 30;  // 1/x-style curves
    else if (ctx.piecewise)   score = 20;  // abs / floor / ceil / round / min / max
    else if (ctx.unknown)     score = 10;  // unresolvable identifier — curve is inert
    else                      score = Math.max(1, d) * 10;

    // Composition cost — each additional transcendental beyond the first
    // adds ~60% of the dominant score (same set as the old totalTrans).
    const totalTrans = ctx.trig + ctx.invTrig + ctx.log + ctx.expFn
                     + ctx.sum + ctx.deriv + ctx.integ;
    if (totalTrans > 1) score += Math.round(score * 0.6 * (totalTrans - 1));

    // Mixing transcendental with polynomial of degree ≥ 2 (e.g. sin(x)*x^2)
    if (totalTrans >= 1 && ctx.maxDeg >= 2) score = Math.round(score * 1.3);

    // High-degree polynomials cost slightly more per extra power
    if (d >= 4) score += (d - 3) * 5;

    return score;
  }

  window.detectClass = detectClass;
  window.classifyEquation = classifyEquation;
})();
