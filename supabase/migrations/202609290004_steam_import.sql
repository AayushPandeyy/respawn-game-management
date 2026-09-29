begin;
alter table public.library_entries
 add column steam_app_id bigint check(steam_app_id>0),
 add column steam_playtime_minutes bigint check(steam_playtime_minutes>=0);
create unique index library_steam_unique on public.library_entries(user_id,steam_app_id) where steam_app_id is not null;
create function public.import_steam_games(entries jsonb)
returns table(game_id bigint)
language plpgsql security invoker set search_path='' as $$
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 if entries is null or jsonb_typeof(entries)<>'array' then raise exception 'Expected an array'; end if;
 if jsonb_array_length(entries)<1 or jsonb_array_length(entries)>20 then raise exception 'Choose 1 to 20 games'; end if;
 if exists(select 1 from jsonb_array_elements(entries) e where
  jsonb_typeof(e)<>'object' or not(e ?& array['game','status','steam_app_id','steam_playtime_minutes'])
  or jsonb_typeof(e->'steam_app_id')<>'number' or jsonb_typeof(e->'steam_playtime_minutes')<>'number'
  or jsonb_typeof(e->'game')<>'object' or jsonb_typeof(e->'status')<>'string') then raise exception 'Invalid import entry'; end if;
 return query
 insert into public.library_entries as target(user_id,game_id,game,status,rating,review,steam_app_id,steam_playtime_minutes)
 select (select auth.uid()),(e->'game'->>'id')::bigint,e->'game',e->>'status',0,'',(e->>'steam_app_id')::bigint,(e->>'steam_playtime_minutes')::bigint
 from jsonb_array_elements(entries) e
 on conflict do nothing returning target.game_id;
end;
$$;
revoke all on function public.import_steam_games(jsonb) from public,anon;
grant execute on function public.import_steam_games(jsonb) to authenticated;
commit;
