begin;
create table public.review_likes (
 user_id uuid not null references auth.users(id) on delete cascade,
 review_user_id uuid not null,
 game_id bigint not null,
 primary key(user_id,review_user_id,game_id),
 foreign key(review_user_id,game_id) references public.public_reviews(user_id,game_id) on delete cascade
);
create index review_likes_target on public.review_likes(review_user_id,game_id);
create table public.review_comments (
 id uuid primary key,
 user_id uuid not null references public.profiles(user_id) on delete cascade,
 review_user_id uuid not null,
 game_id bigint not null,
 body text not null check(length(trim(body)) between 1 and 2000),
 spoiler boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(review_user_id,game_id) references public.public_reviews(user_id,game_id) on delete cascade
);
create index review_comments_target on public.review_comments(review_user_id,game_id,created_at,id);
create table public.review_notifications (
 id uuid primary key default gen_random_uuid(),
 recipient_id uuid not null references auth.users(id) on delete cascade,
 comment_id uuid not null unique references public.review_comments(id) on delete cascade,
 is_read boolean not null default false,
 created_at timestamptz not null default now()
);
create index notifications_inbox on public.review_notifications(recipient_id,created_at desc);
alter table public.review_likes enable row level security;
alter table public.review_comments enable row level security;
alter table public.review_notifications enable row level security;
revoke all on public.review_likes,public.review_comments,public.review_notifications from anon,authenticated;
grant select on public.review_likes,public.review_comments to anon,authenticated;
grant insert,delete on public.review_likes to authenticated;
grant insert(id,user_id,review_user_id,game_id,body,spoiler),delete on public.review_comments to authenticated;
grant update(body,spoiler) on public.review_comments to authenticated;
grant select on public.review_notifications to authenticated;
grant update(is_read) on public.review_notifications to authenticated;
create policy likes_read on public.review_likes for select using(true);
create policy likes_insert on public.review_likes for insert to authenticated with check(user_id=(select auth.uid()));
create policy likes_delete on public.review_likes for delete to authenticated using(user_id=(select auth.uid()));
create policy comments_read on public.review_comments for select using(true);
create policy comments_insert on public.review_comments for insert to authenticated with check(user_id=(select auth.uid()));
create policy comments_update on public.review_comments for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy comments_delete on public.review_comments for delete to authenticated using(user_id=(select auth.uid()));
create policy notifications_read on public.review_notifications for select to authenticated using(recipient_id=(select auth.uid()));
create policy notifications_update on public.review_notifications for update to authenticated using(recipient_id=(select auth.uid())) with check(recipient_id=(select auth.uid()));
create trigger comment_timestamp before update on public.review_comments for each row execute function public.set_library_updated_at();
create function public.notify_review_comment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.user_id<>new.review_user_id then
  insert into public.review_notifications(recipient_id,comment_id) values(new.review_user_id,new.id);
 end if;
 return new;
end;
$$;
revoke all on function public.notify_review_comment() from public,anon,authenticated;
create trigger comment_notification after insert on public.review_comments for each row execute function public.notify_review_comment();
create function public.review_engagement(targets jsonb)
returns table(review_user_id uuid,game_id bigint,likes bigint,comments bigint,liked boolean)
language sql stable security invoker set search_path='' as $$
 select r.user_id,r.game_id,
 (select count(*) from public.review_likes l where l.review_user_id=r.user_id and l.game_id=r.game_id),
 (select count(*) from public.review_comments c where c.review_user_id=r.user_id and c.game_id=r.game_id),
 exists(select 1 from public.review_likes l where l.review_user_id=r.user_id and l.game_id=r.game_id and l.user_id=(select auth.uid()))
 from public.public_reviews r join (
 select distinct (v->>'user_id')::uuid user_id,(v->>'game_id')::bigint game_id
 from jsonb_array_elements(targets) with ordinality as t(v,n) where n<=100
 ) requested on requested.user_id=r.user_id and requested.game_id=r.game_id;
$$;
revoke all on function public.review_engagement(jsonb) from public;
grant execute on function public.review_engagement(jsonb) to anon,authenticated;
commit;
