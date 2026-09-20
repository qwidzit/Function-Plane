// Function Plane — Level data

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const ROMAN_PACKS = ROMAN.map((r, i) => ({
  id: `r-${r}`,
  numeral: r,
  index: i + 1,
  name: ['Foundations', 'Crosswinds', 'Weightless', 'Reflections', 'Intersections', 'Asymptotes', 'Compositions', 'Discontinuities', 'Transforms', 'Mastery'][i],
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
},
// Geometry is the one themed pack with no class restriction: level n holds
// n stars in a recognisable figure, so the shape is the clue rather than a
// rule about what you may write. It keeps the s-qua id because the SQL
// guard hard-codes the five themed ids.
// noHints: the bulb is hidden for the whole pack. Geometry's rule is a shape,
// not a class, so the one thing a hint is allowed to say — the family the
// level was built around — would describe the wrong thing, and a button that
// only ever answers "No hint" is worse than no button.
{
  id: 's-qua',
  numeral: '△',
  name: 'Geometry',
  kind: 'qua',
  type: 'special',
  tag: 'just shapes',
  noHints: true
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
},
// modifier: a rule the whole pack plays under. 'gravityFlip' turns gravity
// over on every real bounce.
{
  id: 's-flip',
  numeral: '↕',
  name: 'Inversion',
  kind: 'flip',
  type: 'special',
  tag: 'gravity flips',
  modifier: 'gravityFlip'
}];

// Stars needed to unlock each special pack
// Ordered by what each pack depends on, not by its number: Linear is the
// second tutorial and opens immediately, Trigonometry needs nothing but
// confidence, Geometry's closed tracks want Pack III's zero-gravity and
// rubber, and Inversion wants a player who reads a bounce. s-exp is hidden
// and its number is reserved rather than tuned.
const SPECIAL_UNLOCK_STARS = {
  's-lin': 0,
  's-trig': 40,
  's-qua': 50,
  's-flip': 80,
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

// ─── Hints ──────────────────────────────────────────
// The *kind* of function a level was built around, and nothing else — no
// form, no coefficients, no reasoning. Naming the family is the most a hint
// can give without solving the level, and a sentence of advice reads as the
// answer even when it isn't. Where the answer is several curves the count is
// the thing worth knowing, so it says that instead: which families they are
// would be most of the solution.
//
// From Pack III a hint may name a *mechanic* instead — "Use rubber material"
// — because a level whose answer is an ordinary line set to a different bounce
// is not described at all by the family of its equation.
//
// Each one follows from the level's own goals, not from taste: a run scores
// complexity + 20 per equation, so `score_goal - 20 * eq_goal` is the
// complexity the author left room for — 0 a constant, 10 a line, 20 a
// parabola. A domain restriction costs nothing, so a level solved by a
// *cut* line is still Linear. Packs I and II are written; everywhere else a
// hint is simply absent and the button says so. A `hint` column on
// level_overrides wins over this table wherever one exists, the way every
// other authored field does.
const LEVEL_HINTS = {
  'r-I-0': 'Linear',
  'r-I-1': 'Linear',
  'r-I-2': 'Quadratic',
  'r-I-3': 'Linear',
  'r-I-4': 'Quadratic',
  'r-I-5': 'Linear',
  'r-I-6': 'Quadratic',
  'r-I-7': 'Use multiple equations',
  'r-I-8': 'Quadratic',
  'r-I-9': 'Use 2 equations',
  'r-II-0': 'Linear',
  'r-II-1': 'Linear',
  'r-II-2': 'Constant',
  'r-II-3': 'Linear',
  'r-II-4': 'Quadratic',
  'r-II-5': 'Quadratic',
  'r-II-6': 'Linear',
  'r-II-7': 'Linear',
  'r-II-8': 'Use 2 equations',
  'r-II-9': 'Use 2 equations',
  'r-III-0': 'Quadratic',
  'r-III-1': 'Quadratic',
  'r-III-2': 'Quadratic',
  'r-III-3': 'Use rubber material',
  'r-III-4': 'Use steel material',
  'r-III-5': 'Use rubber material',
  'r-III-6': 'Use rubber material',
  'r-III-7': 'Linear',
  'r-III-8': 'Use multiple equations'
  // Level X is the finale and deliberately has none.
};
function getHint(packId, levelIndex) {
  const ov = window.FP_LEVEL_OVERRIDES?.[`${packId}-${levelIndex}`];
  return ov && ov.hint || LEVEL_HINTS[`${packId}-${levelIndex}`] || null;
}
function getLevelData(packId, levelIndex) {
  const base = LEVELS[`${packId}-${levelIndex}`] || LEVELS._default;
  const hint = getHint(packId, levelIndex);
  const ov = window.FP_LEVEL_OVERRIDES?.[`${packId}-${levelIndex}`];
  if (!ov) return {
    ...base,
    preplaced: [],
    objects: [],
    outline: [],
    materials: false,
    explain: null,
    hint
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
    preplaced: Array.isArray(ov.preplaced) ? ov.preplaced.filter(s => typeof s === 'string' && s.trim()) : [],
    // Fans, zones, wells, hazards — see level-objects.jsx for the shapes.
    objects: Array.isArray(ov.objects) ? ov.objects.filter(o => o && window.FP_OBJECTS?.KINDS[o.kind]) : [],
    // The figure the stars are arranged in, as polylines over star indices.
    // Decoration for the shape pack: it is drawn, and nothing collides with it.
    outline: Array.isArray(ov.outline) ? ov.outline.filter(Array.isArray) : [],
    // Whether players may set a curve's bounce (steel / rubber).
    materials: !!ov.materials,
    // Which mechanic this level introduces — a key into FP_EXPLAINERS, shown
    // once on the player's first visit. Null on levels that teach nothing new.
    explain: ov.explain && window.FP_EXPLAINERS?.[ov.explain] ? ov.explain : null,
    // What kind of function the level wants. Empty outside the first pack.
    hint
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
    // An override row describes the pack completely: an empty `allowed_class`
    // means "no restriction", not "keep whatever was built in". Falling back
    // to the built-in made a restriction impossible to lift — Geometry went on
    // demanding quadratics long after its row said otherwise.
    allowedClass: ov.allowed_class || null,
    modifier: ov.modifier || null,
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

  // Patch in-place so static references update too. Assign rather than patch,
  // for the reason getPack gives: these used to be set-only, so a pack could
  // gain a restriction from an override and never lose one.
  [...ROMAN_PACKS, ...SPECIAL_PACKS].forEach(p => {
    const ov = packMap[p.id];
    if (!ov) return;
    p.name = ov.name || p.name;
    p.allowedClass = ov.allowed_class || null;
    p.modifier = ov.modifier || null;
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

// Stars earned per level are stored two ways on purpose: `stars[i]` is how
// many (what every total, threshold and leaderboard row counts) and
// `starBits[i]` is which ones (what the level screens draw), because the
// second star can be dark while the third is lit. Keeping the count as its own
// field means nothing downstream has to learn about bits, and progress saved
// before this — which has no starBits — still reads correctly: back then the
// stars really were a ladder.
function starBitsOf(count, bits) {
  if (bits != null) return bits;
  return count >= 3 ? 7 : count === 2 ? 3 : count >= 1 ? 1 : 0;
}
function starCount(bits) {
  return (bits & 1 ? 1 : 0) + (bits & 2 ? 1 : 0) + (bits & 4 ? 1 : 0);
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

// Premium opens every pack *and* every level inside it; admins get the same for
// testing. It does not open hidden packs — visibility is an authoring switch,
// not an entitlement, and `visiblePacks` filters those out for everyone but an
// admin. Three call sites ask this, so it lives in one place: a premium player
// whose pack list and level list disagreed is how this went wrong before.
function hasFullAccess() {
  return !!(window.FP_AUTH && (FP_AUTH.isPremium?.() || FP_AUTH.isAdmin?.()));
}

// Returns { locked: bool, reason: 'stars'|'prev_pack', need?: number, have?: number, prevPackName?: string }
function computePackLocked(progress, pack) {
  if (hasFullAccess()) return {
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
  const full = hasFullAccess();
  for (const pack of [...ROMAN_PACKS, ...SPECIAL_PACKS]) {
    // A hidden pack is never a continue point, entitlement or not.
    if (window.FP_PACK_OVERRIDES?.[pack.id]?.is_hidden) continue;
    if (!full && packIsLocked(progress, pack.id)) continue;
    const pd = progress[pack.id];
    if (!pd) continue;
    for (let i = 0; i < 10; i++) {
      const s = pd.stars[i];
      // null is "never touched". Locked for a free player, playable for premium.
      if (s === null && !full) break;
      if (s === null || s === -1 || s === 0) return {
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
const LEVEL_GRAPH = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'lin', 'qua', 'trig', 'exp', 'flip'];
Object.assign(window, {
  ROMAN_PACKS,
  SPECIAL_PACKS,
  LEVELS,
  SPECIAL_UNLOCK_STARS,
  getLevelData,
  getLevelName,
  getHint,
  getPack,
  visiblePacks,
  applyOverrides,
  freshProgress,
  packTotalStars,
  packIsLocked,
  packIsComplete,
  totalStarsAll,
  starBitsOf,
  starCount,
  computePackLocked,
  hasFullAccess,
  findContinuePoint,
  LEVEL_NAMES,
  LEVEL_GRAPH
});