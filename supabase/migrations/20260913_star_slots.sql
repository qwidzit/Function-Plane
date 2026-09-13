-- Function Plane — stars are three separate awards, so the guard stops
-- second-guessing which ones a row holds
--
-- Clearing a level lights the first star, the score goal the second, the
-- equation goal the third. They were a ladder before, and a run that beat the
-- equation goal was handed all three even when its score missed — the second
-- star was never earned. Now each is awarded on its own, so a row can carry
-- the first and the third with the middle one dark, and `stars` counts two.
--
-- That makes the old clamp here wrong in a way that matters: it demoted any
-- 2-star row whose score missed score_goal to 1 star, which is exactly the
-- shape of a legitimate first-and-third run. Left in place it would have
-- quietly undone the fix on every sync.
--
-- Nothing replaces it, because nothing sound can. A row is a personal best
-- accumulated across attempts: a player can take the score star in one run and
-- the equation star in another, so the stored equations and score — which
-- belong to the best-scoring run alone — cannot tell you what the row is
-- entitled to. Any goal-relative rule here would reject honest players. That
-- check belongs where it already lives: *Admin → Audit leaderboard*, which
-- recomputes with the real classifier and flags rather than rejects.
--
-- The structural checks are untouched, and they are the ones that actually
-- refuse impossible values. `stars` stays a count of 1–3, so totals,
-- thresholds and total_stars are unaffected.
--
-- Existing records keep their stars: the UPDATE branch still takes
-- greatest(old, new), so a 3 earned under the old ladder is never walked back
-- by a resync under the new rule.
--
-- Safe to run more than once.

create or replace function public.level_scores_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  n_eqs int;
begin
  -- Structural limits. None of these can be produced by playing the game, so
  -- they are hard rejections rather than clamps.
  if new.level_index < 0 or new.level_index > 9 then
    raise exception 'level_index % is out of range', new.level_index;
  end if;

  -- Ten roman packs and the five themed ones; anything else is invented.
  if new.pack_id is null or new.pack_id !~
     '^(r-(I|II|III|IV|V|VI|VII|VIII|IX|X)|s-(lin|qua|trig|exp|flip))$' then
    raise exception 'pack_id % is not a pack in this game', new.pack_id;
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
$function$;

revoke all on function public.level_scores_guard() from public, anon, authenticated;
