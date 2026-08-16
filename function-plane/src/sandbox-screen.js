// Function Plane — Sandbox
//
// The game with the goals taken away: graph anything, run the ball, see what
// happens. Doubles as the place to explain the mechanic without a level's
// pass/fail hanging over it.
//
// Stars and the ball spawn are fixed objects here, not things you scatter by
// tapping — you select one and move it, by dragging or by typing coordinates.
// Tapping empty space pans, exactly as it does in a level.
//
// The plane, the equations panel and the physics step are the same code a
// level uses (exported from level-screen.js), so the ball behaves here
// exactly as it does there.

const {
  useState: useSB,
  useRef: useSBR,
  useEffect: useSBE
} = React;
const SB_START = {
  x: -4,
  y: 5
};
const SB_STARS = [{
  x: -2,
  y: 2
}, {
  x: 0,
  y: 0
}, {
  x: 2,
  y: -2
}];
const SB_LIMIT = 30; // seconds of sim before a run stops on its own

function SandboxScreen({
  onBack,
  density = 'comfortable',
  settings
}) {
  const padX = density === 'compact' ? 18 : 22;
  const [ball, setBall] = useSB({
    ...SB_START
  });
  const [stars, setStars] = useSB(SB_STARS.map(s => ({
    ...s
  })));
  const [selected, setSelected] = useSB(null); // 'ball' | `star-${i}` | null
  const [equations, setEquations] = useSB([]);
  const [running, setRunning] = useSB(false);
  const [ballPos, setBallPos] = useSB({
    ...SB_START
  });
  const [simStars, setSimStars] = useSB(SB_STARS.map(s => ({
    ...s,
    collected: false
  })));
  const [trail, setTrail] = useSB(null);
  const [panelOpen, setPanelOpen] = useSB(true);
  const [elapsed, setElapsed] = useSB(0);
  // Frame the objects once, after the plane has been measured. Only on entry:
  // re-framing on Play would throw away a view the player deliberately
  // panned and zoomed to compose.
  const [fitTrigger, setFitTrigger] = useSB(null);
  useSBE(() => {
    const t = setTimeout(() => setFitTrigger(1), 60);
    return () => clearTimeout(t);
  }, []);
  const physRef = useSBR(null);
  const animRef = useSBR(null);
  const eqRef = useSBR(equations);
  eqRef.current = equations;
  const sfx = name => {
    if (settings?.sound === false || !window.FP_AUDIO) return;
    FP_AUDIO[name]?.((settings?.volume ?? 70) / 100);
  };
  const resetSim = () => {
    setBallPos({
      ...ball
    });
    setSimStars(stars.map(s => ({
      ...s,
      collected: false
    })));
    setElapsed(0);
  };

  // Moving an object while stopped should move what you see, not just what the
  // next run starts from.
  useSBE(() => {
    if (!running) resetSim();
  }, [ball, stars, running]);
  const moveObject = (id, pos) => {
    if (running) return;
    if (id === 'ball') {
      setBall(pos);
      return;
    }
    const i = Number(id.slice(5));
    setStars(prev => prev.map((s, k) => k === i ? pos : s));
  };
  const selectedPos = selected === 'ball' ? ball : selected ? stars[Number(selected.slice(5))] : null;
  const setCoord = (axis, value) => {
    const n = Number(value);
    if (!isFinite(n) || !selected) return;
    moveObject(selected, {
      ...selectedPos,
      [axis]: Math.max(-40, Math.min(40, n))
    });
  };
  const handlePlay = () => {
    if (running) {
      cancelAnimationFrame(animRef.current);
      setRunning(false);
      resetSim();
      setTrail(null);
      return;
    }
    physRef.current = {
      x: ball.x,
      y: ball.y,
      vx: 0,
      vy: 0,
      stars: stars.map(s => ({
        ...s,
        collected: false
      })),
      lastTs: null,
      acc: 0,
      simS: 0,
      tick: 0,
      bounced: false,
      justCollected: false,
      trail: [{
        x: ball.x,
        y: ball.y
      }]
    };
    setSimStars(stars.map(s => ({
      ...s,
      collected: false
    })));
    setElapsed(0);
    setTrail(null);
    setSelected(null);
    setRunning(true);
  };
  useSBE(() => {
    if (!running) return;
    const ph = physRef.current;
    const {
      TICK_DT,
      SUB_STEPS,
      MAX_TICKS,
      BALL_R,
      FALL_LIMIT
    } = window.SIM;
    const dt = TICK_DT / SUB_STEPS;
    const active = eqRef.current.filter(e => e.fn && e.visible);
    const colliders = FP_PHYSICS.makeColliders([...active.filter(e => !e.isImplicit), ...active.filter(e => e.isImplicit)].map(e => ({
      fn: e.fn,
      domain: e.domain,
      isImplicit: e.isImplicit
    })), BALL_R);
    const frame = ts => {
      if (ph.lastTs == null) ph.lastTs = ts;
      ph.acc += Math.min((ts - ph.lastTs) / 1000, MAX_TICKS * TICK_DT);
      ph.lastTs = ts;
      ph.bounced = false;
      ph.justCollected = false;
      while (ph.acc >= TICK_DT) {
        ph.acc -= TICK_DT;
        for (let s = 0; s < SUB_STEPS; s++) physicsStep(ph, colliders, dt);
        ph.simS += TICK_DT;
        if (ph.tick++ % 3 === 0) ph.trail.push({
          x: ph.x,
          y: ph.y
        });
      }
      setElapsed(ph.simS);
      if (ph.bounced) sfx('bounce');
      if (ph.justCollected) sfx('collectStar');
      setBallPos({
        x: ph.x,
        y: ph.y
      });
      setSimStars([...ph.stars]);

      // No win condition — a run ends when the ball leaves the world or the
      // clock runs out. Collecting every star is just a nice noise.
      if (ph.y < FALL_LIMIT || ph.simS > SB_LIMIT) {
        cancelAnimationFrame(animRef.current);
        setTrail(ph.trail);
        setRunning(false);
        resetSim();
        return;
      }
      animRef.current = requestAnimationFrame(frame);
    };
    animRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animRef.current);
  }, [running]);
  const reset = () => {
    if (running) return;
    setBall({
      ...SB_START
    });
    setStars(SB_STARS.map(s => ({
      ...s
    })));
    setEquations([]);
    setTrail(null);
    setSelected(null);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "fp-screen",
    style: {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 'env(safe-area-inset-top, 0px)',
      flex: '0 0 auto',
      background: 'var(--lv-bg)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: `8px ${padX}px 8px`,
      flex: '0 0 auto',
      background: 'var(--lv-bg)'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    "aria-label": "Back",
    style: {
      width: 38,
      height: 38,
      borderRadius: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--fp-ink-2)'
    }
  }, /*#__PURE__*/React.createElement(Icon.Chevron, {
    dir: "left",
    size: 20
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: 'var(--fp-ink-4)'
    }
  }, "Sandbox"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Instrument Serif', Georgia, serif",
      fontStyle: 'italic',
      fontSize: 19,
      letterSpacing: '-0.02em',
      color: 'var(--fp-ink)'
    }
  }, running ? `${elapsed.toFixed(1)}s` : 'Free play')), /*#__PURE__*/React.createElement("button", {
    onClick: handlePlay,
    style: {
      height: 38,
      padding: '0 16px',
      borderRadius: 11,
      background: 'var(--fp-ink)',
      color: 'var(--fp-bg)',
      fontSize: 13.5,
      fontWeight: 500
    }
  }, running ? 'Stop' : 'Play ▸')), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
      padding: `0 ${padX}px 8px`,
      flex: '0 0 auto',
      background: 'var(--lv-bg)'
    }
  }, /*#__PURE__*/React.createElement(ObjChip, {
    label: "Spawn",
    active: selected === 'ball',
    disabled: running,
    onClick: () => setSelected(selected === 'ball' ? null : 'ball')
  }), stars.map((_, i) => /*#__PURE__*/React.createElement(ObjChip, {
    key: i,
    label: `Star ${i + 1}`,
    active: selected === `star-${i}`,
    disabled: running,
    onClick: () => setSelected(selected === `star-${i}` ? null : `star-${i}`)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: reset,
    disabled: running,
    style: {
      fontSize: 11.5,
      color: 'var(--fp-ink-3)',
      opacity: running ? 0.4 : 1,
      textDecoration: 'underline'
    }
  }, "Reset")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minHeight: 0,
      position: 'relative',
      overflow: 'hidden',
      borderTop: '1px solid var(--lv-bg)',
      borderBottom: '1px solid var(--lv-bg)'
    }
  }, /*#__PURE__*/React.createElement(PlaneFiller, {
    equations: equations,
    ballPos: ballPos,
    simStars: simStars,
    startPos: ball,
    autoZoomTrigger: fitTrigger,
    autoZoomEnabled: true,
    levelStars: stars,
    trail: trail,
    editable: !running,
    selected: selected,
    onSelect: setSelected,
    onMove: moveObject
  }), !selected && !running && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 8,
      left: 0,
      right: 0,
      textAlign: 'center',
      pointerEvents: 'none',
      fontSize: 11.5,
      color: 'var(--fp-ink-4)'
    }
  }, "Pick an object above, or drag one on the plane")), selectedPos && !running && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: `10px ${padX}px`,
      flex: '0 0 auto',
      background: 'var(--fp-surface)',
      borderTop: '1px solid var(--fp-line)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: 'var(--fp-ink-3)',
      minWidth: 52
    }
  }, selected === 'ball' ? 'Spawn' : `Star ${Number(selected.slice(5)) + 1}`), /*#__PURE__*/React.createElement(CoordField, {
    axis: "x",
    value: selectedPos.x,
    onChange: setCoord
  }), /*#__PURE__*/React.createElement(CoordField, {
    axis: "y",
    value: selectedPos.y,
    onChange: setCoord
  })), /*#__PURE__*/React.createElement(EquationsPanel, {
    equations: equations,
    setEquations: setEquations,
    expanded: panelOpen,
    onToggle: () => setPanelOpen(v => !v),
    disabled: running,
    notation: settings?.notation || 'standard',
    allowedClass: null,
    classWarning: null
  }));
}
function ObjChip({
  label,
  active,
  disabled,
  onClick
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    disabled: disabled,
    style: {
      padding: '5px 11px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 500,
      background: active ? 'var(--fp-ink)' : 'transparent',
      color: active ? 'var(--fp-bg)' : 'var(--fp-ink-2)',
      border: `1px solid ${active ? 'var(--fp-ink)' : 'var(--fp-line)'}`,
      opacity: disabled ? 0.4 : 1
    }
  }, label);
}
function CoordField({
  axis,
  value,
  onChange
}) {
  // Held locally while typing so an intermediate "-" or "1." isn't rejected
  // as unparseable and snapped back mid-keystroke.
  const [draft, setDraft] = useSB(String(value));
  useSBE(() => {
    setDraft(String(value));
  }, [value]);
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Geist Mono', monospace",
      fontSize: 12,
      color: 'var(--fp-ink-3)'
    }
  }, axis), /*#__PURE__*/React.createElement("input", {
    type: "number",
    step: "0.25",
    inputMode: "decimal",
    value: draft,
    onChange: e => {
      setDraft(e.target.value);
      onChange(axis, e.target.value);
    },
    style: {
      width: '100%',
      height: 34,
      borderRadius: 9,
      padding: '0 9px',
      background: 'var(--fp-bg)',
      border: '1px solid var(--fp-line)',
      color: 'var(--fp-ink)',
      fontFamily: "'Geist Mono', monospace",
      fontSize: 13
    }
  }));
}
window.SandboxScreen = SandboxScreen;
