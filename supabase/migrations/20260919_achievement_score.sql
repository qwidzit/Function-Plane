-- Function Plane — an achievement can name a score as well as a count
--
-- achievement_overrides.score integer  the second number the levels_min_score
--                            kind needs: "complete N levels with a score of S
--                            or less" is a count and a bound, and every other
--                            kind so far needed only one. Null for the kinds
--                            that don't use it.
--
-- Not optional once the editor ships: its save patch names every column it
-- writes, `score` included and always, and PostgREST refuses an upsert naming
-- a column the table does not have — so without this, *every* achievement
-- save fails, not just one using the new kind.
--
-- Additive only; every existing row keeps working. Safe to run more than once.

alter table public.achievement_overrides
  add column if not exists score integer;
