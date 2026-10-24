-- Families and personal cookbooks.
--
-- Before: one "cookbook" = a group of members sharing all recipes.
-- After:  a FAMILY is the group (members, invites). Inside a family every
--         member owns one or more COOKBOOKS. All members can read every
--         cookbook of their family, but only the owner can change it.
--
-- Existing data is migrated: the old cookbooks become families, every member
-- gets a personal cookbook, and recipes move into their author's cookbook.
-- Storage paths stay <family_id>/<recipe_id>/<file>.

-- ---------------------------------------------------------------------------
-- 1. Drop policies and helpers that reference the old structure
-- ---------------------------------------------------------------------------
drop policy "members can read their cookbooks" on public.cookbooks;
drop policy "owners can rename their cookbooks" on public.cookbooks;
drop policy "members can see fellow members" on public.cookbook_members;
drop policy "owners can remove members" on public.cookbook_members;
drop policy "owners can see invites" on public.invites;
drop policy "owners can create invites" on public.invites;
drop policy "owners can delete invites" on public.invites;
drop policy "members can read recipes" on public.recipes;
drop policy "members can add recipes" on public.recipes;
drop policy "members can edit recipes" on public.recipes;
drop policy "members can delete recipes" on public.recipes;
drop policy "members can read images" on public.recipe_images;
drop policy "members can add images" on public.recipe_images;
drop policy "members can edit images" on public.recipe_images;
drop policy "members can delete images" on public.recipe_images;
drop policy "members can read recipe files" on storage.objects;
drop policy "members can upload recipe files" on storage.objects;
drop policy "members can delete recipe files" on storage.objects;

drop function public.is_cookbook_member(uuid);
drop function public.is_cookbook_owner(uuid);
drop function public.storage_cookbook_id(text);

-- ---------------------------------------------------------------------------
-- 2. cookbooks -> families, cookbook_members -> family_members
-- ---------------------------------------------------------------------------
alter table public.cookbooks rename to families;
alter index public.cookbooks_pkey rename to families_pkey;
alter table public.cookbook_members rename to family_members;
alter index public.cookbook_members_pkey rename to family_members_pkey;
alter table public.family_members rename column cookbook_id to family_id;
alter index public.cookbook_members_user_id_idx rename to family_members_user_id_idx;
alter table public.invites rename column cookbook_id to family_id;
alter table public.recipe_images rename column cookbook_id to family_id;

-- ---------------------------------------------------------------------------
-- 3. New cookbooks table
-- ---------------------------------------------------------------------------
create table public.cookbooks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  emoji text not null default '📗' check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now()
);
create index cookbooks_family_id_idx on public.cookbooks (family_id);
create index cookbooks_owner_id_idx on public.cookbooks (owner_id);

-- One personal cookbook per existing member
insert into public.cookbooks (family_id, owner_id, name)
select fm.family_id, fm.user_id, coalesce(nullif(trim(fm.display_name), ''), 'Recipes')
from public.family_members fm;

-- ---------------------------------------------------------------------------
-- 4. Recipes now belong to a cookbook (not directly to a family)
-- ---------------------------------------------------------------------------
alter table public.recipes drop constraint recipes_cookbook_id_fkey;
alter table public.recipes rename column cookbook_id to legacy_family_id;
alter table public.recipes add column cookbook_id uuid;

-- The author's cookbook in that family ...
update public.recipes r
set cookbook_id = c.id
from public.cookbooks c
where c.family_id = r.legacy_family_id and c.owner_id = r.created_by;

-- ... otherwise the cookbook of a family owner, otherwise any cookbook of the family
update public.recipes r
set cookbook_id = (
  select c.id
  from public.cookbooks c
  left join public.family_members fm on fm.family_id = c.family_id and fm.user_id = c.owner_id
  where c.family_id = r.legacy_family_id
  order by (fm.role = 'owner') desc, c.created_at
  limit 1
)
where r.cookbook_id is null;

-- Recipes of a family without any member can't be assigned; they were unreachable anyway.
delete from public.recipes where cookbook_id is null;

alter table public.recipes alter column cookbook_id set not null;
alter table public.recipes
  add constraint recipes_cookbook_id_fkey foreign key (cookbook_id) references public.cookbooks (id) on delete cascade;
alter table public.recipes drop column legacy_family_id;
create index recipes_cookbook_id_idx on public.recipes (cookbook_id);

-- ---------------------------------------------------------------------------
-- 5. Access helpers
-- ---------------------------------------------------------------------------
create function public.is_family_member(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.family_members
    where family_id = p_family_id and user_id = (select auth.uid())
  );
$$;

create function public.is_family_admin(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.family_members
    where family_id = p_family_id and user_id = (select auth.uid()) and role = 'owner'
  );
$$;

create function public.can_read_cookbook(p_cookbook_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cookbooks c
    join public.family_members fm on fm.family_id = c.family_id
    where c.id = p_cookbook_id and fm.user_id = (select auth.uid())
  );
$$;

create function public.can_edit_cookbook(p_cookbook_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cookbooks c
    join public.family_members fm on fm.family_id = c.family_id and fm.user_id = c.owner_id
    where c.id = p_cookbook_id and c.owner_id = (select auth.uid())
  );
