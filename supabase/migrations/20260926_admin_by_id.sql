-- Function Plane — admin is a user id, not a display name
--
-- Every admin check compared profiles.name to 'Test Account'. The name is set
-- once, at signup, from metadata the client chooses, and profiles_name_lower_key
-- only kept it unique while that profile existed. Since
-- 20260921_delete_account_completely.sql, deleting the account frees the name,
-- and the next stranger to register it would own every level, pack,
-- achievement, news post and premium grant — and, through the equations in
-- level overrides, code every player's device compiles.
--
-- public.admins lists admins by auth.users id; is_admin() is the one check.
-- The name is also reserved, so nobody can pass as the admin on a leaderboard.

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admins enable row level security;
drop policy if exists admins_self_read on public.admins;
create policy admins_self_read on public.admins
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.admins from anon, authenticated;
grant select on public.admins to authenticated;

insert into public.admins (user_id) values ('27bdc17f-ad7e-45ea-b56b-b484665af094')
  on conflict do nothing;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Admin writes are for signed-in admins only; reads stay open where they were.
drop policy if exists ach_admin_write on public.achievement_overrides;
create policy ach_admin_write on public.achievement_overrides
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists lo_write on public.level_overrides;
create policy lo_write on public.level_overrides
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists po_write on public.pack_overrides;
create policy po_write on public.pack_overrides
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists news_admin_write on public.news;
create policy news_admin_write on public.news
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists client_errors_admin_read on public.client_errors;
create policy client_errors_admin_read on public.client_errors
  for select to authenticated using ((select public.is_admin()));

-- An admin removes a score through admin_remove_score (20260926_score_integrity.sql),
-- which records the removal so the owner's device cannot put it back.
drop policy if exists level_scores_delete on public.level_scores;
create policy level_scores_delete on public.level_scores
  for delete to authenticated using ((select auth.uid()) = user_id);

-- A premium grant is remembered as a grant, so a refund of a purchase the same
-- player also made does not take away what the admin gave (void_purchase).
alter table public.profiles add column if not exists premium_granted boolean not null default false;

create or replace function public.admin_set_premium(target uuid, value boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorised';
  end if;
  update public.profiles set is_premium = value, premium_granted = value where id = target;
end;
$$;
revoke all on function public.admin_set_premium(uuid, boolean) from public, anon;
grant execute on function public.admin_set_premium(uuid, boolean) to authenticated;

-- Names: trimmed, and 'Test Account' — in any case, with any
-- spacing or invisible characters — is reserved.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  n text := btrim(coalesce(new.raw_user_meta_data->>'name', 'Player'));
begin
  if lower(regexp_replace(n, '[\s\u00a0\u200b-\u200d\u2060\ufeff]', '', 'g')) = 'testaccount' then
    raise exception 'That name is reserved';
  end if;
  insert into public.profiles (id, name, avatar) values (
    new.id, n, left(coalesce(new.raw_user_meta_data->>'avatar', '🟢'), 8)
  );
  insert into public.progress (user_id, data) values (new.id, '{}');
  return new;
end;
$$;
