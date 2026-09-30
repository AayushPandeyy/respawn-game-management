-- Run after migrations 001–006 in the Supabase SQL Editor.
-- Seeds 28 achievements. Existing activity is credited at migration time.
begin;
create table if not exists public.achievements (
 id text primary key,
 title text not null,
 description text not null,
 category text not null,
 metric text not null check(metric in ('library','completed','rated','reviews','lists','sessions','minutes')),
 target bigint not null check(target > 0),
 points integer not null check(points > 0),
 sort_order integer not null
);
create table if not exists public.user_achievements (
 user_id uuid not null references auth.users(id) on delete cascade,
 achievement_id text not null references public.achievements(id) on delete cascade,
 unlocked_at timestamptz not null default now(),
 primary key(user_id,achievement_id)
);
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
revoke all on public.achievements, public.user_achievements from anon, authenticated;
grant select on public.achievements, public.user_achievements to authenticated;
drop policy if exists achievements_read on public.achievements;
create policy achievements_read on public.achievements for select to authenticated using(true);
drop policy if exists achievements_own on public.user_achievements;
create policy achievements_own on public.user_achievements for select to authenticated using(user_id=(select auth.uid()));

insert into public.achievements(id,title,description,category,metric,target,points,sort_order) values
('library_1', 'First Save', 'Save 1 games to your library.', 'Collection', 'library', 1, 10, 0),
('library_10', 'Shelf Builder', 'Save 10 games to your library.', 'Collection', 'library', 10, 25, 1),
('library_25', 'Collector', 'Save 25 games to your library.', 'Collection', 'library', 25, 50, 2),
('library_50', 'The Archive', 'Save 50 games to your library.', 'Collection', 'library', 50, 100, 3),
('completed_1', 'Credits Roll', 'Complete 1 games.', 'Completion', 'completed', 1, 10, 4),
('completed_5', 'Five Finales', 'Complete 5 games.', 'Completion', 'completed', 5, 25, 5),
('completed_10', 'Finisher', 'Complete 10 games.', 'Completion', 'completed', 10, 50, 6),
('completed_25', 'Backlog Champion', 'Complete 25 games.', 'Completion', 'completed', 25, 100, 7),
('rated_1', 'First Verdict', 'Rate 1 games.', 'Ratings', 'rated', 1, 10, 8),
('rated_10', 'Opinionated', 'Rate 10 games.', 'Ratings', 'rated', 10, 25, 9),
('rated_25', 'Taste Maker', 'Rate 25 games.', 'Ratings', 'rated', 25, 50, 10),
('rated_50', 'Rating Authority', 'Rate 50 games.', 'Ratings', 'rated', 50, 100, 11),
('reviews_1', 'Your Voice', 'Publish 1 public game reviews.', 'Reviews', 'reviews', 1, 10, 12),
('reviews_5', 'Review Regular', 'Publish 5 public game reviews.', 'Reviews', 'reviews', 5, 25, 13),
('reviews_10', 'Critic', 'Publish 10 public game reviews.', 'Reviews', 'reviews', 10, 50, 14),
('reviews_25', 'Editorial Legend', 'Publish 25 public game reviews.', 'Reviews', 'reviews', 25, 100, 15),
('lists_1', 'First Collection', 'Create 1 custom lists.', 'Lists', 'lists', 1, 10, 16),
('lists_3', 'Curator', 'Create 3 custom lists.', 'Lists', 'lists', 3, 25, 17),
('lists_5', 'Shelf Designer', 'Create 5 custom lists.', 'Lists', 'lists', 5, 50, 18),
('lists_10', 'Collection Master', 'Create 10 custom lists.', 'Lists', 'lists', 10, 100, 19),
('sessions_1', 'Dear Diary', 'Log 1 play sessions.', 'Diary', 'sessions', 1, 10, 20),
('sessions_5', 'Habit Forming', 'Log 5 play sessions.', 'Diary', 'sessions', 5, 25, 21),
('sessions_20', 'Chronicler', 'Log 20 play sessions.', 'Diary', 'sessions', 20, 50, 22),
('sessions_50', 'Memory Keeper', 'Log 50 play sessions.', 'Diary', 'sessions', 50, 100, 23),
('minutes_60', 'One More Hour', 'Log 60 minutes in your gaming diary.', 'Playtime', 'minutes', 60, 10, 24),
('minutes_600', 'Ten Hour Journey', 'Log 600 minutes in your gaming diary.', 'Playtime', 'minutes', 600, 25, 25),
('minutes_3000', 'Fifty Hour Club', 'Log 3000 minutes in your gaming diary.', 'Playtime', 'minutes', 3000, 50, 26),
('minutes_6000', 'Hundred Hour Hero', 'Log 6000 minutes in your gaming diary.', 'Playtime', 'minutes', 6000, 100, 27)
on conflict(id) do update set title=excluded.title, description=excluded.description,
 category=excluded.category, metric=excluded.metric, target=excluded.target,
 points=excluded.points, sort_order=excluded.sort_order;

