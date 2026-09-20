// Function Plane — Achievements screen

const { useState: useACHState } = React;

// ── Achievement kinds ──────────────────────────────────────────────────────
// Every achievement — built-in or admin-created — is a data row naming one of
// these kinds plus its parameters. Nothing is eval'd, so the table stays
// data-only, and the admin panel can edit all of them through one editor.
// Adding a new mechanic = add a kind here; the editor picks it up from
// `needs` automatically.
//
// Param shape: { threshold?, packId?, levelIndex?, score? }. Each kind
// documents which params it consumes; the rest are ignored.
const ACH_KINDS = {
  total_stars: {
    label: 'Earn N stars total',
    needs: ['threshold'],
    desc: ({ threshold }) => `Earn ${threshold} stars in total`,
    build: ({ threshold }) => p =>
      Object.values(p).reduce((a, pd) => a + pd.stars.reduce((b, s) => b + (s > 0 ? s : 0), 0), 0) >= threshold,
  },
  total_levels: {
    label: 'Complete N levels overall',
    needs: ['threshold'],
    desc: ({ threshold }) => threshold === 1 ? 'Complete your first level' : `Complete ${threshold} levels across all packs`,
    build: ({ threshold }) => p =>
      Object.values(p).reduce((a, pd) => a + pd.stars.filter(s => s >= 1).length, 0) >= threshold,
  },
  pack_complete: {
    label: 'Complete N levels in pack X',
    needs: ['packId', 'threshold'],
    desc: ({ packId, threshold }) => `Complete ${threshold} levels in ${packId}`,
    build: ({ packId, threshold }) => p =>
      (p[packId]?.stars ?? []).filter(s => s >= 1).length >= threshold,
  },
  pack_full_gold: {
    label: '3★ on every level of pack X',
    needs: ['packId'],
    desc: ({ packId }) => `Earn 3 stars on every level in ${packId}`,
    build: ({ packId }) => p => {
      const stars = p[packId]?.stars ?? [];
      return stars.length === 10 && stars.every(s => s === 3);
    },
  },
  any_pack_complete: {
    label: 'Complete every level of any one pack',
    needs: [],
    desc: () => 'Complete all 10 levels in a single pack',
    build: () => p => Object.values(p).some(pd => pd.stars.filter(s => s >= 1).length >= 10),
  },
  any_pack_gold: {
    label: '3★ on every level of any one pack',
    needs: [],
    desc: () => 'Earn 3 stars on every level in a pack',
    build: () => p => Object.values(p).some(pd =>
      pd.stars.length === 10 && pd.stars.every(s => s === 3)),
  },
  all_roman_packs: {
    label: 'Complete every released Roman pack',
    needs: [],
    desc: () => 'Complete every released Roman numeral pack',
    // Scoped to released packs: a fixed I–X list would be unobtainable while
    // any pack is still hidden.
    build: () => p => {
      const released = (window.ROMAN_PACKS ?? []).filter(
        pk => !window.FP_PACK_OVERRIDES?.[pk.id]?.is_hidden);
      return released.length > 0 && released.every(pk =>
        (p[pk.id]?.stars ?? []).filter(s => s >= 1).length >= 10);
    },
  },
  themed_level: {
    label: 'Complete any Themed pack level',
    needs: [],
    desc: () => 'Complete any Themed pack level',
    build: () => p => (window.SPECIAL_PACKS ?? []).some(pk =>
      (p[pk.id]?.stars ?? []).some(s => s >= 1)),
  },
  any_3stars: {
    label: '3★ on at least one level (any pack)',
    needs: [],
    desc: () => 'Earn 3 stars on any level',
    build: () => p => Object.values(p).some(pd => pd.stars.some(s => s === 3)),
  },
  min_score: {
    label: 'Finish a level with score ≤ N',
    needs: ['threshold'],
    desc: ({ threshold }) => `Complete a level with a score of ${threshold} or less`,
    build: ({ threshold }) => p => Object.values(p).some(pd =>
      pd.best.some((b, i) => b != null && b <= threshold && (pd.stars[i] ?? -1) >= 1)
    ),
  },
  score_over: {
    label: 'Finish a level with score > N',
    needs: ['threshold'],
    desc: ({ threshold }) => `Beat any level with an equation score over ${threshold} points`,
    // maxScore is the highest score used on a winning run; older progress
    // entries only have `best`.
    build: ({ threshold }) => p => Object.values(p).some(pd =>
      (pd.maxScore ?? pd.best ?? []).some((s, i) => s != null && s > threshold && (pd.stars[i] ?? -1) >= 1)
    ),
  },
  time_under: {
    label: 'Finish a level in under N milliseconds',
    needs: ['threshold'],
    thresholdLabel: 'Milliseconds',
    desc: ({ threshold }) => `Beat any level in under ${(threshold / 1000).toFixed(threshold % 1000 ? 1 : 0)} seconds`,
    build: ({ threshold }) => p => Object.values(p).some(pd =>
      (pd.bestTime ?? []).some(t => t != null && t <= threshold / 1000)
    ),
  },
  time_over: {
    label: 'Finish a level in over N milliseconds',
    needs: ['threshold'],
    thresholdLabel: 'Milliseconds',
    desc: ({ threshold }) => `Beat any level with a time of ${(threshold / 1000).toFixed(threshold % 1000 ? 1 : 0)} seconds or more`,
    build: ({ threshold }) => p => Object.values(p).some(pd =>
      (pd.bestTime ?? []).some((t, i) => t != null && t >= threshold / 1000 && (pd.stars[i] ?? -1) >= 1)
    ),
  },
  // The only kind taking two numbers: how many levels, and how cheaply. It
  // counts levels rather than asking whether any one qualifies, which is what
  // separates it from min_score.
  levels_min_score: {
    label: 'Complete N levels with score ≤ S',
    needs: ['threshold', 'score'],
    desc: ({ threshold, score }) => `Complete ${threshold} levels with a score of ${score} or less`,
    build: ({ threshold, score }) => p => Object.values(p).reduce((n, pd) =>
      n + (pd.best ?? []).filter((b, i) => b != null && b <= score && (pd.stars[i] ?? -1) >= 1).length, 0) >= threshold,
  },
  packs_complete: {
    label: 'Complete N packs',
    needs: ['threshold'],
    desc: ({ threshold }) => `Complete ${threshold} packs`,
    build: ({ threshold }) => p => Object.values(p).filter(pd =>
      (pd.stars ?? []).filter(s => s >= 1).length >= 10).length >= threshold,
  },
  themed_stars: {
    label: 'Earn N stars in Themed packs',
    needs: ['threshold'],
    desc: ({ threshold }) => `Earn ${threshold} stars in Themed packs`,
    build: ({ threshold }) => p => (window.SPECIAL_PACKS ?? []).reduce((a, pk) =>
      a + (p[pk.id]?.stars ?? []).reduce((b, s) => b + (s > 0 ? s : 0), 0), 0) >= threshold,
  },
  themed_packs_complete: {
    label: 'Complete N Themed packs',
    needs: ['threshold'],
    desc: ({ threshold }) => `Complete ${threshold} Themed packs`,
    build: ({ threshold }) => p => (window.SPECIAL_PACKS ?? []).filter(pk =>
      (p[pk.id]?.stars ?? []).filter(s => s >= 1).length >= 10).length >= threshold,
  },
};

