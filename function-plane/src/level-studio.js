// Function Plane — Level studio
//
// One screen, two jobs. As the *sandbox* it is the game with the goals taken
// away: graph anything, place fans and hazards, run the ball, see what
// happens. As the *admin editor* it is the same screen with a level loaded
// into it, the goals and the Save button on the Level tab — so a level is
// authored by playing it, not by typing coordinates into a form.
//
// Both modes have that Level tab, and both can write the board to a file and
// read one back (see *Level files* below). That is the bridge between them:
// the sandbox is where a level gets worked out, and the editor is where it
// gets saved, and until now nothing carried a board from one to the other.
//
// Objects, stars and the spawn are things you select and move — by dragging
// on the plane or by editing their numbers — never things you scatter by
// tapping. Tapping empty space pans, exactly as it does in a level.
//
// The plane, the equations panel and the tick loop are the level's own code
// (exported from level-screen.js), so a test run here is the run a player
// gets.

const {
  useState: useLS,
  useRef: useLSR,
  useEffect: useLSE
} = React;
const STUDIO_START = {
  x: -4,
  y: 5
};
const STUDIO_STARS = [{
  x: -2,
  y: 2
}, {
  x: 0,
  y: 0
}, {
  x: 2,
  y: -2
}];
const STUDIO_LIMIT = 30; // seconds of sim before a free run stops on its own

// ── Level files ──────────────────────────────────────────────────────────
// The whole board as one JSON document — what Export writes and Import reads,
// in both modes, so a level worked out in the sandbox can be carried into the
// admin editor and a saved level can be taken back out to play with. The
// fields are named as levels/*.json names them, so an export drops straight
// into a pack draft.
//
// The sandbox shows only the name, but it holds the goals, hint and explainer
// it read and writes them back out: a file that survives a round trip through
// the sandbox is the point, and silently dropping the half it cannot display
// would defeat it.
const LEVEL_FILE = 'function-plane/level';

// Export and Import are peers, and neither is the primary action on the tab —
// outlined rather than filled, so Save still reads as the thing to press.
const FILE_BTN = {
  flex: 1,
  height: 38,
  borderRadius: 10,
  background: 'var(--fp-surface)',
  border: '1px solid var(--lv-line)',
  color: 'var(--fp-ink)',
  fontSize: 13,
  fontWeight: 500
};
const pt = p => ({
  x: Number(p?.x) || 0,
  y: Number(p?.y) || 0
});
// The goal fields are edited as strings, because a half-typed one is not a
// number yet. Empty stays empty rather than becoming 0.
const goalOut = s => {
  const t = String(s).trim();
  return t && isFinite(Number(t)) ? Number(t) : null;
};
const goalIn = v => v == null || !isFinite(v) ? '' : String(v);
function levelToFile(b) {
  return {
    format: LEVEL_FILE,
    version: 1,
    name: b.name.trim() || null,
    ball: pt(b.ball),
    stars: b.stars.map(pt),
    objects: b.objects.map(o => ({
      ...o
    })),
    // A blank row is something you are about to type into, not part of the level.
    equations: b.equations.filter(e => e.expr.trim()).map(e => ({
      expr: e.expr,
      domain: e.domain || null,
      material: e.material || null,
      visible: e.visible !== false
    })),
    scoreGoal: goalOut(b.scoreGoal),
    eqGoal: goalOut(b.eqGoal),
    materials: !!b.materials,
    hint: b.hint.trim() || null,
    explain: b.explain || null
  };
}
function fileToLevel(doc) {
  if (!doc || doc.format !== LEVEL_FILE) throw new Error('Not a Function Plane level file');
  const stars = Array.isArray(doc.stars) ? doc.stars.map(pt) : [];
  if (!stars.length) throw new Error('That file has no stars');
  // Sliders are per-board, the way they are when the studio first opens.
  window.FP_PARAMS = {};
  const equations = (Array.isArray(doc.equations) ? doc.equations : []).filter(e => e && typeof e.expr === 'string' && e.expr.trim()).map((e, i) => {
    const segs = (Array.isArray(e.domain) ? e.domain : []).filter(d => isFinite(d?.xMin) && isFinite(d?.xMax)).map(d => ({
      xMin: Number(d.xMin),
      xMax: Number(d.xMax)
    }));
    return {
      id: i + 1,
      expr: e.expr,
      ...parseEquation(e.expr),
      color: SIM.EQ_COLORS[i % SIM.EQ_COLORS.length],
      visible: e.visible !== false,
      // An empty segment list is not "no restriction" — it is a curve with
      // nowhere to draw. Only a real segment becomes a domain.
      domain: segs.length ? segs : null,
      material: e.material === 'dead' || e.material === 'rubber' ? e.material : null,
      preplaced: false
    };
  });
  return {
    name: typeof doc.name === 'string' ? doc.name : '',
    ball: pt(doc.ball),
    stars,
    // An unknown kind draws nothing and does nothing; getLevelData drops one
    // on the same grounds rather than carrying a hole around.
    objects: (Array.isArray(doc.objects) ? doc.objects : []).filter(o => o && FP_OBJECTS.KINDS[o.kind]).map(o => ({
      ...o
    })),
    equations,
    scoreGoal: goalIn(doc.scoreGoal),
    eqGoal: goalIn(doc.eqGoal),
    materials: !!doc.materials,
    hint: typeof doc.hint === 'string' ? doc.hint : '',
    explain: typeof doc.explain === 'string' ? doc.explain : ''
  };
}

