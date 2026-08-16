// Function Plane — Admin panel
// Visible only to the user with display name "Test Account". Lets them edit
// pack metadata (name, allowed equation class) and per-level data
// (level name, ball position, stars, score & equation goals). Writes go to the
// pack_overrides / level_overrides Supabase tables; on save the parent app
// re-fetches overrides and the change becomes live for everyone.

const {
  useState: useAS,
  useEffect: useASE
} = React;
const FUNCTION_CLASSES = [{
  id: '',
  label: 'Any (no restriction)'
}, {
  id: 'linear',
  label: 'Linear only'
}, {
  id: 'quadratic',
  label: 'Quadratic only'
}, {
  id: 'trig',
  label: 'Trigonometry only'
}, {
  id: 'exp',
  label: 'Exponential / log only'
}, {
  id: 'cubic',
  label: 'Cubic only'
}];
function AdminScreen({
  onBack,
  density = 'comfortable',
  onChanged
}) {
  const padX = density === 'compact' ? 18 : 22;
  const [view, setView] = useAS('list'); // 'list' | 'pack' | 'level' | 'users' | 'achievements' | 'achievement'
  const [pack, setPack] = useAS(null);
  const [levelIndex, setLI] = useAS(0);
  const [editAchId, setEditAchId] = useAS(null); // null = new

  if (view === 'pack' && pack) return /*#__PURE__*/React.createElement(PackEditor, {
    pack: pack,
    padX: padX,
    onBack: () => setView('list'),
    onChanged: onChanged,
    onPickLevel: idx => {
      setLI(idx);
      setView('level');
    }
  });
  if (view === 'level' && pack) return /*#__PURE__*/React.createElement(LevelEditor, {
    pack: pack,
    levelIndex: levelIndex,
    padX: padX,
    onBack: () => setView('pack'),
    onChanged: onChanged
  });
  if (view === 'users') return /*#__PURE__*/React.createElement(UsersAdmin, {
    padX: padX,
    onBack: () => setView('list')
  });
  if (view === 'audit') return /*#__PURE__*/React.createElement(LeaderboardAudit, {
    padX: padX,
    onBack: () => setView('list')
  });
  if (view === 'achievements') return /*#__PURE__*/React.createElement(AchievementsAdmin, {
    padX: padX,
    onBack: () => setView('list'),
    onChanged: onChanged,
    onEdit: id => {
      setEditAchId(id);
      setView('achievement');
    }
  });
  if (view === 'achievement') return /*#__PURE__*/React.createElement(AchievementEditor, {
    padX: padX,
    editId: editAchId,
    onBack: () => setView('achievements'),
    onChanged: onChanged
  });
  return /*#__PURE__*/React.createElement(ScreenFrameAS, {
    title: "Admin",
    onBack: onBack,
    padX: padX
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 0 24px'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setView('users'),
    style: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 14px',
      marginBottom: 8,
      borderRadius: 12,
      background: 'var(--fp-ink)',
      color: 'var(--fp-bg)',
      textAlign: 'left',
      fontSize: 14,
      fontWeight: 500
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, "Manage users / grant premium"), /*#__PURE__*/React.createElement(Icon.Chevron, {
    dir: "right",
    size: 14,
    c: "currentColor"
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => setView('achievements'),
    style: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 14px',
      marginBottom: 14,
      borderRadius: 12,
      background: 'var(--fp-ink)',
      color: 'var(--fp-bg)',
      textAlign: 'left',
      fontSize: 14,
      fontWeight: 500
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, "Manage achievements"), /*#__PURE__*/React.createElement(Icon.Chevron, {
    dir: "right",
    size: 14,
    c: "currentColor"
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => setView('audit'),
    style: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 14px',
      marginBottom: 14,
      borderRadius: 12,
      background: 'var(--fp-ink)',
      color: 'var(--fp-bg)',
      textAlign: 'left',
      fontSize: 14,
      fontWeight: 500
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, "Audit leaderboard"), /*#__PURE__*/React.createElement(Icon.Chevron, {
    dir: "right",
    size: 14,
    c: "currentColor"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'var(--fp-ink-3)',
      marginBottom: 8
    }
  }, "Roman packs"), ROMAN_PACKS.map(p => /*#__PURE__*/React.createElement(AdminPackRow, {
    key: p.id,
    pack: p,
    onClick: () => {
      setPack(p);
      setView('pack');
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'var(--fp-ink-3)',
      marginBottom: 8,
      marginTop: 18
    }
  }, "Themed packs"), SPECIAL_PACKS.map(p => /*#__PURE__*/React.createElement(AdminPackRow, {
    key: p.id,
    pack: p,
    onClick: () => {
      setPack(p);
      setView('pack');
    }
  }))));
}

// ─── Leaderboard audit ─────────────────────────────────────────────────────
// The database refuses values no run can produce (see the leaderboard
// integrity migration), but it can't tell whether a plausible score matches
// the equations that claim to have produced it — scoring needs the classifier.
// This recomputes each submission with the same code the game scores with.

function auditRow(row) {
  const exprs = Array.isArray(row.equations) ? row.equations : null;
  if (!exprs || exprs.length === 0) {
    // Rows predating the equations column, or a client that stripped it.
    return {
      level: 'unverifiable',
      reason: 'No equations submitted'
    };
  }
  const parsed = exprs.map(expr => ({
    expr,
    ...parseEquation(expr)
  }));
  const broken = parsed.filter(e => !e.fn);
  if (broken.length) {
    return {
      level: 'bad',
      reason: `Does not parse: ${broken.map(e => e.expr).join(', ')}`
    };
  }
  const score = computeScore(parsed);
  if (score !== row.best_score) {
    return {
      level: 'bad',
      reason: `Score claims ${row.best_score}, equations give ${score}`
    };
  }
  const allowed = getPack(row.pack_id)?.allowedClass;
  if (allowed) {
    const wrong = parsed.filter(e => !classMatches(allowed, detectClass(e.expr)));
    if (wrong.length) {
      return {
        level: 'bad',
        reason: `Not ${allowed}: ${wrong.map(e => e.expr).join(', ')}`
      };
    }
  }
  const data = getLevelData(row.pack_id, row.level_index);
  const expected = starRating(parsed.length, score, data.eqGoal, data.scoreGoal);
  if (row.stars > expected) {
    // Not proof: a row holds a personal best, and a 3-star run with more
    // equations can score worse than a 2-star run with fewer, in which case
    // the stored equations belong to the other run. Worth a look, not a ban.
    return {
      level: 'suspect',
      reason: `${row.stars} stars, but these equations earn ${expected} — check the player's other runs`
    };
  }
  return {
    level: 'ok',
    reason: `Verified — score ${score}, ${expected} stars`
  };
}
function LeaderboardAudit({
  padX,
  onBack
}) {
  const [rows, setRows] = useAS(null);
  const [err, setErr] = useAS('');
  const [showAll, setShowAll] = useAS(false);
  const [busyKey, setBusyKey] = useAS(null);
  const load = () => {
    setErr('');
    setRows(null);
    FP_AUTH.fetchScoreRows().then(rs => setRows(rs.map(r => ({
      ...r,
      audit: auditRow(r)
    })))).catch(e => setErr(e.message));
  };
  useASE(load, []);
  const remove = row => {
    const key = `${row.user_id}-${row.pack_id}-${row.level_index}`;
    setBusyKey(key);
    FP_AUTH.deleteScoreRow(row.user_id, row.pack_id, row.level_index).then(() => setRows(rs => rs.filter(r => `${r.user_id}-${r.pack_id}-${r.level_index}` !== key))).catch(e => setErr(e.message)).finally(() => setBusyKey(null));
  };
  const count = level => rows.filter(r => r.audit.level === level).length;
  const shown = !rows ? [] : showAll ? rows : rows.filter(r => r.audit.level !== 'ok');
  const TONE = {
    bad: '#c0392b',
    suspect: '#b8860b'
  };
  return /*#__PURE__*/React.createElement(ScreenFrameAS, {
    title: "Leaderboard audit",
    onBack: onBack,
    padX: padX
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 0 24px'
    }
  }, err && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: '#c0392b',
      marginBottom: 12
    }
  }, err), !rows && !err && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--fp-ink-3)'
    }
  }, "Checking submissions\u2026"), rows && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--fp-ink-2)',
      lineHeight: 1.7,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", null, count('ok'), " verified \xB7 ", count('bad'), " failed \xB7 ", count('suspect'), " to check \xB7 ", count('unverifiable'), " unverifiable"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowAll(v => !v),
    style: {
      marginTop: 6,
      fontSize: 12,
      color: 'var(--fp-ink-3)',
      textDecoration: 'underline'
    }
  }, showAll ? 'Show only problems' : 'Show every row')), rows && shown.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--fp-ink-3)'
    }
  }, "Nothing to review \u2014 every submission matches its equations."), shown.map(row => {
    const key = `${row.user_id}-${row.pack_id}-${row.level_index}`;
    const tone = TONE[row.audit.level] || null;
    const bad = row.audit.level === 'bad';
    return /*#__PURE__*/React.createElement("div", {
      key: key,
      style: {
        border: `1px solid ${tone || 'var(--fp-line)'}`,
        borderRadius: 12,
        padding: '11px 13px',
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4
      }
    }, /*#__PURE__*/React.createElement("span", null, row.avatar), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13.5,
        fontWeight: 500,
        color: 'var(--fp-ink)',
        flex: 1
      }
    }, row.name), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "'Geist Mono', monospace",
        fontSize: 11.5,
        color: 'var(--fp-ink-3)'
      }
    }, row.pack_id, " \xB7 L", row.level_index + 1)), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: tone || 'var(--fp-ink-3)',
        marginBottom: 6
      }
    }, row.audit.reason), Array.isArray(row.equations) && row.equations.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "'Geist Mono', monospace",
        fontSize: 11.5,
        color: 'var(--fp-ink-2)',
        marginBottom: 8,
        wordBreak: 'break-all'
      }
    }, row.equations.join('   ')), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "'Geist Mono', monospace",
        fontSize: 11.5,
        color: 'var(--fp-ink-3)',
        flex: 1
      }
    }, row.stars, "\u2605 \xB7 ", row.best_score, " pts", row.best_time != null ? ` · ${row.best_time}s` : ''), /*#__PURE__*/React.createElement("button", {
      onClick: () => remove(row),
      disabled: busyKey === key,
      style: {
        padding: '6px 12px',
        borderRadius: 9,
        fontSize: 12,
        fontWeight: 500,
        background: bad ? '#c0392b' : 'var(--fp-surface)',
        color: bad ? '#fff' : 'var(--fp-ink)',
        border: bad ? 'none' : '1px solid var(--fp-line)',
        opacity: busyKey === key ? 0.5 : 1
      }
    }, busyKey === key ? 'Removing…' : 'Remove')));
  })));
}

