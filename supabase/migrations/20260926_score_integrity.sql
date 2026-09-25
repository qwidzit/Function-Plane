-- Function Plane — leaderboard rows the owner's device cannot resurrect or inflate
--
-- Four holes, one trigger:
--   * An admin deleting a forged row changed nothing for long: the owner's
--     device rebuilds every level_scores row from its progress on each upload,
--     and the next sync inserted it again — the same bug as the times reset.
--     score_removals remembers what an admin removed, and the guard skips any
--     row for it (return null, so the rest of a batch upsert still lands).
--   * The pack allow-list admitted hidden packs, and nothing checked that a
--     level exists, so total_stars could reach 450 instead of 210. Rows for a
--     level that is not in level_overrides under a visible pack are skipped.
--   * best_time_at is the device clock, and a time dated in the future would
--     survive any later reset. Anything more than ten minutes ahead of the
--     server is clamped to now.
--   * Every player could read everyone's winning equations and copy the top
--     solution exactly. They move to score_equations, readable only through
--     admin_score_rows; level_scores.equations stays in the upload (older
--     builds send it) but is stored null from now on; the copies already
--     there are cleared by 20260926_score_equations_cleanup.sql. submitted_at,
--     the activity trail, is no longer readable.

create table if not exists public.score_removals (
  user_id     uuid     not null references public.profiles(id) on delete cascade,
  pack_id     text     not null,
  level_index smallint not null,
  removed_at  timestamptz not null default now(),
  primary key (user_id, pack_id, level_index)
);
alter table public.score_removals enable row level security;
revoke all on public.score_removals from anon, authenticated;

create table if not exists public.score_equations (
  user_id     uuid     not null references public.profiles(id) on delete cascade,
  pack_id     text     not null,
  level_index smallint not null,
  equations   text[],
  primary key (user_id, pack_id, level_index)
);
alter table public.score_equations enable row level security;
revoke all on public.score_equations from anon, authenticated;

insert into public.score_equations (user_id, pack_id, level_index, equations)
  select user_id, pack_id, level_index, equations from public.level_scores where equations is not null
  on conflict do nothing;

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

  if new.best_time is not null and (new.best_time < 0.05 or new.best_time > 30) then
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

  -- A time from before the reset is dropped, not refused: the stars and score
  -- on the same row are still good.
  if new.best_time is null
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

-- Reads: everything the leaderboards need, nothing that tracks activity.
-- equations and best_time_at stay selectable because an upsert reads back
-- every column it sends; equations is always null here.
revoke select on public.level_scores from anon, authenticated;
grant select (user_id, pack_id, level_index, best_score, stars, best_time, best_time_at, equations)
  on public.level_scores to anon, authenticated;

create or replace function public.admin_score_rows(p_limit int default 400)
returns table (user_id uuid, pack_id text, level_index smallint, best_score int, stars smallint,
               best_time real, equations text[], submitted_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not authorised'; end if;
  return query
    select s.user_id, s.pack_id, s.level_index, s.best_score, s.stars, s.best_time,
           coalesce(e.equations, s.equations), s.submitted_at
      from public.level_scores s
      left join public.score_equations e using (user_id, pack_id, level_index)
     order by s.submitted_at desc
     limit least(greatest(p_limit, 1), 2000);
end;
$$;
revoke all on function public.admin_score_rows(int) from public, anon;
grant execute on function public.admin_score_rows(int) to authenticated;

create or replace function public.admin_remove_score(p_user uuid, p_pack text, p_level int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not authorised'; end if;
  insert into public.score_removals (user_id, pack_id, level_index)
    values (p_user, p_pack, p_level) on conflict do nothing;
  delete from public.level_scores where user_id = p_user and pack_id = p_pack and level_index = p_level;
  delete from public.score_equations where user_id = p_user and pack_id = p_pack and level_index = p_level;
end;
$$;
revoke all on function public.admin_remove_score(uuid, text, int) from public, anon;
grant execute on function public.admin_remove_score(uuid, text, int) to authenticated;
