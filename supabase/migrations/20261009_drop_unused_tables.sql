-- Function Plane — tables nothing reads or writes
--
-- news and push_subscriptions were scaffolding for notifications that never
-- shipped; the client code that would have written push_subscriptions was
-- removed with this migration. Both are empty. Safe to run more than once.

drop table if exists public.push_subscriptions;
drop table if exists public.news;
