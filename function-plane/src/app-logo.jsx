// Function Plane — App Logo
// Designed to scale: ranges from 16px favicon to 1024px hero.
// Mark: stylized parabola arc with a ball at the vertex, "f" glyph centered,
// inside a rounded square. No words.

function AppLogo({ size = 96, radius = null, theme = 'light' }) {
  const r = radius == null ? Math.round(size * 0.22) : radius;
  const dark = theme === 'dark';

  // Ink/bg flip based on theme — but the mark itself is monochrome on a flat tile.
  const bg = dark ? '#0e0f10' : '#0e0f10';   // logo always uses near-black tile
  const ink = '#fafaf7';
  const accent = '#fafaf7';

  return (
    <svg width={size} height={size} viewBox="0 0 100 100"
      style={{ display: 'block', borderRadius: r, overflow: 'hidden' }}>
      <defs>
        <clipPath id={`lc-${size}`}>
          <rect x="0" y="0" width="100" height="100" rx={r * 100 / size} ry={r * 100 / size}/>
        </clipPath>
      </defs>
      <g clipPath={`url(#lc-${size})`}>
        {/* Tile */}
        <rect x="0" y="0" width="100" height="100" fill={bg}/>

        {/* Inner subtle frame */}
        <rect x="0.5" y="0.5" width="99" height="99" rx={r * 100 / size - 0.5}
          fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>

        {/* Coordinate axes — minimal */}
        <g stroke={ink} strokeOpacity="0.18" strokeWidth="1.2" strokeLinecap="round">
          <line x1="14" y1="78" x2="86" y2="78"/>
          <line x1="22" y1="14" x2="22" y2="86"/>
        </g>

        {/* Tick marks */}
        <g stroke={ink} strokeOpacity="0.22" strokeWidth="1.2" strokeLinecap="round">
          <line x1="40" y1="76" x2="40" y2="80"/>
          <line x1="58" y1="76" x2="58" y2="80"/>
          <line x1="76" y1="76" x2="76" y2="80"/>
          <line x1="20" y1="60" x2="24" y2="60"/>
          <line x1="20" y1="42" x2="24" y2="42"/>
        </g>

        {/* Parabola — y = (x-h)^2 like curve, opens downward then up */}
        <path d="M14 78 C26 78 30 22 50 22 C70 22 74 78 86 78"
          fill="none" stroke={ink} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round"/>

        {/* Ball at the vertex */}
        <circle cx="50" cy="22" r="6.5" fill={accent}/>
        <circle cx="48" cy="20" r="1.6" fill="rgba(0,0,0,0.25)"/>
      </g>
    </svg>
  );
}

window.AppLogo = AppLogo;
