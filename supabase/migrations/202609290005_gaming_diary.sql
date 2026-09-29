begin;
create table public.play_sessions (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 game_id bigint not null check(game_id>0 and game_id<=9007199254740991),
 game_name text not null check(length(game_name) between 1 and 250),
 played_on date not null check(played_on between date '1970-01-01' and date '2100-12-31'),
 minutes integer not null check(minutes between 1 and 1440),
 notes text not null default '' check(length(notes)<=3000),
 completed boolean not null default false,
 replay boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index sessions_timeline on public.play_sessions(user_id,played_on desc,created_at desc,id);
create index sessions_game on public.play_sessions(user_id,game_id,played_on desc);
alter table public.play_sessions enable row level security;
revoke all on public.play_sessions from anon,authenticated;
grant select,insert,update,delete on public.play_sessions to authenticated;
create policy sessions_read on public.play_sessions for select to authenticated using((select auth.uid())=user_id);
create policy sessions_insert on public.play_sessions for insert to authenticated with check((select auth.uid())=user_id);
create policy sessions_update on public.play_sessions for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy sessions_delete on public.play_sessions for delete to authenticated using((select auth.uid())=user_id);
create trigger session_timestamp before update on public.play_sessions for each row execute function public.set_library_updated_at();
create function public.diary_monthly(target_year integer)
returns table(month integer,minutes bigint,sessions bigint,completions bigint,replays bigint)
language sql stable security invoker set search_path='' as $$
 select extract(month from played_on)::integer,sum(minutes)::bigint,count(*),
  count(*) filter(where completed),count(*) filter(where replay)
 from public.play_sessions
 where user_id=(select auth.uid()) and played_on>=make_date(greatest(1970,least(2100,target_year)),1,1)
 and played_on<make_date(greatest(1970,least(2100,target_year))+1,1,1)
 group by 1 order by 1;
$$;
revoke all on function public.diary_monthly(integer) from public,anon;
grant execute on function public.diary_monthly(integer) to authenticated;
commit;
