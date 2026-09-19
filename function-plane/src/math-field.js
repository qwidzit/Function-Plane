// Function Plane — the equation field
//
// A structural editor. The row holds a *tree* — characters, fractions,
// exponents, roots and brackets — and the caret is a place in that tree, not
// an offset into a string. The text the parser reads is derived from the tree
// (`text()`), so what the row shows and what it means cannot drift: a fraction
// is a fraction because it is one, not because a slash happened to draw as
// one, and two "+" in a row are two "+" in a row.
//
// The editing rules are MathQuill's, which is what Desmos runs:
//   - "/" takes everything back to the previous operator as the numerator and
//     leaves the caret in the denominator (1, /, x, +, 1 is 1 over x+1);
//   - "^" opens an exponent; + - = < > typed at the end of one step out first;
//   - a bracket typed on its own is one-sided — its other half is a *ghost*
//     drawn faint and treated as present — and typing the other half closes
//     it; the ghost moves to the far end, so "(" in front of x+1 brackets all
//     of it;
//   - backspace at the start of a fraction, exponent or root spills its
//     contents into the line; on a bracket it takes one side and leaves the
//     other a ghost;
//   - "sqrt" and "pi" typed as letters become √ and π.
//
// Text in: `parseText` reads what the parser reads and builds the same tree
// typing it would have — a level's preplaced equations, the run history and
// the manual all come in this way. Text out: `textOf` writes what the parser
// reads, bracketing a fraction's halves and an exponent when they are more
// than one thing. Round trips are stable: text → tree → text is a fixed point.

const {
  useState: useMF,
  useRef: useMR,
  useEffect: useME,
  useLayoutEffect: useMLE
} = React;

// Names the parser calls. A fraction half or an exponent that is exactly one
// of these calls is one thing and needs no brackets.
const MF_FNS = ['arcsin', 'arccos', 'arctan', 'asin', 'acos', 'atan', 'sin', 'cos', 'tan', 'sqrt', 'abs', 'log', 'ln', 'exp', 'floor', 'ceil', 'round', 'max', 'min', 'pow', 'sgn', 'sum', 'deriv', 'integ'];
const MF_BR = {
  paren: {
    open: '(',
    close: ')',
    text: s => `(${s})`
  },
  abs: {
    open: '|',
    close: '|',
    text: s => `abs(${s})`
  },
  floor: {
    open: '⌊',
    close: '⌋',
    text: s => `floor(${s})`
  },
  ceil: {
    open: '⌈',
    close: '⌉',
    text: s => `ceil(${s})`
  }
};
// What a typed bracket character is: its kind, and which side it is. A pipe
// is either side.
const MF_BR_CH = {
  '(': ['paren', 'L'],
  ')': ['paren', 'R'],
  '|': ['abs', null],
  '⌊': ['floor', 'L'],
  '⌋': ['floor', 'R'],
  '⌈': ['ceil', 'L'],
  '⌉': ['ceil', 'R']
};
const MF_GLYPH = {
  '*': '·',
  '-': '−'
};
let mfSeq = 0;
class MBlock {
  constructor(parent) {
    this.id = ++mfSeq;
    this.nodes = [];
    this.parent = parent || null;
  }
  insert(i, nodes) {
    for (const n of nodes) n.parent = this;
    this.nodes.splice(i, 0, ...nodes);
  }
  remove(i, count) {
    return this.nodes.splice(i, count);
  }
  indexOf(n) {
    return this.nodes.indexOf(n);
  }
  get length() {
    return this.nodes.length;
  }
  isEmpty() {
    return this.nodes.length === 0;
  }
}
const mkBlock = (owner, nodes) => {
  const b = new MBlock(owner);
  b.insert(0, nodes || []);
  return b;
};
const mkCh = c => ({
  id: ++mfSeq,
  t: 'ch',
  c
});
const mkFrac = (num, den) => {
  const n = {
    id: ++mfSeq,
    t: 'frac'
  };
  n.num = mkBlock(n, num);
  n.den = mkBlock(n, den);
  return n;
};
const mkSup = body => {
  const n = {
    id: ++mfSeq,
    t: 'sup'
  };
  n.body = mkBlock(n, body);
  return n;
};
const mkSqrt = body => {
  const n = {
    id: ++mfSeq,
    t: 'sqrt'
  };
  n.body = mkBlock(n, body);
  return n;
};
// ghost: null (both sides drawn), 'L' or 'R' (that side is the faint one).
const mkBr = (kind, body, ghost) => {
  const n = {
    id: ++mfSeq,
    t: 'br',
    kind,
    ghost
  };
  n.body = mkBlock(n, body);
  return n;
};