// ── Built-in achievements ──────────────────────────────────────────────────
// Shipped as rows in exactly the shape `achievement_overrides` uses, so the
// admin panel edits them through the same editor as custom ones. An override
// row sharing an id replaces whichever fields it sets; deleting that row
// restores the defaults below.
const BUILTIN_ACH_ROWS = [
  { id: 'first_roll',    kind: 'total_levels',      threshold: 1,   name: 'First Roll',      description: 'Complete your first level' },
  { id: 'levels_15',     kind: 'total_levels',      threshold: 15,  name: 'On a Roll',       description: 'Complete 15 levels across all packs' },
  { id: 'three_stars',   kind: 'any_3stars',                        name: 'Shooting Star',   description: 'Earn 3 stars on any level' },
  { id: 'minimalist',    kind: 'levels_min_score',  threshold: 5,  score: 30, name: 'Minimalist',       description: 'Complete 5 levels with a score of 30 or less' },
  { id: 'ultra_minimal', kind: 'levels_min_score',  threshold: 15, score: 30, name: 'Ultra Minimalist', description: 'Complete 15 levels with a score of 30 or less' },
  { id: 'pack_master',   kind: 'packs_complete',    threshold: 5,   name: 'Pack Master',     description: 'Complete 5 packs' },
  { id: 'pack_gold',     kind: 'any_pack_gold',                     name: 'Golden Pack',     description: 'Earn 3 stars on every level in a pack' },
  { id: 'pack_i_done',   kind: 'pack_complete',     threshold: 10, pack_id: 'r-I',   name: 'Scholar',       description: 'Complete all Pack I levels' },
  { id: 'pack_ii_done',  kind: 'pack_complete',     threshold: 10, pack_id: 'r-II',  name: 'Windswept',     description: 'Complete all Pack II levels' },
  { id: 'pack_iii_done', kind: 'pack_complete',     threshold: 10, pack_id: 'r-III', name: 'Astronaut',     description: 'Complete all Pack III levels' },
  { id: 'pack_iv_done',  kind: 'pack_complete',     threshold: 10, pack_id: 'r-IV',  name: 'Magnetic',      description: 'Complete all Pack IV levels' },
  { id: 'all_roman',     kind: 'all_roman_packs',                   name: 'Completionist',   description: 'Complete all main packs' },
  { id: 'themed_10',     kind: 'themed_stars',      threshold: 10,  name: 'Extra Credit',    description: 'Earn 10 stars in Themed packs' },
  { id: 'themed_30',     kind: 'themed_stars',      threshold: 30,  name: 'Honour Roll',     description: 'Earn 30 stars in Themed packs' },
  { id: 'themed_packs_2', kind: 'themed_packs_complete', threshold: 2, name: 'Double Major', description: 'Complete 2 Themed packs' },
  { id: 'flash',         kind: 'time_under',        threshold: 1000, name: 'Flash',          description: 'Complete any level in under 1 second' },
  { id: 'sunday_stroll', kind: 'time_over',         threshold: 25000, name: 'Sunday Stroll', description: 'Complete any level with a time of over 25 seconds' },
  { id: 'stars_15',      kind: 'total_stars',       threshold: 15,  name: 'Rising Star',     description: 'Earn 15 stars in total' },
  { id: 'stars_30',      kind: 'total_stars',       threshold: 30,  name: 'Stargazer',       description: 'Earn 30 stars in total' },
  { id: 'stars_50',      kind: 'total_stars',       threshold: 50,  name: 'Star Collector',  description: 'Earn 50 stars in total' },
  { id: 'stars_100',     kind: 'total_stars',       threshold: 100, name: 'Supernova',       description: 'Earn 100 stars in total' },
  { id: 'stars_150',     kind: 'total_stars',       threshold: 150, name: 'Galaxy Brain',    description: 'Earn 150 stars in total' },
  { id: 'stars_210',     kind: 'total_stars',       threshold: 210, name: 'Impossible?',     description: 'Earn 210 stars in total' },
];