// ─── Users / premium grant ─────────────────────────────────────────────────

function UsersAdmin({
  padX,
  onBack
}) {
  const [q, setQ] = useAS('');
  const [results, setResults] = useAS([]);
  const [busy, setBusy] = useAS(false);
  const [msg, setMsg] = useAS('');
  const search = async () => {
    setBusy(true);
    setMsg('');
    try {
      const sb = window.FP_SB || null; // fallback
      // Use buildLeaderboard's underlying client via a quick query
      const {
        data,
        error
      } = await window.fpAdminSearchProfiles(q);
      if (error) throw new Error(error.message);
      setResults(data || []);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };
  const togglePremium = async row => {
    const next = !row.is_premium;
    const ok = await window.fpConfirm({
      title: next ? `Grant premium to ${row.name}?` : `Revoke premium from ${row.name}?`,
      body: next ? 'They will get all packs unlocked immediately.' : 'They will lose premium-only content access.',
      confirmLabel: next ? 'Grant' : 'Revoke',
      danger: !next
    });
    if (!ok) return;
    try {
      await FP_AUTH.setPremium(row.id, next);
      setResults(rs => rs.map(r => r.id === row.id ? {
        ...r,
        is_premium: next
      } : r));
    } catch (e) {
      window.fpToast?.(e.message, {
        kind: 'error'
      });
    }
  };
  return /*#__PURE__*/React.createElement(ScreenFrameAS, {
    title: "Admin \xB7 Users",
    onBack: onBack,
    padX: padX
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '18px 0 24px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "Search by name or email",
    autoFocus: true,
    style: {
      flex: 1,
      height: 42,
      borderRadius: 10,
      padding: '0 12px',
      fontSize: 14,
      background: 'var(--fp-surface)',
      border: '1px solid var(--fp-line)',
      color: 'var(--fp-ink)',
      outline: 'none'
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: search,
    disabled: busy || q.trim().length < 2,
    style: {
      padding: '0 18px',
      height: 42,
      borderRadius: 10,
      background: 'var(--fp-ink)',
      color: 'var(--fp-bg)',
      fontSize: 13,
      fontWeight: 500,
      opacity: busy ? 0.6 : 1
    }
  }, busy ? '…' : 'Search')), msg && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 10,
      fontSize: 12,
      color: '#e34'
    }
  }, msg), results.length === 0 && !busy && q && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      color: 'var(--fp-ink-3)',
      fontSize: 12.5,
      padding: 20
    }
  }, "No matches."), results.map(r => /*#__PURE__*/React.createElement("div", {
    key: r.id,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px',
      marginBottom: 6,
      borderRadius: 12,
      background: 'var(--fp-surface)',
      border: '1px solid var(--fp-line)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 34,
      height: 34,
      borderRadius: '50%',
      flex: '0 0 34px',
      background: 'var(--fp-surface-2)',
      border: '1px solid var(--fp-line)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 18
    }
  }, r.avatar || '🟢'), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      fontWeight: 600,
      color: 'var(--fp-ink)'
    }
  }, r.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: 'var(--fp-ink-4)'
    }
  }, r.total_stars, "\u2605 ", r.is_premium && '· Premium')), /*#__PURE__*/React.createElement("button", {
    onClick: () => togglePremium(r),
    style: {
      padding: '6px 10px',
      borderRadius: 8,
      fontSize: 11,
      fontWeight: 500,
      background: r.is_premium ? 'transparent' : 'var(--fp-ink)',
      color: r.is_premium ? 'var(--fp-ink)' : 'var(--fp-bg)',
      border: '1px solid var(--fp-line)'
    }
  }, r.is_premium ? 'Revoke' : 'Grant premium')))));
}
function AdminPackRow({
  pack,
  onClick
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 14px',
      marginBottom: 6,
      borderRadius: 12,
      background: 'var(--fp-surface)',
      border: '1px solid var(--fp-line)',
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 10,
      flex: '0 0 36px',
      background: 'var(--fp-surface-2)',
      border: '1px solid var(--fp-line)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Geist Mono', monospace",
      fontSize: 13,
      color: 'var(--fp-ink)'
    }
  }, pack.numeral), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--fp-ink)'
    }
  }, pack.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--fp-ink-3)'
    }
  }, pack.id, " ", pack.allowedClass ? `· ${pack.allowedClass}` : '')), /*#__PURE__*/React.createElement(Icon.Chevron, {
    dir: "right",
    size: 14,
    c: "var(--fp-ink-3)"
  }));
}

