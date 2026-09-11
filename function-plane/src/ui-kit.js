// Function Plane — shared UI primitives
// Icons, logo, stars, mini graph preview

const Icon = {
  Levels: ({
    size = 22,
    c = 'currentColor'
  }) => /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M3 20 V4 M3 20 H21",
    stroke: c,
    strokeWidth: "1.5",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3 16 C7 16 9 7 13 7 C17 7 18 13 21 11",
    stroke: c,
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })),
  Info: ({
    size = 22,
    c = 'currentColor'
  }) => /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "9",
    stroke: c,
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 11 V17",
    stroke: c,
    strokeWidth: "1.5",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "7.6",
    r: "0.9",
    fill: c
  })),
  Trophy: ({
    size = 22,
    c = 'currentColor'
  }) => /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M7 4 H17 V10 A5 5 0 0 1 7 10 Z",
    stroke: c,
    strokeWidth: "1.5",
    strokeLinejoin: "round"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7 6 H4 V8 A3 3 0 0 0 7 11",
    stroke: c,
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M17 6 H20 V8 A3 3 0 0 1 17 11",
    stroke: c,
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9 20 H15 M12 15 V20",
    stroke: c,
    strokeWidth: "1.5",
    strokeLinecap: "round"
  })),
  User: ({
    size = 22,
    c = 'currentColor'
  }) => /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "9",
    r: "3.5",
    stroke: c,
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 20 C5 16.5 8 14.5 12 14.5 C16 14.5 19 16.5 19 20",
    stroke: c,
    strokeWidth: "1.5",
    strokeLinecap: "round"
  })),
  Settings: ({
    size = 22,
    c = 'currentColor'
  }) => /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "2.8",
    stroke: c,
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10.3 3.4 L9.6 5.2 A7 7 0 0 0 7.2 6.6 L5.3 6.1 L3.4 9.4 L4.9 10.8 A7.1 7.1 0 0 0 4.9 13.2 L3.4 14.6 L5.3 17.9 L7.2 17.4 A7 7 0 0 0 9.6 18.8 L10.3 20.6 H13.7 L14.4 18.8 A7 7 0 0 0 16.8 17.4 L18.7 17.9 L20.6 14.6 L19.1 13.2 A7.1 7.1 0 0 0 19.1 10.8 L20.6 9.4 L18.7 6.1 L16.8 6.6 A7 7 0 0 0 14.4 5.2 L13.7 3.4 Z",
    stroke: c,
    strokeWidth: "1.5",
    strokeLinejoin: "round"
  })),
  Star: ({
    size = 14,
    filled = true,
    c = 'currentColor',
    empty = '#d6d6d0'
  }) => /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 3 L14.6 9.2 L21.2 9.8 L16.2 14.2 L17.8 20.6 L12 17.2 L6.2 20.6 L7.8 14.2 L2.8 9.8 L9.4 9.2 Z",
    fill: filled ? c : 'none',
    stroke: filled ? c : empty,
    strokeWidth: "1.4",
    strokeLinejoin: "round"
  })),
  Lock: ({
    size = 14,
    c = 'currentColor'
  }) => /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "5",
    y: "11",
    width: "14",
    height: "9",
    rx: "1.5",
    stroke: c,
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 11 V8 A4 4 0 0 1 16 8 V11",
    stroke: c,
    strokeWidth: "1.5"
  })),
  Chevron: ({
    size = 18,
    c = 'currentColor',
    dir = 'right'
  }) => {
    const rot = {
      right: 0,
      left: 180,
      up: -90,
      down: 90
    }[dir] || 0;
    return /*#__PURE__*/React.createElement("svg", {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      style: {
        transform: `rotate(${rot}deg)`
      }
    }, /*#__PURE__*/React.createElement("path", {
      d: "M9 5 L16 12 L9 19",
      stroke: c,
      strokeWidth: "1.8",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }));
  },
  Play: ({
    size = 22,
    c = 'currentColor'
  }) => /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M7 5 L19 12 L7 19 Z",
    fill: c,
    stroke: c,
    strokeWidth: "1.5",
    strokeLinejoin: "round"
  })),
  Heart: ({
    size = 18,
    c = 'currentColor'
  }) => /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 20 C5 15 3 11 3 8 A4.5 4.5 0 0 1 12 7 A4.5 4.5 0 0 1 21 8 C21 11 19 15 12 20 Z",
    stroke: c,
    strokeWidth: "1.5",
    strokeLinejoin: "round"
  }))
};