// Built-in defaults with any override applied. Only fields the override
// actually sets win — a row storing null for the params its kind doesn't use
// must not wipe a built-in's threshold.
function getAchievementRows() {
  const overrides = window.FP_ACH_OVERRIDES || [];
  const byId = new Map(overrides.map(r => [r.id, r]));
  const builtin = BUILTIN_ACH_ROWS.map(base => {
    const ov = byId.get(base.id);
    if (!ov) return { ...base, builtin: true };
    const patch = {};
    for (const [k, v] of Object.entries(ov)) if (v != null) patch[k] = v;
    return { ...base, ...patch, builtin: true };
  });
  const builtinIds = new Set(BUILTIN_ACH_ROWS.map(b => b.id));
  const custom = overrides.filter(r => !builtinIds.has(r.id)).map(r => ({ ...r, builtin: false }));
  return [...builtin, ...custom];
}

// Row → runtime achievement. Returns null for a row whose kind is unknown or
// whose required params are missing; the editor flags those instead.
function buildAchievement(row) {
  const def = ACH_KINDS[row.kind];
  if (!def) return null;
  const params = { threshold: row.threshold, packId: row.pack_id, levelIndex: row.level_index, score: row.score };
  for (const need of def.needs) {
    if (params[need] == null || params[need] === '') return null;
  }
  return {
    id:   row.id,
    name: row.name,
    desc: row.description || def.desc(params),
    check: def.build(params),
    builtin: !!row.builtin,
  };
}

