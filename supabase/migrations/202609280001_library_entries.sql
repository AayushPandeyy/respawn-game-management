begin;
create table if not exists public.library_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id bigint not null check (game_id > 0 and game_id <= 9007199254740991),
  game jsonb not null check (jsonb_typeof(game) = 'object' and game ? 'id' and game ? 'name' and jsonb_typeof(game->'id') = 'number' and jsonb_typeof(game->'name') = 'string' and game->>'id' = game_id::text and length(game->>'name') between 1 and 250),
  status text not null check (status in ('wishlist','playing','completed')),
  rating smallint not null default 0 check (rating between 0 and 5),
  review text not null default '' check (length(review) <= 3000),
  updated_at timestamptz not null default now(),
  primary key (user_id,game_id)
);
create index if not exists library_entries_recent on public.library_entries(user_id,updated_at desc);
alter table public.library_entries enable row level security;
revoke all on public.library_entries from anon, authenticated;
grant select,insert,update,delete on public.library_entries to authenticated;
drop policy if exists library_select_own on public.library_entries;
create policy library_select_own on public.library_entries for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists library_insert_own on public.library_entries;
create policy library_insert_own on public.library_entries for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists library_update_own on public.library_entries;
create policy library_update_own on public.library_entries for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists library_delete_own on public.library_entries;
create policy library_delete_own on public.library_entries for delete to authenticated using ((select auth.uid()) = user_id);
create or replace function public.set_library_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists library_updated_at on public.library_entries;
create trigger library_updated_at before update on public.library_entries for each row execute function public.set_library_updated_at();
commit;