-- Internal helpers cannot be called by browser/API clients with arbitrary users.
create or replace function public.achievement_metrics(target_user uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'library', (select count(*) from public.library_entries where user_id=target_user),
 'completed', (select count(*) from public.library_entries where user_id=target_user and status='completed'),
 'rated', (select count(*) from public.library_entries where user_id=target_user and rating>0),
 'reviews', (select count(*) from public.public_reviews where user_id=target_user),
 'lists', (select count(*) from public.game_lists where user_id=target_user),
 'sessions', (select count(*) from public.play_sessions where user_id=target_user),
 'minutes', (select coalesce(sum(minutes),0) from public.play_sessions where user_id=target_user)
 );
$$;
revoke all on function public.achievement_metrics(uuid) from public, anon, authenticated;

create or replace function public.award_achievements(target_user uuid)
returns void language plpgsql security definer set search_path='' as $$
declare metrics jsonb;
begin
 metrics := public.achievement_metrics(target_user);
 insert into public.user_achievements(user_id,achievement_id)
 select target_user,a.id from public.achievements a
 where coalesce((metrics->>a.metric)::bigint,0)>=a.target
 on conflict(user_id,achievement_id) do nothing;
end;
$$;
revoke all on function public.award_achievements(uuid) from public, anon, authenticated;

create or replace function public.on_achievement_activity()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform public.award_achievements(new.user_id);
 return new;
end;
$$;
revoke all on function public.on_achievement_activity() from public, anon, authenticated;

drop trigger if exists achievement_activity on public.library_entries;
create trigger achievement_activity after insert or update on public.library_entries
for each row execute function public.on_achievement_activity();
drop trigger if exists achievement_activity on public.public_reviews;
create trigger achievement_activity after insert or update on public.public_reviews
for each row execute function public.on_achievement_activity();
drop trigger if exists achievement_activity on public.game_lists;
create trigger achievement_activity after insert or update on public.game_lists
for each row execute function public.on_achievement_activity();
drop trigger if exists achievement_activity on public.play_sessions;
create trigger achievement_activity after insert or update on public.play_sessions
for each row execute function public.on_achievement_activity();

-- Read-only progress endpoint: identity always comes from the authenticated session.
create or replace function public.my_achievements()
returns table(id text,title text,description text,category text,target bigint,
 points integer,progress bigint,unlocked_at timestamptz)
language sql stable security definer set search_path='' as $$
 with metrics as (select public.achievement_metrics(auth.uid()) as values)
 select a.id,a.title,a.description,a.category,a.target,a.points,
 least(a.target,case when u.achievement_id is not null then a.target
 else coalesce((m.values->>a.metric)::bigint,0) end),u.unlocked_at
 from public.achievements a cross join metrics m
 left join public.user_achievements u on u.achievement_id=a.id and u.user_id=auth.uid()
 where auth.uid() is not null
 order by a.sort_order;
$$;
revoke all on function public.my_achievements() from public, anon;
grant execute on function public.my_achievements() to authenticated;

-- Backfill once for all existing players; rerunning preserves original unlock dates.
do $$ declare player record; begin
 for player in select id from auth.users loop
   perform public.award_achievements(player.id);
 end loop;
end $$;
notify pgrst, 'reload schema';
commit;