function getAchievementList() {
  return getAchievementRows()
    .filter(r => !r.is_hidden)
    .map(buildAchievement)
    .filter(Boolean);
}

Object.assign(window, { ACH_KINDS, BUILTIN_ACH_ROWS, getAchievementRows, buildAchievement, getAchievementList });

function AchievementsScreen({ onBack, progress, density = 'comfortable' }) {
  const padX = density === 'compact' ? 22 : 26;
  const [tab, setTab] = useACHState('achievements'); // 'achievements' | 'leaderboard'
  const list = getAchievementList();
  const unlocked = new Set(list.filter(a => a.check(progress)).map(a => a.id));
  const count = unlocked.size;
  const myStars = totalStarsAll(progress);

  return (
    <div className="fp-screen" style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
    }}>
      {/* Top bar */}
      <div style={{
        padding: `calc(14px + env(safe-area-inset-top, 0px)) ${padX}px 0`,
        display: 'flex', alignItems: 'center', gap: 12, flex: '0 0 auto',
      }}>
        <button onClick={onBack} style={{
          width: 36, height: 36, borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--fp-ink-2)',
        }}>
          <Icon.Chevron dir="left" size={18}/>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontStyle: 'italic', fontSize: 24, letterSpacing: '-0.02em', color: 'var(--fp-ink)',
          }}>
            {tab === 'achievements' ? 'Achievements' : 'Leaderboard'}
          </div>
        </div>
        {tab === 'achievements' && (
          <div style={{ fontSize: 12, color: 'var(--fp-ink-3)', display: 'flex', alignItems: 'baseline', gap: 3 }}>
            <span className="fp-mono" style={{ fontSize: 16, color: 'var(--fp-ink)', fontWeight: 500 }}>{count}</span>
            / {list.length}
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 4, padding: `10px ${padX}px 0`,
        flex: '0 0 auto',
      }}>
        {[['achievements','Achievements'],['leaderboard','Leaderboard']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            height: 32, padding: '0 14px', borderRadius: 999,
            background: tab === id ? 'var(--fp-ink)' : 'transparent',
            color: tab === id ? 'var(--fp-bg)' : 'var(--fp-ink-3)',
            fontSize: 12.5, fontWeight: 500,
            border: tab === id ? 'none' : '1px solid var(--fp-line)',
          }}>{label}</button>
        ))}
      </div>

      {tab === 'achievements' && (
        <>
          {/* Progress bar */}
          <div style={{ padding: `10px ${padX}px 14px`, flex: '0 0 auto' }}>
            <div style={{ height: 4, background: 'var(--fp-line)', borderRadius: 2 }}>
              <div style={{
                height: '100%', borderRadius: 2, background: 'var(--fp-accent)',
                width: `${list.length ? (count / list.length) * 100 : 0}%`,
                transition: 'width .5s ease',
              }}/>
            </div>
          </div>

          {/* Achievement list */}
          <div className="fp-scroll" style={{
            flex: 1, overflowY: 'auto',
            padding: `0 ${padX}px`,
            paddingBottom: 'max(28px, env(safe-area-inset-bottom, 0px))',
          }}>
            {list.map((ach, i) => {
              const done = unlocked.has(ach.id);
              return (
                <div key={ach.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0',
                  borderBottom: i < list.length - 1 ? '1px solid var(--fp-line)' : 'none',
                  opacity: done ? 1 : 0.42,
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 14, flex: '0 0 44px',
                    background: done ? 'var(--fp-surface)' : 'var(--fp-surface-2)',
                    border: '1px solid var(--fp-line)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {done
                      ? <Icon.Trophy size={20} c="var(--fp-ink-2)"/>
                      : <Icon.Lock size={18} c="var(--fp-ink-4)"/>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13.5, fontWeight: 600, color: 'var(--fp-ink)',
                      letterSpacing: '-0.01em', marginBottom: 2,
                    }}>{ach.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--fp-ink-3)', lineHeight: 1.45 }}>
                      {ach.desc}
                    </div>
                  </div>
                  {done && (
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" style={{ flex: '0 0 18px' }}>
                      <path d="M5 13 L9 17 L19 7"
                        stroke="var(--fp-accent)" strokeWidth={2.2}
                        strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === 'leaderboard' && (
        <LeaderboardTab padX={padX} myStars={myStars}/>
      )}
    </div>
  );
}

function LeaderboardTab({ padX, myStars }) {
  const { useState: useL, useEffect: useLE } = React;
  const [rows, setRows]       = useL(null);   // null = loading
  const [signedIn, setSignedIn] = useL(!!(window.FP_AUTH && FP_AUTH.getActive()));

  useLE(() => {
    setSignedIn(!!(window.FP_AUTH && FP_AUTH.getActive()));
    if (!window.FP_AUTH) { setRows([]); return; }
    FP_AUTH.buildLeaderboard({ metric: 'stars' })
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  return (
    <div className="fp-scroll" style={{
      flex: 1, overflowY: 'auto',
      paddingBottom: 'max(28px, env(safe-area-inset-bottom, 0px))',
    }}>
      <div style={{ padding: `14px ${padX}px 0` }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '0 0 8px',
          fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fp-ink-4)',
        }}>
          <div style={{ width: 32 }}>#</div>
          <div style={{ flex: 1 }}>Player</div>
          <div style={{ width: 48, textAlign: 'right' }}>Stars</div>
        </div>

        {rows === null && (
          <div style={{ textAlign: 'center', color: 'var(--fp-ink-4)', fontSize: 12, padding: '28px 0' }}>
            Loading…
          </div>
        )}

        {rows !== null && rows.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--fp-ink-3)', fontSize: 12.5, padding: '24px 0', lineHeight: 1.6 }}>
            {signedIn
              ? 'No scores yet — be the first.'
              : 'Sign in to appear on the global leaderboard.'}
          </div>
        )}

        {rows !== null && rows.map((row, i) => (
          <div key={row.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: row.self ? '11px 12px' : '11px 0',
            margin: row.self ? '6px 0' : 0,
            borderRadius: row.self ? 12 : 0,
            background: row.self ? 'var(--fp-surface)' : 'transparent',
            border: row.self ? '1.5px solid var(--fp-ink)' : 'none',
            borderBottom: !row.self && i < (rows||[]).length - 1 ? '1px solid var(--fp-line)' : (row.self ? '1.5px solid var(--fp-ink)' : 'none'),
          }}>
            <div style={{
              width: 32, flex: '0 0 32px',
              fontFamily: "'Geist Mono', monospace",
              fontSize: row.rank <= 3 ? 14 : 12,
              fontWeight: row.rank <= 3 ? 700 : 400,
              color: row.rank === 1 ? '#d4a017' : row.rank === 2 ? '#9ba0a6' : row.rank === 3 ? '#b87333' : 'var(--fp-ink-4)',
            }}>
              {row.rank <= 3 ? ['🥇','🥈','🥉'][row.rank-1] : (row.rank ?? '—')}
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flex: '0 0 32px',
                background: 'var(--fp-surface-2)', border: '1px solid var(--fp-line)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16,
              }}>{row.avatar || '🟢'}</div>
              <span style={{
                fontSize: 13.5, fontWeight: row.self ? 600 : 500, color: 'var(--fp-ink)',
                minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {row.self ? `${row.name} (you)` : row.name}
              </span>
              {row.premium && <PremiumBadge size={12}/>}
            </div>
            <div style={{ width: 48, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
              <span className="fp-mono" style={{ fontSize: 13, fontWeight: row.self ? 700 : 600, color: 'var(--fp-ink)' }}>{row.stars}</span>
              <Icon.Star size={10} c="var(--lv-star)"/>
            </div>
          </div>
        ))}

        {!signedIn && (
          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--fp-ink-4)', padding: '14px 0 8px' }}>
            You have <span className="fp-mono" style={{ color: 'var(--fp-ink-2)' }}>{myStars}</span> ★ as Guest
          </div>
        )}
      </div>
    </div>
  );
}

window.AchievementsScreen = AchievementsScreen;
