// Function Plane — Level studio
//
// One screen, two jobs. As the *sandbox* it is the game with the goals taken
// away: graph anything, place fans and hazards, run the ball, see what
// happens. As the *admin editor* it is the same screen with a level loaded
// into it, a Level tab for the name and goals, and a Save button — so a level
// is authored by playing it, not by typing coordinates into a form.
//
// Objects, stars and the spawn are things you select and move — by dragging
// on the plane or by editing their numbers — never things you scatter by
// tapping. Tapping empty space pans, exactly as it does in a level.
//
// The plane, the equations panel and the tick loop are the level's own code
// (exported from level-screen.js), so a test run here is the run a player
// gets.

const { useState: useLS, useRef: useLSR, useEffect: useLSE } = React;

const STUDIO_START = { x: -4, y: 5 };
const STUDIO_STARS = [{ x: -2, y: 2 }, { x: 0, y: 0 }, { x: 2, y: -2 }];
const STUDIO_LIMIT = 30;   // seconds of sim before a free run stops on its own

// mode: 'sandbox' | 'admin'. In admin mode pack/levelIndex name the level
// being edited and onSaved runs after a successful write.
function LevelStudio({ mode = 'sandbox', pack, levelIndex, onBack, onSaved, density = 'comfortable', settings }) {
  const padX  = density === 'compact' ? 18 : 22;
  const admin = mode === 'admin';
  const level = admin ? getLevelData(pack.id, levelIndex) : null;
  const ov    = admin ? (window.FP_LEVEL_OVERRIDES?.[`${pack.id}-${levelIndex}`] || {}) : {};
  const gravityFlip = admin && getPack(pack.id)?.modifier === 'gravityFlip';

  const [ball,      setBall]      = useLS(admin ? { ...level.ball } : { ...STUDIO_START });
  const [stars,     setStars]     = useLS(admin ? level.stars.map(s => ({ ...s })) : STUDIO_STARS.map(s => ({ ...s })));
  const [objects,   setObjects]   = useLS(admin ? level.objects.map(o => ({ ...o })) : []);
  const [selected,  setSelected]  = useLS(null);   // 'ball' | `star-${i}` | `obj-${i}` | null
  const [equations, setEquations] = useLS(() => {
    window.FP_PARAMS = {};
    // The admin edits the pre-placed curves as ordinary rows; they lock for
    // players when the level is played.
    return admin ? level.preplaced.map((expr, i) => ({
      id: i + 1, expr, ...parseEquation(expr),
      color: SIM.EQ_COLORS[i % SIM.EQ_COLORS.length], visible: true, domain: null, preplaced: false,
    })) : [];
  });
  const [running,   setRunning]   = useLS(false);
  const [ballPos,   setBallPos]   = useLS(ball);
  const [simStars,  setSimStars]  = useLS(stars.map(s => ({ ...s, collected: false })));
  const [trail,     setTrail]     = useLS(null);
  const [panelOpen, setPanelOpen] = useLS(true);
  const [elapsed,   setElapsed]   = useLS(0);
  const [gravityDir, setGravityDir] = useLS(1);
  const [flash,     setFlash]     = useLS(null);   // 'hazard' | 'cleared' | null

  // Admin-only level settings.
  const [name,      setName]      = useLS(ov.name || (window.LEVEL_NAMES?.[levelIndex] ?? ''));
  const [scoreGoal, setScoreGoal] = useLS(admin ? String(level.scoreGoal) : '');
  const [eqGoal,    setEqGoal]    = useLS(admin ? String(level.eqGoal) : '');
  const [materials, setMaterials] = useLS(admin ? !!level.materials : true);
  const [busy,      setBusy]      = useLS(false);
  const [msg,       setMsg]       = useLS('');

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
  const viewRef = useLSR({ cx: 0, cy: 0, scale: 40 });
  const eqRef   = useLSR(equations);
  eqRef.current = equations;
  const objRef  = useLSR(objects);
  objRef.current = objects;

  const sfx = nm => {
    if (settings?.sound === false || !window.FP_AUDIO) return;
    FP_AUDIO[nm]?.((settings?.volume ?? 70) / 100);
  };

  const resetSim = () => {
    setBallPos({ ...ball });
    setSimStars(stars.map(s => ({ ...s, collected: false })));
    setElapsed(0);
    setGravityDir(1);
  };

  // Moving an object while stopped should move what you see, not just what the
  // next run starts from.
  useLSE(() => { if (!running) resetSim(); }, [ball, stars, running]);

  const q = v => Math.max(-40, Math.min(40, v));
  const moveObject = (id, pos) => {
    if (running) return;
    if (id === 'ball') { setBall(pos); return; }
    if (id.startsWith('star-')) {
      const i = Number(id.slice(5));
      setStars(prev => prev.map((s, k) => (k === i ? pos : s)));
      return;
    }
    const i = Number(id.slice(4));
    setObjects(prev => prev.map((o, k) => (k === i ? { ...o, x: pos.x, y: pos.y } : o)));
  };

  const selectedPos = !selected ? null
    : selected === 'ball' ? ball
    : selected.startsWith('star-') ? stars[Number(selected.slice(5))]
    : objects[Number(selected.slice(4))];
  const selectedLabel = !selected ? ''
    : selected === 'ball' ? 'Spawn'
    : selected.startsWith('star-') ? `Star ${Number(selected.slice(5)) + 1}`
    : FP_OBJECTS.KINDS[objects[Number(selected.slice(4))]?.kind]?.label || '';

  const setCoord = (axis, value) => {
    const n = Number(value);
    if (!isFinite(n) || !selectedPos) return;
    moveObject(selected, { ...selectedPos, [axis]: q(n) });
  };

  const addStar = () => {
    if (running) return;
    const c = viewRef.current;
    setStars(prev => [...prev, { x: Math.round(c.cx * 4) / 4, y: Math.round(c.cy * 4) / 4 }]);
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
    setSimStars(stars.map(s => ({ ...s, collected: false })));
    setElapsed(0);
    setTrail(null);
    setFlash(null);
    setSelected(null);
    setRunning(true);
  };

  useLSE(() => {
    if (!running) return;
    const ph = physRef.current;
    const active = eqRef.current.filter(e => e.fn && e.visible);
    const colliders = FP_PHYSICS.makeColliders(
      [...active.filter(e => !e.isImplicit), ...active.filter(e => e.isImplicit)]
        .map(e => ({ fn: e.fn, domain: e.domain, isImplicit: e.isImplicit, material: e.material })),
      SIM.BALL_R,
    );
    const objs = objRef.current;
    const world = {
      field:   FP_OBJECTS.makeField(objs),
      hazards: objs.filter(o => o.kind === 'hazard'),
      gravityFlip,
    };

    const frame = ts => {
      drainTicks(ph, colliders, world, ts);
      setElapsed(ph.simS);
      if (gravityFlip) setGravityDir(ph.gSign);
      if (ph.bounced)       sfx('bounce');
      if (ph.justCollected) sfx('collectStar');
      setBallPos({ x: ph.x, y: ph.y });
      setSimStars([...ph.stars]);

      // A free run ends when the ball leaves the world, dies, or the clock
      // runs out; collecting every star is just a nice noise. Editing a level
      // also ends it half a second after the last star, the way play does,
      // so the admin sees the run a player would get.
      const cleared = admin && ph.wonAtS != null && ph.simS - ph.wonAtS >= 0.5;
      if (ph.dead || outOfWorld(ph) || ph.simS > STUDIO_LIMIT || cleared) {
        cancelAnimationFrame(animRef.current);
        setTrail(ph.trail);
        setRunning(false);
        resetSim();
        if (ph.dead) { setFlash('hazard'); sfx('levelFail'); }
        else if (cleared) { setFlash('cleared'); sfx('levelComplete'); }
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
    setBall(admin ? { ...level.ball } : { ...STUDIO_START });
    setStars(admin ? level.stars.map(s => ({ ...s })) : STUDIO_STARS.map(s => ({ ...s })));
    setObjects(admin ? level.objects.map(o => ({ ...o })) : []);
    setEquations([]);
    setTrail(null);
    setSelected(null);
  };

  const save = async () => {
    setBusy(true); setMsg('');
    try {
      const patch = {
        name: name.trim() || null,
        ball_x: ball.x, ball_y: ball.y,
        stars: stars.map(s => ({ x: s.x, y: s.y })),
        score_goal: parseInt(scoreGoal, 10),
        eq_goal:    parseInt(eqGoal, 10),
        preplaced:  equations.map(e => e.expr.trim()).filter(Boolean),
        objects, materials,
      };
      if (!patch.stars.length) throw new Error('At least one star is required');
      if (!isFinite(patch.score_goal) || !isFinite(patch.eq_goal)) throw new Error('Both star goals are required');
      await FP_AUTH.saveLevelOverride(pack.id, levelIndex, patch);
      setMsg('Saved');
      onSaved && await onSaved();
    } catch (e) { setMsg(e.message); }
    finally    { setBusy(false); }
  };

  const placeAt = () => {
    const c = viewRef.current;
    return { x: Math.round(c.cx * 4) / 4, y: Math.round(c.cy * 4) / 4 };
  };

  const levelTab = admin ? {
    label: 'Level',
    content: (
      <div style={{ padding: '4px 14px 12px' }}>
        <StudioField label="Level name" value={name} onChange={setName} placeholder={window.LEVEL_NAMES?.[levelIndex]}/>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><StudioField label="Score goal (≤ for 2★)" value={scoreGoal} onChange={setScoreGoal} numeric/></div>
          <div style={{ flex: 1 }}><StudioField label="Equation goal (≤ for 3★)" value={eqGoal} onChange={setEqGoal} numeric/></div>
        </div>
        <label style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          padding: '10px 12px', borderRadius: 10, marginBottom: 12,
          background: 'var(--fp-surface)', border: '1px solid var(--lv-line)', cursor: 'pointer',
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fp-ink)' }}>Players can set bounce</div>
            <div style={{ fontSize: 11, color: 'var(--fp-ink-3)', marginTop: 2, lineHeight: 1.4 }}>
              Lets a player make any of their curves dead (no bounce) or perfectly elastic. Off by default.
            </div>
          </div>
          <input type="checkbox" checked={materials} onChange={e => setMaterials(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: 'var(--fp-ink)', flex: '0 0 auto' }}/>
        </label>
        <div style={{ fontSize: 11, color: 'var(--fp-ink-4)', lineHeight: 1.5, marginBottom: 10 }}>
          Every equation on the Equations tab is saved as pre-placed: players see it, can't change it, and aren't charged for it.
          {gravityFlip && ' This pack flips gravity on every bounce — test runs here do too.'}
        </div>
        <button onClick={save} disabled={busy || running} style={{
          width: '100%', height: 44, borderRadius: 12,
          background: 'var(--fp-accent)', color: 'var(--fp-accent-ink)',
          fontSize: 14, fontWeight: 500, opacity: busy || running ? 0.5 : 1,
        }}>{busy ? 'Saving…' : 'Save level'}</button>
        {msg && <div style={{ marginTop: 8, fontSize: 12, textAlign: 'center', color: msg === 'Saved' ? 'var(--fp-accent)' : '#e34' }}>{msg}</div>}
      </div>
    ),
  } : null;

  return (
    <div className="fp-screen" style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      position: 'relative',
    }}>
      <div style={{ height: 'env(safe-area-inset-top, 0px)', flex: '0 0 auto', background: 'var(--lv-bg)' }}/>

      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: `8px ${padX}px 8px`, flex: '0 0 auto', background: 'var(--lv-bg)',
      }}>
        <button onClick={onBack} aria-label="Back" style={{
          width: 38, height: 38, borderRadius: 10, display: 'flex',
          alignItems: 'center', justifyContent: 'center', color: 'var(--fp-ink-2)',
        }}>
          <Icon.Chevron dir="left" size={20}/>
        </button>
        <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
          <div style={{
            fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--fp-ink-4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{admin ? `Editing · ${pack.id} · Level ${levelIndex + 1}` : 'Sandbox'}</div>
          <div style={{
            fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: 'italic',
            fontSize: 19, letterSpacing: '-0.02em', color: 'var(--fp-ink)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{running ? `${elapsed.toFixed(1)}s` : (admin ? (name || 'Untitled level') : 'Free play')}</div>
        </div>
        {gravityFlip && (
          <div className="fp-mono" style={{ fontSize: 13, color: 'var(--fp-ink-2)', width: 22, textAlign: 'center' }}
            title="Gravity direction">{gravityDir < 0 ? '↑' : '↓'}</div>
        )}
        <button onClick={handlePlay} style={{
          height: 38, padding: '0 16px', borderRadius: 11,
          background: 'var(--fp-ink)', color: 'var(--fp-bg)',
          fontSize: 13.5, fontWeight: 500,
        }}>{running ? 'Stop' : 'Play ▸'}</button>
      </div>

      {/* Object picker — the spawn and the stars; placed objects select from their tab or the plane */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
        padding: `0 ${padX}px 8px`, flex: '0 0 auto', background: 'var(--lv-bg)',
      }}>
        <StudioChip label="Spawn" active={selected === 'ball'} disabled={running}
          onClick={() => setSelected(selected === 'ball' ? null : 'ball')}/>
        {stars.map((_, i) => (
          <StudioChip key={i} label={`Star ${i + 1}`} active={selected === `star-${i}`} disabled={running}
            onClick={() => setSelected(selected === `star-${i}` ? null : `star-${i}`)}/>
        ))}
        <StudioChip label="+ star" disabled={running || stars.length >= 8} onClick={addStar}/>
        <div style={{ flex: 1 }}/>
        <button onClick={reset} disabled={running} style={{
          fontSize: 11.5, color: 'var(--fp-ink-3)', opacity: running ? 0.4 : 1,
          textDecoration: 'underline',
        }}>Reset</button>
      </div>

      {/* Plane */}
      <div style={{
        flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden',
        borderTop: '1px solid var(--lv-bg)', borderBottom: '1px solid var(--lv-bg)',
      }}>
        <PlaneFiller
          equations={equations} ballPos={ballPos}
          simStars={simStars} startPos={ball}
          autoZoomTrigger={fitTrigger} autoZoomEnabled={true}
          gridLabels={settings?.gridLabels !== false}
          levelStars={stars} trail={trail}
          objects={objects} gravityDir={gravityFlip && running ? gravityDir : null}
          viewRef={viewRef}
          editable={!running} selected={selected}
          onSelect={setSelected} onMove={moveObject}/>

        {!selected && !running && !flash && (
          <div style={{
            position: 'absolute', top: 8, left: 0, right: 0, textAlign: 'center',
            pointerEvents: 'none', fontSize: 11.5, color: 'var(--fp-ink-4)',
          }}>
            Pick something above or on the Objects tab, or drag it on the plane
          </div>
        )}
        {flash && (
          <div style={{
            position: 'absolute', top: 8, left: 0, right: 0, textAlign: 'center',
            pointerEvents: 'none', fontSize: 12, fontWeight: 500,
            color: flash === 'hazard' ? '#c74440' : 'var(--fp-accent)',
            textShadow: '0 1px 2px rgba(0,0,0,0.35)',
          }}>{flash === 'hazard' ? 'The ball hit a hazard' : 'Cleared!'}</div>
        )}
      </div>

      {/* Coordinates for the selected object */}
      {selectedPos && !running && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: `10px ${padX}px`, flex: '0 0 auto',
          background: 'var(--fp-surface)', borderTop: '1px solid var(--fp-line)',
        }}>
          <span style={{
            fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
            color: 'var(--fp-ink-3)', minWidth: 52,
          }}>{selectedLabel}</span>
          <StudioCoord axis="x" value={selectedPos.x} onChange={setCoord}/>
          <StudioCoord axis="y" value={selectedPos.y} onChange={setCoord}/>
          {selected.startsWith('star-') && stars.length > 1 && (
            <button onClick={removeSelectedStar} title="Remove star"
              style={{ width: 30, height: 34, color: 'var(--fp-ink-3)', fontSize: 18, lineHeight: 1 }}>×</button>
          )}
        </div>
      )}

      <EquationsPanel
        equations={equations} setEquations={setEquations}
        expanded={panelOpen} onToggle={() => setPanelOpen(v => !v)}
        disabled={running} notation={settings?.notation || 'standard'}
        allowedClass={null} classWarning={null}
        materialsOn={materials}
        objects={objects} setObjects={setObjects}
        selectedObj={selected?.startsWith('obj-') ? selected : null}
        onSelectObj={setSelected} placeAt={placeAt}
        extraTab={levelTab}/>
    </div>
  );
}