// ─── Pack editor ───────────────────────────────────────────────────────────

function PackEditor({
  pack,
  padX,
  onBack,
  onPickLevel,
  onChanged
}) {
  const initialHidden = !!window.FP_PACK_OVERRIDES?.[pack.id]?.is_hidden;
  const [name, setName] = useAS(pack.name || '');
  const [cls, setCls] = useAS(pack.allowedClass || '');
  const [hidden, setHidden] = useAS(initialHidden);
  const [busy, setBusy] = useAS(false);
  const [msg, setMsg] = useAS('');
  const save = async () => {
    setBusy(true);
    setMsg('');
    try {
      await FP_AUTH.savePackOverride(pack.id, {
        name: name.trim() || null,
        allowed_class: cls || null,
        is_hidden: hidden
      });
      setMsg('Saved');
      onChanged && (await onChanged());
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };
  return /*#__PURE__*/React.createElement(ScreenFrameAS, {
    title: `Pack · ${pack.id}`,
    onBack: onBack,
    padX: padX
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '18px 0 24px'
    }
  }, /*#__PURE__*/React.createElement(FieldText, {
    label: "Pack name",
    value: name,
    onChange: setName
  }), /*#__PURE__*/React.createElement(FieldSelect, {
    label: "Allowed equation class",
    value: cls,
    onChange: setCls,
    options: FUNCTION_CLASSES
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 14px',
      borderRadius: 12,
      marginBottom: 12,
      background: 'var(--fp-surface)',
      border: '1px solid var(--fp-line)',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 500,
      color: 'var(--fp-ink)'
    }
  }, "Hide pack from all users"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--fp-ink-3)',
      marginTop: 2
    }
  }, "When checked, regular players won't see this pack at all.")), /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: hidden,
    onChange: e => setHidden(e.target.checked),
    style: {
      width: 18,
      height: 18,
      accentColor: 'var(--fp-ink)'
    }
  })), /*#__PURE__*/React.createElement("button", {
    onClick: save,
    disabled: busy,
    style: primaryBtn(busy)
  }, busy ? 'Saving…' : 'Save pack'), msg && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      fontSize: 12,
      textAlign: 'center',
      color: msg === 'Saved' ? 'var(--fp-accent)' : '#e34'
    }
  }, msg), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: 'var(--fp-line)',
      margin: '24px 0 14px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'var(--fp-ink-3)',
      marginBottom: 10
    }
  }, "Levels"), Array.from({
    length: 10
  }, (_, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    onClick: () => onPickLevel(i),
    style: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '11px 12px',
      marginBottom: 5,
      borderRadius: 11,
      background: 'var(--fp-surface)',
      border: '1px solid var(--fp-line)',
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 28,
      height: 28,
      borderRadius: 7,
      flex: '0 0 28px',
      background: 'var(--fp-surface-2)',
      border: '1px solid var(--fp-line)',
      fontFamily: "'Geist Mono', monospace",
      fontSize: 12,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--fp-ink)'
    }
  }, i + 1), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontSize: 13,
      color: 'var(--fp-ink)'
    }
  }, getLevelName(pack.id, i)), /*#__PURE__*/React.createElement(Icon.Chevron, {
    dir: "right",
    size: 13,
    c: "var(--fp-ink-3)"
  })))));
}

