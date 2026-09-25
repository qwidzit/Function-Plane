-- Function Plane — a one-time reset of best times that keeps offline play
--
-- Replaces 20260925_reset_epoch.sql, which cleared all progress and made a
-- device that was offline at the reset lose whatever it played before it next
-- connected. Only times are reset now; stars, scores and equations stay.
--
-- Every best time carries when it was set (best_time_at, the device's clock at
-- the finish). game_state.times_reset_at is the cutoff: a time set before it,
-- or with no date at all, is dropped rather than refused, so older builds keep
-- saving stars and scores and only lose the time. A time set after the reset —
-- including one set offline and uploaded later — survives, because its date
-- says so. Clients filter their own copies the same way (accounts.js,
-- _checkTimesReset).
--
-- To reset, from the SQL editor:  select public.reset_times();
-- It is not callable through the API.

drop trigger if exists progress_epoch on public.progress;
drop trigger if exists level_scores_epoch on public.level_scores;
drop function if exists public.reject_stale_epoch();
drop function if exists public.reset_all_progress();
alter table public.progress     drop column if exists epoch;
alter table public.level_scores drop column if exists epoch;
alter table public.game_state   drop column if exists reset_epoch;

alter table public.game_state   add column if not exists times_reset_at timestamptz;
alter table public.level_scores add column if not exists best_time_at   timestamptz;

create or replace function public.level_scores_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  n_eqs  int;
  cutoff timestamptz := (select times_reset_at from public.game_state);
begin
  if new.level_index < 0 or new.level_index > 9 then
    raise exception 'level_index % is out of range', new.level_index;
  end if;

  if new.pack_id is null or new.pack_id !~
     '^(r-(I|II|III|IV|V|VI|VII|VIII|IX|X)|s-(lin|qua|trig|exp|flip))$' then
    raise exception 'pack_id % is not a pack in this game', new.pack_id;
  end if;

  if new.stars is null or new.stars < 1 or new.stars > 3 then
    raise exception 'stars must be between 1 and 3, got %', new.stars;
  end if;

  if new.best_score is null or new.best_score < 20 then
    raise exception 'best_score % is below the minimum a winning run can produce', new.best_score;
  end if;

  if new.best_time is not null and (new.best_time < 0.05 or new.best_time > 30) then
    raise exception 'best_time % is outside the playable range', new.best_time;
  end if;

  select count(*) into n_eqs
    from unnest(coalesce(new.equations, '{}'::text[])) as e
   where e !~ '^[[:space:]]*[a-df-mo-wz][[:space:]]*=[[:space:]]*-?[0-9]+(\.[0-9]+)?[[:space:]]*$';

  if n_eqs > 0 and new.best_score < 20 * n_eqs then
    raise exception 'best_score % is impossible with % equations', new.best_score, n_eqs;
  end if;

  -- A time from before the reset is dropped, not refused: the stars and score
  -- on the same row are still good.
  if new.best_time is null
     or (cutoff is not null and (new.best_time_at is null or new.best_time_at < cutoff)) then
    new.best_time    := null;
    new.best_time_at := null;
  end if;

  if tg_op = 'UPDATE' then
    if new.best_score > old.best_score then
      new.best_score := old.best_score;
      new.equations  := old.equations;
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

  new.submitted_at := now();
  return new;
end;
$$;

create or replace function public.reset_times()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  t timestamptz;
begin
  update public.game_state set times_reset_at = now() returning times_reset_at into t;
  update public.level_scores set best_time = null, best_time_at = null where best_time is not null;
  return t;
end;
$$;

revoke all on function public.reset_times() from public, anon, authenticated;
