// Function Plane — Level Selector (inside a pack)

function LevelSelector({
  pack,
  progress,
  onBack,
  onPickLevel,
  density = 'comfortable'
}) {
  const padX = density === 'compact' ? 18 : 22;
  const data = progress[pack.id] || {
    stars: Array(10).fill(-1),
    best: Array(10).fill(null)
  };
  const earned = data.stars.reduce((a, v) => a + (v > 0 ? v : 0), 0);
  const completed = data.stars.filter(v => v !== null && v >= 1).length;

  // Pack-level gating already happened in PackSelector (computePackLocked) —
  // inside an open pack the first level is always playable and each next
  // level unlocks by clearing the previous one. Never gate on stars[i]
  // itself: a freshly-unlocked pack still has null (untouched) entries,
  // which used to lock every level including the first.
  const isLevelUnlocked = i => {
    if (i === 0) return true;
    const prev = data.stars[i - 1];
    return prev != null && prev >= 1;
  };
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
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: `calc(14px + env(safe-area-inset-top, 0px)) ${padX}px 6px`,
      flex: '0 0 auto'
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
      fontSize: 11.5,
      color: 'var(--fp-ink-3)',
      letterSpacing: '0.06em',
      textTransform: 'uppercase'
    }
  }, pack.type === 'roman' ? `Pack ${pack.numeral}` : 'Themed'), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 32,
      padding: '0 12px',
      borderRadius: 999,
      border: '1px solid var(--fp-line)',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      color: 'var(--fp-ink-2)',
      fontSize: 12
    }
  }, /*#__PURE__*/React.createElement(Icon.Star, {
    size: 11,
    c: "var(--fp-ink)"
  }), /*#__PURE__*/React.createElement("span", {
    className: "fp-mono",
    style: {
      color: 'var(--fp-ink)'
    }
  }, earned), /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: 0.5
    }
  }, "/ 30"))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: `12px ${padX}px 18px`,
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      flex: '0 0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 70,
      height: 70,
      borderRadius: 14,
      flex: '0 0 70px',
      background: 'var(--fp-surface-2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: 0.18
    }
  }, /*#__PURE__*/React.createElement(MiniGraph, {
    kind: pack.kind,
    w: 68,
    h: 48,
    c: "var(--fp-ink)",
    dim: "transparent"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Instrument Serif', Georgia, serif",
      fontStyle: 'italic',
      fontWeight: 400,
      fontSize: pack.numeral.length > 2 ? 24 : 30,
      color: 'var(--fp-ink)',
      position: 'relative',
      letterSpacing: '-0.02em'
    }
  }, pack.numeral)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontFamily: "'Instrument Serif', Georgia, serif",
      fontStyle: 'italic',
      fontWeight: 400,
      fontSize: 28,
      lineHeight: 1,
      letterSpacing: '-0.02em'
    }
  }, pack.name), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      fontSize: 12,
      color: 'var(--fp-ink-3)',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, pack.tag ? /*#__PURE__*/React.createElement("span", {
    className: "fp-mono",
    style: {
      fontSize: 11.5,
      color: 'var(--fp-ink-2)'
    }
  }, pack.tag) : /*#__PURE__*/React.createElement("span", null, "10 levels"), /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: 0.4
    }
  }, "\xB7"), /*#__PURE__*/React.createElement("span", null, completed, "/10 cleared")))), /*#__PURE__*/React.createElement("div", {
    className: "fp-scroll",
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: `0 ${padX}px calc(24px + env(safe-area-inset-bottom, 0px))`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: 'var(--fp-ink-3)',
      fontWeight: 500,
      padding: '4px 2px 12px'
    }
  }, "Levels"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, Array.from({
    length: 10
  }).map((_, i) => {
    const stars = data.stars[i];
    const best = data.best[i];
    const unlocked = isLevelUnlocked(i);
    const attempted = stars !== null && stars >= 0;
    const cleared = stars !== null && stars >= 1;
    return /*#__PURE__*/React.createElement(LevelRow, {
      key: i,
      index: i,
      pack: pack,
      stars: stars,
      best: best,
      unlocked: unlocked,
      attempted: attempted,
      cleared: cleared,
      onClick: () => unlocked && onPickLevel(pack, i)
    });
  }))));
}
function LevelRow({
  index,
  pack,
  stars,
  best,
  unlocked,
  attempted,
  cleared,
  onClick
}) {
  const num = String(index + 1).padStart(2, '0');
  const status = !unlocked ? 'locked' : !attempted ? 'fresh' : cleared ? 'cleared' : 'inprogress';
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    disabled: !unlocked,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '12px 14px',
      borderRadius: 14,
      border: '1px solid var(--fp-line)',
      background: 'var(--fp-surface)',
      textAlign: 'left',
      opacity: !unlocked ? 0.5 : 1,
      cursor: !unlocked ? 'not-allowed' : 'pointer',
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      flex: '0 0 40px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "fp-mono",
    style: {
      fontSize: 18,
      fontWeight: 500,
      color: 'var(--fp-ink)',
      letterSpacing: '-0.01em',
      lineHeight: 1
    }
  }, num), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 8.5,
      color: 'var(--fp-ink-4)',
      letterSpacing: '0.1em',
      textTransform: 'uppercase'
    }
  }, "Lvl")), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1,
      alignSelf: 'stretch',
      background: 'var(--fp-line)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 500,
      color: 'var(--fp-ink)'
    }
  }, window.getLevelName ? getLevelName(pack.id, index) : LEVEL_NAMES[index]), status === 'cleared' && stars === 3 && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 8.5,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      padding: '1px 5px',
      borderRadius: 3,
      background: 'var(--fp-ink)',
      color: 'var(--fp-bg)'
    }
  }, "Perfect"), status === 'fresh' && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 8.5,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'var(--fp-ink-3)'
    }
  }, "New"), status === 'inprogress' && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 8.5,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'var(--fp-ink-3)'
    }
  }, "In progress")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      color: 'var(--fp-ink-3)',
      fontSize: 11.5
    }
  }, !unlocked ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement(Icon.Lock, {
    size: 11
  }), " Clear level ", index, " first") : !attempted ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Stars, {
    count: 0,
    total: 3,
    size: 10
  }), /*#__PURE__*/React.createElement("span", {
    className: "fp-mono",
    style: {
      color: 'var(--fp-ink-4)'
    }
  }, "\u2014")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Stars, {
    count: stars,
    total: 3,
    size: 10
  }), /*#__PURE__*/React.createElement("span", {
    className: "fp-mono",
    style: {
      color: 'var(--fp-ink-2)'
    }
  }, "best ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--fp-ink)'
    }
  }, best))))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '0 0 auto',
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, unlocked && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      height: 30,
      borderRadius: 6,
      background: 'var(--fp-surface-2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(MiniGraph, {
    kind: LEVEL_GRAPH[(index + (pack.type === 'roman' ? pack.index : 0)) % LEVEL_GRAPH.length],
    w: 40,
    h: 26,
    c: cleared ? 'var(--fp-ink)' : 'var(--fp-ink-3)',
    dim: "transparent"
  })), /*#__PURE__*/React.createElement(Icon.Chevron, {
    size: 15,
    c: unlocked ? 'var(--fp-ink-3)' : 'var(--fp-ink-4)'
  })));
}
window.LevelSelector = LevelSelector;