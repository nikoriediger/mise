-- Core schema: cookbooks, members, invites, recipes, recipe images, storage.
--
-- Every recipe belongs to a cookbook. Users see the recipes of every cookbook
-- they are a member of. Sign-up behaviour is controlled by app_config:
--   'open'   -> anyone can sign up and gets a personal cookbook
--   'invite' -> sign-up needs a valid invite token (the very first user is
--               always allowed and becomes owner of the first cookbook)
-- An invite token always joins the invited cookbook, in both modes.

-- ---------------------------------------------------------------------------
-- App config (single row)
-- ---------------------------------------------------------------------------
create table public.app_config (
  id boolean primary key default true check (id),
  signup_mode text not null default 'open' check (signup_mode in ('open', 'invite'))
);
insert into public.app_config default values;
alter table public.app_config enable row level security;

-- ---------------------------------------------------------------------------
-- Cookbooks & membership
-- ---------------------------------------------------------------------------
create table public.cookbooks (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now()
);

create table public.cookbook_members (
  cookbook_id uuid not null references public.cookbooks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  display_name text,
  joined_at timestamptz not null default now(),
  primary key (cookbook_id, user_id)
);
create index cookbook_members_user_id_idx on public.cookbook_members (user_id);

-- Reports 'open' while no cookbook exists yet, so the first user can sign up.
create function public.get_signup_mode()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when exists (select 1 from public.cookbooks) then signup_mode else 'open' end
  from public.app_config where id;
$$;
grant execute on function public.get_signup_mode() to anon, authenticated;

create function public.is_cookbook_member(p_cookbook_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cookbook_members
    where cookbook_id = p_cookbook_id and user_id = (select auth.uid())
  );
$$;

create function public.is_cookbook_owner(p_cookbook_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cookbook_members
    where cookbook_id = p_cookbook_id and user_id = (select auth.uid()) and role = 'owner'
  );
$$;

alter table public.cookbooks enable row level security;
create policy "members can read their cookbooks" on public.cookbooks
  for select to authenticated using (public.is_cookbook_member(id));
create policy "owners can rename their cookbooks" on public.cookbooks
  for update to authenticated using (public.is_cookbook_owner(id));

alter table public.cookbook_members enable row level security;
create policy "members can see fellow members" on public.cookbook_members
  for select to authenticated using (public.is_cookbook_member(cookbook_id));