// A node's blocks, in reading order.
const kidsOf = n => n.t === 'frac' ? [n.num, n.den] : n.t === 'ch' ? [] : [n.body];
const isCh = (n, re) => !!n && n.t === 'ch' && re.test(n.c);
const isBinOp = n => isCh(n, /[+\-*=<>,]/);
const solidOf = n => n.ghost === 'R' ? 'L' : n.ghost === 'L' ? 'R' : null;

// ─── Text out ────────────────────────────────────────────────

function textOf(block) {
  return block.nodes.map(nodeText).join('');
}
function nodeText(n) {
  switch (n.t) {
    case 'ch':
      return n.c;
    case 'frac':
      return `${wrapText(n.num)}/${wrapText(n.den)}`;
    case 'sup':
      return `^${wrapText(n.body)}`;
    case 'sqrt':
      return `sqrt(${textOf(n.body)})`;
    case 'br':
      return MF_BR[n.kind].text(textOf(n.body));
  }
}

// One thing, as the parser binds it: a number, a letter, a bracket group, a
// root, or a call of a known name. Anything else under a fraction bar or up in
// an exponent is bracketed, or 1 over x+1 would come out as 1/x + 1.
function isPrimary(nodes) {
  if (!nodes.length) return false;
  if (nodes.every(n => isCh(n, /[0-9.]/))) return true;
  if (nodes.length === 1) {
    const n = nodes[0];
    return n.t === 'ch' ? /[a-zA-Zπ]/.test(n.c) : n.t === 'sqrt' || n.t === 'br';
  }
  const last = nodes[nodes.length - 1],
    head = nodes.slice(0, -1);
  return last.t === 'br' && last.kind === 'paren' && head.every(n => isCh(n, /[a-zA-Z]/)) && MF_FNS.includes(head.map(n => n.c).join(''));
}
const wrapText = block => isPrimary(block.nodes) ? textOf(block) : `(${textOf(block)})`;

// ─── Text in ─────────────────────────────────────────────────

function mfTokens(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      out.push({
        t: 'num',
        v: src.slice(i, j)
      });
      i = j;
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      let j = i;
      while (j < src.length && /[a-zA-Z]/.test(src[j])) j++;
      const run = src.slice(i, j);
      out.push(run === 'pi' ? {
        t: 'other',
        v: 'π'
      } : {
        t: 'name',
        v: run
      });
      i = j;
      continue;
    }
    if (c === '(' || c === ')') {
      out.push({
        t: c
      });
      i++;
      continue;
    }
    if ('+-*/^=<>,'.indexOf(c) >= 0) {
      out.push({
        t: 'op',
        v: c
      });
      i++;
      continue;
    }
    out.push({
      t: 'other',
      v: c
    });
    i++;
  }
  return out;
}

