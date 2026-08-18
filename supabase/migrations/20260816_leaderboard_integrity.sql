-- Function Plane — leaderboard integrity
--
-- Clients write their own rows into level_scores, so before this migration a
-- player with devtools open could post any score, star count or time they
-- liked. Full verification means replaying the physics server-side, which is
-- a much bigger job; this closes the gap that matters by refusing values no
-- real run can produce and by making the server, not the client, decide what
-- "best" means.
--
-- Safe to run more than once.

-- ── 1. Audit trail ─────────────────────────────────────────────────────────
-- The equations behind a submission. Nothing reads them at runtime; they let
-- the admin screen recompute a score with the real classifier and spot a row
-- that could not have come from the run it claims.

alter table public.level_scores
  add column if not exists equations    text[],
  add column if not exists submitted_at timestamptz not null default now();

-- ── 2. Indexes the leaderboard queries actually use ────────────────────────

create index if not exists level_scores_score_idx
  on public.level_scores (pack_id, level_index, best_score);

create index if not exists level_scores_time_idx
  on public.level_scores (pack_id, level_index, best_time)
  where best_time is not null;

-- ── 3. The guard ───────────────────────────────────────────────────────────

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
  -- the cheapest thing the classifier scores is a linear equation at 10. One
  -- equation therefore floors at 30; nothing winning can score less.
  if new.best_score is null or new.best_score < 30 then
    raise exception 'best_score % is below the minimum a winning run can produce', new.best_score;
  end if;

  -- TIME_LIMIT is 28s in game; under 0.05s the ball cannot physically reach a
  -- star from any authored start position.
  if new.best_time is not null and (new.best_time < 0.05 or new.best_time > 30) then
    raise exception 'best_time % is outside the playable range', new.best_time;
  end if;

  n_eqs := coalesce(array_length(new.equations, 1), 0);
  if n_eqs > 0 and new.best_score < 30 * n_eqs then
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

drop trigger if exists level_scores_guard on public.level_scores;
create trigger level_scores_guard
  before insert or update on public.level_scores
  for each row execute function public.level_scores_guard();

-- ── 4. Row-level security ──────────────────────────────────────────────────
-- The guard is pointless if a player can write a row under someone else's id.
-- Reads stay open because the leaderboard is public by design (the privacy
-- policy says display name, avatar, stars and scores are visible to others).

alter table public.level_scores enable row level security;

drop policy if exists level_scores_read   on public.level_scores;
drop policy if exists level_scores_insert on public.level_scores;
drop policy if exists level_scores_update on public.level_scores;
drop policy if exists level_scores_delete on public.level_scores;

-- Policies from before this migration named the table differently. Postgres
-- OR's permissive policies together, so leaving an older, looser one in place
-- silently defeats every restriction below — a stale `scores_insert` that only
-- checked `authenticated` would let anyone write anyone's row no matter what
-- `level_scores_insert` says. Drop them by their old names too.
drop policy if exists scores_read   on public.level_scores;
drop policy if exists scores_insert on public.level_scores;
drop policy if exists scores_update on public.level_scores;
drop policy if exists scores_delete on public.level_scores;

create policy level_scores_read
  on public.level_scores for select
  using (true);

create policy level_scores_insert
  on public.level_scores for insert
  with check (auth.uid() = user_id);

create policy level_scores_update
  on public.level_scores for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Players may delete their own rows (account deletion depends on it); the
-- admin may delete anyone's, which is how a flagged entry gets removed.
create policy level_scores_delete
  on public.level_scores for delete
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles
       where profiles.id = auth.uid() and profiles.name = 'Test Account'
    )
  );
