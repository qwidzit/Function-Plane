-- Function Plane — deleting your profile deletes the sign-in account behind it
--
-- The app's Delete account removes progress, level_scores and profiles, then
-- signs out. It cannot touch auth.users — the client has no rights there — so
-- the email, the password hash and every purchases row (which cascades from
-- auth.users, not from profiles) survived a deletion that delete-account.html
-- and the privacy policy both describe as complete.
--
-- Finishing it here rather than in the app means the Build 2 client, which
-- already deletes the profile, needs no new build. profiles_delete only lets a
-- player delete their own row, so this fires for self-deletion and for nothing
-- a client can aim at anyone else.
--
-- Deleting from auth.users directly still works: its cascade removes the
-- profile, this trigger then finds its auth row already gone, and does nothing.

create or replace function public.delete_auth_user_for_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from auth.users where id = old.id;
  return old;
end;
$$;

revoke all on function public.delete_auth_user_for_profile() from public, anon, authenticated;

drop trigger if exists profiles_delete_auth_user on public.profiles;
create trigger profiles_delete_auth_user
  after delete on public.profiles
  for each row execute function public.delete_auth_user_for_profile();