// Builds the tree typing the text would have built, so an equation that comes
// back from a save looks the way it did when it was written.
function parseText(src) {
  const toks = mfTokens(src || '');
  let p = 0;
  const peek = () => toks[p];
  const opIs = v => !!peek() && peek().t === 'op' && peek().v === v;

  // At "(": the nodes inside, up to the matching ")" or the end.
  function group() {
    p++;
    const inner = seq(true);
    if (peek() && peek().t === ')') p++;
    return inner;
  }

  // A number, a letter run, π, a bracket group — or a call, when a known name
  // ends the run before a "(". The nodes it takes, in order.
  function primary() {
    const tk = peek();
    if (!tk) return [];
    if (tk.t === 'num') {
      p++;
      return [...tk.v].map(mkCh);
    }
    if (tk.t === 'other') {
      p++;
      return [mkCh(tk.v)];
    }
    if (tk.t === '(') return [mkBr('paren', group(), null)];
    if (tk.t !== 'name') return [];
    p++;
    const fn = peek() && peek().t === '(' ? MF_FNS.find(f => tk.v.endsWith(f)) : null;
    const head = [...(fn ? tk.v.slice(0, -fn.length) : tk.v)].map(mkCh);
    if (fn === 'sqrt') return [...head, mkSqrt(group())];
    if (fn === 'abs' || fn === 'floor' || fn === 'ceil') return [...head, mkBr(fn, group(), null)];
    if (fn) return [...head, ...[...fn].map(mkCh), mkBr('paren', group(), null)];
    return head;
  }

  // The operand after "/" or "^": a sign, one primary and the exponents on it
  // — what the parser binds there. A lone bracket group is unwrapped, because
  // (x+1)/2 is a fraction over x+1, not over (x+1).
  function term() {
    const out = [];
    while (opIs('-') || opIs('+')) {
      out.push(mkCh(peek().v));
      p++;
    }
    out.push(...primary());
    while (opIs('^')) {
      p++;
      out.push(mkSup(term()));
    }
    if (out.length === 1 && out[0].t === 'br' && out[0].kind === 'paren') {
      const b = out[0].body;
      return b.remove(0, b.length);
    }
    return out;
  }
  function seq(inGroup) {
    const out = [];
    for (;;) {
      const tk = peek();
      if (!tk) break;
      if (tk.t === ')') {
        if (inGroup) break;
        p++;
        out.push(mkCh(')'));
        continue;
      }
      if (opIs('/')) {
        // Numerator: back to the previous operator, the way "/" takes it when typed.
        p++;
        let j = out.length;
        while (j > 0 && !isBinOp(out[j - 1])) j--;
        const num = out.splice(j);
        out.push(mkFrac(num, term()));
        continue;
      }
      if (opIs('^')) {
        p++;
        out.push(mkSup(term()));
        continue;
      }
      if (tk.t === 'op' || tk.t === ',') {
        p++;
        out.push(mkCh(tk.v));
        continue;
      }
      const prim = primary();
      if (prim.length) {
        out.push(...prim);
        continue;
      }
      p++;
    }
    return out;
  }
  return mkBlock(null, seq(false));
}

// ─── The field ───────────────────────────────────────────────

class MathField {
  constructor(text, onUpdate) {
    this.onUpdate = onUpdate || (() => {});
    this.input = null; // the focusable element the row gives it
    this.setText(text);
  }
  setText(s) {
    this.root = parseText(s);
    this.cur = {
      blk: this.root,
      i: this.root.length
    };
  }
  text() {
    return textOf(this.root);
  }
  render(withCaret = true) {
    return renderBlock(this.root, withCaret ? this.cur : null);
  }
  changed() {
    this.onUpdate();
  }
  focus() {
    this.input?.focus();
  }
  blur() {
    this.input?.blur();
  }

  // Each key typed. Everything the keyboard and a hardware keyboard send comes
  // through here, so the two can never disagree about what a character does.
  write(str) {
    for (const ch of str) this.type(ch);
    this.changed();
  }
  typed(ch) {
    this.type(ch);
    this.changed();
  }
  type(ch) {
    if (ch === ' ') return;
    if (ch === '×' || ch === '·') ch = '*';
    if (ch === '−') ch = '-';
    if (ch === '/' || ch === '÷') return this.frac(true);
    if (ch === '^') return this.sup(true);
    if (ch === '√') return this.sqrt(true);
    if (MF_BR_CH[ch]) return this.bracket(ch);
    // An operator at the end of an exponent steps out of it first: x^2+1 is
    // x²+1, not x^(2+1). Only at the end, and only of one with something in
    // it, so x^-1 can still be typed.
    const {
      blk,
      i
    } = this.cur;
    if ('+-=<>'.indexOf(ch) >= 0 && blk.parent?.t === 'sup' && i > 0 && i === blk.length) this.exitSup();
    this.insert(mkCh(ch));
    if (/[a-zA-Z]/.test(ch)) this.autoCmd();
  }
  insert(n) {
    const {
      blk,
      i
    } = this.cur;
    blk.insert(i, [n]);
    this.cur = {
      blk,
      i: i + 1
    };
  }
  exitSup() {
    const s = this.cur.blk.parent;
    this.cur = {
      blk: s.parent,
      i: s.parent.indexOf(s) + 1
    };
  }

  // The letters just typed spell a command: "sqrt" opens a root, "pi" is π.
  autoCmd() {
    const {
      blk,
      i
    } = this.cur;
    for (const [word, act] of [['sqrt', () => this.sqrt(true)], ['pi', () => this.insert(mkCh('π'))]]) {
      const n = word.length;
      if (i < n) continue;
      const run = blk.nodes.slice(i - n, i);
      if (run.every((x, k) => isCh(x, /[a-zA-Z]/) && x.c === word[k])) {
        blk.remove(i - n, n);
        this.cur = {
          blk,
          i: i - n
        };
        act();
        return;
      }
    }
  }

