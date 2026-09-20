// Function Plane — App Logo
// Designed to scale: ranges from 16px favicon to 1024px hero.
// Mark: stylized parabola arc with a ball at the vertex, "f" glyph centered,
// inside a rounded square. No words.

function AppLogo({
  size = 96,
  radius = null,
  theme = 'light'
}) {
  const r = radius == null ? Math.round(size * 0.22) : radius;
  const dark = theme === 'dark';

  // Ink/bg flip based on theme — but the mark itself is monochrome on a flat tile.
  const bg = dark ? '#0e0f10' : '#0e0f10'; // logo always uses near-black tile
  const ink = '#fafaf7';
  const accent = '#fafaf7';
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 100 100",
    style: {
      display: 'block',
      borderRadius: r,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("clipPath", {
    id: `lc-${size}`
  }, /*#__PURE__*/React.createElement("rect", {
    x: "0",
    y: "0",
    width: "100",
    height: "100",
    rx: r * 100 / size,
    ry: r * 100 / size
  }))), /*#__PURE__*/React.createElement("g", {
    clipPath: `url(#lc-${size})`
  }, /*#__PURE__*/React.createElement("rect", {
    x: "0",
    y: "0",
    width: "100",
    height: "100",
    fill: bg
  }), /*#__PURE__*/React.createElement("rect", {
    x: "0.5",
    y: "0.5",
    width: "99",
    height: "99",
    rx: r * 100 / size - 0.5,
    fill: "none",
    stroke: "rgba(255,255,255,0.08)",
    strokeWidth: "1"
  }), /*#__PURE__*/React.createElement("g", {
    stroke: ink,
    strokeOpacity: "0.18",
    strokeWidth: "1.2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "14",
    y1: "78",
    x2: "86",
    y2: "78"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "22",
    y1: "14",
    x2: "22",
    y2: "86"
  })), /*#__PURE__*/React.createElement("g", {
    stroke: ink,
    strokeOpacity: "0.22",
    strokeWidth: "1.2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "40",
    y1: "76",
    x2: "40",
    y2: "80"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "58",
    y1: "76",
    x2: "58",
    y2: "80"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "76",
    y1: "76",
    x2: "76",
    y2: "80"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "20",
    y1: "60",
    x2: "24",
    y2: "60"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "20",
    y1: "42",
    x2: "24",
    y2: "42"
  })), /*#__PURE__*/React.createElement("path", {
    d: "M14 78 C26 78 30 22 50 22 C70 22 74 78 86 78",
    fill: "none",
    stroke: ink,
    strokeWidth: "3.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "50",
    cy: "22",
    r: "6.5",
    fill: accent
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "48",
    cy: "20",
    r: "1.6",
    fill: "rgba(0,0,0,0.25)"
  })));
}
window.AppLogo = AppLogo;