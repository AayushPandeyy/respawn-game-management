begin;

-- Players may choose a username later. Every account still receives a public
-- player card immediately, using the display name from signup or Google.
alter table public.profiles alter column username drop not null;

create or replace function public.create_player_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_name text;
begin
  player_name := left(
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'name'), ''),
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(split_part(new.email, '@', 1)), ''),
      'Player'
    ),
    40
  );
  insert into public.profiles (user_id, username, display_name, bio, color)
  values (new.id, null, player_name, '', '#c3f66b')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_player_profile_on_signup on auth.users;
create trigger create_player_profile_on_signup
after insert on auth.users
for each row execute function public.create_player_profile();

-- Add player cards for accounts that existed before this migration.
insert into public.profiles (user_id, username, display_name, bio, color)
select
  u.id,
  null,
  left(coalesce(nullif(trim(u.raw_user_meta_data->>'name'), ''), nullif(trim(u.raw_user_meta_data->>'full_name'), ''), nullif(trim(split_part(u.email, '@', 1)), ''), 'Player'), 40),
  '',
  '#c3f66b'
from auth.users u
left join public.profiles p on p.user_id = u.id
where p.user_id is null;

commit;
