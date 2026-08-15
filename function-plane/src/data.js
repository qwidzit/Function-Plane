// Function Plane — Level data

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const ROMAN_PACKS = ROMAN.map((r, i) => ({
  id: `r-${r}`,
  numeral: r,
  index: i + 1,
  name: ['Foundations', 'Slopes', 'Curves', 'Reflections', 'Intersections', 'Asymptotes', 'Compositions', 'Discontinuities', 'Transforms', 'Mastery'][i],
  kind: r,
  type: 'roman'
}));
const SPECIAL_PACKS = [{
  id: 's-lin',
  numeral: 'ƒ',
  name: 'Linear',
  kind: 'lin',
  type: 'special',
  tag: 'mx + b',
  allowedClass: 'linear'
}, {
  id: 's-qua',
  numeral: 'ƒ',
  name: 'Quadratic',
  kind: 'qua',
  type: 'special',
  tag: 'ax² + bx + c',
  allowedClass: 'quadratic'
}, {
  id: 's-trig',
  numeral: 'ƒ',
  name: 'Trigonometry',
  kind: 'trig',
  type: 'special',
  tag: 'sin · cos · tan',
  allowedClass: 'trig'
}, {
  id: 's-exp',
  numeral: 'ƒ',
  name: 'Exponential',
  kind: 'exp',
  type: 'special',
  tag: 'aᵇˣ · log',
  allowedClass: 'exp'
}];

// Stars needed to unlock each special pack
const SPECIAL_UNLOCK_STARS = {
  's-lin': 0,
  's-qua': 50,
  's-trig': 100,
  's-exp': 150
};

// ─── Level data ──────────────────────────────────────────────
// Every shipped level is authored in Supabase and baked into
// overrides-snapshot.js, which always wins over this table. `_default` is the
// fallback for a level with no authored row — its goals track the authored
// scale (score goals run 30–90) so an unauthored level isn't trivially easy.
const LEVELS = {
  _default: {
    ball: {
      x: -3,
      y: 5
    },
    stars: [{
      x: -1,
      y: 2
    }, {
      x: 1,
      y: 0
    }, {
      x: 3,
      y: -2
    }],
    scoreGoal: 40,
    eqGoal: 1
  }
};
function getLevelData(packId, levelIndex) {
  const base = LEVELS[`${packId}-${levelIndex}`] || LEVELS._default;
  const ov = window.FP_LEVEL_OVERRIDES?.[`${packId}-${levelIndex}`];
  if (!ov) return {
    ...base,
    preplaced: []
  };
  return {
    ball: ov.ball_x != null && ov.ball_y != null ? {
      x: ov.ball_x,
      y: ov.ball_y
    } : base.ball,
    stars: Array.isArray(ov.stars) ? ov.stars : base.stars,
    scoreGoal: ov.score_goal != null ? ov.score_goal : base.scoreGoal,
    eqGoal: ov.eq_goal != null ? ov.eq_goal : base.eqGoal,
    // Pre-placed equations: visible to the player but locked. They don't
    // count toward eqsUsed or score. Stored as a JSON array of strings.
    preplaced: Array.isArray(ov.preplaced) ? ov.preplaced.filter(s => typeof s === 'string' && s.trim()) : []
  };
}
function getLevelName(packId, levelIndex) {
  const ov = window.FP_LEVEL_OVERRIDES?.[`${packId}-${levelIndex}`];
  return ov && ov.name || LEVEL_NAMES[levelIndex] || `Level ${levelIndex + 1}`;
}
function getPack(packId) {
  const base = [...ROMAN_PACKS, ...SPECIAL_PACKS].find(p => p.id === packId);
  if (!base) return null;
  const ov = window.FP_PACK_OVERRIDES?.[packId];
  if (!ov) return base;
  return {
    ...base,
    name: ov.name || base.name,
    allowedClass: ov.allowed_class || base.allowedClass,
    isHidden: !!ov.is_hidden
  };
}

// Filtered list of packs visible to the current user. Admins see everything,
// regular users get hidden packs filtered out.
function visiblePacks(packs) {
  const isAdmin = window.FP_AUTH && FP_AUTH.isAdmin && FP_AUTH.isAdmin();
  if (isAdmin) return packs;
  return packs.filter(p => !window.FP_PACK_OVERRIDES?.[p.id]?.is_hidden);
}

// Apply overrides fetched from Supabase. Mutates packs in place so existing
// references (e.g. ROMAN_PACKS[0].name) immediately reflect new values.
function applyOverrides({
  packs = [],
  levels = [],
  achievements = []
}) {
  const lvlMap = {};
  levels.forEach(l => {
    lvlMap[`${l.pack_id}-${l.level_index}`] = l;
  });
  window.FP_LEVEL_OVERRIDES = lvlMap;
  const packMap = {};
  packs.forEach(p => {
    packMap[p.pack_id] = p;
  });
  window.FP_PACK_OVERRIDES = packMap;
  window.FP_ACH_OVERRIDES = achievements;

  // Patch in-place so static references update too
  [...ROMAN_PACKS, ...SPECIAL_PACKS].forEach(p => {
    const ov = packMap[p.id];
    if (!ov) return;
    if (ov.name) p.name = ov.name;
    if (ov.allowed_class) p.allowedClass = ov.allowed_class;
  });
}

// ─── Progress helpers ────────────────────────────────────────

