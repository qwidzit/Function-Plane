-- Function Plane — the star leaderboard stops taking the client's word
--
-- `level_scores` has been guarded since 20260816: a row has to survive a
-- trigger that refuses values no real run can produce. `profiles.total_stars`
-- had none of that. It is what the stars leaderboard ranks on, and the client
-- simply asserted it — one PATCH with the publishable key and a player is top
-- of the table with 999.
--
-- So it stops being an assertion and becomes a derivation: summed from the
-- guarded rows, maintained by the database, and not writable by anyone else.
-- On the data as it stands every player's claimed total already equals the
-- derived one, so this changes no real score.
--
-- Three smaller holes in the same tables go with it, below.
--
-- Safe to run more than once.

-- ── 1. A pack id has to be a pack ──────────────────────────────────────────
-- Nothing checked pack_id beyond "not empty", which did not matter while these
-- rows only fed per-level leaderboards queried by real pack id. Summing them
-- into total_stars changes that: rows under an invented pack would be free
-- stars. Adding a pack to data.jsx means adding it here — the same standing
-- deal as the score numbers this trigger already has baked in.

create or replace function public.level_scores_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  goal_score int;
  n_eqs      int;
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
$function$;

-- ── 2. total_stars is derived, never asserted ──────────────────────────────
-- Statement-level rather than per row: one progress sync upserts every
-- completed level at once (~70 rows), and recomputing once per statement beats
-- recomputing seventy times for the same answer. Transition tables cannot be
-- shared across events, hence three triggers onto one function.

create or replace function public.sync_total_stars()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles p
     set total_stars = coalesce((
           select sum(ls.stars) from public.level_scores ls where ls.user_id = p.id
         ), 0)
   where p.id in (select user_id from changed);
  return null;
end;
$$;

drop trigger if exists level_scores_stars_insert on public.level_scores;
create trigger level_scores_stars_insert
  after insert on public.level_scores
  referencing new table as changed
  for each statement execute function public.sync_total_stars();

drop trigger if exists level_scores_stars_update on public.level_scores;
create trigger level_scores_stars_update
  after update on public.level_scores
  referencing new table as changed
  for each statement execute function public.sync_total_stars();

-- Deleting rows has to move the total too — that is how a forged entry the
-- admin removes stops counting.
drop trigger if exists level_scores_stars_delete on public.level_scores;
create trigger level_scores_stars_delete
  after delete on public.level_scores
  referencing old table as changed
  for each statement execute function public.sync_total_stars();

update public.profiles p
   set total_stars = coalesce((
         select sum(ls.stars) from public.level_scores ls where ls.user_id = p.id
       ), 0);

-- ── 3. Nothing about a profile is client-writable any more ─────────────────
-- With total_stars derived, the app has no reason to write this table at all:
-- name and avatar are set once at signup by handle_new_user (SECURITY DEFINER,
-- so unaffected), is_premium belongs to the edge functions, and there is no
-- rename feature. Leaving UPDATE open only left a way to take someone else's
-- display name on the leaderboard.

revoke update on public.profiles from anon, authenticated;
drop policy if exists profiles_update on public.profiles;

-- ── 4. Deleting an account actually deletes the profile ────────────────────
-- RLS was on with no DELETE policy, so deleteAccount()'s `delete from
-- profiles` matched zero rows and reported success: progress and scores went,
-- the profile stayed, and the player kept their name and their place on the
-- stars leaderboard forever. Which also made the Data safety answer about
-- in-app deletion untrue.
--
-- Deliberately not extended to the admin: a policy on profiles that reads
-- profiles risks recursive evaluation, and removing someone else's account is
-- a dashboard job, not an in-app one.

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete
  on public.profiles for delete
  using (auth.uid() = id);

-- ── 5. Display names are unique case-insensitively ─────────────────────────
-- checkNameAvailable() has always tested with ilike, but the constraint was
-- case-sensitive, so the app's own check was stricter than the database's.
-- `Test Account` is the admin gate in both the client and every overrides
-- policy; it being takeable in another case is not a gap worth leaving open.
-- Verified free of collisions before this ran.

alter table public.profiles drop constraint if exists profiles_name_unique;
drop index if exists public.profiles_name_unique;
create unique index if not exists profiles_name_lower_key
  on public.profiles (lower(name));

-- ── 6. Trigger functions are not API endpoints ─────────────────────────────
-- PostgREST exposes every function in this schema as an RPC, and the default
-- grant is to `public`. Calling a trigger function directly only raises
-- "trigger functions can only be called as triggers", so this is tidying
-- rather than a hole — but the grant buys nothing either way. Trigger
-- invocation does not check EXECUTE, so the triggers keep firing; verified
-- after applying.

revoke all on function public.sync_total_stars()   from public, anon, authenticated;
revoke all on function public.level_scores_guard() from public, anon, authenticated;
revoke all on function public.handle_new_user()    from public, anon, authenticated;
