-- Function Plane — constant lines and slider parameters
--
-- Two changes in the game reach the leaderboard guard:
--
--   1. y=c and x=c classify as 'const' and cost 0 complexity, so the cheapest
--      winning run is now 20 (one equation's flat 20), not 30. Without this
--      the guard rejects every run solved with a horizontal line.
--   2. Slider definitions ("a=3.4") travel in the equations array so the admin
--      audit can recompute a parameterised run against the same values. They
--      are declarations, not curves, so they must not count toward the
--      per-equation score floor.
--
-- Everything else about the guard is unchanged; this replaces the function
-- body from 20260816_leaderboard_integrity.sql. Safe to run more than once.

create or replace function public.level_scores_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  goal_score int;
  n_eqs      int;
begin
  -- Structural limits. None of these can be produced by playing the game, so
  -- they are hard rejections rather than clamps.
  if new.level_index < 0 or new.level_index > 9 then
    raise exception 'level_index % is out of range', new.level_index;
  end if;

  if coalesce(new.pack_id, '') = '' then
    raise exception 'pack_id is required';
  end if;

  if new.stars is null or new.stars < 1 or new.stars > 3 then
    raise exception 'stars must be between 1 and 3, got %', new.stars;
  end if;

  -- computeScore() in level-screen is sum(complexity) + 20 per equation, and
  -- the cheapest thing the classifier scores is a constant line (y=c, x=c) at
  -- 0. One equation therefore floors at 20; nothing winning can score less.
  -- It was 30 while a line was the cheapest curve in the game.
  if new.best_score is null or new.best_score < 20 then
    raise exception 'best_score % is below the minimum a winning run can produce', new.best_score;
  end if;

  -- TIME_LIMIT is 28s in game; under 0.05s the ball cannot physically reach a
  -- star from any authored start position.
  if new.best_time is not null and (new.best_time < 0.05 or new.best_time > 30) then
    raise exception 'best_time % is outside the playable range', new.best_time;
  end if;

  -- Slider definitions ("a=3.4") are submitted with the equations so the
  -- audit can recompute the score against the same parameters. They declare a
  -- value, they don't draw anything, and they cost nothing — counting them as
  -- equations would reject legitimate runs.
  select count(*) into n_eqs
    from unnest(coalesce(new.equations, '{}'::text[])) as e
   where e !~ '^[[:space:]]*[a-df-mo-wz][[:space:]]*=[[:space:]]*-?[0-9]+(\.[0-9]+)?[[:space:]]*$';

  if n_eqs > 0 and new.best_score < 20 * n_eqs then
    raise exception 'best_score % is impossible with % equations', new.best_score, n_eqs;
  end if;

  -- Goal-relative check, only where the level has authored goals. starRating()
  -- awards 3 stars when equations used <= eq_goal, otherwise 2 when the score
  -- is at or under score_goal, otherwise 1.
  --
  -- Only the 2-star claim is checkable here. A row holds a personal best
  -- aggregated across runs, so its stored equations belong to the best-scoring
  -- run, which is not necessarily the run that earned 3 stars — enforcing the
  -- 3-star rule would reject legitimate players. The admin audit covers that
  -- case by recomputing with the real classifier.
  --
  -- This clamps rather than raises: retuning a level's goals in the admin
  -- panel would otherwise make every existing record for that level invalid
  -- and lock those players out of syncing entirely.
  select score_goal into goal_score
    from public.level_overrides
   where pack_id = new.pack_id and level_index = new.level_index;

  if goal_score is not null and new.stars = 2 and new.best_score > goal_score then
    new.stars := 1;
  end if;

  -- The server owns "best". A client can no longer walk a record backwards,
  -- and a stale offline sync can't overwrite a better result recorded since.
  if tg_op = 'UPDATE' then
    if new.best_score > old.best_score then
      new.best_score := old.best_score;
      new.equations  := old.equations;   -- keep the equations of the kept score
    end if;
    new.best_time := least(old.best_time, new.best_time);  -- least() skips nulls
    new.stars     := greatest(old.stars, new.stars);
  end if;

  new.submitted_at := now();
  return new;
end;
$$;
