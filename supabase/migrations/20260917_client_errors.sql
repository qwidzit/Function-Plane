-- Crash and error reports from the client, kept in the project we already run
-- rather than sent to a crash-reporting provider.
--
-- Deliberately anonymous: no user id, no device identifier, no IP. A report
-- says what broke and in which build and nothing about who hit it. That is
-- what keeps "Supabase is the only processor" true in the privacy policy, and
-- what lets the Play Data safety answer stay "not linked to your identity".

create table if not exists public.client_errors (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  build      integer,
  native     boolean     not null default false,
  kind       text        not null,
  route      text,
  message    text        not null,
  stack      text,
  constraint client_errors_kind_ck    check (kind in ('error', 'unhandledrejection', 'react')),
  -- Bounded, because anyone holding the publishable key can write here and an
  -- unbounded text column is an unbounded bill.
  constraint client_errors_message_ck check (char_length(message) between 1 and 500),
  constraint client_errors_stack_ck   check (stack is null or char_length(stack) <= 4000),
  constraint client_errors_route_ck   check (route is null or char_length(route) <= 120)
);

create index if not exists client_errors_created_idx
  on public.client_errors (created_at desc);

alter table public.client_errors enable row level security;

-- Anyone may report: a crash in a signed-out session is still a crash, and the
-- anon key is public either way. Nobody may read one back except the admin, so
-- the table is write-only from the client — a junk row costs a row and tells
-- whoever wrote it nothing.
drop policy if exists client_errors_insert on public.client_errors;
create policy client_errors_insert on public.client_errors
  for insert to anon, authenticated
  with check (true);

drop policy if exists client_errors_admin_read on public.client_errors;
create policy client_errors_admin_read on public.client_errors
  for select to authenticated
  using (exists (
    select 1 from public.profiles p
     where p.id = auth.uid() and p.name = 'Test Account'
  ));

revoke update, delete on public.client_errors from anon, authenticated;

-- Thirty days, because the policy says thirty days. A retention promise that
-- nothing enforces is worse than not making one.
do $$
begin
  perform cron.unschedule('client-errors-prune');
exception when others then null;
end $$;

select cron.schedule(
  'client-errors-prune', '17 4 * * *',
  $$delete from public.client_errors where created_at < now() - interval '30 days'$$
);
