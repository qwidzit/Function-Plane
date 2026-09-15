-- Function Plane — a level can introduce the mechanic it teaches
--
-- level_overrides.explain text  key into FP_EXPLAINERS (how-to-play.jsx). The
--                               level screen shows that card once, the first
--                               time a player opens the level, and never again.
--                               Null on every level that teaches nothing new.
--
-- Additive only; every existing row keeps working. Safe to run more than once.

alter table public.level_overrides
  add column if not exists explain text;