// Wordmark with a tiny curve mark above
function Wordmark({
  size = 1,
  c = 'currentColor',
  sub = 'currentColor'
}) {
  const s = size;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6 * s,
      color: c
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: 64 * s,
    height: 28 * s,
    viewBox: "0 0 64 28",
    fill: "none",
    style: {
      display: 'block'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M4 24 H60 M8 4 V26",
    stroke: "currentColor",
    strokeOpacity: "0.25",
    strokeWidth: "1",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 22 C18 22 22 6 32 6 C42 6 46 22 60 22",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round",
    fill: "none"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "32",
    cy: "6",
    r: "2",
    fill: "currentColor"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Instrument Serif', Georgia, serif",
      fontSize: 36 * s,
      lineHeight: 1,
      letterSpacing: '-0.02em',
      fontWeight: 400,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8 * s,
      whiteSpace: 'nowrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontStyle: 'italic',
      display: 'inline-block'
    }
  }, "Function"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontStyle: 'normal',
      opacity: 0.55,
      display: 'inline-block'
    }
  }, "Plane")));
}

// Compact wordmark for nav bars
function WordmarkSmall({
  c = 'currentColor'
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 6,
      color: c,
      whiteSpace: 'nowrap',
      fontFamily: "'Instrument Serif', Georgia, serif",
      fontSize: 19,
      letterSpacing: '-0.02em',
      lineHeight: 1
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    style: {
      alignSelf: 'center'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M3 20 C8 20 10 4 16 4 C19 4 21 8 21 12",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    fill: "none"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontStyle: 'italic'
    }
  }, "Function"), /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: 0.55
    }
  }, "Plane"));
}

// Stars row — used everywhere
function Stars({
  count = 0,
  total = 3,
  size = 12,
  gap = 2,
  c = 'var(--fp-star)',
  empty = 'var(--fp-star-empty)'
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      gap,
      alignItems: 'center',
      color: c
    }
  }, Array.from({
    length: total
  }).map((_, i) => /*#__PURE__*/React.createElement(Icon.Star, {
    key: i,
    size: size,
    filled: i < count,
    c: c,
    empty: empty
  })));
}

// Mini graph preview — generates a deterministic curve for a pack
function MiniGraph({
  kind = 'I',
  w = 56,
  h = 36,
  c = 'var(--fp-ink)',
  dim = 'var(--fp-line)'
}) {
  // produce a path based on the kind
  const paths = {
    'I': 'M2 28 L54 8',
    'II': 'M2 24 Q28 -4 54 24',
    'III': 'M2 30 C18 30 18 6 28 6 C38 6 38 30 54 30',
    'IV': 'M2 18 Q14 4 28 18 T54 18',
    'V': 'M2 30 L20 30 L20 14 L36 14 L36 24 L54 24',
    'VI': 'M2 6 L54 30',
    'VII': 'M2 30 Q28 30 28 18 Q28 6 54 6',
    'VIII': 'M2 28 Q14 4 28 16 Q42 28 54 6',
    'IX': 'M2 30 C12 6 22 30 32 18 C42 6 50 24 54 14',
    'X': 'M2 8 Q28 8 28 18 Q28 28 54 28',
    'lin': 'M2 30 L54 6',
    'qua': 'M2 30 Q28 -8 54 30',
    'trig': 'M2 18 Q10 4 18 18 T34 18 T50 18 L54 18',
    'exp': 'M2 32 C30 32 38 30 44 22 C50 12 52 6 54 4',
    'flip': 'M2 8 L18 28 L34 8 L50 28 L54 22'
  };
  return /*#__PURE__*/React.createElement("svg", {
    width: w,
    height: h,
    viewBox: `0 0 56 36`,
    fill: "none",
    style: {
      display: 'block'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M4 32 H54 M4 4 V32",
    stroke: dim,
    strokeWidth: "1",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("path", {
    d: paths[kind] || paths.I,
    stroke: c,
    strokeWidth: "1.6",
    strokeLinecap: "round",
    fill: "none"
  }));
}

// Pill button — primary
function PrimaryButton({
  children,
  onClick,
  icon = null
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      width: '100%',
      height: 56,
      borderRadius: 14,
      background: 'var(--fp-accent)',
      color: 'var(--fp-accent-ink)',
      fontSize: 17,
      fontWeight: 500,
      letterSpacing: '-0.01em'
    }
  }, icon, children);
}

// Ghost button — square icon tile w/ label below
function IconTile({
  icon,
  label,
  onClick,
  badge = null
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      flex: 1,
      padding: '14px 4px',
      color: 'var(--fp-ink)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 52,
      height: 52,
      borderRadius: 14,
      border: '1px solid var(--fp-line)',
      background: 'var(--fp-surface)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative'
    }
  }, icon, badge != null && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 18,
      height: 18,
      padding: '0 5px',
      borderRadius: 9,
      background: 'var(--fp-accent)',
      color: 'var(--fp-accent-ink)',
      fontSize: 10,
      fontWeight: 600,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, badge)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      color: 'var(--fp-ink-2)',
      letterSpacing: '0.01em'
    }
  }, label));
}
Object.assign(window, {
  Icon,
  Wordmark,
  WordmarkSmall,
  Stars,
  MiniGraph,
  PrimaryButton,
  IconTile
});