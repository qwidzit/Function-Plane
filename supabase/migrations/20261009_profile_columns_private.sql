-- Function Plane — two profile columns nobody but the admin needs to read
--
-- premium_granted says whether Premium came from the admin rather than a
-- purchase, and created_at is the account's age; both were readable by any
-- client, neither is drawn anywhere. Every profile select in accounts.js
-- names its columns, so losing these breaks nothing. The admin's own
-- functions are SECURITY DEFINER and unaffected.
--
-- Safe to run more than once.

revoke select (premium_granted, created_at) on public.profiles from anon, authenticated;
