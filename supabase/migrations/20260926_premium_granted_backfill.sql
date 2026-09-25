-- Function Plane — mark existing admin grants as grants
--
-- NOT APPLIED YET — it updates profiles, so it waits for an explicit go-ahead.
-- Run it in the SQL editor.
--
-- 20260926_admin_by_id.sql added profiles.premium_granted so that a refund
-- does not take away Premium an admin gave (void_purchase). Premium held today
-- without any live purchase can only have come from an admin grant; until this
-- runs, those players would lose it if they ever bought and then refunded.

update public.profiles p set premium_granted = true
 where p.is_premium
   and not exists (select 1 from public.purchases b where b.user_id = p.id and b.voided_at is null);
