-- Function Plane — level objects, curve materials, pack rules
--
-- level_overrides.objects   jsonb  [{ kind, x, y, ... }] — fans, antigravity
--                                  zones, gravity wells, hazards. Shapes are
--                                  defined in src/level-objects.jsx.
-- level_overrides.materials bool   players may set a curve's bounce (dead /
--                                  perfectly elastic) on this level. Off by
--                                  default; on always in the sandbox.
-- pack_overrides.modifier   text   a rule the whole pack plays under —
--                                  currently 'gravityFlip'.
--
-- Additive only; every existing row keeps working. Safe to run more than once.

alter table public.level_overrides
  add column if not exists objects   jsonb   not null default '[]'::jsonb,
  add column if not exists materials boolean not null default false;

alter table public.pack_overrides
  add column if not exists modifier text;
