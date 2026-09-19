// Function Plane — Custom math keyboard

const { useState: useKB, useRef: useRK, useEffect: useEK } = React;

// Hold-to-repeat, for keys that are safe to fire many times (backspace). A tap
// fires once; holding starts repeating after HOLD_DELAY and then every
// HOLD_RATE, the way a hardware key does. Shared with the domain NumPad in
// level-screen.jsx, which loads after this file.
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

// `field` is a ref to the active MathField. Every key drives it through the
// same entry points a hardware keyboard does, so there is one set of editing
// rules and the two can never disagree. Focus stays on the field: a key's
// pointerdown is prevented, and the field is refocused before each action in
// case something else took it.
function MathKeyboard({ field, onDone }) {
  const [page, setPage] = useKB('main');   // 'main' | 'abc' | 'fn'
  const { start: holdStart, stop: holdStop } = useKeyRepeat();
  const f = () => field?.current;
  const ins = text => { const x = f(); if (!x) return; x.focus(); x.write(text); };
  const cmd = name => { const x = f(); if (!x) return; x.focus(); x[name](); };
  // A function key types its name and opens its bracket. The closer is a
  // ghost the field treats as there until it is typed, so "sin(x" reads as
  // sin(x) and *is* sin(x), and "+1" typed next lands inside — as it looks.
  const call = name => ins(name + '(');

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
     k(pow('a','2'), ()=>cmd('squared'), 'op', 1, 'squared'), k(pow('a','b'), ()=>cmd('sup'), 'op', 1, 'power')],
    [k('(', ()=>ins('('), 'op'), k(')', ()=>ins(')'), 'op'),
     k('⌊a⌋', ()=>ins('⌊'), 'fn'), k('⌈a⌉', ()=>ins('⌈'), 'fn')],
    [k('|a|', ()=>ins('|'), 'fn'), k(',', ()=>ins(','), 'op'),
     k(FRAC, ()=>cmd('frac'), 'op', 1, 'fraction'), k('sgn', ()=>call('sgn'), 'fn')],
    [k('ABC', ()=>setPage('abc'), 'ctrl'), k('√', ()=>cmd('sqrt'), 'fn'),
     k(it('e'), ()=>ins('e'), 'const', 1, 'e'), k('π', ()=>ins('π'), 'const')],
  ];

  const NUM = [
    [k('7', ()=>ins('7'), 'num'), k('8', ()=>ins('8'), 'num'), k('9', ()=>ins('9'), 'num'), k('÷', ()=>cmd('frac'), 'num')],
    [k('4', ()=>ins('4'), 'num'), k('5', ()=>ins('5'), 'num'), k('6', ()=>ins('6'), 'num'), k('×', ()=>ins('*'), 'num')],
    [k('1', ()=>ins('1'), 'num'), k('2', ()=>ins('2'), 'num'), k('3', ()=>ins('3'), 'num'), k('−', ()=>ins('-'), 'num')],
    [k('0', ()=>ins('0'), 'num'), k('.', ()=>ins('.'), 'num'), k('=', ()=>ins('='), 'num'), k('+', ()=>ins('+'), 'num')],
  ];

  const FNS = [
    [k('sin', ()=>call('sin'), 'fn'), k('cos', ()=>call('cos'), 'fn'), k('tan', ()=>call('tan'), 'fn'),
     k('ln', ()=>call('ln'), 'fn'), k('log', ()=>call('log'), 'fn')],
    [k('sin⁻¹', ()=>call('arcsin'), 'fn'), k('cos⁻¹', ()=>call('arccos'), 'fn'), k('tan⁻¹', ()=>call('arctan'), 'fn'),
     k(pow('e','x'), ()=>call('exp'), 'fn', 1, 'e to the x'), k('√', ()=>cmd('sqrt'), 'fn')],
    [k('⌊a⌋', ()=>ins('⌊'), 'fn'), k('⌈a⌉', ()=>ins('⌈'), 'fn'), k('sgn', ()=>call('sgn'), 'fn'),
     k('|a|', ()=>ins('|'), 'fn'), k(pow('a','b'), ()=>cmd('sup'), 'op', 1, 'power')],
    [k('Σ', ()=>ins('sum(1,5,n*x)'), 'adv'), k('d/dx', ()=>call('deriv'), 'adv'), k('∫', ()=>call('integ'), 'adv'),
     k('min', ()=>call('min'), 'fn'), k('max', ()=>call('max'), 'fn')],
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
    [k('←', ()=>cmd('left'), 'ctrl'), k('→', ()=>cmd('right'), 'ctrl')],
    [k('⌫', ()=>cmd('backspace'), 'del', 2)],
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