  // Everything back to the previous operator goes on top; the caret lands in
  // the denominator, or in an empty numerator when there was nothing to take.
  frac(quiet) {
    const {
      blk,
      i
    } = this.cur;
    let j = i;
    while (j > 0 && !isBinOp(blk.nodes[j - 1])) j--;
    const num = blk.remove(j, i - j);
    const f = mkFrac(num, []);
    blk.insert(j, [f]);
    this.cur = {
      blk: num.length ? f.den : f.num,
      i: 0
    };
    if (!quiet) this.changed();
  }

  // Right after an exponent, "^" goes back into it rather than stacking one.
  sup(quiet) {
    const {
      blk,
      i
    } = this.cur;
    const prev = blk.nodes[i - 1];
    if (prev && prev.t === 'sup') this.cur = {
      blk: prev.body,
      i: prev.body.length
    };else {
      const s = mkSup([]);
      blk.insert(i, [s]);
      this.cur = {
        blk: s.body,
        i: 0
      };
    }
    if (!quiet) this.changed();
  }
  squared() {
    this.sup(true);
    this.insert(mkCh('2'));
    this.exitSup();
    this.changed();
  }
  sqrt(quiet) {
    const r = mkSqrt([]);
    this.insert(r);
    this.cur = {
      blk: r.body,
      i: 0
    };
    if (!quiet) this.changed();
  }

  // MathQuill's bracket: typed beside or inside a one-sided one of its kind,
  // it closes that; otherwise it opens a new one whose ghost half sits at the
  // far end of the line, with everything between inside it.
  bracket(ch) {
    const [kind, typedSide] = MF_BR_CH[ch];
    const {
      blk,
      i
    } = this.cur;
    const enclosing = blk.parent?.t === 'br' ? blk.parent : null;
    const oneSided = (n, solid) => !!n && n.t === 'br' && n.kind === kind && !!n.ghost && (!solid || solidOf(n) === solid);
    let m = null;
    if (!typedSide) {
      if (oneSided(blk.nodes[i], 'R')) m = blk.nodes[i];else if (oneSided(blk.nodes[i - 1], 'L')) m = blk.nodes[i - 1];else if (oneSided(enclosing)) m = enclosing;
    } else {
      const solid = typedSide === 'L' ? 'R' : 'L';
      const beside = typedSide === 'L' ? blk.nodes[i] : blk.nodes[i - 1];
      if (oneSided(beside, solid)) m = beside;else if (oneSided(enclosing, solid)) m = enclosing;
    }
    if (m) {
      const side = m.ghost;
      m.ghost = null;
      if (m === enclosing) {
        // What sits between the caret and the ghost belongs outside.
        const pb = m.parent,
          at = pb.indexOf(m);
        if (side === 'R') pb.insert(at + 1, blk.remove(i, blk.length - i));else pb.insert(at, blk.remove(0, i));
      }
      this.cur = side === 'L' ? {
        blk: m.body,
        i: 0
      } : {
        blk: m.parent,
        i: m.parent.indexOf(m) + 1
      };
    } else if ((typedSide || 'L') === 'L') {
      const n = mkBr(kind, blk.remove(i, blk.length - i), 'R');
      blk.insert(i, [n]);
      this.cur = {
        blk: n.body,
        i: 0
      };
    } else {
      const n = mkBr(kind, blk.remove(0, i), 'L');
      blk.insert(0, [n]);
      this.cur = {
        blk,
        i: 1
      };
    }
    this.changed();
  }

  // The bracket's contents take its place in the line.
  unwrap(n) {
    const pb = n.parent,
      at = pb.indexOf(n);
    const inner = n.body.remove(0, n.body.length);
    pb.remove(at, 1);
    pb.insert(at, inner);
  }

