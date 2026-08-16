// Function Plane — Level Complete popup

const {
  useState: useLCState,
  useEffect: useLCEffect
} = React;
function LevelCompletePopup({
  pack,
  levelIndex,
  starsRating,
  score,
  prevBest,
  isNewBest,
  time,
  prevBestTime,
  isNewBestTime,
  onReplay,
  onNext,
  onClose
}) {
  // Level 10 has no next level — onNext returns to the level list there, so
  // the label has to say so.
  const isLastLevel = levelIndex >= 9;
  const [revealed, setRevealed] = useLCState(false);
  const [tab, setTab] = useLCState('score'); // 'score' | 'scoreboard' | 'timeboard'
  const [scoreboard, setScoreboard] = useLCState(null);
  const [timeboard, setTimeboard] = useLCState(null);
  const [boardLoading, setBoardLoading] = useLCState(false);
  useLCEffect(() => {
    const t = setTimeout(() => setRevealed(true), 80);
    return () => clearTimeout(t);
  }, []);

  // Load leaderboard async when its tab is first opened
  useLCEffect(() => {
    if (tab === 'score') return;
    const isTime = tab === 'timeboard';
    if ((isTime ? timeboard : scoreboard) !== null) return;
    setBoardLoading(true);
    const packId = pack?.id;
    FP_AUTH.buildLeaderboard({
      metric: isTime ? 'time' : 'level',
      packId,
      levelIndex
    }).then(rows => {
      const me = FP_AUTH.getActive();
      if (me) {
        const selfRow = rows.find(r => r.self);
        if (isTime) {
          if (selfRow) {
            if (time != null && time < selfRow.time) selfRow.time = time;
          } else if (time != null) rows.push({
            id: me.id,
            name: me.name,
            avatar: me.avatar,
            time,
            rank: null,
            self: true
          });
          rows.sort((a, b) => (a.time ?? Infinity) - (b.time ?? Infinity));
        } else {
          if (selfRow) {
            if (score != null && score < selfRow.score) selfRow.score = score;
          } else if (score != null) rows.push({
            id: me.id,
            name: me.name,
            avatar: me.avatar,
            score,
            rank: null,
            self: true
          });
          rows.sort((a, b) => a.score - b.score);
        }
        rows.forEach((r, i) => r.rank = i + 1);
      }
      if (isTime) setTimeboard(rows);else setScoreboard(rows);
    }).catch(() => {
      if (isTime) setTimeboard([]);else setScoreboard([]);
    }).finally(() => setBoardLoading(false));
  }, [tab]);
  const board = tab === 'timeboard' ? timeboard : tab === 'scoreboard' ? scoreboard : null;
  const isTimeTab = tab === 'timeboard';
  const packLabel = pack ? pack.type === 'roman' ? `Pack ${pack.numeral}` : pack.name : 'Pack I';
  const signedIn = !!(window.FP_AUTH && FP_AUTH.getActive());
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 100,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex',
      alignItems: 'flex-end',
      backdropFilter: 'blur(2px)'
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: '100%',
      background: 'var(--fp-bg)',
      borderRadius: '24px 24px 0 0',
      paddingBottom: 'max(28px, env(safe-area-inset-bottom, 0px))',
      boxShadow: '0 -8px 40px rgba(0,0,0,0.3)',
      transform: revealed ? 'translateY(0)' : 'translateY(100%)',
      transition: 'transform .3s cubic-bezier(.22,.68,0,1.2)',
      boxSizing: 'border-box',
      maxHeight: '90vh',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 24px 0',
      flex: '0 0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 4,
      borderRadius: 2,
      background: 'var(--fp-ink-4)',
      margin: '0 auto 16px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      fontSize: 10.5,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: 'var(--fp-ink-3)',
      marginBottom: 4
    }
  }, packLabel, " \xB7 Level ", levelIndex + 1), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      fontFamily: "'Instrument Serif', Georgia, serif",
      fontStyle: 'italic',
      fontSize: 34,
      lineHeight: 1.05,
      letterSpacing: '-0.02em',
      color: 'var(--fp-ink)',
      marginBottom: 16
    }
  }, starsRating === 3 ? 'Perfect!' : starsRating === 2 ? 'Nice work' : 'Level clear'), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: 6,
      marginBottom: 18
    }
  }, [0, 1, 2].map(i => {
    const earned = i < starsRating;
    const size = i === 1 ? 52 : 42;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: revealed && earned ? i === 1 ? 'scale(1) translateY(-6px)' : 'scale(1)' : 'scale(0.4)',
        opacity: revealed ? 1 : 0,
        transition: `transform .35s cubic-bezier(.34,1.56,.64,1) ${i * 75 + 120}ms,
                               opacity .2s ease ${i * 75 + 120}ms`
      }
    }, /*#__PURE__*/React.createElement("svg", {
      width: size,
      height: size,
      viewBox: "0 0 24 24"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M12 2 L15 9 L22 9.5 L17 14 L18.5 21 L12 17.5 L5.5 21 L7 14 L2 9.5 L9 9 Z",
      fill: earned ? 'var(--lv-star)' : 'none',
      stroke: earned ? 'var(--lv-star)' : 'var(--fp-ink-4)',
      strokeWidth: 1.5,
      strokeLinejoin: "round"
    })));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      marginBottom: 14
    }
  }, [['score', 'Score'], ['scoreboard', 'Best scores'], ['timeboard', 'Best times']].map(([id, label]) => /*#__PURE__*/React.createElement("button", {
    key: id,
    onClick: () => setTab(id),
    style: {
      height: 30,
      padding: '0 12px',
      borderRadius: 999,
      background: tab === id ? 'var(--fp-ink)' : 'transparent',
      color: tab === id ? 'var(--fp-bg)' : 'var(--fp-ink-3)',
      fontSize: 11.5,
      fontWeight: 500,
      border: tab === id ? 'none' : '1px solid var(--fp-line)'
    }
  }, label)))), /*#__PURE__*/React.createElement("div", {
    className: "fp-scroll",
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '0 24px'
    }
  }, tab === 'score' && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--fp-surface)',
      border: '1px solid var(--fp-line)',
      borderRadius: 16,
      padding: '14px 18px',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: 'var(--fp-ink-3)',
      marginBottom: 3
    }
  }, "Score"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "fp-mono",
    style: {
      fontSize: 30,
      fontWeight: 600,
      color: 'var(--fp-ink)',
      letterSpacing: '-0.03em'
    }
  }, score), isNewBest && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: 'var(--fp-accent)',
      padding: '2px 7px',
      borderRadius: 999,
      background: 'color-mix(in srgb, var(--fp-accent) 14%, transparent)'
    }
  }, "New best"))), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: 'var(--fp-ink-3)',
      marginBottom: 3
    }
  }, "Rating"), /*#__PURE__*/React.createElement("div", {
    className: "fp-mono",
    style: {
      fontSize: 22,
      color: 'var(--fp-ink)'
    }
  }, starsRating, "/3"))), prevBest != null && !isNewBest && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      paddingTop: 10,
      borderTop: '1px solid var(--fp-line)',
      fontSize: 11.5,
      color: 'var(--fp-ink-3)'
    }
  }, "Previous best: ", /*#__PURE__*/React.createElement("span", {
    className: "fp-mono",
    style: {
      color: 'var(--fp-ink-2)'
    }
  }, prevBest))), time != null && /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--fp-surface)',
      border: '1px solid var(--fp-line)',
      borderRadius: 16,
      padding: '14px 18px',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: 'var(--fp-ink-3)',
      marginBottom: 3
    }
  }, "Time"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "fp-mono",
    style: {
      fontSize: 26,
      fontWeight: 600,
      color: 'var(--fp-ink)',
      letterSpacing: '-0.03em'
    }
  }, time.toFixed(2), "s"), isNewBestTime && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: 'var(--fp-accent)',
      padding: '2px 7px',
      borderRadius: 999,
      background: 'color-mix(in srgb, var(--fp-accent) 14%, transparent)'
    }
  }, "Fastest yet")))), prevBestTime != null && !isNewBestTime && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      paddingTop: 10,
      borderTop: '1px solid var(--fp-line)',
      fontSize: 11.5,
      color: 'var(--fp-ink-3)'
    }
  }, "Previous best: ", /*#__PURE__*/React.createElement("span", {
    className: "fp-mono",
    style: {
      color: 'var(--fp-ink-2)'
    }
  }, prevBestTime.toFixed(2), "s")))), (tab === 'scoreboard' || tab === 'timeboard') && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      padding: '0 0 8px',
      fontSize: 10,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: 'var(--fp-ink-4)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 28
    }
  }, "#"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, "Player"), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 60,
      textAlign: 'right'
    }
  }, isTimeTab ? 'Time' : 'Score')), boardLoading && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      color: 'var(--fp-ink-4)',
      fontSize: 12,
      padding: '20px 0'
    }
  }, "Loading\u2026"), !boardLoading && board !== null && board.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      color: 'var(--fp-ink-3)',
      fontSize: 12.5,
      padding: '16px 0',
      lineHeight: 1.55
    }
  }, signedIn ? 'No scores yet — be the first!' : 'Sign in to appear on the global leaderboard.'), !boardLoading && board !== null && board.map((row, i) => /*#__PURE__*/React.createElement("div", {
    key: row.id,
    style: {
      display: 'flex',
      alignItems: 'center',
      padding: row.self ? '9px 10px' : '9px 0',
      margin: row.self ? '4px 0' : 0,
      borderRadius: row.self ? 10 : 0,
      background: row.self ? 'var(--fp-surface)' : 'transparent',
      border: row.self ? '1.5px solid var(--fp-ink)' : 'none',
      borderBottom: !row.self && i < board.length - 1 ? '1px solid var(--fp-line)' : row.self ? '1.5px solid var(--fp-ink)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 28,
      flex: '0 0 28px',
      fontSize: row.rank <= 3 ? 13 : 11,
      fontWeight: row.rank <= 3 ? 700 : 400,
      color: row.rank === 1 ? '#d4a017' : row.rank === 2 ? '#9ba0a6' : row.rank === 3 ? '#b87333' : 'var(--fp-ink-4)',
      fontFamily: "'Geist Mono', monospace"
    }
  }, row.rank <= 3 ? ['🥇', '🥈', '🥉'][row.rank - 1] : row.rank ?? '—'), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontSize: 13,
      color: 'var(--fp-ink)',
      fontWeight: row.self ? 600 : 500,
      display: 'flex',
      alignItems: 'center',
      gap: 7
    }
  }, row.avatar && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14
    }
  }, row.avatar), /*#__PURE__*/React.createElement("span", null, row.self ? `${row.name} (you)` : row.name)), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 60,
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "fp-mono",
    style: {
      fontSize: 13,
      fontWeight: row.self ? 700 : 600,
      color: 'var(--fp-ink)'
    }
  }, isTimeTab ? row.time != null ? row.time.toFixed(2) + 's' : '—' : row.score)))), !signedIn && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      fontSize: 11,
      color: 'var(--fp-ink-4)',
      paddingTop: 10
    }
  }, "Sign in to save your score to the global leaderboard"))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 24px',
      flex: '0 0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onReplay,
    style: {
      flex: 1,
      height: 50,
      borderRadius: 14,
      background: 'var(--fp-surface)',
      border: '1px solid var(--fp-line)',
      color: 'var(--fp-ink)',
      fontSize: 14,
      fontWeight: 500,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M1 4v6h6",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3.51 15a9 9 0 1 0 .49-4.96",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })), "Replay"), /*#__PURE__*/React.createElement("button", {
    onClick: onNext,
    style: {
      flex: 2,
      height: 50,
      borderRadius: 14,
      background: 'var(--fp-accent)',
      color: 'var(--fp-accent-ink)',
      fontSize: 14,
      fontWeight: 500,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7
    }
  }, isLastLevel ? 'Back to levels' : 'Next level', /*#__PURE__*/React.createElement(Icon.Chevron, {
    dir: "right",
    size: 14,
    c: "currentColor"
  }))))));
}
window.LevelCompletePopup = LevelCompletePopup;