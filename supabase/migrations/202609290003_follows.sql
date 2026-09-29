begin;
create table public.follows (
 follower_id uuid not null references auth.users(id) on delete cascade,
 following_id uuid not null references public.profiles(user_id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(follower_id,following_id),
 check(follower_id <> following_id)
);
create index follows_target on public.follows(following_id);
alter table public.follows enable row level security;
revoke all on public.follows from anon,authenticated;
grant select on public.follows to anon,authenticated;
grant insert,delete on public.follows to authenticated;
create policy follows_read on public.follows for select using(true);
create policy follows_insert on public.follows for insert to authenticated with check((select auth.uid())=follower_id);
create policy follows_delete on public.follows for delete to authenticated using((select auth.uid())=follower_id);

-- Read current public content, so unpublishing immediately removes it from feeds.
-- No private library entries, copied review bodies or client-supplied viewer IDs.
create function public.following_feed(page_offset integer default 0)
returns table(kind text,event_id text,occurred_at timestamptz,payload jsonb)
language sql stable security invoker set search_path = '' as $$
 select * from (
  select 'review'::text kind,r.user_id::text||':'||r.game_id::text event_id,r.updated_at occurred_at,
   to_jsonb(r)||jsonb_build_object('profiles',to_jsonb(p)) payload
  from public.public_reviews r join public.profiles p on p.user_id=r.user_id
  join public.follows f on f.following_id=r.user_id and f.follower_id=(select auth.uid())
  union all
  select 'list'::text,l.id::text,l.created_at,
   jsonb_build_object('id',l.id,'title',l.title,'description',l.description,'profiles',to_jsonb(p))
  from public.game_lists l join public.profiles p on p.user_id=l.user_id
  join public.follows f on f.following_id=l.user_id and f.follower_id=(select auth.uid())
  where l.is_public
 ) events order by occurred_at desc,kind,event_id
 limit 21 offset greatest(0,least(coalesce(page_offset,0),100000));
$$;
revoke all on function public.following_feed(integer) from public,anon;
grant execute on function public.following_feed(integer) to authenticated;
commit;