  // Deleting one side of a bracket, from outside (backspace over its ")") or
  // from inside at that end (`outward`). MathQuill's rules: the solid side of
  // a one-sided bracket unwraps it; a side of a solid pair becomes the ghost,
  // which then moves to the far end of the line and takes what it passes.
  deleteSide(n, side, outward) {
    const pb = n.parent,
      at = pb.indexOf(n);
    const sib = side === 'R' ? pb.nodes[at + 1] : pb.nodes[at - 1];
    const body = n.body;
    const beside = () => {
      if (sib) {
        const b = sib.parent;
        this.cur = {
          blk: b,
          i: b.indexOf(sib) + (side === 'R' ? 0 : 1)
        };
      } else this.cur = {
        blk: pb,
        i: side === 'R' ? pb.length : 0
      };
    };
    if (n.ghost && side === solidOf(n)) {
      this.unwrap(n);
      beside();
      return;
    }
    const wasSolid = !n.ghost;
    n.ghost = side;
    // Its own first node is the bracket this one was really paired with.
    const innerEnd = side === 'R' ? body.nodes[0] : body.nodes[body.length - 1];
    if (innerEnd && innerEnd.t === 'br' && innerEnd.kind === n.kind && innerEnd.ghost && solidOf(innerEnd) === side) {
      innerEnd.ghost = null;
      this.unwrap(n);
      beside();
      return;
    }
    const enc = pb.parent?.t === 'br' ? pb.parent : null;
    if (enc && enc.kind === n.kind && enc.ghost && solidOf(enc) === side) {
      enc.ghost = null;
      this.unwrap(enc);
    } else if (outward && wasSolid) {
      this.unwrap(n);
      beside();
      return;
    }
    if (sib) {
      const b = sib.parent,
        k = b.indexOf(sib);
      if (side === 'R') body.insert(body.length, b.remove(k, b.length - k));else body.insert(0, b.remove(0, k + 1));
      beside();
    } else if (outward) {
      this.cur = {
        blk: n.parent,
        i: n.parent.indexOf(n) + (side === 'R' ? 1 : 0)
      };
    } else {
      this.cur = {
        blk: body,
        i: side === 'R' ? body.length : 0
      };
    }
  }

  // A fraction, exponent or root deleted from inside its edge spills its
  // contents into the line, caret where it was.
  spill(n) {
    const pb = n.parent,
      at = pb.indexOf(n);
    const all = [];
    let idx = at;
    for (const b of kidsOf(n)) {
      if (b === this.cur.blk) idx = at + all.length + this.cur.i;
      all.push(...b.remove(0, b.length));
    }
    pb.remove(at, 1);
    pb.insert(at, all);
    this.cur = {
      blk: pb,
      i: idx
    };
  }
  deleteDir(dir) {
    const {
      blk,
      i
    } = this.cur;
    const n = dir === 'L' ? blk.nodes[i - 1] : blk.nodes[i];
    if (n) {
      const at = dir === 'L' ? i - 1 : i;
      if (n.t === 'br') this.deleteSide(n, dir === 'L' ? 'R' : 'L', false);else if (n.t === 'ch' || kidsOf(n).every(b => b.isEmpty())) {
        blk.remove(at, 1);
        this.cur = {
          blk,
          i: at
        };
      } else {
        // Not empty: step into it instead, the way the caret would.
        const ks = kidsOf(n),
          b = dir === 'L' ? ks[ks.length - 1] : ks[0];
        this.cur = {
          blk: b,
          i: dir === 'L' ? b.length : 0
        };
      }
    } else if (blk.parent) {
      const p = blk.parent;
      if (p.t === 'br') this.deleteSide(p, dir, true);else this.spill(p);
    }
    this.changed();
  }
  backspace() {
    this.deleteDir('L');
  }
  del() {
    this.deleteDir('R');
  }
  moveDir(dir) {
    const {
      blk,
      i
    } = this.cur;
    const n = dir === 'L' ? blk.nodes[i - 1] : blk.nodes[i];
    if (n) {
      const ks = kidsOf(n);
      if (!ks.length) this.cur = {
        blk,
        i: dir === 'L' ? i - 1 : i + 1
      };else {
        const b = dir === 'L' ? ks[ks.length - 1] : ks[0];
        this.cur = {
          blk: b,
          i: dir === 'L' ? b.length : 0
        };
      }
    } else if (blk.parent) {
      const p = blk.parent,
        ks = kidsOf(p),
        k = ks.indexOf(blk);
      const next = ks[dir === 'L' ? k - 1 : k + 1];
      if (next) this.cur = {
        blk: next,
        i: dir === 'L' ? next.length : 0
      };else this.cur = {
        blk: p.parent,
        i: p.parent.indexOf(p) + (dir === 'L' ? 0 : 1)
      };
    }
    this.changed();
  }
  left() {
    this.moveDir('L');
  }
  right() {
    this.moveDir('R');
  }
  home() {
    this.cur = {
      blk: this.root,
      i: 0
    };
    this.changed();
  }
  end() {
    this.cur = {
      blk: this.root,
      i: this.root.length
    };
    this.changed();
  }