// ─── Level editor ──────────────────────────────────────────────────────────

function LevelEditor({
  pack,
  levelIndex,
  padX,
  onBack,
  onChanged
}) {
  const data = getLevelData(pack.id, levelIndex);
  const ov = window.FP_LEVEL_OVERRIDES?.[`${pack.id}-${levelIndex}`] || {};
  const [name, setName] = useAS(ov.name || LEVEL_NAMES[levelIndex] || '');
  const [ballX, setBallX] = useAS(String(data.ball.x));
  const [ballY, setBallY] = useAS(String(data.ball.y));
  const [scoreGoal, setScoreGoal] = useAS(String(data.scoreGoal));
  const [eqGoal, setEqGoal] = useAS(String(data.eqGoal));
  const [stars, setStars] = useAS(data.stars.map(s => ({
    x: String(s.x),
    y: String(s.y)
  })));
  const [preplaced, setPreplaced] = useAS(Array.isArray(ov.preplaced) ? [...ov.preplaced] : []);
  const [busy, setBusy] = useAS(false);
  const [msg, setMsg] = useAS('');
  const setStar = (i, k, v) => setStars(arr => arr.map((s, idx) => idx === i ? {
    ...s,
    [k]: v
  } : s));
  const addStar = () => setStars(arr => [...arr, {
    x: '0',
    y: '0'
  }]);
  const removeStar = i => setStars(arr => arr.filter((_, idx) => idx !== i));
  const setPre = (i, v) => setPreplaced(arr => arr.map((s, idx) => idx === i ? v : s));
  const addPre = () => setPreplaced(arr => [...arr, '']);
  const removePre = i => setPreplaced(arr => arr.filter((_, idx) => idx !== i));
  const save = async () => {
    setBusy(true);
    setMsg('');
    try {
      const patch = {
        name: name.trim() || null,
        ball_x: numOrNull(ballX),
        ball_y: numOrNull(ballY),
        stars: stars.map(s => ({
          x: Number(s.x),
          y: Number(s.y)
        })).filter(s => isFinite(s.x) && isFinite(s.y)),
        score_goal: intOrNull(scoreGoal),
        eq_goal: intOrNull(eqGoal),
        preplaced: preplaced.map(s => (s || '').trim()).filter(Boolean)
      };
      if (!patch.stars.length) throw new Error('At least one star is required');
      if (patch.ball_x == null || patch.ball_y == null) throw new Error('Ball position is required');
      if (patch.score_goal == null || patch.eq_goal == null) throw new Error('Both star goals are required');
      await FP_AUTH.saveLevelOverride(pack.id, levelIndex, patch);
      setMsg('Saved');
      onChanged && (await onChanged());
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };
  return /*#__PURE__*/React.createElement(ScreenFrameAS, {
    title: `${pack.id} · Level ${levelIndex + 1}`,
    onBack: onBack,
    padX: padX
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '18px 0 24px'
    }
  }, /*#__PURE__*/React.createElement(FieldText, {
    label: "Level name",
    value: name,
    onChange: setName,
    placeholder: LEVEL_NAMES[levelIndex]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(FieldText, {
    label: "Ball x",
    value: ballX,
    onChange: setBallX
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(FieldText, {
    label: "Ball y",
    value: ballY,
    onChange: setBallY
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(FieldText, {
    label: "Score goal (\u2264 for 2\u2605)",
    value: scoreGoal,
    onChange: setScoreGoal
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(FieldText, {
    label: "Equation goal (\u2264 for 3\u2605)",
    value: eqGoal,
    onChange: setEqGoal
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--fp-ink-3)',
      letterSpacing: '0.03em',
      textTransform: 'uppercase',
      marginBottom: 8
    }
  }, "Stars to collect"), stars.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 18,
      fontSize: 11.5,
      color: 'var(--fp-ink-4)',
      fontFamily: "'Geist Mono', monospace"
    }
  }, i + 1), /*#__PURE__*/React.createElement("input", {
    value: s.x,
    onChange: e => setStar(i, 'x', e.target.value),
    placeholder: "x",
    style: miniInput()
  }), /*#__PURE__*/React.createElement("input", {
    value: s.y,
    onChange: e => setStar(i, 'y', e.target.value),
    placeholder: "y",
    style: miniInput()
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => removeStar(i),
    style: {
      width: 28,
      height: 28,
      borderRadius: 7,
      color: 'var(--fp-ink-4)',
      fontSize: 16
    }
  }, "\xD7"))), /*#__PURE__*/React.createElement("button", {
    onClick: addStar,
    style: {
      marginTop: 4,
      fontSize: 12,
      color: 'var(--fp-ink-3)'
    }
  }, "+ add star")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--fp-ink-3)',
      letterSpacing: '0.03em',
      textTransform: 'uppercase',
      marginBottom: 6
    }
  }, "Pre-placed equations"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--fp-ink-4)',
      lineHeight: 1.5,
      marginBottom: 8
    }
  }, "Visible to players but locked \u2014 they can't edit or remove them, and they don't count toward score or equation budget."), preplaced.map((expr, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 18,
      fontSize: 11.5,
      color: 'var(--fp-ink-4)',
      fontFamily: "'Geist Mono', monospace"
    }
  }, i + 1), /*#__PURE__*/React.createElement("input", {
    value: expr,
    onChange: e => setPre(i, e.target.value),
    placeholder: "y = sin(x)",
    style: miniInput()
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => removePre(i),
    style: {
      width: 28,
      height: 28,
      borderRadius: 7,
      color: 'var(--fp-ink-4)',
      fontSize: 16
    }
  }, "\xD7"))), /*#__PURE__*/React.createElement("button", {
    onClick: addPre,
    style: {
      marginTop: 4,
      fontSize: 12,
      color: 'var(--fp-ink-3)'
    }
  }, "+ add pre-placed equation")), /*#__PURE__*/React.createElement("button", {
    onClick: save,
    disabled: busy,
    style: primaryBtn(busy)
  }, busy ? 'Saving…' : 'Save level'), msg && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      fontSize: 12,
      textAlign: 'center',
      color: msg === 'Saved' ? 'var(--fp-accent)' : '#e34'
    }
  }, msg)));
}