// mode: 'sandbox' | 'admin'. In admin mode pack/levelIndex name the level
// being edited and onSaved runs after a successful write.
function LevelStudio({
  mode = 'sandbox',
  pack,
  levelIndex,
  onBack,
  onSaved,
  density = 'comfortable',
  settings
}) {
  const padX = density === 'compact' ? 18 : 22;
  const admin = mode === 'admin';
  const level = admin ? getLevelData(pack.id, levelIndex) : null;
  const ov = admin ? window.FP_LEVEL_OVERRIDES?.[`${pack.id}-${levelIndex}`] || {} : {};
  const gravityFlip = admin && getPack(pack.id)?.modifier === 'gravityFlip';
  const [ball, setBall] = useLS(admin ? {
    ...level.ball
  } : {
    ...STUDIO_START
  });
  const [stars, setStars] = useLS(admin ? level.stars.map(s => ({
    ...s
  })) : STUDIO_STARS.map(s => ({
    ...s
  })));
  const [objects, setObjects] = useLS(admin ? level.objects.map(o => ({
    ...o
  })) : []);
  const [selected, setSelected] = useLS(null); // 'ball' | `star-${i}` | `obj-${i}` | null
  const [equations, setEquations] = useLS(() => {
    window.FP_PARAMS = {};
    // The admin edits the pre-placed curves as ordinary rows; they lock for
    // players when the level is played.
    return admin ? level.preplaced.map((expr, i) => ({
      id: i + 1,
      expr,
      ...parseEquation(expr),
      color: SIM.EQ_COLORS[i % SIM.EQ_COLORS.length],
      visible: true,
      domain: null,
      preplaced: false
    })) : [];
  });
  const [running, setRunning] = useLS(false);
  const [ballPos, setBallPos] = useLS(ball);
  const [simStars, setSimStars] = useLS(stars.map(s => ({
    ...s,
    collected: false
  })));
  const [trail, setTrail] = useLS(null);
  const [panelOpen, setPanelOpen] = useLS(true);
  const [elapsed, setElapsed] = useLS(0);
  const [gravityDir, setGravityDir] = useLS(1);
  const [flash, setFlash] = useLS(null); // 'hazard' | 'cleared' | null

  // Admin-only level settings.
  const [name, setName] = useLS(ov.name || (window.LEVEL_NAMES?.[levelIndex] ?? ''));
  const [scoreGoal, setScoreGoal] = useLS(admin ? String(level.scoreGoal) : '');
  const [eqGoal, setEqGoal] = useLS(admin ? String(level.eqGoal) : '');
  const [materials, setMaterials] = useLS(admin ? !!level.materials : true);
  const [explain, setExplain] = useLS(admin ? level.explain || '' : '');
  const [hint, setHint] = useLS(admin ? level.hint || '' : '');
  const [busy, setBusy] = useLS(false);
  // { text, bad } — Save, Export and Import all report here, and only some of
  // what they report is a failure.
  const [msg, setMsg] = useLS(null);
  // The selected thing's x / y, edited with the game's keypad rather than the
  // device's: an <input type="number"> cannot reliably suppress the native
  // keyboard on Android, and it mangles a half-typed "-" on the way through.
  // null = closed; { axis, val } = open on that axis.
  const [coordKb, setCoordKb] = useLS(null);

  // Frame the objects once, after the plane has been measured. Only on entry:
  // re-framing on Play would throw away a view the player deliberately
  // panned and zoomed to compose.
  const [fitTrigger, setFitTrigger] = useLS(null);
  useLSE(() => {
    const t = setTimeout(() => setFitTrigger(1), 60);
    return () => clearTimeout(t);
  }, []);
  const physRef = useLSR(null);
  const animRef = useLSR(null);
  const viewRef = useLSR({
    cx: 0,
    cy: 0,
    scale: 40
  });
  const eqRef = useLSR(equations);
  eqRef.current = equations;
  const objRef = useLSR(objects);
  objRef.current = objects;
  const sfx = nm => {
    if (settings?.sound === false || !window.FP_AUDIO) return;
    FP_AUDIO[nm]?.((settings?.volume ?? 70) / 100);
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
    setGravityDir(1);
  };

  // Moving an object while stopped should move what you see, not just what the
  // next run starts from.
  useLSE(() => {
    if (!running) resetSim();
  }, [ball, stars, running]);
  const q = v => Math.max(-40, Math.min(40, v));
  const moveObject = (id, pos) => {
    if (running) return;
    if (id === 'ball') {
      setBall(pos);
      return;
    }
    if (id.startsWith('star-')) {
      const i = Number(id.slice(5));
      setStars(prev => prev.map((s, k) => k === i ? pos : s));
      return;
    }
    const i = Number(id.slice(4));
    setObjects(prev => prev.map((o, k) => k === i ? {
      ...o,
      x: pos.x,
      y: pos.y
    } : o));
  };

  // What this board would score as a level run, so the sandbox can answer the
  // only question it could not: is this cheaper than what I did before?
  const liveScore = computeScore(equations);
  const eqsUsed = equations.filter(e => e.fn && e.visible !== false).length;
  const selectedPos = !selected ? null : selected === 'ball' ? ball : selected.startsWith('star-') ? stars[Number(selected.slice(5))] : objects[Number(selected.slice(4))];
  const selectedLabel = !selected ? '' : selected === 'ball' ? 'Spawn' : selected.startsWith('star-') ? `Star ${Number(selected.slice(5)) + 1}` : FP_OBJECTS.KINDS[objects[Number(selected.slice(4))]?.kind]?.label || '';
  const setCoord = (axis, value) => {
    // Number('') is 0 and Number('-') is NaN, so an emptied field used to snap
    // the object to the origin on the keystroke that cleared it. A field the
    // player is still part-way through typing commits nothing.
    const t = String(value).trim();
    if (!t || t === '-' || t === '.' || t === '-.' || !selectedPos) return;
    const n = Number(t);
    if (!isFinite(n)) return;
    moveObject(selected, {
      ...selectedPos,
      [axis]: q(n)
    });
  };
  const openCoord = axis => {
    if (!running && selectedPos) setCoordKb({
      axis,
      val: String(selectedPos[axis])
    });
  };
  // Anything that takes the selection away takes the keypad with it.
  useLSE(() => {
    setCoordKb(null);
  }, [selected, running]);
  const addStar = () => {
    if (running) return;
    const c = viewRef.current;
    setStars(prev => [...prev, {
      x: Math.round(c.cx * 4) / 4,
      y: Math.round(c.cy * 4) / 4
    }]);
    setSelected(`star-${stars.length}`);
  };
  const removeSelectedStar = () => {
    if (!selected?.startsWith('star-') || stars.length <= 1) return;
    const i = Number(selected.slice(5));
    setStars(prev => prev.filter((_, k) => k !== i));
    setSelected(null);
  };
  const handlePlay = () => {
    if (running) {
      cancelAnimationFrame(animRef.current);
      setRunning(false);
      resetSim();
      setTrail(physRef.current?.trail?.length > 1 ? physRef.current.trail : null);
      return;
    }
    physRef.current = freshPh(ball, stars);
    setSimStars(stars.map(s => ({
      ...s,
      collected: false
    })));
    setElapsed(0);
    setTrail(null);
    setFlash(null);
    setSelected(null);
    setRunning(true);
  };
  useLSE(() => {
    if (!running) return;
    const ph = physRef.current;
    const world = makeWorld(objRef.current, gravityFlip, stars, ball);
    const colliders = makeRunColliders(eqRef.current, world);
    const frame = ts => {
      drainTicks(ph, colliders, world, ts);
      setElapsed(ph.simS);
      if (gravityFlip) setGravityDir(ph.gSign);
      if (ph.bounced) sfx('bounce');
      if (ph.justCollected) sfx('collectStar');
      setBallPos({
        x: ph.x,
        y: ph.y
      });
      setSimStars([...ph.stars]);

      // A free run ends when the ball leaves the world, dies, or the clock
      // runs out; collecting every star is just a nice noise. Editing a level
      // also ends it half a second after the last star, the way play does,
      // so the admin sees the run a player would get.
      const cleared = admin && ph.wonAtS != null && ph.simS - ph.wonAtS >= 0.5;
      if (ph.dead || outOfWorld(ph, world) || ph.simS > STUDIO_LIMIT || cleared) {
        cancelAnimationFrame(animRef.current);
        setTrail(ph.trail);
        setRunning(false);
        resetSim();
        if (ph.dead) {
          setFlash('hazard');
          sfx('levelFail');
        } else if (cleared) {
          setFlash('cleared');
          sfx('levelComplete');
        }
        if (ph.dead || cleared) setTimeout(() => setFlash(null), 1800);
        return;
      }
      animRef.current = requestAnimationFrame(frame);
    };
    animRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animRef.current);
  }, [running]);
  const reset = () => {
    if (running) return;
    setBall(admin ? {
      ...level.ball
    } : {
      ...STUDIO_START
    });
    setStars(admin ? level.stars.map(s => ({
      ...s
    })) : STUDIO_STARS.map(s => ({
      ...s
    })));
    setObjects(admin ? level.objects.map(o => ({
      ...o
    })) : []);
    setEquations([]);
    setTrail(null);
    setSelected(null);
  };
  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const patch = {
        name: name.trim() || null,
        ball_x: ball.x,
        ball_y: ball.y,
        stars: stars.map(s => ({
          x: s.x,
          y: s.y
        })),
        score_goal: parseInt(scoreGoal, 10),
        eq_goal: parseInt(eqGoal, 10),
        preplaced: equations.map(e => e.expr.trim()).filter(Boolean),
        objects,
        materials,
        explain: explain || null,
        hint: hint.trim() || null
      };
      if (!patch.stars.length) throw new Error('At least one star is required');
      if (!isFinite(patch.score_goal) || !isFinite(patch.eq_goal)) throw new Error('Both star goals are required');
      await FP_AUTH.saveLevelOverride(pack.id, levelIndex, patch);
      setMsg({
        text: 'Saved'
      });
      onSaved && (await onSaved());
    } catch (e) {
      setMsg({
        text: e.message,
        bad: true
      });
    } finally {
      setBusy(false);
    }
  };
  const placeAt = () => {
    const c = viewRef.current;
    return {
      x: Math.round(c.cx * 4) / 4,
      y: Math.round(c.cy * 4) / 4
    };
  };
  const fileRef = useLSR(null);
  const exportLevel = () => {
    const doc = levelToFile({
      name,
      ball,
      stars,
      objects,
      equations,
      scoreGoal,
      eqGoal,
      materials,
      hint,
      explain
    });
    const slug = (doc.name || (admin ? `${pack.id}-${levelIndex + 1}` : 'sandbox')).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'level';
    const url = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], {
      type: 'application/json'
    }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoking in the same tick cancels the download before the WebView has
    // read the blob.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMsg({
      text: `Exported ${slug}.json`
    });
  };
  const importLevel = file => {
    if (!file) return;
    file.text().then(txt => {
      const next = fileToLevel(JSON.parse(txt));
      setName(next.name);
      setBall(next.ball);
      setStars(next.stars);
      setObjects(next.objects);
      setEquations(next.equations);
      setScoreGoal(next.scoreGoal);
      setEqGoal(next.eqGoal);
      setMaterials(next.materials);
      setHint(next.hint);
      setExplain(next.explain);
      setSelected(null);
      setTrail(null);
      // A board from somewhere else is somewhere else on the plane; this is
      // the one moment re-framing is not throwing away a composed view.
      setFitTrigger(v => (v || 0) + 1);
      setMsg({
        text: `Imported ${file.name}`
      });
    }).catch(e => setMsg({
      text: e instanceof SyntaxError ? 'That file is not JSON' : e.message,
      bad: true
    }));
  };
  const levelTab = {
    label: 'Level',
    content: /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '4px 14px 12px'
      }
    }, /*#__PURE__*/React.createElement(StudioField, {
      label: "Level name",
      value: name,
      onChange: setName,
      placeholder: admin ? window.LEVEL_NAMES?.[levelIndex] : 'Untitled'
    }), admin && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement(StudioField, {
      label: "Score goal (\u2264 for 2\u2605)",
      value: scoreGoal,
      onChange: setScoreGoal,
      numeric: true
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement(StudioField, {
      label: "Equation goal (\u2264 for 3\u2605)",
      value: eqGoal,
      onChange: setEqGoal,
      numeric: true
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: 'var(--fp-ink-3)',
        marginBottom: 5
      }
    }, "Hint"), /*#__PURE__*/React.createElement("textarea", {
      value: hint,
      onChange: e => setHint(e.target.value),
      rows: 2,
      placeholder: window.getHint?.(pack.id, levelIndex) || 'No hint — the button says so',
      style: {
        width: '100%',
        borderRadius: 10,
        padding: '8px 10px',
        resize: 'vertical',
        boxSizing: 'border-box',
        background: 'var(--fp-surface)',
        border: '1px solid var(--lv-line)',
        color: 'var(--fp-ink)',
        fontSize: 13,
        lineHeight: 1.5,
        outline: 'none',
        fontFamily: 'inherit'
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: 'var(--fp-ink-4)',
        marginTop: 4,
        lineHeight: 1.5
      }
    }, "What ", /*#__PURE__*/React.createElement("em", null, "kind"), " of function this level wants \u2014 never the numbers. Overrides the built-in hint for this level; leave empty to fall back to it.")), /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: 'var(--fp-ink-3)',
        marginBottom: 5
      }
    }, "Introduces"), /*#__PURE__*/React.createElement("select", {
      value: explain,
      onChange: e => setExplain(e.target.value),
      style: {
        width: '100%',
        height: 38,
        borderRadius: 10,
        padding: '0 10px',
        background: 'var(--fp-surface)',
        border: '1px solid var(--lv-line)',
        color: 'var(--fp-ink)',
        fontSize: 13
      }
    }, /*#__PURE__*/React.createElement("option", {
      value: ""
    }, "Nothing \u2014 no popup"), Object.entries(window.FP_EXPLAINERS || {}).map(([k, v]) => /*#__PURE__*/React.createElement("option", {
      key: k,
      value: k
    }, v.title))), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: 'var(--fp-ink-4)',
        marginTop: 4,
        lineHeight: 1.5
      }
    }, "Shown once, the first time a player opens this level. Objects are not listed \u2014 a fan or a hazard explains itself the first time a player meets one.")), /*#__PURE__*/React.createElement("label", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '10px 12px',
        borderRadius: 10,
        marginBottom: 12,
        background: 'var(--fp-surface)',
        border: '1px solid var(--lv-line)',
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--fp-ink)'
      }
    }, "Players can set bounce"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: 'var(--fp-ink-3)',
        marginTop: 2,
        lineHeight: 1.4
      }
    }, "Lets a player make any of their curves steel (no bounce) or rubber (perfectly elastic). Off by default.")), /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      checked: materials,
      onChange: e => setMaterials(e.target.checked),
      style: {
        width: 18,
        height: 18,
        accentColor: 'var(--fp-ink)',
        flex: '0 0 auto'
      }
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: 'var(--fp-ink-4)',
        lineHeight: 1.5,
        marginBottom: 10
      }
    }, "Every equation on the Equations tab is saved as pre-placed: players see it, can't change it, and aren't charged for it.", gravityFlip && ' This pack flips gravity on every bounce — test runs here do too.')), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 10.5,
        color: 'var(--fp-ink-3)',
        marginBottom: 6,
        letterSpacing: '0.04em',
        textTransform: 'uppercase'
      }
    }, "File"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        marginBottom: 6
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: exportLevel,
      disabled: running,
      style: {
        ...FILE_BTN,
        opacity: running ? 0.4 : 1
      }
    }, "Export"), /*#__PURE__*/React.createElement("button", {
      onClick: () => fileRef.current?.click(),
      disabled: running,
      style: {
        ...FILE_BTN,
        opacity: running ? 0.4 : 1
      }
    }, "Import")), /*#__PURE__*/React.createElement("input", {
      ref: fileRef,
      type: "file",
      accept: "application/json,.json",
      style: {
        display: 'none'
      },
      onChange: e => {
        importLevel(e.target.files?.[0]);
        e.target.value = '';
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: 'var(--fp-ink-4)',
        marginTop: 4,
        marginBottom: 12,
        lineHeight: 1.5
      }
    }, "The spawn, the stars, the objects, every equation and the goals, as one JSON file. Import replaces the whole board", admin ? ' — it does not save; the button below does' : '', "."), admin && /*#__PURE__*/React.createElement("button", {
      onClick: save,
      disabled: busy || running,
      style: {
        width: '100%',
        height: 44,
        borderRadius: 12,
        background: 'var(--fp-accent)',
        color: 'var(--fp-accent-ink)',
        fontSize: 14,
        fontWeight: 500,
        opacity: busy || running ? 0.5 : 1
      }
    }, busy ? 'Saving…' : 'Save level'), msg && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 8,
        fontSize: 12,
        textAlign: 'center',
        color: msg.bad ? '#e34' : 'var(--fp-accent)'
      }
    }, msg.text))
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
      textAlign: 'center',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: 'var(--fp-ink-4)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, admin ? `Editing · ${pack.id} · Level ${levelIndex + 1}` : 'Sandbox'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Instrument Serif', Georgia, serif",
      fontStyle: 'italic',
      fontSize: 19,
      letterSpacing: '-0.02em',
      color: 'var(--fp-ink)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, running ? `${elapsed.toFixed(1)}s` : admin ? name || 'Untitled level' : 'Free play')), /*#__PURE__*/React.createElement("div", {
    title: "What these equations would score as a level",
    style: {
      flex: '0 0 auto'
    }
  }, /*#__PURE__*/React.createElement(HudChip, {
    label: "Score",
    value: eqsUsed > 0 ? liveScore : '—'
  })), gravityFlip && /*#__PURE__*/React.createElement("div", {
    className: "fp-mono",
    style: {
      fontSize: 13,
      color: 'var(--fp-ink-2)',
      width: 22,
      textAlign: 'center'
    },
    title: "Gravity direction"
  }, gravityDir < 0 ? '↑' : '↓'), /*#__PURE__*/React.createElement("button", {
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
  }, /*#__PURE__*/React.createElement(StudioChip, {
    label: "Spawn",
    active: selected === 'ball',
    disabled: running,
    onClick: () => setSelected(selected === 'ball' ? null : 'ball')
  }), stars.map((_, i) => /*#__PURE__*/React.createElement(StudioChip, {
    key: i,
    label: `Star ${i + 1}`,
    active: selected === `star-${i}`,
    disabled: running,
    onClick: () => setSelected(selected === `star-${i}` ? null : `star-${i}`)
  })), /*#__PURE__*/React.createElement(StudioChip, {
    label: "+ star",
    disabled: running || stars.length >= 10,
    onClick: addStar
  }), /*#__PURE__*/React.createElement("div", {
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
    gridLabels: settings?.gridLabels !== false,
    levelStars: stars,
    trail: trail,
    objects: objects,
    gravityDir: gravityFlip && running ? gravityDir : null,
    viewRef: viewRef,
    editable: !running,
    selected: selected,
    onSelect: setSelected,
    onMove: moveObject
  }), !selected && !running && !flash && /*#__PURE__*/React.createElement("div", {
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
  }, "Pick something above or on the Objects tab, or drag it on the plane"), flash && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 8,
      left: 0,
      right: 0,
      textAlign: 'center',
      pointerEvents: 'none',
      fontSize: 12,
      fontWeight: 500,
      color: flash === 'hazard' ? '#c74440' : 'var(--fp-accent)',
      textShadow: '0 1px 2px rgba(0,0,0,0.35)'
    }
  }, flash === 'hazard' ? 'The ball hit a hazard' : 'Cleared!')), selectedPos && !running && /*#__PURE__*/React.createElement("div", {
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
  }, selectedLabel), /*#__PURE__*/React.createElement(StudioCoord, {
    axis: "x",
    value: selectedPos.x,
    active: coordKb?.axis === 'x',
    draft: coordKb?.val,
    label: `${selectedLabel} x`,
    onTap: () => openCoord('x')
  }), /*#__PURE__*/React.createElement(StudioCoord, {
    axis: "y",
    value: selectedPos.y,
    active: coordKb?.axis === 'y',
    draft: coordKb?.val,
    label: `${selectedLabel} y`,
    onTap: () => openCoord('y')
  }), selected.startsWith('star-') && stars.length > 1 && /*#__PURE__*/React.createElement("button", {
    onClick: removeSelectedStar,
    title: "Remove star",
    style: {
      width: 30,
      height: 34,
      color: 'var(--fp-ink-3)',
      fontSize: 18,
      lineHeight: 1
    }
  }, "\xD7")), /*#__PURE__*/React.createElement(EquationsPanel, {
    equations: equations,
    setEquations: setEquations,
    expanded: panelOpen,
    onToggle: () => setPanelOpen(v => !v),
    disabled: running,
    notation: settings?.notation || 'standard',
    allowedClass: null,
    classWarning: null,
    materialsOn: materials,
    objects: objects,
    setObjects: setObjects,
    selectedObj: selected?.startsWith('obj-') ? selected : null,
    onSelectObj: setSelected,
    placeAt: placeAt,
    extraTab: levelTab,
    suppressKeyboard: !!coordKb
  }), coordKb && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 60
    }
  }, /*#__PURE__*/React.createElement(NumPad, {
    val: coordKb.val,
    label: `${selectedLabel} ${coordKb.axis}`,
    onChange: v => {
      setCoordKb(k => ({
        ...k,
        val: v
      }));
      setCoord(coordKb.axis, v);
    },
    onDone: () => {
      setCoord(coordKb.axis, coordKb.val);
      setCoordKb(null);
    }
  })));
}
function StudioChip({
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

// A button, not an input: tapping it opens the game's keypad. `draft` is what
// that keypad currently holds, so a half-typed "-" or "1." shows as typed
// instead of being parsed and snapped back on every keystroke.
function StudioCoord({
  axis,
  value,
  active,
  draft,
  label,
  onTap
}) {
  return /*#__PURE__*/React.createElement("div", {
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
  }, axis), /*#__PURE__*/React.createElement("button", {
    "aria-label": label,
    onPointerDown: e => {
      e.preventDefault();
      onTap();
    },
    style: {
      width: '100%',
      height: 34,
      borderRadius: 9,
      padding: '0 9px',
      textAlign: 'left',
      background: active ? 'color-mix(in srgb, var(--fp-accent) 16%, var(--fp-bg))' : 'var(--fp-bg)',
      border: `1px solid ${active ? 'var(--fp-accent)' : 'var(--fp-line)'}`,
      color: 'var(--fp-ink)',
      fontFamily: "'Geist Mono', monospace",
      fontSize: 13
    }
  }, active ? draft : String(value)));
}
function StudioField({
  label,
  value,
  onChange,
  placeholder,
  numeric
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: 'var(--fp-ink-3)',
      marginBottom: 4,
      letterSpacing: '0.04em',
      textTransform: 'uppercase'
    }
  }, label), /*#__PURE__*/React.createElement("input", {
    value: value,
    onChange: e => onChange(e.target.value),
    placeholder: placeholder,
    inputMode: numeric ? 'numeric' : undefined,
    style: {
      width: '100%',
      height: 38,
      borderRadius: 9,
      boxSizing: 'border-box',
      padding: '0 10px',
      fontSize: 13.5,
      background: 'var(--fp-surface)',
      border: '1px solid var(--lv-line)',
      color: 'var(--fp-ink)',
      outline: 'none'
    }
  }));
}
window.LevelStudio = LevelStudio;
// The two halves of the level file, out where npm test can round-trip them.
// The format is not only the studio's: a levels/*.json draft is the same
// shape written by hand, so a change here has to stay honest about both.
window.FP_LEVEL_FILE = {
  LEVEL_FILE,
  levelToFile,
  fileToLevel
};