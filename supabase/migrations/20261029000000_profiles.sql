-- Profiles: one per person (across families) with name, short bio, photo and
-- notification settings. Visible to the person and to everyone they share a
-- family with. The display name is mirrored into family_members.

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 60),
  bio text not null default '' check (char_length(bio) <= 200),
  avatar_path text,
  notify_notes boolean not null default false,
  notify_new_recipes boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Existing members: take the name from their (first) family membership
insert into public.profiles (user_id, display_name)
select distinct on (user_id) user_id, nullif(trim(display_name), '')
from public.family_members
order by user_id, joined_at;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create function public.shares_family_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.family_members me
    join public.family_members other on other.family_id = me.family_id
    where me.user_id = (select auth.uid()) and other.user_id = p_user_id
  );
$$;

alter table public.profiles enable row level security;
create policy "profiles are visible to their family" on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()) or public.shares_family_with(user_id));
create policy "people can create their own profile" on public.profiles
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "people can edit their own profile" on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select on public.profiles to authenticated;
grant insert (user_id, display_name, bio, avatar_path, notify_notes, notify_new_recipes) on public.profiles to authenticated;
grant update (display_name, bio, avatar_path, notify_notes, notify_new_recipes) on public.profiles to authenticated;

-- Keep the name shown in family lists in sync
create function public.sync_profile_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.display_name is distinct from old.display_name then
    update public.family_members set display_name = new.display_name where user_id = new.user_id;
  end if;
  return new;
end;
$$;

create trigger profiles_sync_name
  after update on public.profiles
  for each row execute function public.sync_profile_name();

-- ---------------------------------------------------------------------------
-- Profile photos: private bucket, files under <user_id>/...
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']);

create policy "family can see profile photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (
      public.storage_path_uuid(name, 1) = (select auth.uid())
      or public.shares_family_with(public.storage_path_uuid(name, 1))
    )
  );
create policy "people can upload their own profile photo" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and public.storage_path_uuid(name, 1) = (select auth.uid()));
create policy "people can delete their own profile photo" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and public.storage_path_uuid(name, 1) = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- New users also get a profile
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token uuid;
  v_invite public.invites;
  v_family_id uuid;
  v_name text := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');
  v_cookbook_name text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'cookbook_name'), ''), v_name, 'Recipes');
begin
  begin
    v_token := nullif(new.raw_user_meta_data ->> 'invite_token', '')::uuid;
  exception when invalid_text_representation then
    raise exception 'invalid_invite';
  end;

  if v_token is not null then
    select * into v_invite from public.invites
    where token = v_token and accepted_at is null and expires_at > now()
    for update;
    if not found then
      raise exception 'invalid_invite';
    end if;

    v_family_id := v_invite.family_id;
    insert into public.family_members (family_id, user_id, role, display_name)
    values (v_family_id, new.id, 'member', v_name);
    update public.invites set accepted_by = new.id, accepted_at = now()
    where token = v_token;

  elsif (select signup_mode from public.app_config where id) = 'open'
     or not exists (select 1 from public.families) then
    insert into public.families (name)
    values (coalesce(nullif(trim(new.raw_user_meta_data ->> 'family_name'), ''), 'My family'))
    returning id into v_family_id;

    insert into public.family_members (family_id, user_id, role, display_name)
    values (v_family_id, new.id, 'owner', v_name);

  else
    raise exception 'signup_disabled';
  end if;

  insert into public.cookbooks (family_id, owner_id, name, is_default)
  values (v_family_id, new.id, v_cookbook_name, true);

  insert into public.profiles (user_id, display_name)
  values (new.id, v_name)
  on conflict (user_id) do nothing;

  return new;
end;
$$;
