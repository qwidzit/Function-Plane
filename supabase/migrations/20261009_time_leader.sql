-- Function Plane — how many time leaderboards the caller leads
--
-- The "fastest time on a level" achievement is the one thing a save on the
-- device cannot know: whether anyone else is faster. One count, computed
-- from the guarded rows every player can already read, so SECURITY INVOKER
-- is enough. A tie for fastest counts as leading, as the board draws it.
--
-- Safe to run more than once.

create or replace function public.my_time_firsts()
returns int
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::int
    from (
      select user_id,
             rank() over (partition by pack_id, level_index order by best_time asc) as r
        from public.level_scores
       where best_time is not null
    ) t
   where t.user_id = (select auth.uid()) and t.r = 1;
$$;
revoke all on function public.my_time_firsts() from public, anon;
grant execute on function public.my_time_firsts() to authenticated;
