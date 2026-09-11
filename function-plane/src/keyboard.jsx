// Function Plane — Custom math keyboard

const { useState: useKB, useRef: useRK, useEffect: useEK } = React;

// Hold-to-repeat, for keys that are safe to fire many times (backspace). A tap
// fires once; holding starts repeating after HOLD_DELAY and then every
// HOLD_RATE, the way a hardware key does. Shared with the domain NumPad in
// level-screen.jsx, which loads after this file.
// Moving the selection on the DOM node directly is invisible to React's
// onSelect, and the typeset field draws its own cursor — so say so.
function setCaret(inp, p) {
  inp.setSelectionRange?.(p, p);
  inp.dispatchEvent(new Event('fp-caret'));
}

const HOLD_DELAY = 420;
const HOLD_RATE  = 60;

function useKeyRepeat() {
  const timers = useRK({ delay: null, rate: null });
  const stop = () => {
    clearTimeout(timers.current.delay);
    clearInterval(timers.current.rate);
    timers.current = { delay: null, rate: null };
  };
  // A pointer released outside the button never fires pointerup on it, so the
  // interval has to be killed on unmount too or it repeats forever.
  useEK(() => stop, []);
  const start = act => {
    stop();
    act();
    timers.current.delay = setTimeout(() => {
      timers.current.rate = setInterval(act, HOLD_RATE);
    }, HOLD_DELAY);
  };
  return { start, stop };
}

window.useKeyRepeat = useKeyRepeat;