  // Up into a numerator or an exponent, down into a denominator; between the
  // halves of a fraction, landing under the caret's x when the layout is known.
  upDown(dir, x, rectOf) {
    const {
      blk,
      i
    } = this.cur;
    const into = n => n.t === 'frac' ? dir === 'up' ? n.num : n.den : n.t === 'sup' && dir === 'up' ? n.body : null;
    const r = blk.nodes[i],
      l = blk.nodes[i - 1];
    if (r && into(r)) this.cur = {
      blk: into(r),
      i: 0
    };else if (l && into(l)) this.cur = {
      blk: into(l),
      i: into(l).length
    };else {
      for (let b = blk; b.parent; b = b.parent.parent) {
        const n = b.parent;
        if (n.t === 'frac') {
          const other = dir === 'up' ? b === n.den ? n.num : null : b === n.num ? n.den : null;
          if (other) {
            if (x != null && rectOf) this.seekBlock(other, x, rectOf);else this.cur = {
              blk: other,
              i: other.length
            };
            break;
          }
        } else if (n.t === 'sup' && dir === 'down') {
          const pb = n.parent,
            at = pb.indexOf(n);
          this.cur = {
            blk: pb,
            i: b === blk && i === b.length ? at + 1 : at
          };
          break;
        }
      }
    }
    this.changed();
  }

  // A tap. `el` is the tapped node or block (whichever is nearest in the DOM),
  // `x` the tap's client x, `rectOf` measures a node or block on screen.
  seek(el, x, rectOf) {
    if (el && el.nodes) this.seekBlock(el, x, rectOf);else if (el) this.seekNode(el, x, rectOf);else this.seekBlock(this.root, x, rectOf);
    this.changed();
  }
  seekBlock(b, x, rectOf) {
    const last = b.nodes[b.length - 1];
    if (!last || rectOf(last).right < x) {
      this.cur = {
        blk: b,
        i: b.length
      };
      return;
    }
    if (x < rectOf(b.nodes[0]).left) {
      this.cur = {
        blk: b,
        i: 0
      };
      return;
    }
    let k = b.length - 1;
    while (k > 0 && x < rectOf(b.nodes[k]).left) k--;
    this.seekNode(b.nodes[k], x, rectOf);
  }
  seekNode(n, x, rectOf) {
    const r = rectOf(n),
      pb = n.parent,
      at = pb.indexOf(n),
      ks = kidsOf(n);
    if (!ks.length) {
      this.cur = {
        blk: pb,
        i: at + (x - r.left < r.right - x ? 0 : 1)
      };
      return;
    }
    if (x < r.left) {
      this.cur = {
        blk: pb,
        i: at
      };
      return;
    }
    if (x > r.right) {
      this.cur = {
        blk: pb,
        i: at + 1
      };
      return;
    }
    let leftBound = r.left;
    for (let k = 0; k < ks.length; k++) {
      const b = ks[k],
        br = rectOf(b);
      if (x < br.left) {
        if (x - leftBound < br.left - x) this.cur = k > 0 ? {
          blk: ks[k - 1],
          i: ks[k - 1].length
        } : {
          blk: pb,
          i: at
        };else this.cur = {
          blk: b,
          i: 0
        };
        return;
      }
      if (x > br.right) {
        if (k < ks.length - 1) {
          leftBound = br.right;
          continue;
        }
        this.cur = r.right - x < x - br.right ? {
          blk: pb,
          i: at + 1
        } : {
          blk: b,
          i: b.length
        };
        return;
      }
      this.seekBlock(b, x, rectOf);
      return;
    }
  }

  // The node or block behind a data-n / data-b id.
  lookup(id, block) {
    const walk = b => {
      if (block && b.id === id) return b;
      for (const n of b.nodes) {
        if (!block && n.id === id) return n;
        for (const k of kidsOf(n)) {
          const hit = walk(k);
          if (hit) return hit;
        }
      }
      return null;
    };
    return walk(this.root);
  }

