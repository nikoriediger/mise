-- Family notes: tips and tweaks that family members add below a recipe.
-- Everyone who can read the recipe can read and add notes. Authors can edit
-- their own notes; authors, the recipe's owner and family admins can delete them.

create table public.recipe_notes (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recipe_notes_recipe_id_idx on public.recipe_notes (recipe_id, created_at);

create trigger recipe_notes_set_updated_at
  before update on public.recipe_notes
  for each row execute function public.set_updated_at();

alter table public.recipe_notes enable row level security;

create policy "members can read notes" on public.recipe_notes
  for select to authenticated using (public.can_access_recipe(recipe_id));
create policy "members can add notes" on public.recipe_notes
  for insert to authenticated
  with check (author_id = (select auth.uid()) and public.can_access_recipe(recipe_id));
create policy "authors can edit their notes" on public.recipe_notes
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()) and public.can_access_recipe(recipe_id));
create policy "authors, recipe owners and admins can delete notes" on public.recipe_notes
  for delete to authenticated
  using (
    author_id = (select auth.uid())
    or public.can_edit_recipe(recipe_id)
    or public.is_family_admin((select r.family_id from public.recipes r where r.id = recipe_id))
  );

grant select, insert, delete on public.recipe_notes to authenticated;
grant update (body) on public.recipe_notes to authenticated;
