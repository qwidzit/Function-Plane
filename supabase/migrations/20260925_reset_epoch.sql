-- Function Plane — a reset that sticks
--
-- Clearing progress and scores on the server never lasted: level_scores_guard
-- refuses to lower a record, and every client merges its local copy with the
-- server's toward the better value and uploads the result, so the first device
-- to sync after a wipe put everything back.
--
-- game_state.reset_epoch counts resets. Every progress and level_scores write
-- carries the epoch its data was earned under, and a write from an older epoch
-- is refused here. A client that meets a newer epoch clears its local progress
-- and adopts it (accounts.js, _checkEpoch). Clients that predate this send no
-- epoch, which reads as 0: accepted until the first reset, refused after it.
--
-- To reset, from the SQL editor:  select public.reset_all_progress();
-- It is not callable through the API.

create table if not exists public.game_state (
  id          boolean primary key default true check (id),
  reset_epoch int not null default 0
);
insert into public.game_state default values on conflict do nothing;

alter table public.game_state enable row level security;
drop policy if exists game_state_read on public.game_state;
create policy game_state_read on public.game_state for select using (true);
revoke all on public.game_state from anon, authenticated;
grant select on public.game_state to anon, authenticated;

alter table public.progress     add column if not exists epoch int;
alter table public.level_scores add column if not exists epoch int;

create or replace function public.reject_stale_epoch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.epoch, 0) < (select reset_epoch from public.game_state) then
    raise exception 'stale_epoch: this progress predates the last reset';
  end if;
  return new;
end;
$$;

revoke all on function public.reject_stale_epoch() from public, anon, authenticated;

drop trigger if exists progress_epoch on public.progress;
create trigger progress_epoch
  before insert or update on public.progress
  for each row execute function public.reject_stale_epoch();

drop trigger if exists level_scores_epoch on public.level_scores;
create trigger level_scores_epoch
  before insert or update on public.level_scores
  for each row execute function public.reject_stale_epoch();

-- Premium, purchases, profiles and names are untouched. Deleting level_scores
-- fires level_scores_stars_delete, which zeroes profiles.total_stars.
create or replace function public.reset_all_progress()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  e int;
begin
  update public.game_state set reset_epoch = reset_epoch + 1 returning reset_epoch into e;
  delete from public.level_scores where true;
  delete from public.progress where true;
  return e;
end;
$$;

revoke all on function public.reset_all_progress() from public, anon, authenticated;