// ─── Achievements admin ────────────────────────────────────────────────────

const ACH_SQL = `-- Run this once in Supabase SQL editor.
create table if not exists achievement_overrides (
  id text primary key,
  name text not null,
  description text,
  kind text not null,
  threshold integer,
  pack_id text,
  level_index integer,
  is_hidden boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table achievement_overrides enable row level security;
drop policy if exists "ach_read" on achievement_overrides;
create policy "ach_read" on achievement_overrides for select using (true);
drop policy if exists "ach_admin_write" on achievement_overrides;
create policy "ach_admin_write" on achievement_overrides for all
  using     (exists (select 1 from profiles where id = auth.uid() and name = 'Test Account'))
  with check(exists (select 1 from profiles where id = auth.uid() and name = 'Test Account'));`;
function AchievementsAdmin({
  padX,
  onBack,
  onEdit,
  onChanged
}) {
  // Built-ins and custom rows in one list — every achievement is a data row
  // now, and the same editor handles both.
  const rows = getAchievementRows();
  const [showSql, setShowSql] = useAS(false);
  return /*#__PURE__*/React.createElement(ScreenFrameAS, {
    title: "Admin \xB7 Achievements",
    onBack: onBack,
    padX: padX
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 0 24px'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => onEdit(null),
    style: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: '12px 14px',
      marginBottom: 10,
      borderRadius: 12,
      background: 'var(--fp-accent)',
      color: 'var(--fp-accent-ink)',
      fontSize: 14,
      fontWeight: 500
    }
  }, "+ New achievement"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowSql(s => !s),
    style: {
      width: '100%',
      padding: '8px 12px',
      marginBottom: 14,
      fontSize: 11.5,
      color: 'var(--fp-ink-3)',
      border: '1px solid var(--fp-line)',
      borderRadius: 10,
      background: 'transparent',
      textAlign: 'left'
    }
  }, showSql ? '▾ Hide' : '▸ Show', " Supabase migration SQL (run once)"), showSql && /*#__PURE__*/React.createElement("pre", {
    className: "fp-mono",
    style: {
      background: 'var(--fp-surface-2)',
      border: '1px solid var(--fp-line)',
      borderRadius: 10,
      padding: 12,
      fontSize: 10.5,
      lineHeight: 1.5,
      color: 'var(--fp-ink-2)',
      whiteSpace: 'pre-wrap',
      marginBottom: 14,
      overflowX: 'auto'
    }
  }, ACH_SQL), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'var(--fp-ink-3)',
      marginBottom: 8
    }
  }, "All achievements (", rows.length, ")"), rows.map(r => /*#__PURE__*/React.createElement("button", {
    key: r.id,
    onClick: () => onEdit(r.id),
    style: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '11px 12px',
      marginBottom: 5,
      borderRadius: 11,
      background: 'var(--fp-surface)',
      border: '1px solid var(--fp-line)',
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 500,
      color: 'var(--fp-ink)'
    }
  }, r.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--fp-ink-3)'
    }
  }, window.ACH_KINDS?.[r.kind]?.label || r.kind, " \xB7 id ", /*#__PURE__*/React.createElement("span", {
    className: "fp-mono"
  }, r.id))), r.builtin && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10.5,
      color: 'var(--fp-ink-4)'
    }
  }, "built-in"), r.is_hidden && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10.5,
      color: 'var(--fp-ink-4)'
    }
  }, "hidden"), /*#__PURE__*/React.createElement(Icon.Chevron, {
    dir: "right",
    size: 13,
    c: "var(--fp-ink-3)"
  })))));
}
function AchievementEditor({
  padX,
  editId,
  onBack,
  onChanged
}) {
  // Built-ins load their shipped defaults; editing one writes an override row
  // with the same id, and deleting that row restores the default.
  const existing = getAchievementRows().find(r => r.id === editId);
  const isBuiltin = !!existing?.builtin;
  const hasOverride = !!(window.FP_ACH_OVERRIDES || []).find(r => r.id === editId);
  const [id, setId] = useAS(existing?.id || '');
  const [name, setName] = useAS(existing?.name || '');
  const [description, setDesc] = useAS(existing?.description || '');
  const [kind, setKind] = useAS(existing?.kind || 'total_stars');
  const [threshold, setThr] = useAS(existing?.threshold != null ? String(existing.threshold) : '');
  const [packId, setPackId] = useAS(existing?.pack_id || '');
  const [levelIndex, setLvl] = useAS(existing?.level_index != null ? String(existing.level_index) : '');
  const [isHidden, setHidden] = useAS(!!existing?.is_hidden);
  const [busy, setBusy] = useAS(false);
  const [msg, setMsg] = useAS('');
  const def = window.ACH_KINDS?.[kind];
  const needs = def?.needs || [];
  const KIND_OPTIONS = Object.entries(window.ACH_KINDS || {}).map(([id, v]) => ({
    id,
    label: v.label
  }));
  const PACK_OPTIONS = [{
    id: '',
    label: '— none —'
  }, ...(window.ROMAN_PACKS || []).map(p => ({
    id: p.id,
    label: `${p.id} · ${p.name}`
  })), ...(window.SPECIAL_PACKS || []).map(p => ({
    id: p.id,
    label: `${p.id} · ${p.name}`
  }))];
  const save = async () => {
    setBusy(true);
    setMsg('');
    try {
      if (!id.trim()) throw new Error('ID is required');
      if (!/^[a-z0-9_]+$/i.test(id.trim())) throw new Error('ID can only contain letters, numbers, and underscores');
      if (!name.trim()) throw new Error('Name is required');
      if (!def) throw new Error('Pick an achievement kind');
      const payload = {
        id: id.trim(),
        name: name.trim(),
        description: description.trim() || null,
        kind,
        threshold: needs.includes('threshold') ? intOrNull(threshold) : null,
        pack_id: needs.includes('packId') ? packId || null : null,
        level_index: needs.includes('levelIndex') ? intOrNull(levelIndex) : null,
        is_hidden: !!isHidden
      };
      for (const need of needs) {
        const k = need === 'packId' ? 'pack_id' : need === 'levelIndex' ? 'level_index' : need;
        if (payload[k] == null || payload[k] === '') throw new Error(`Missing required field: ${need}`);
      }
      await FP_AUTH.saveAchievementOverride(payload);
      setMsg('Saved');
      onChanged && (await onChanged());
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!existing) return;
    const ok = await window.fpConfirm({
      title: isBuiltin ? `Reset "${existing.name}"?` : `Delete "${existing.name}"?`,
      body: isBuiltin ? 'This drops your edits and restores the achievement that ships with the game.' : 'This removes the achievement for everyone. Already-earned ones will simply disappear from their list.',
      confirmLabel: isBuiltin ? 'Reset' : 'Delete',
      danger: true
    });
    if (!ok) return;
    setBusy(true);
    setMsg('');
    try {
      await FP_AUTH.deleteAchievementOverride(existing.id);
      onChanged && (await onChanged());
      onBack();
    } catch (e) {
      setMsg(e.message);
      setBusy(false);
    }
  };
  return /*#__PURE__*/React.createElement(ScreenFrameAS, {
    title: existing ? `Achievement · ${existing.id}` : 'New achievement',
    onBack: onBack,
    padX: padX
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '18px 0 24px'
    }
  }, isBuiltin
  // Changing a built-in's id would orphan every unlock recorded
  // against it and resurrect the default alongside it.
  ? /*#__PURE__*/React.createElement(FieldReadonly, {
    label: "ID (built-in \u2014 not editable)",
    value: id
  }) : /*#__PURE__*/React.createElement(FieldText, {
    label: "ID (stable, unique)",
    value: id,
    onChange: setId,
    placeholder: "e.g. winter_event_2026"
  }), /*#__PURE__*/React.createElement(FieldText, {
    label: "Name (shown to players)",
    value: name,
    onChange: setName,
    placeholder: "e.g. Winter Champion"
  }), /*#__PURE__*/React.createElement(FieldText, {
    label: "Description (optional \u2014 auto-generated if blank)",
    value: description,
    onChange: setDesc,
    placeholder: "Earn 100 stars in total"
  }), /*#__PURE__*/React.createElement(FieldSelect, {
    label: "Kind",
    value: kind,
    onChange: setKind,
    options: KIND_OPTIONS
  }), needs.includes('threshold') && /*#__PURE__*/React.createElement(FieldText, {
    label: def?.thresholdLabel ? `Threshold (${def.thresholdLabel})` : 'Threshold (N)',
    value: threshold,
    onChange: setThr,
    placeholder: "e.g. 50"
  }), needs.includes('packId') && /*#__PURE__*/React.createElement(FieldSelect, {
    label: "Pack",
    value: packId,
    onChange: setPackId,
    options: PACK_OPTIONS
  }), needs.includes('levelIndex') && /*#__PURE__*/React.createElement(FieldText, {
    label: "Level index (0\u20139)",
    value: levelIndex,
    onChange: setLvl,
    placeholder: "0"
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 14px',
      borderRadius: 12,
      marginBottom: 12,
      background: 'var(--fp-surface)',
      border: '1px solid var(--fp-line)',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 500,
      color: 'var(--fp-ink)'
    }
  }, "Hidden"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--fp-ink-3)',
      marginTop: 2
    }
  }, "When checked, this achievement won't show in any player's list.")), /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: isHidden,
    onChange: e => setHidden(e.target.checked),
    style: {
      width: 18,
      height: 18,
      accentColor: 'var(--fp-ink)'
    }
  })), /*#__PURE__*/React.createElement("button", {
    onClick: save,
    disabled: busy,
    style: primaryBtn(busy)
  }, busy ? 'Saving…' : existing ? 'Save changes' : 'Create achievement'), existing && (!isBuiltin || hasOverride) && /*#__PURE__*/React.createElement("button", {
    onClick: remove,
    disabled: busy,
    style: {
      width: '100%',
      height: 42,
      marginTop: 10,
      borderRadius: 12,
      background: 'transparent',
      color: '#e34',
      border: '1px solid #e34',
      fontSize: 13,
      fontWeight: 500,
      opacity: busy ? 0.6 : 1
    }
  }, isBuiltin ? 'Reset to default' : 'Delete achievement'), msg && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      fontSize: 12,
      textAlign: 'center',
      color: msg === 'Saved' ? 'var(--fp-accent)' : '#e34'
    }
  }, msg)));
}

