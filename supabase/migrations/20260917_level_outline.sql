-- The figure a level's stars are arranged in, for the shape pack: a list of
-- polylines over star indices, e.g. [[0,1,2,0]] for a triangle. Drawn faintly
-- on the plane so the shape reads as a shape, and nothing else — it is never
-- an equation, never a collider, and the ball passes straight through it.
--
-- Nullable with no default so every row written before this column existed
-- still reads, and so the studio's upsert, which does not name it, leaves
-- whatever is there alone.
alter table public.level_overrides
  add column if not exists outline jsonb;
