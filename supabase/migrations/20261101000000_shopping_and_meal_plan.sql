-- Shopping lists (personal and one shared family list) and a personal meal plan.

-- ---------------------------------------------------------------------------
-- Shopping items. owner_id set = personal list, null = shared family list.
-- Quantities are stored separately so equal ingredients can be added up.
-- ---------------------------------------------------------------------------
create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  owner_id uuid references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  -- normalized name + unit, used to merge "200 g Mehl" and "300 g Mehl"
  merge_key text not null,
  amount numeric,
  unit text,
  sources text[] not null default '{}',
  checked boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index shopping_items_list_idx on public.shopping_items (family_id, owner_id, checked);

create function public.can_use_shopping_item(p_family_id uuid, p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_family_member(p_family_id)
    and (p_owner_id is null or p_owner_id = (select auth.uid()));
$$;

alter table public.shopping_items enable row level security;
create policy "members use their own and the family list" on public.shopping_items
  for all to authenticated
  using (public.can_use_shopping_item(family_id, owner_id))
  with check (public.can_use_shopping_item(family_id, owner_id));
grant select, insert, update, delete on public.shopping_items to authenticated;

-- ---------------------------------------------------------------------------
-- Meal plan: personal; recipes of one's families on days
-- ---------------------------------------------------------------------------
create table public.meal_plan (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  planned_on date not null,
  servings integer check (servings between 1 and 100),
  created_at timestamptz not null default now()
);
create index meal_plan_user_day_idx on public.meal_plan (user_id, planned_on);

alter table public.meal_plan enable row level security;
create policy "people manage their own meal plan" on public.meal_plan
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.can_access_recipe(recipe_id));
grant select, insert, update, delete on public.meal_plan to authenticated;
