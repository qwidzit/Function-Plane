-- Function Plane — achievement_overrides, as a migration
--
-- The table was created from the admin panel's bootstrap SQL (ACH_SQL in
-- admin-screen.jsx) and never recorded here, so a project rebuilt from this
-- folder would lack it. Same shape, same policies; a no-op on the live
-- project. Safe to run more than once.

create table if not exists public.achievement_overrides (
  id          text primary key,
  name        text not null,
  description text,
  kind        text not null,
  threshold   integer,
  pack_id     text,
  level_index integer,
  score       integer,
  is_hidden   boolean default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table public.achievement_overrides enable row level security;
drop policy if exists ach_read on public.achievement_overrides;
create policy ach_read on public.achievement_overrides for select using (true);
drop policy if exists ach_admin_write on public.achievement_overrides;
create policy ach_admin_write on public.achievement_overrides for all
  to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