create policy "owners can remove members" on public.cookbook_members
  for delete to authenticated
  using (public.is_cookbook_owner(cookbook_id) and user_id <> (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Invites
-- ---------------------------------------------------------------------------
create table public.invites (
  token uuid primary key default gen_random_uuid(),
  cookbook_id uuid not null references public.cookbooks (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz
);

alter table public.invites enable row level security;
create policy "owners can see invites" on public.invites
  for select to authenticated using (public.is_cookbook_owner(cookbook_id));
create policy "owners can create invites" on public.invites
  for insert to authenticated
  with check (public.is_cookbook_owner(cookbook_id) and created_by = (select auth.uid()));
create policy "owners can delete invites" on public.invites
  for delete to authenticated using (public.is_cookbook_owner(cookbook_id));

-- Lets the sign-up page show "You've been invited to <cookbook>" before an
-- account exists. Only reveals the cookbook name for a valid, unused token.
create function public.get_invite(p_token uuid)
returns table (cookbook_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.name
  from public.invites i
  join public.cookbooks c on c.id = i.cookbook_id
  where i.token = p_token and i.accepted_at is null and i.expires_at > now();
$$;
grant execute on function public.get_invite(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- New user handling (runs inside the sign-up request; raising aborts it)
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token uuid;
  v_invite public.invites;
  v_cookbook_id uuid;
  v_name text := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');
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

    insert into public.cookbook_members (cookbook_id, user_id, role, display_name)
    values (v_invite.cookbook_id, new.id, 'member', v_name);
    update public.invites set accepted_by = new.id, accepted_at = now()
    where token = v_token;

  elsif (select signup_mode from public.app_config where id) = 'open'
     or not exists (select 1 from public.cookbooks) then
    insert into public.cookbooks (name)
    values (coalesce(nullif(trim(new.raw_user_meta_data ->> 'cookbook_name'), ''), 'My recipes'))
    returning id into v_cookbook_id;

    insert into public.cookbook_members (cookbook_id, user_id, role, display_name)
    values (v_cookbook_id, new.id, 'owner', v_name);

  else
    raise exception 'signup_disabled';
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Recipes
-- ---------------------------------------------------------------------------
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  cookbook_id uuid not null references public.cookbooks (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  servings integer check (servings > 0),
  prep_minutes integer check (prep_minutes >= 0),
  cook_minutes integer check (cook_minutes >= 0),
  ingredients text[] not null default '{}',
  steps text[] not null default '{}',
  notes text,
  category text,
  tags text[] not null default '{}',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recipes_cookbook_id_idx on public.recipes (cookbook_id);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger recipes_set_updated_at
  before update on public.recipes
  for each row execute function public.set_updated_at();

alter table public.recipes enable row level security;
create policy "members can read recipes" on public.recipes
  for select to authenticated using (public.is_cookbook_member(cookbook_id));
create policy "members can add recipes" on public.recipes
  for insert to authenticated with check (public.is_cookbook_member(cookbook_id));
create policy "members can edit recipes" on public.recipes
  for update to authenticated
  using (public.is_cookbook_member(cookbook_id))
  with check (public.is_cookbook_member(cookbook_id));
create policy "members can delete recipes" on public.recipes
  for delete to authenticated using (public.is_cookbook_member(cookbook_id));

-- ---------------------------------------------------------------------------
-- Recipe images
--   role 'gallery' = photos of the dish
--   role 'source'  = scans of the original recipe (card, cookbook page)
-- ---------------------------------------------------------------------------
create table public.recipe_images (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  cookbook_id uuid not null references public.cookbooks (id) on delete cascade,
  storage_path text not null unique,
  role text not null default 'gallery' check (role in ('gallery', 'source')),
  sort_order integer not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);
create index recipe_images_recipe_id_idx on public.recipe_images (recipe_id);

alter table public.recipe_images enable row level security;
create policy "members can read images" on public.recipe_images
  for select to authenticated using (public.is_cookbook_member(cookbook_id));
create policy "members can add images" on public.recipe_images
  for insert to authenticated with check (
    public.is_cookbook_member(cookbook_id)
    and exists (select 1 from public.recipes r where r.id = recipe_id and r.cookbook_id = recipe_images.cookbook_id)
  );
create policy "members can edit images" on public.recipe_images
  for update to authenticated
  using (public.is_cookbook_member(cookbook_id))
  with check (public.is_cookbook_member(cookbook_id));
create policy "members can delete images" on public.recipe_images
  for delete to authenticated using (public.is_cookbook_member(cookbook_id));

-- ---------------------------------------------------------------------------
-- Storage: private bucket, files stored under <cookbook_id>/<recipe_id>/...
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-images', 'recipe-images', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

create function public.storage_cookbook_id(p_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return (string_to_array(p_name, '/'))[1]::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

create policy "members can read recipe files" on storage.objects
  for select to authenticated
  using (bucket_id = 'recipe-images' and public.is_cookbook_member(public.storage_cookbook_id(name)));
create policy "members can upload recipe files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'recipe-images' and public.is_cookbook_member(public.storage_cookbook_id(name)));
create policy "members can delete recipe files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'recipe-images' and public.is_cookbook_member(public.storage_cookbook_id(name)));

-- ---------------------------------------------------------------------------
-- Explicit API grants (newer Supabase projects don't expose tables by default)
-- ---------------------------------------------------------------------------
grant select, update on public.cookbooks to authenticated;
grant select, delete on public.cookbook_members to authenticated;
grant select, insert, delete on public.invites to authenticated;
grant select, insert, update, delete on public.recipes to authenticated;
grant select, insert, update, delete on public.recipe_images to authenticated;