$$;

-- Read access to a recipe (also used by features attached to recipes, e.g. notes)
create function public.can_access_recipe(p_recipe_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.recipes r
    where r.id = p_recipe_id and public.can_read_cookbook(r.cookbook_id)
  );
$$;

create function public.can_edit_recipe(p_recipe_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.recipes r
    where r.id = p_recipe_id and public.can_edit_cookbook(r.cookbook_id)
  );
$$;

-- The family a cookbook belongs to (used to keep image rows consistent)
create function public.cookbook_family_id(p_cookbook_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select family_id from public.cookbooks where id = p_cookbook_id;
$$;

-- n-th segment of a storage path as uuid (null if it isn't one)
create function public.storage_path_uuid(p_name text, p_index integer)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return (string_to_array(p_name, '/'))[p_index]::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Policies
-- ---------------------------------------------------------------------------
create policy "members can read their families" on public.families
  for select to authenticated using (public.is_family_member(id));
create policy "admins can rename their families" on public.families
  for update to authenticated using (public.is_family_admin(id));

create policy "members can see fellow members" on public.family_members
  for select to authenticated using (public.is_family_member(family_id));
create policy "admins can remove members" on public.family_members
  for delete to authenticated
  using (public.is_family_admin(family_id) and user_id <> (select auth.uid()));

create policy "admins can see invites" on public.invites
  for select to authenticated using (public.is_family_admin(family_id));
create policy "admins can create invites" on public.invites
  for insert to authenticated
  with check (public.is_family_admin(family_id) and created_by = (select auth.uid()));
create policy "admins can delete invites" on public.invites
  for delete to authenticated using (public.is_family_admin(family_id));

alter table public.cookbooks enable row level security;
create policy "members can read family cookbooks" on public.cookbooks
  for select to authenticated using (public.is_family_member(family_id));
create policy "members can create their own cookbooks" on public.cookbooks
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.is_family_member(family_id));
create policy "owners can edit their cookbooks" on public.cookbooks
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and public.is_family_member(family_id));
create policy "owners can delete their empty cookbooks" on public.cookbooks
  for delete to authenticated
  using (
    owner_id = (select auth.uid())
    and not exists (select 1 from public.recipes r where r.cookbook_id = cookbooks.id)
  );

create policy "members can read recipes" on public.recipes
  for select to authenticated using (public.can_read_cookbook(cookbook_id));
create policy "owners can add recipes" on public.recipes
  for insert to authenticated with check (public.can_edit_cookbook(cookbook_id));
create policy "owners can edit recipes" on public.recipes
  for update to authenticated
  using (public.can_edit_cookbook(cookbook_id))
  with check (public.can_edit_cookbook(cookbook_id));
create policy "owners can delete recipes" on public.recipes
  for delete to authenticated using (public.can_edit_cookbook(cookbook_id));

create policy "members can read images" on public.recipe_images
  for select to authenticated using (public.is_family_member(family_id));
create policy "owners can add images" on public.recipe_images
  for insert to authenticated
  with check (
    public.can_edit_recipe(recipe_id)
    and family_id = (select public.cookbook_family_id(r.cookbook_id) from public.recipes r where r.id = recipe_id)
  );
create policy "owners can edit images" on public.recipe_images
  for update to authenticated
  using (public.can_edit_recipe(recipe_id))
  with check (public.can_edit_recipe(recipe_id));
create policy "owners can delete images" on public.recipe_images
  for delete to authenticated using (public.can_edit_recipe(recipe_id));

-- Storage: <family_id>/<recipe_id>/<file>. Uploads happen before a new recipe
-- row exists, so uploading only requires family membership. Deleting requires
-- edit rights on the recipe, or that the recipe doesn't exist (orphaned files).
create policy "members can read recipe files" on storage.objects
  for select to authenticated
  using (bucket_id = 'recipe-images' and public.is_family_member(public.storage_path_uuid(name, 1)));
create policy "members can upload recipe files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'recipe-images' and public.is_family_member(public.storage_path_uuid(name, 1)));
create policy "owners can delete recipe files" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'recipe-images'
    and public.is_family_member(public.storage_path_uuid(name, 1))
    and (
      public.can_edit_recipe(public.storage_path_uuid(name, 2))
      or not exists (select 1 from public.recipes r where r.id = public.storage_path_uuid(name, 2))
    )
  );

grant select, insert, update, delete on public.cookbooks to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Sign-up, invites and signup mode on the new structure
-- ---------------------------------------------------------------------------
create or replace function public.get_signup_mode()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when exists (select 1 from public.families) then signup_mode else 'open' end
  from public.app_config where id;
$$;

drop function public.get_invite(uuid);
create function public.get_invite(p_token uuid)
returns table (family_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select f.name
  from public.invites i
  join public.families f on f.id = i.family_id
  where i.token = p_token and i.accepted_at is null and i.expires_at > now();
$$;
grant execute on function public.get_invite(uuid) to anon, authenticated;

-- New users: join the invited family (or create a family), and always get a
-- personal cookbook. Names come from the sign-up form (already localized).
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

  insert into public.cookbooks (family_id, owner_id, name)
  values (v_family_id, new.id, v_cookbook_name);

  return new;
end;
$$;