function freshProgress() {
  const out = {};
  [...ROMAN_PACKS, ...SPECIAL_PACKS].forEach(p => {
    out[p.id] = {
      stars: Array(10).fill(null),
      best: Array(10).fill(null)
    };
  });
  // Always unlock Pack I and Linear themed pack
  out['r-I'].stars = Array(10).fill(-1);
  out['s-lin'].stars = Array(10).fill(-1);
  return out;
}
function buildProgress(state) {
  const all = [...ROMAN_PACKS, ...SPECIAL_PACKS];
  const out = {};
  all.forEach(p => {
    out[p.id] = {
      stars: Array(10).fill(-1),
      best: Array(10).fill(null)
    };
  });
  if (state === 'mid') {
    out['r-I'].stars = [3, 3, 3, 2, 3, 3, 2, 3, 3, 3];
    out['r-I'].best = [120, 140, 160, 210, 180, 220, 250, 240, 270, 300];
    out['r-II'].stars = [3, 3, 2, 3, 2, 3, 2, 1, -1, -1];
    out['r-II'].best = [180, 200, 260, 230, 280, 260, 310, 360, null, null];
    out['r-III'].stars = [3, 2, 2, 1, -1, -1, -1, -1, -1, -1];
    out['r-III'].best = [220, 290, 310, 420, null, null, null, null, null, null];
    out['r-IV'].stars = [2, -1, -1, -1, -1, -1, -1, -1, -1, -1];
    out['r-IV'].best = [380, null, null, null, null, null, null, null, null, null];
    for (let i = 4; i < 10; i++) out[ROMAN_PACKS[i].id].stars = Array(10).fill(null);
    out['s-lin'].stars = [3, 3, 3, 3, 2, 3, 3, 2, 3, 3];
    out['s-lin'].best = [140, 160, 180, 200, 260, 220, 240, 290, 250, 310];
    out['s-qua'].stars = [3, 2, 2, -1, -1, -1, -1, -1, -1, -1];
    out['s-qua'].best = [200, 280, 310, null, null, null, null, null, null, null];
    out['s-trig'].stars = Array(10).fill(null);
    out['s-exp'].stars = Array(10).fill(null);
  }
  return out;
}
function packTotalStars(progress, packId) {
  return (progress[packId]?.stars || []).reduce((a, v) => a + (v > 0 ? v : 0), 0);
}
function packIsLocked(progress, packId) {
  const s = progress[packId]?.stars || [];
  return s.length > 0 && s.every(v => v === null);
}
function packIsComplete(progress, packId) {
  const s = progress[packId]?.stars || [];
  return s.length > 0 && s.every(v => v !== null && v >= 1);
}
function totalStarsAll(progress) {
  return Object.keys(progress).reduce((a, k) => a + packTotalStars(progress, k), 0);
}

// Returns { locked: bool, reason: 'stars'|'prev_pack', need?: number, have?: number, prevPackName?: string }
function computePackLocked(progress, pack) {
  // Premium players have everything unlocked; admins also get full access for testing.
  if (window.FP_AUTH && (FP_AUTH.isPremium?.() || FP_AUTH.isAdmin?.())) return {
    locked: false
  };
  const id = pack.id;

  // Special packs — star threshold
  if (id in SPECIAL_UNLOCK_STARS) {
    const need = SPECIAL_UNLOCK_STARS[id];
    if (need === 0) return {
      locked: false
    };
    const have = totalStarsAll(progress);
    if (have < need) return {
      locked: true,
      reason: 'stars',
      need,
      have
    };
    return {
      locked: false
    };
  }

  // Roman packs
  const romanIdx = ROMAN_PACKS.findIndex(p => p.id === id);
  if (romanIdx <= 0) return {
    locked: false
  }; // r-I always unlocked

  const prevPack = ROMAN_PACKS[romanIdx - 1];
  const prevStars = packTotalStars(progress, prevPack.id);
  const need = 27; // 90% of 30
  if (prevStars < need) {
    return {
      locked: true,
      reason: 'prev_pack',
      need,
      have: prevStars,
      prevPackName: prevPack.name
    };
  }
  return {
    locked: false
  };
}
function findContinuePoint(progress) {
  for (const pack of [...ROMAN_PACKS, ...SPECIAL_PACKS]) {
    if (packIsLocked(progress, pack.id)) continue;
    const pd = progress[pack.id];
    if (!pd) continue;
    for (let i = 0; i < 10; i++) {
      const s = pd.stars[i];
      if (s === null) break;
      if (s === -1 || s === 0) return {
        pack,
        levelIndex: i
      };
    }
  }
  return {
    pack: ROMAN_PACKS[0],
    levelIndex: 0
  };
}
const LEVEL_NAMES = ['Warm-up', 'First slope', 'Through the gate', 'Twin peaks', 'Reflections', 'The valley', 'Crosswinds', 'Threshold', 'Loop & catch', 'The summit'];
const LEVEL_GRAPH = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'lin', 'qua', 'trig', 'exp'];
Object.assign(window, {
  ROMAN_PACKS,
  SPECIAL_PACKS,
  LEVELS,
  SPECIAL_UNLOCK_STARS,
  getLevelData,
  getLevelName,
  getPack,
  visiblePacks,
  applyOverrides,
  freshProgress,
  buildProgress,
  packTotalStars,
  packIsLocked,
  packIsComplete,
  totalStarsAll,
  computePackLocked,
  findContinuePoint,
  LEVEL_NAMES,
  LEVEL_GRAPH
});