// ─── Shared bits ───────────────────────────────────────────────────────────

function ScreenFrameAS({
  title,
  onBack,
  padX,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "fp-screen",
    style: {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: `calc(14px + env(safe-area-inset-top, 0px)) ${padX}px 12px`,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flex: '0 0 auto',
      borderBottom: '1px solid var(--fp-line)'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    style: {
      width: 36,
      height: 36,
      borderRadius: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--fp-ink-2)'
    }
  }, /*#__PURE__*/React.createElement(Icon.Chevron, {
    dir: "left",
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Instrument Serif', Georgia, serif",
      fontStyle: 'italic',
      fontSize: 22,
      letterSpacing: '-0.02em',
      color: 'var(--fp-ink)'
    }
  }, title)), /*#__PURE__*/React.createElement("div", {
    className: "fp-scroll",
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: `0 ${padX}px`,
      paddingBottom: 'max(28px, env(safe-area-inset-bottom, 0px))'
    }
  }, children));
}
function FieldReadonly({
  label,
  value
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: 'var(--fp-ink-3)',
      marginBottom: 5
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    className: "fp-mono",
    style: {
      ...miniInput(),
      display: 'flex',
      alignItems: 'center',
      color: 'var(--fp-ink-3)',
      background: 'var(--fp-surface-2)'
    }
  }, value));
}
function FieldText({
  label,
  value,
  onChange,
  placeholder
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--fp-ink-3)',
      marginBottom: 5,
      letterSpacing: '0.03em',
      textTransform: 'uppercase'
    }
  }, label), /*#__PURE__*/React.createElement("input", {
    value: value,
    onChange: e => onChange(e.target.value),
    placeholder: placeholder,
    style: {
      width: '100%',
      height: 42,
      borderRadius: 10,
      boxSizing: 'border-box',
      padding: '0 12px',
      fontSize: 14,
      background: 'var(--fp-surface)',
      border: '1px solid var(--fp-line)',
      color: 'var(--fp-ink)',
      outline: 'none'
    }
  }));
}
function FieldSelect({
  label,
  value,
  onChange,
  options
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--fp-ink-3)',
      marginBottom: 5,
      letterSpacing: '0.03em',
      textTransform: 'uppercase'
    }
  }, label), /*#__PURE__*/React.createElement("select", {
    value: value,
    onChange: e => onChange(e.target.value),
    style: {
      width: '100%',
      height: 42,
      borderRadius: 10,
      boxSizing: 'border-box',
      padding: '0 10px',
      fontSize: 14,
      background: 'var(--fp-surface)',
      border: '1px solid var(--fp-line)',
      color: 'var(--fp-ink)',
      outline: 'none'
    }
  }, options.map(o => /*#__PURE__*/React.createElement("option", {
    key: o.id,
    value: o.id
  }, o.label))));
}
function miniInput() {
  return {
    flex: 1,
    height: 36,
    borderRadius: 8,
    boxSizing: 'border-box',
    padding: '0 10px',
    fontSize: 13,
    background: 'var(--fp-surface)',
    border: '1px solid var(--fp-line)',
    color: 'var(--fp-ink)',
    outline: 'none',
    fontFamily: "'Geist Mono', monospace"
  };
}
function primaryBtn(disabled) {
  return {
    width: '100%',
    height: 48,
    borderRadius: 13,
    background: 'var(--fp-accent)',
    color: 'var(--fp-accent-ink)',
    fontSize: 14,
    fontWeight: 500,
    opacity: disabled ? 0.6 : 1,
    marginTop: 8
  };
}
const numOrNull = s => {
  const n = Number(s);
  return isFinite(n) ? n : null;
};
const intOrNull = s => {
  const n = parseInt(s, 10);
  return isFinite(n) ? n : null;
};
window.AdminScreen = AdminScreen;