function MathKeyboard({ inputRef, onChange, onDone }) {
  const [page, setPage] = useKB('main');   // 'main' | 'abc' | 'fn'
  const { start: holdStart, stop: holdStop } = useKeyRepeat();
  // `back` leaves the cursor that many characters short of the end of what
  // was typed — for keys that build something around it rather than after it.
  const ins = (text, back = 0) => {
    const inp = inputRef?.current;
    if (!inp) return;
    inp.focus();
    const s = inp.selectionStart ?? inp.value.length;
    const e = inp.selectionEnd   ?? inp.value.length;
    const v = inp.value.slice(0, s) + text + inp.value.slice(e);
    const p = s + text.length - back;
    onChange(v);
    requestAnimationFrame(() => setCaret(inp, p));
  };

  // A fraction over whatever was just written — or, with nothing to put on
  // top, an empty one with the cursor in the numerator, since that is the
  // half you are about to fill in.
  const frac = () => {
    const inp = inputRef?.current;
    if (!inp) return;
    const before = inp.value.slice(0, inp.selectionStart ?? inp.value.length);
    ins('/', /[0-9a-zA-Zπ.)]$/.test(before) ? 0 : 1);
  };

  const del = () => {
    const inp = inputRef?.current;
    if (!inp) return;
    inp.focus();
    const s = inp.selectionStart, e = inp.selectionEnd;
    let v, p;
    if (s !== e)  { v = inp.value.slice(0,s) + inp.value.slice(e); p = s; }
    else if (s>0) { v = inp.value.slice(0,s-1) + inp.value.slice(s); p = s-1; }
    else return;
    onChange(v);
    requestAnimationFrame(() => setCaret(inp, p));
  };

  const mov = d => {
    const inp = inputRef?.current;
    if (!inp) return;
    inp.focus();
    const p = Math.max(0, Math.min(inp.value.length, (inp.selectionStart ?? 0) + d));
    requestAnimationFrame(() => setCaret(inp, p));
  };

  // Key faces that are typeset rather than typed. Plain builders, not
  // components — a component declared in here is a new type every render, so
  // React would tear down and rebuild every key on each keystroke.
  const it  = c => <span>{c}</span>;
  const pow = (base, ex) => (
    <span style={{ display:'inline-flex', alignItems:'flex-start' }}>
      {it(base)}<span style={{ fontSize:'0.68em', marginTop:'-0.1em' }}>{ex}</span>
    </span>
  );
  const FRAC = (
    <span style={{ display:'inline-flex', flexDirection:'column', alignItems:'center',
      fontSize:'0.8em', lineHeight:1.05 }}>
      <span style={{ padding:'0 3px 1px' }}>{it('a')}</span>
      <span style={{ padding:'1px 3px 0', borderTop:'1px solid currentColor' }}>{it('b')}</span>
    </span>
  );

  // t: 'var' | 'op' | 'num' | 'const' | 'fn' | 'adv' | 'del' | 'ctrl' | 'enter' | 'gap'
  // `al` names a key whose face is drawn rather than written, so it still has
  // something to read out.
  const k = (lbl, act, t, w, al) => ({ lbl, act, t, w, al });
  const gap = w => ({ t:'gap', w });

  // ── Left block: variables, grouping, the shapes with their own notation ──
  const LEFT = [
    [k(it('x'), ()=>ins('x'), 'var', 1, 'x'), k(it('y'), ()=>ins('y'), 'var', 1, 'y'),
     k(pow('a','2'), ()=>ins('^2'), 'op', 1, 'squared'), k(pow('a','b'), ()=>ins('^'), 'op', 1, 'power')],
    [k('(', ()=>ins('('), 'op'), k(')', ()=>ins(')'), 'op'),
     k('⌊a⌋', ()=>ins('floor('), 'fn'), k('⌈a⌉', ()=>ins('ceil('), 'fn')],
    [k('|a|', ()=>ins('abs('), 'fn'), k(',', ()=>ins(','), 'op'),
     k(FRAC, frac, 'op', 1, 'fraction'), k('sgn', ()=>ins('sgn('), 'fn')],
    [k('ABC', ()=>setPage('abc'), 'ctrl'), k('√', ()=>ins('sqrt('), 'fn'),
     k(it('e'), ()=>ins('e'), 'const', 1, 'e'), k('π', ()=>ins('π'), 'const')],
  ];

  const NUM = [
    [k('7', ()=>ins('7'), 'num'), k('8', ()=>ins('8'), 'num'), k('9', ()=>ins('9'), 'num'), k('÷', frac, 'num')],
    [k('4', ()=>ins('4'), 'num'), k('5', ()=>ins('5'), 'num'), k('6', ()=>ins('6'), 'num'), k('×', ()=>ins('*'), 'num')],
    [k('1', ()=>ins('1'), 'num'), k('2', ()=>ins('2'), 'num'), k('3', ()=>ins('3'), 'num'), k('−', ()=>ins('-'), 'num')],
    [k('0', ()=>ins('0'), 'num'), k('.', ()=>ins('.'), 'num'), k('=', ()=>ins('='), 'num'), k('+', ()=>ins('+'), 'num')],
  ];

  const FNS = [
    [k('sin', ()=>ins('sin('), 'fn'), k('cos', ()=>ins('cos('), 'fn'), k('tan', ()=>ins('tan('), 'fn'),
     k('ln', ()=>ins('ln('), 'fn'), k('log', ()=>ins('log('), 'fn')],
    [k('sin⁻¹', ()=>ins('arcsin('), 'fn'), k('cos⁻¹', ()=>ins('arccos('), 'fn'), k('tan⁻¹', ()=>ins('arctan('), 'fn'),
     k(pow('e','x'), ()=>ins('exp('), 'fn', 1, 'e to the x'), k('√', ()=>ins('sqrt('), 'fn')],
    [k('⌊a⌋', ()=>ins('floor('), 'fn'), k('⌈a⌉', ()=>ins('ceil('), 'fn'), k('sgn', ()=>ins('sgn('), 'fn'),
     k('|a|', ()=>ins('abs('), 'fn'), k(pow('a','b'), ()=>ins('^'), 'op', 1, 'power')],
    [k('Σ', ()=>ins('sum(1,5,n*x)'), 'adv'), k('d/dx', ()=>ins('deriv('), 'adv'), k('∫', ()=>ins('integ('), 'adv'),
     k('min', ()=>ins('min('), 'fn'), k('max', ()=>ins('max('), 'fn')],
  ];

  const letters = row => row.split('').map(c => k(it(c), ()=>ins(c), 'var', 1, c));
  const ABC = [
    letters('qwertyuiop'),
    [gap(0.5), ...letters('asdfghjkl'), gap(0.5)],
    [gap(1.5), ...letters('zxcvbnm'), gap(1.5)],
    [k('123', ()=>setPage('main'), 'ctrl', 1.6), k('π', ()=>ins('π'), 'const'),
     k(it('e'), ()=>ins('e'), 'const', 1, 'e'), k(',', ()=>ins(','), 'op'),
     k(it('x'), ()=>ins('x'), 'var', 1, 'x'), k(it('y'), ()=>ins('y'), 'var', 1, 'y')],
  ];

  // ── Right block: page switch, caret, backspace, accept ──
  const CTRL = [
    [page === 'fn'
      ? k('123', ()=>setPage('main'), 'ctrl', 2)
      : k('functions', ()=>setPage('fn'), 'ctrl', 2)],
    [k('←', ()=>mov(-1), 'ctrl'), k('→', ()=>mov(1), 'ctrl')],
    [k('⌫', del, 'del', 2)],
    [k('↵', () => onDone?.(), 'enter', 2)],
  ];

  const bg = t => {
    if (t === 'num')   return 'var(--fp-surface-2)';
    if (t === 'ctrl')  return 'var(--fp-surface-2)';
    if (t === 'del')   return 'var(--fp-surface-2)';
    if (t === 'enter') return 'var(--fp-accent)';
    if (t === 'var')   return 'rgba(45,112,179,0.13)';
    if (t === 'const') return 'rgba(56,140,70,0.11)';
    if (t === 'adv')   return 'rgba(96,66,166,0.13)';
    return 'var(--fp-surface)';
  };
  const fg = t => {
    if (t === 'enter') return 'var(--fp-accent-ink)';
    if (t === 'var')   return '#2d70b3';
    if (t === 'const') return '#388c46';
    if (t === 'adv')   return '#6042a6';
    return 'var(--fp-ink)';
  };

  const block = (rows, flex) => (
    <div style={{ flex, minWidth:0, display:'flex', flexDirection:'column', gap:4 }}>
      {rows.map((row, ri) => (
        <div key={ri} style={{ flex:1, display:'flex', gap:4 }}>
          {row.map((key, ki) => key.t === 'gap'
            ? <div key={ki} style={{ flex:key.w }}/>
            : (
              <button key={ki}
                aria-label={key.al || (typeof key.lbl === 'string' ? key.lbl : undefined)}
                onPointerDown={e => { e.preventDefault(); if (key.t === 'del') holdStart(key.act); else key.act(); }}
                onPointerUp={holdStop}
                onPointerCancel={holdStop}
                onPointerLeave={holdStop}
                style={{
                  flex: key.w || 1, minWidth:0, height:40, borderRadius:7,
                  fontSize: typeof key.lbl === 'string' && key.lbl.length > 3 ? 10.5 : 13.5,
                  background: bg(key.t),
                  border: key.t === 'enter' ? 0 : '1px solid var(--lv-line)',
                  color: fg(key.t),
                  fontWeight: key.t === 'enter' ? 600 : (key.t === 'var' || key.t === 'const' ? 600 : 400),
                  display:'flex', alignItems:'center', justifyContent:'center',
                  cursor:'pointer', letterSpacing:'-0.01em',
                }}>
                {key.lbl}
              </button>
            ))}
        </div>
      ))}
    </div>
  );

  return (
    <div style={{
      background: 'var(--fp-surface)',
      borderTop: '1px solid var(--lv-line)',
      padding: '5px 5px',
      paddingBottom: 'max(5px, env(safe-area-inset-bottom, 0px))',
      userSelect: 'none', WebkitUserSelect: 'none',
      touchAction: 'manipulation',
      flexShrink: 0,
    }}>
      <div style={{ display:'flex', gap:6 }}>
        {page === 'main' && block(LEFT, 4)}
        {page === 'main' && block(NUM, 4)}
        {page === 'abc'  && block(ABC, 8)}
        {page === 'fn'   && block(FNS, 8)}
        {block(CTRL, 2.5)}
      </div>
    </div>
  );
}

window.MathKeyboard = MathKeyboard;
