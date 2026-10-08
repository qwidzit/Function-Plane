-- Function Plane — a time under the floor is dropped, not the whole row
--
-- The guard refused any best_time under 0.05 s, which aborted the upsert
-- carrying the stars and the score with it — silently, because a refusal is
-- not retried. A star placed within the ball's reach of the spawn is
-- collected on the first tick, at 0.0167 s; no shipped level does that, but
-- nothing stops one being authored. Such a time is now nulled the way a
-- pre-reset time already is, and the rest of the row lands.
--
-- Everything else about the guard is unchanged from
-- 20260926_score_integrity.sql. Safe to run more than once.

create or replace function public.level_scores_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  n_eqs  int;
  cutoff timestamptz := (select times_reset_at from public.game_state);
  is_best boolean;
begin
  if exists (select 1 from public.score_removals r
              where r.user_id = new.user_id and r.pack_id = new.pack_id and r.level_index = new.level_index) then
    return null;
  end if;

  if not exists (select 1 from public.level_overrides lo
                   join public.pack_overrides po on po.pack_id = lo.pack_id and not po.is_hidden
                  where lo.pack_id = new.pack_id and lo.level_index = new.level_index) then
    return null;
  end if;

  if new.stars is null or new.stars < 1 or new.stars > 3 then
    raise exception 'stars must be between 1 and 3, got %', new.stars;
  end if;

  if new.best_score is null or new.best_score < 20 then
    raise exception 'best_score % is below the minimum a winning run can produce', new.best_score;
  end if;

  -- TIME_LIMIT is 28 s in the game; nothing can finish later. A time under
  -- the floor is not impossible, only unauthored, so it is dropped below.
  if new.best_time is not null and new.best_time > 30 then
    raise exception 'best_time % is outside the playable range', new.best_time;
  end if;

  if cardinality(new.equations) > 16 or length(array_to_string(new.equations, '')) > 4000 then
    raise exception 'too many equations';
  end if;

  select count(*) into n_eqs
    from unnest(coalesce(new.equations, '{}'::text[])) as e
   where e !~ '^[[:space:]]*[a-df-mo-wz][[:space:]]*=[[:space:]]*-?[0-9]+(\.[0-9]+)?[[:space:]]*$';

  if n_eqs > 0 and new.best_score < 20 * n_eqs then
    raise exception 'best_score % is impossible with % equations', new.best_score, n_eqs;
  end if;

  if new.best_time_at > now() + interval '10 minutes' then
    new.best_time_at := now();
  end if;

  -- A time from before the reset, or under the floor, is dropped, not
  -- refused: the stars and score on the same row are still good.
  if new.best_time is null
     or new.best_time < 0.05
     or (cutoff is not null and (new.best_time_at is null or new.best_time_at < cutoff)) then
    new.best_time    := null;
    new.best_time_at := null;
  end if;

  is_best := tg_op = 'INSERT' or new.best_score <= old.best_score;

  if tg_op = 'UPDATE' then
    if new.best_score > old.best_score then
      new.best_score := old.best_score;
    end if;
    -- The stored time wins only if it is itself from after the reset.
    if old.best_time is not null
       and (cutoff is null or old.best_time_at >= cutoff)
       and (new.best_time is null or old.best_time <= new.best_time) then
      new.best_time    := old.best_time;
      new.best_time_at := old.best_time_at;
    end if;
    new.stars := greatest(old.stars, new.stars);
  end if;

  if is_best and new.equations is not null then
    insert into public.score_equations (user_id, pack_id, level_index, equations)
      values (new.user_id, new.pack_id, new.level_index, new.equations)
      on conflict (user_id, pack_id, level_index) do update set equations = excluded.equations;
  end if;
  new.equations := null;

  new.submitted_at := now();
  return new;
end;
$$;

revoke all on function public.level_scores_guard() from public, anon, authenticated;
