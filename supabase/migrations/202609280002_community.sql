begin;
create table public.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 username text unique not null check(username ~ '^[a-z0-9_]{3,24}$'),
 display_name text not null check(length(display_name) between 1 and 40),
 bio text not null default '' check(length(bio)<=500),
 color text not null default '#c3f66b' check(color in ('#c3f66b','#91bfff','#d5a3ff','#ffb58a'))
);
create table public.public_reviews (
 user_id uuid not null references public.profiles(user_id) on delete cascade,
 game_id bigint not null check(game_id>0),
 game_name text not null check(length(game_name) between 1 and 250),
 body text not null check(length(body) between 1 and 3000),
 rating smallint not null check(rating between 1 and 5),
 spoiler boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(user_id,game_id)
);
create table public.game_lists (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(title) between 1 and 100),
 description text not null default '' check(length(description)<=1000),
 is_public boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.list_items (
 list_id uuid not null references public.game_lists(id) on delete cascade,
 game_id bigint not null check(game_id>0),
 game_name text not null check(length(game_name) between 1 and 250),
 added_at timestamptz not null default now(),
 primary key(list_id,game_id)
);
create index on public.public_reviews(updated_at desc);
create index on public.public_reviews(game_id);
create index on public.game_lists(user_id);
alter table public.profiles enable row level security;
alter table public.public_reviews enable row level security;
alter table public.game_lists enable row level security;
alter table public.list_items enable row level security;
revoke all on public.profiles,public.public_reviews,public.game_lists,public.list_items from anon,authenticated;
grant select on public.profiles,public.public_reviews,public.game_lists,public.list_items to anon,authenticated;
grant insert,update,delete on public.profiles,public.public_reviews,public.game_lists,public.list_items to authenticated;
create policy profile_read on public.profiles for select using(true);
create policy profile_write on public.profiles for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy review_read on public.public_reviews for select using(true);
create policy review_write on public.public_reviews for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy list_read on public.game_lists for select using(is_public or (select auth.uid())=user_id);
create policy list_write on public.game_lists for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy item_read on public.list_items for select using(exists(select 1 from public.game_lists l where l.id=list_id and (l.is_public or l.user_id=(select auth.uid()))));
create policy item_write on public.list_items for all to authenticated using(exists(select 1 from public.game_lists l where l.id=list_id and l.user_id=(select auth.uid()))) with check(exists(select 1 from public.game_lists l where l.id=list_id and l.user_id=(select auth.uid())));
create trigger review_timestamp before update on public.public_reviews for each row execute function public.set_library_updated_at();
commit;