  // Pasted or dropped text: read it the way a save is read.
  insertText(s) {
    const nodes = parseText(s).nodes;
    const {
      blk,
      i
    } = this.cur;
    blk.insert(i, nodes);
    this.cur = {
      blk,
      i: i + nodes.length
    };
    this.changed();
  }
}

// ─── Drawing ─────────────────────────────────────────────────

const mfCaret = () => /*#__PURE__*/React.createElement("span", {
  key: "caret",
  className: "fp-caret",
  style: {
    display: 'inline-block',
    width: 1.5,
    height: '1.05em',
    verticalAlign: 'middle',
    background: 'currentColor',
    margin: '0 -0.7px'
  }
});
const MF_ROW = {
  display: 'inline-flex',
  alignItems: 'center'
};

// cur: the caret to draw, or null for a static render.
function renderBlock(b, cur) {
  const here = cur && cur.blk === b;
  if (b.isEmpty()) {
    // The root draws nothing when empty — the row's placeholder does. Any
    // other empty block is a slot to type into.
    if (!b.parent) return /*#__PURE__*/React.createElement("span", {
      "data-b": b.id,
      style: {
        ...MF_ROW,
        alignSelf: 'stretch',
        flex: 1
      }
    }, here ? mfCaret() : null);
    return /*#__PURE__*/React.createElement("span", {
      "data-b": b.id,
      style: {
        ...MF_ROW,
        justifyContent: 'center',
        minWidth: '0.66em',
        height: '1.05em',
        margin: '0 1px',
        borderRadius: 2,
        border: '1px dashed color-mix(in srgb, currentColor 45%, transparent)'
      }
    }, here ? mfCaret() : null);
  }
  const kids = [];
  b.nodes.forEach((n, k) => {
    if (here && cur.i === k) kids.push(mfCaret());
    kids.push(renderNode(n, cur));
  });
  if (here && cur.i === b.length) kids.push(mfCaret());
  return /*#__PURE__*/React.createElement("span", {
    "data-b": b.id,
    style: b.parent ? MF_ROW : {
      ...MF_ROW,
      alignSelf: 'stretch',
      flex: 1
    }
  }, kids);
}
function renderNode(n, cur) {
  switch (n.t) {
    case 'ch':
      {
        const pad = /[+\-=<>]/.test(n.c) ? '0 3px' : n.c === '*' ? '0 1px' : n.c === ',' ? '0 2px 0 0' : undefined;
        return /*#__PURE__*/React.createElement("span", {
          key: n.id,
          "data-n": n.id,
          style: pad ? {
            padding: pad
          } : undefined
        }, MF_GLYPH[n.c] || n.c);
      }
    case 'frac':
      return /*#__PURE__*/React.createElement("span", {
        key: n.id,
        "data-n": n.id,
        style: {
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          margin: '0 2px',
          fontSize: '0.85em',
          lineHeight: 1.12
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          padding: '0 3px 1px',
          display: 'flex'
        }
      }, renderBlock(n.num, cur)), /*#__PURE__*/React.createElement("span", {
        style: {
          padding: '1px 3px 0',
          borderTop: '1px solid currentColor',
          width: '100%',
          display: 'flex',
          justifyContent: 'center'
        }
      }, renderBlock(n.den, cur)));
    case 'sup':
      // Raised against the line's centre, so it sits the same beside a letter
      // and beside a bracket group.
      return /*#__PURE__*/React.createElement("span", {
        key: n.id,
        "data-n": n.id,
        style: {
          ...MF_ROW,
          fontSize: '0.66em',
          lineHeight: 1.15,
          marginBottom: '1em'
        }
      }, renderBlock(n.body, cur));
    case 'sqrt':
      return /*#__PURE__*/React.createElement("span", {
        key: n.id,
        "data-n": n.id,
        style: MF_ROW
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: '1.1em'
        }
      }, "\u221A"), /*#__PURE__*/React.createElement("span", {
        style: {
          ...MF_ROW,
          borderTop: '1px solid currentColor',
          padding: '1px 2px 0',
          marginTop: 1
        }
      }, renderBlock(n.body, cur)));
    case 'br':
      {
        const g = MF_BR[n.kind];
        return /*#__PURE__*/React.createElement("span", {
          key: n.id,
          "data-n": n.id,
          style: MF_ROW
        }, /*#__PURE__*/React.createElement("span", {
          style: n.ghost === 'L' ? {
            opacity: 0.4
          } : undefined
        }, g.open), renderBlock(n.body, cur), /*#__PURE__*/React.createElement("span", {
          style: n.ghost === 'R' ? {
            opacity: 0.4
          } : undefined
        }, g.close));
      }
  }
}

