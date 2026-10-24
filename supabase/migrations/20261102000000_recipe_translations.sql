-- Stored translations of a recipe's content into another UI language. They are
-- created on demand (by an optional translator) and are considered outdated
-- when the recipe changed after the translation (source_updated_at).
create table public.recipe_translations (
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  language text not null check (language in ('de', 'en', 'it')),
  title text not null,
  ingredients text[] not null default '{}',
  steps text[] not null default '{}',
  notes text not null default '',
  origin text not null default '',
  story text not null default '',
  source_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (recipe_id, language)
);

alter table public.recipe_translations enable row level security;
create policy "family can read translations" on public.recipe_translations
  for select to authenticated using (public.can_access_recipe(recipe_id));
create policy "family can store translations" on public.recipe_translations
  for insert to authenticated with check (public.can_access_recipe(recipe_id));
create policy "family can refresh translations" on public.recipe_translations
  for update to authenticated
  using (public.can_access_recipe(recipe_id))
  with check (public.can_access_recipe(recipe_id));
create policy "owners can delete translations" on public.recipe_translations
  for delete to authenticated using (public.can_edit_recipe(recipe_id));

grant select, insert, update, delete on public.recipe_translations to authenticated;
