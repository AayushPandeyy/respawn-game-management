-- Run in the same Supabase project configured in this app.
-- Read-only checks plus an API schema-cache refresh. No user data is changed.
select
  to_regclass('public.achievements') as achievement_catalog,
  to_regclass('public.user_achievements') as earned_achievements,
  to_regclass('public.library_entries') as library,
  to_regclass('public.public_reviews') as reviews,
  to_regclass('public.game_lists') as lists,
  to_regclass('public.play_sessions') as diary,
  to_regprocedure('public.my_achievements()') as achievements_function,
  to_regprocedure('public.achievement_metrics(uuid)') as metrics_function;

select p.oid::regprocedure as function_name,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='my_achievements';

notify pgrst, 'reload schema';