// An expression at rest — the manual, the run history, a locked row.
function MathExpr({
  src
}) {
  if (!src) return null;
  return renderBlock(parseText(src), null);
}

// The editable row. `field` is the MathField it draws and drives; the caret is
// shown while `focused`. The hidden input takes focus so a hardware keyboard
// works and the on-screen one has something to keep focus on; every key it
// sees goes through the same `type` the on-screen keyboard uses.
function MathFieldView({
  field,
  focused,
  disabled,
  onFocus,
  onBlur,
  onDone,
  placeholder,
  color
}) {
  const inputRef = useMR(null);
  const boxRef = useMR(null);
  useME(() => {
    field.input = inputRef.current;
    return () => {
      if (field.input === inputRef.current) field.input = null;
    };
  }, [field]);
  const rectOf = o => boxRef.current?.querySelector(`[data-${o.nodes ? 'b' : 'n'}="${o.id}"]`)?.getBoundingClientRect() || {
    left: 0,
    right: 0
  };

  // Keep the caret in view as it moves.
  useMLE(() => {
    const box = boxRef.current,
      c = box?.querySelector('.fp-caret');
    if (!c) return;
    const r = c.getBoundingClientRect(),
      b = box.getBoundingClientRect();
    if (r.left < b.left + 8) box.scrollLeft -= b.left + 8 - r.left;else if (r.right > b.right - 8) box.scrollLeft += r.right - (b.right - 8);
  });
  const onDown = e => {
    if (disabled) return;
    e.preventDefault();
    const el = e.target.closest?.('[data-n],[data-b]');
    const id = el ? Number(el.dataset.n || el.dataset.b) : null;
    field.seek(el ? field.lookup(id, !!el.dataset.b) : null, e.clientX, rectOf);
    inputRef.current?.focus();
    onFocus?.();
  };
  const onKey = e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === 'Backspace') field.backspace();else if (k === 'Delete') field.del();else if (k === 'ArrowLeft') field.left();else if (k === 'ArrowRight') field.right();else if (k === 'ArrowUp' || k === 'ArrowDown') {
      const c = boxRef.current?.querySelector('.fp-caret');
      field.upDown(k === 'ArrowUp' ? 'up' : 'down', c ? c.getBoundingClientRect().left : null, rectOf);
    } else if (k === 'Home') field.home();else if (k === 'End') field.end();else if (k === 'Enter') onDone?.();else if (k.length === 1) field.typed(k);else return;
    e.preventDefault();
  };
  // Anything that reached the input without a keydown (an IME, dictation).
  const onInput = e => {
    const v = e.target.value;
    if (v) field.write(v);
    e.target.value = '';
  };
  const onPaste = e => {
    e.preventDefault();
    field.insertText(e.clipboardData?.getData('text') || '');
  };
  const empty = field.root.isEmpty();
  return /*#__PURE__*/React.createElement("div", {
    ref: boxRef,
    className: "fp-scroll",
    onPointerDown: onDown,
    style: {
      position: 'relative',
      flex: 1,
      minWidth: 0,
      minHeight: 38,
      display: 'flex',
      alignItems: 'center',
      padding: '8px 0',
      boxSizing: 'border-box',
      overflowX: 'auto',
      overflowY: 'hidden',
      fontFamily: "'Geist Mono','ui-monospace',monospace",
      fontSize: 14,
      whiteSpace: 'nowrap',
      color,
      cursor: disabled ? 'default' : 'text'
    }
  }, empty && !focused && placeholder, renderBlock(field.root, focused ? field.cur : null), /*#__PURE__*/React.createElement("input", {
    ref: inputRef,
    inputMode: "none",
    spellCheck: false,
    autoComplete: "off",
    disabled: disabled,
    onKeyDown: onKey,
    onInput: onInput,
    onPaste: onPaste,
    onFocus: onFocus,
    onBlur: onBlur,
    "aria-label": "Equation",
    style: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: 1,
      height: 1,
      opacity: 0,
      border: 0,
      padding: 0,
      pointerEvents: 'none'
    }
  }));
}
window.MathField = MathField;
window.MathFieldView = MathFieldView;
window.MathExpr = MathExpr;
window.FP_MATH = {
  parseText,
  textOf,
  MF_FNS
};