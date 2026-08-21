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

function MathKeyboard({ inputRef, onChange }) {
  const [page, setPage] = useKB('basic'); // 'basic' | 'advanced'
  const { start: holdStart, stop: holdStop } = useKeyRepeat();
  const ins = text => {
    const inp = inputRef?.current;
    if (!inp) return;
    inp.focus();
    const s = inp.selectionStart ?? inp.value.length;
    const e = inp.selectionEnd   ?? inp.value.length;
    const v = inp.value.slice(0, s) + text + inp.value.slice(e);
    const p = s + text.length;
    onChange(v);
    requestAnimationFrame(() => inp.setSelectionRange?.(p, p));
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
    requestAnimationFrame(() => inp.setSelectionRange?.(p, p));
  };

  const clr = () => onChange('');

  const mov = d => {
    const inp = inputRef?.current;
    if (!inp) return;
    inp.focus();
    const p = Math.max(0, Math.min(inp.value.length, (inp.selectionStart ?? 0) + d));
    requestAnimationFrame(() => inp.setSelectionRange?.(p, p));
  };

  // t: 'fn' | 'op' | 'num' | 'var' | 'const' | 'del' | 'nav' | 'util' | 'adv'
  const ROWS_BASIC = [
    [
      { lbl:'sin',  act:()=>ins('sin('),  t:'fn'    },
      { lbl:'cos',  act:()=>ins('cos('),  t:'fn'    },
      { lbl:'tan',  act:()=>ins('tan('),  t:'fn'    },
      { lbl:'(',    act:()=>ins('('),     t:'op'    },
      { lbl:')',    act:()=>ins(')'),     t:'op'    },
      { lbl:'⌫',   act:del,             t:'del'   },
    ],
    [
      { lbl:'log',  act:()=>ins('log('),  t:'fn'    },
      { lbl:'ln',   act:()=>ins('ln('),   t:'fn'    },
      { lbl:'√‾',   act:()=>ins('sqrt('), t:'fn'    },
      { lbl:'x',    act:()=>ins('x'),     t:'var'   },
      { lbl:'y',    act:()=>ins('y'),     t:'var'   },
      { lbl:'^',    act:()=>ins('^'),     t:'op'    },
    ],
    [
      { lbl:'π',    act:()=>ins('π'),     t:'const' },
      { lbl:'e',    act:()=>ins('e'),     t:'const' },
      { lbl:'|x|',  act:()=>ins('abs('),  t:'fn'    },
      { lbl:'7',    act:()=>ins('7'),     t:'num'   },
      { lbl:'8',    act:()=>ins('8'),     t:'num'   },
      { lbl:'9',    act:()=>ins('9'),     t:'num'   },
    ],
    [
      { lbl:'⌊x⌋', act:()=>ins('floor('),t:'fn'    },
      { lbl:'÷',    act:()=>ins('/'),     t:'op'    },
      { lbl:'×',    act:()=>ins('*'),     t:'op'    },
      { lbl:'4',    act:()=>ins('4'),     t:'num'   },
      { lbl:'5',    act:()=>ins('5'),     t:'num'   },
      { lbl:'6',    act:()=>ins('6'),     t:'num'   },
    ],
    [
      { lbl:'⌈x⌉', act:()=>ins('ceil('), t:'fn'    },
      { lbl:'−',    act:()=>ins('-'),     t:'op'    },
      { lbl:'+',    act:()=>ins('+'),     t:'op'    },
      { lbl:'1',    act:()=>ins('1'),     t:'num'   },
      { lbl:'2',    act:()=>ins('2'),     t:'num'   },
      { lbl:'3',    act:()=>ins('3'),     t:'num'   },
    ],
    [
      { lbl:'=',    act:()=>ins('='),     t:'op'    },
      { lbl:'.',    act:()=>ins('.'),     t:'num'   },
      { lbl:'0',    act:()=>ins('0'),     t:'num'   },
      { lbl:'CLR',  act:clr,             t:'util'  },
      { lbl:'←',   act:()=>mov(-1),     t:'nav'   },
      { lbl:'→',   act:()=>mov(1),      t:'nav'   },
    ],
  ];

  // Advanced page — inverse trig + higher-order operators (sum, derivative,
  // integral). The right three columns mirror the basic layout so digits and
  // arrow keys stay in the same spots and muscle memory carries over.
  const ROWS_ADV = [
    [
      { lbl:'arcsin', act:()=>ins('arcsin('), t:'fn'  },
      { lbl:'arccos', act:()=>ins('arccos('), t:'fn'  },
      { lbl:'arctan', act:()=>ins('arctan('), t:'fn'  },
      { lbl:'(',    act:()=>ins('('),     t:'op'    },
      { lbl:')',    act:()=>ins(')'),     t:'op'    },
      { lbl:'⌫',   act:del,             t:'del'   },
    ],
    [
      { lbl:'Σ',    act:()=>ins('sum(1,5,n*x)'), t:'adv' },
      { lbl:'d/dx', act:()=>ins('deriv('), t:'adv'  },
      { lbl:'∫',    act:()=>ins('integ('), t:'adv'  },
      { lbl:'x',    act:()=>ins('x'),     t:'var'   },
      { lbl:'n',    act:()=>ins('n'),     t:'var'   },
      { lbl:'^',    act:()=>ins('^'),     t:'op'    },
    ],
    [
      { lbl:'π',    act:()=>ins('π'),     t:'const' },
      { lbl:'e',    act:()=>ins('e'),     t:'const' },
      { lbl:'|x|',  act:()=>ins('abs('),  t:'fn'    },
      { lbl:'7',    act:()=>ins('7'),     t:'num'   },
      { lbl:'8',    act:()=>ins('8'),     t:'num'   },
      { lbl:'9',    act:()=>ins('9'),     t:'num'   },
    ],
    [
      { lbl:'⌊x⌋', act:()=>ins('floor('),t:'fn'    },
      { lbl:'÷',    act:()=>ins('/'),     t:'op'    },
      { lbl:'×',    act:()=>ins('*'),     t:'op'    },
      { lbl:'4',    act:()=>ins('4'),     t:'num'   },
      { lbl:'5',    act:()=>ins('5'),     t:'num'   },
      { lbl:'6',    act:()=>ins('6'),     t:'num'   },
    ],
    [
      { lbl:',',    act:()=>ins(','),     t:'op'    },
      { lbl:'−',    act:()=>ins('-'),     t:'op'    },
      { lbl:'+',    act:()=>ins('+'),     t:'op'    },
      { lbl:'1',    act:()=>ins('1'),     t:'num'   },
      { lbl:'2',    act:()=>ins('2'),     t:'num'   },
      { lbl:'3',    act:()=>ins('3'),     t:'num'   },
    ],
    [
      { lbl:'=',    act:()=>ins('='),     t:'op'    },
      { lbl:'.',    act:()=>ins('.'),     t:'num'   },
      { lbl:'0',    act:()=>ins('0'),     t:'num'   },
      { lbl:'CLR',  act:clr,             t:'util'  },
      { lbl:'←',   act:()=>mov(-1),     t:'nav'   },
      { lbl:'→',   act:()=>mov(1),      t:'nav'   },
    ],
  ];

  const ROWS = page === 'advanced' ? ROWS_ADV : ROWS_BASIC;

  const bg = t => {
    if (t === 'num')   return 'var(--fp-surface)';
    if (t === 'del')   return 'var(--fp-surface-2)';
    if (t === 'util')  return 'var(--fp-surface-2)';
    if (t === 'nav')   return 'var(--fp-surface-2)';
    if (t === 'var')   return 'rgba(45,112,179,0.13)';
    if (t === 'const') return 'rgba(56,140,70,0.11)';
    if (t === 'adv')   return 'rgba(96,66,166,0.13)';
    return 'var(--lv-bg)';
  };
  const fg = t => {
    if (t === 'var')   return '#2d70b3';
    if (t === 'const') return '#388c46';
    if (t === 'adv')   return '#6042a6';
    return 'var(--fp-ink)';
  };
  const ff = t => (t === 'var' || t === 'const' || t === 'adv') ? "'Geist Mono',monospace" : 'inherit';

  const tabBtn = (id, label) => (
    <button key={id} onPointerDown={e => { e.preventDefault(); setPage(id); }} style={{
      flex: '0 0 auto', padding: '4px 14px', height: 24,
      borderRadius: 999, fontSize: 11, fontWeight: 500,
      border: '1px solid var(--lv-line)',
      background: page === id ? 'var(--fp-ink)' : 'transparent',
      color:      page === id ? 'var(--fp-bg)'  : 'var(--fp-ink-3)',
      letterSpacing: '0.04em',
    }}>{label}</button>
  );

  return (
    <div style={{
      background: 'var(--fp-surface)',
      borderTop: '1px solid var(--lv-line)',
      padding: '4px 5px',
      paddingBottom: 'max(5px, env(safe-area-inset-bottom, 0px))',
      userSelect: 'none', WebkitUserSelect: 'none',
      touchAction: 'manipulation',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', gap: 4, padding: '2px 2px 4px', justifyContent: 'center' }}>
        {tabBtn('basic',    'abc')}
        {tabBtn('advanced', '𝑓𝑥')}
      </div>
      {ROWS.map((row, ri) => (
        <div key={ri} style={{ display:'flex', gap:3, marginBottom: ri < ROWS.length-1 ? 3 : 0 }}>
          {row.map((k, ki) => (
            <button key={ki}
              onPointerDown={e => {
                e.preventDefault();
                if (k.t === 'del') holdStart(k.act); else k.act();
              }}
              onPointerUp={holdStop}
              onPointerCancel={holdStop}
              onPointerLeave={holdStop}
              style={{
                flex: 1, height: 38, borderRadius: 7,
                fontSize: k.lbl.length > 3 ? 10 : 12.5,
                background: bg(k.t),
                border: '1px solid var(--lv-line)',
                color: fg(k.t),
                fontWeight: (k.t==='var'||k.t==='const') ? 600 : 400,
                fontFamily: ff(k.t),
                display:'flex', alignItems:'center', justifyContent:'center',
                cursor: 'pointer',
                letterSpacing: '-0.01em',
              }}>
              {k.lbl}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

window.MathKeyboard = MathKeyboard;
