-- Function Plane — make is_premium unwritable by the player it belongs to
--
-- `profiles_update` is `auth.uid() = id`, and RLS has no column granularity:
-- any signed-in player could PATCH their own row with is_premium = true using
-- the publishable key and unlock every pack. Column privileges are the only
-- lever that stops it, so the client roles lose INSERT and UPDATE on that one
-- column — `total_stars` is the only profile column the game itself writes.
-- handle_new_user() is SECURITY DEFINER and the entitlement webhook will use
-- the service-role key, so neither is affected.
--
-- The admin grant loses its REST path with the same revoke, hence the RPC
-- below. Safe to run more than once.

-- A column-level revoke does nothing against a table-level grant, so the
-- table grants come off first and go back on column by column. `anon` gets
-- neither back: auth.uid() is null there, so both policies reject it anyway.
revoke insert, update on public.profiles from anon, authenticated;
grant insert (id, name, avatar, total_stars, created_at) on public.profiles to authenticated;
grant update (name, avatar, total_stars) on public.profiles to authenticated;

-- The manual grant, until purchases flip the flag on their own. Re-checks the
-- caller's own profile name rather than trusting anything sent from the
-- client; `profiles_premium_admin` used to carry this and is dropped below,
-- since with the column revoked it only granted the admin the power to rewrite
-- other players' names.
create or replace function public.admin_set_premium(target uuid, value boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles p
     where p.id = auth.uid() and p.name = 'Test Account'
  ) then
    raise exception 'not authorised';
  end if;

  update public.profiles set is_premium = value where id = target;
end;
$$;

revoke all on function public.admin_set_premium(uuid, boolean) from public;
grant execute on function public.admin_set_premium(uuid, boolean) to authenticated;

drop policy if exists profiles_premium_admin on public.profiles;
