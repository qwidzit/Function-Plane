-- Function Plane — clear the public copies of winning equations
--
-- NOT APPLIED YET — it rewrites every level_scores row, so it waits for an
-- explicit go-ahead. Run it in the SQL editor.
--
-- 20260926_score_integrity.sql copied every row's equations into
-- score_equations and made the guard store new ones there only. The copies
-- still sitting in level_scores.equations are readable by any player until
-- this clears them. The guard is disabled around the update because clearing
-- the column is not a submission: through the guard, an equal score would
-- rewrite score_equations with the null being written. achieved_at was never
-- written by the app and is dropped.

alter table public.level_scores disable trigger level_scores_guard;
update public.level_scores set equations = null where equations is not null;
alter table public.level_scores enable trigger level_scores_guard;

alter table public.level_scores drop column if exists achieved_at;
