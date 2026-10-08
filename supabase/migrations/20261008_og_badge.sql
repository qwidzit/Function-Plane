-- Function Plane — the OG badge
--
-- A mark beside the name of everyone who had an account before launch: the
-- closed-testing players. Given once, here, by date; after that only the
-- admin changes it, through admin_set_og() below.
--
-- The client roles hold no INSERT or UPDATE on `profiles` at all
-- (20260926_grants_and_limits.sql) and new rows come from handle_new_user(),
-- which names its columns, so a new account gets the default: false. SELECT
-- on this table is granted column by column, hence the grant — without it the
-- leaderboard selects that name `is_og` fail outright.
--
-- Safe to run more than once. The backfill runs only when the column is first
-- added, so a re-run does not hand the badge back to an account the admin has
-- since taken it from (the Play review account, on the day this was applied).

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_og'
  ) then
    alter table public.profiles add column is_og boolean not null default false;
    update public.profiles
       set is_og = true
     where created_at < timestamptz '2026-10-08 13:00:00+00';
  end if;
end;
$$;

grant select (is_og) on public.profiles to anon, authenticated;

-- The manual grant, for Admin ▸ Manage users. Same shape as
-- admin_set_premium(): the column has no client write path, so this is the
-- only way in, and it checks the caller rather than anything it is sent.
create or replace function public.admin_set_og(target uuid, value boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorised';
  end if;
  update public.profiles set is_og = value where id = target;
end;
$$;
revoke all on function public.admin_set_og(uuid, boolean) from public, anon;
grant execute on function public.admin_set_og(uuid, boolean) to authenticated;
