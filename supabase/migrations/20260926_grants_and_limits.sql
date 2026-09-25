-- Function Plane — client roles hold only what the app uses, and nothing is unbounded
--
-- anon and authenticated carried Supabase's default grants: every privilege on
-- every table, TRUNCATE (which RLS does not gate) included. RLS kept writes
-- honest, but a grant nothing uses is one migration mistake from a hole.
-- Guests (anon) write only crash reports; signed-in players write their own
-- progress, scores, subscriptions and profile deletion, and admins the
-- override and news tables (RLS decides who is an admin).
--
-- Size limits: a progress blob, an avatar and the crash-report table had no
-- ceiling, so one account — or one script, for crash reports — could fill the
-- database.

revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

revoke insert, update, delete on all tables in schema public from anon;

revoke insert, update on public.profiles from authenticated;
drop policy if exists profiles_insert on public.profiles;

revoke select on public.client_errors from anon, authenticated;
grant  select on public.client_errors to authenticated;
revoke insert on public.client_errors from anon, authenticated;
grant  insert (build, native, kind, route, message, stack) on public.client_errors to anon, authenticated;

alter table public.progress drop constraint if exists progress_data_size;
alter table public.progress add constraint progress_data_size check (pg_column_size(data) < 1048576);

alter table public.profiles drop constraint if exists profiles_avatar_check;
alter table public.profiles add constraint profiles_avatar_check check (char_length(avatar) between 1 and 8);

-- Crash reports past 500 an hour are dropped, not refused: a real crash loop
-- on many devices at once still leaves 500 an hour to read, and a flood costs
-- at most that.
create or replace function public.client_errors_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.client_errors where created_at > now() - interval '1 hour') >= 500 then
    return null;
  end if;
  return new;
end;
$$;
revoke all on function public.client_errors_cap() from public, anon, authenticated;

drop trigger if exists client_errors_cap on public.client_errors;
create trigger client_errors_cap
  before insert on public.client_errors
  for each row execute function public.client_errors_cap();