function StudioChip({ label, active, disabled, onClick }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '5px 11px', borderRadius: 999, fontSize: 12, fontWeight: 500,
      background: active ? 'var(--fp-ink)' : 'transparent',
      color: active ? 'var(--fp-bg)' : 'var(--fp-ink-2)',
      border: `1px solid ${active ? 'var(--fp-ink)' : 'var(--fp-line)'}`,
      opacity: disabled ? 0.4 : 1,
    }}>{label}</button>
  );
}

function StudioCoord({ axis, value, onChange }) {
  // Held locally while typing so an intermediate "-" or "1." isn't rejected
  // as unparseable and snapped back mid-keystroke.
  const [draft, setDraft] = useLS(String(value));
  useLSE(() => { setDraft(String(value)); }, [value]);
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
      <span style={{
        fontFamily: "'Geist Mono', monospace", fontSize: 12, color: 'var(--fp-ink-3)',
      }}>{axis}</span>
      <input
        type="number" step="0.25" inputMode="decimal" value={draft}
        onChange={e => { setDraft(e.target.value); onChange(axis, e.target.value); }}
        style={{
          width: '100%', height: 34, borderRadius: 9, padding: '0 9px',
          background: 'var(--fp-bg)', border: '1px solid var(--fp-line)',
          color: 'var(--fp-ink)', fontFamily: "'Geist Mono', monospace", fontSize: 13,
        }}/>
    </label>
  );
}

function StudioField({ label, value, onChange, placeholder, numeric }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10.5, color: 'var(--fp-ink-3)', marginBottom: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</div>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        inputMode={numeric ? 'numeric' : undefined}
        style={{ width: '100%', height: 38, borderRadius: 9, boxSizing: 'border-box', padding: '0 10px', fontSize: 13.5,
          background: 'var(--fp-surface)', border: '1px solid var(--lv-line)', color: 'var(--fp-ink)', outline: 'none' }}/>
    </div>
  );
}

window.LevelStudio = LevelStudio;
