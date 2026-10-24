-- Recipes belong to a person; cookbooks are collections.
--
-- * Every recipe has an owner (and lives in the owner's family). Only the
--   owner can edit it, wherever it appears.
-- * Every member has exactly one MAIN cookbook (is_default). It automatically
--   shows all of the owner's recipes, without link rows.
-- * Other cookbooks are collections: they link to any recipes of the family
--   (own ones or other members'), via cookbook_recipes. Removing a link never
--   deletes the recipe.

-- ---------------------------------------------------------------------------
-- 1. Recipes get an owner and a family
-- ---------------------------------------------------------------------------
alter table public.recipes add column owner_id uuid references auth.users (id) on delete cascade;
alter table public.recipes add column family_id uuid references public.families (id) on delete cascade;

update public.recipes r
set owner_id = c.owner_id, family_id = c.family_id
from public.cookbooks c
where c.id = r.cookbook_id;

alter table public.recipes alter column owner_id set not null;
alter table public.recipes alter column family_id set not null;
create index recipes_owner_id_idx on public.recipes (owner_id);
create index recipes_family_id_idx on public.recipes (family_id);

-- ---------------------------------------------------------------------------
-- 2. Main cookbooks: the oldest cookbook of each person in a family
-- ---------------------------------------------------------------------------
alter table public.cookbooks add column is_default boolean not null default false;

update public.cookbooks set is_default = true
where id in (
  select distinct on (family_id, owner_id) id
  from public.cookbooks
  order by family_id, owner_id, created_at
);

create unique index cookbooks_one_default_per_person
  on public.cookbooks (family_id, owner_id) where is_default;

-- ---------------------------------------------------------------------------
-- 3. Collections: cookbook <-> recipe links
-- ---------------------------------------------------------------------------
create table public.cookbook_recipes (
  cookbook_id uuid not null references public.cookbooks (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  added_by uuid references auth.users (id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (cookbook_id, recipe_id)
);
create index cookbook_recipes_recipe_id_idx on public.cookbook_recipes (recipe_id);

-- Recipes that were filed in a non-main cookbook stay there as a link
insert into public.cookbook_recipes (cookbook_id, recipe_id, added_by)
select r.cookbook_id, r.id, r.owner_id
from public.recipes r
join public.cookbooks c on c.id = r.cookbook_id
where not c.is_default;

-- ---------------------------------------------------------------------------
-- 4. Policies that depend on recipes.cookbook_id
-- ---------------------------------------------------------------------------
drop policy "members can read recipes" on public.recipes;
drop policy "owners can add recipes" on public.recipes;
drop policy "owners can edit recipes" on public.recipes;
drop policy "owners can delete recipes" on public.recipes;
drop policy "owners can add images" on public.recipe_images;
drop policy "owners can delete their empty cookbooks" on public.cookbooks;

alter table public.recipes drop column cookbook_id;

create or replace function public.can_access_recipe(p_recipe_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.recipes r
    where r.id = p_recipe_id and public.is_family_member(r.family_id)
  );
$$;

create or replace function public.can_edit_recipe(p_recipe_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.recipes r
    where r.id = p_recipe_id and r.owner_id = (select auth.uid()) and public.is_family_member(r.family_id)
  );
$$;

create policy "members can read family recipes" on public.recipes
  for select to authenticated using (public.is_family_member(family_id));
create policy "members can add their own recipes" on public.recipes
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.is_family_member(family_id));
create policy "owners can edit their recipes" on public.recipes
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and public.is_family_member(family_id));
create policy "owners can delete their recipes" on public.recipes
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "owners can add images" on public.recipe_images
  for insert to authenticated
  with check (
    public.can_edit_recipe(recipe_id)
    and family_id = (select r.family_id from public.recipes r where r.id = recipe_id)
  );

-- Collections can be deleted with their links (recipes stay); main cookbooks can't.
create policy "owners can delete their collections" on public.cookbooks
  for delete to authenticated using (owner_id = (select auth.uid()) and not is_default);

-- Clients may only set these columns; is_default is managed by the database.
revoke insert, update on public.cookbooks from authenticated;
grant insert (family_id, owner_id, name, emoji) on public.cookbooks to authenticated;
grant update (name, emoji) on public.cookbooks to authenticated;

alter table public.cookbook_recipes enable row level security;
create policy "members can read collection links" on public.cookbook_recipes
  for select to authenticated using (public.can_read_cookbook(cookbook_id));
create policy "owners can add recipes of their family to collections" on public.cookbook_recipes
  for insert to authenticated
  with check (
    added_by = (select auth.uid())
    and public.can_edit_cookbook(cookbook_id)
    and not exists (select 1 from public.cookbooks c where c.id = cookbook_id and c.is_default)
    and exists (
      select 1 from public.recipes r
      where r.id = recipe_id and r.family_id = public.cookbook_family_id(cookbook_id)
    )
  );
create policy "owners can remove recipes from collections" on public.cookbook_recipes
  for delete to authenticated using (public.can_edit_cookbook(cookbook_id));

grant select, insert, delete on public.cookbook_recipes to authenticated;

-- ---------------------------------------------------------------------------
-- 5. New users get a main cookbook
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

  return new;
end;
$$;
