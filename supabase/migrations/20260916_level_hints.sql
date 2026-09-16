-- Function Plane — a level can carry its own hint
--
-- level_overrides.hint text  one line naming the *kind* of function the level
--                            was built around, and never the numbers. Wins over
--                            LEVEL_HINTS in data.jsx wherever it is set; null
--                            falls back to that table, and a level in neither
--                            simply has no hint and says so.
--
-- Additive only; every existing row keeps working. Safe to run more than once.

alter table public.level_overrides
  add column if not exists hint text;
