-- Favorites (personal), a recipe's origin & story (with memory photos), and a
-- cooking diary ("cooked today", with rating, comment and photo).

-- ---------------------------------------------------------------------------
-- Favorites: personal, only visible to their owner
-- ---------------------------------------------------------------------------
create table public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

alter table public.favorites enable row level security;
create policy "people see their own favorites" on public.favorites
  for select to authenticated using (user_id = (select auth.uid()));
create policy "people can favorite recipes they can read" on public.favorites
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_access_recipe(recipe_id));
create policy "people can remove their favorites" on public.favorites
  for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, delete on public.favorites to authenticated;

-- ---------------------------------------------------------------------------
-- Origin & story
-- ---------------------------------------------------------------------------
alter table public.recipes
  add column origin text check (char_length(origin) <= 200),
  add column story text check (char_length(story) <= 5000);

-- Memory photos are a third kind of recipe image
alter table public.recipe_images drop constraint recipe_images_role_check;
alter table public.recipe_images
  add constraint recipe_images_role_check check (role in ('gallery', 'source', 'memory'));

-- ---------------------------------------------------------------------------
-- Cooking diary: anyone who can read a recipe can log cooking it
-- ---------------------------------------------------------------------------
create table public.cook_log (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  cooked_on date not null default current_date,
  rating smallint check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 1000),
  photo_path text,
  created_at timestamptz not null default now()
);
create index cook_log_recipe_id_idx on public.cook_log (recipe_id, cooked_on desc);
create index cook_log_user_id_idx on public.cook_log (user_id, cooked_on desc);

alter table public.cook_log enable row level security;
create policy "family can read the cooking diary" on public.cook_log
  for select to authenticated using (public.can_access_recipe(recipe_id));
create policy "people can log their own cooking" on public.cook_log
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_access_recipe(recipe_id));
create policy "people can edit their own entries" on public.cook_log
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "people can delete their own entries" on public.cook_log
  for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, delete on public.cook_log to authenticated;
grant update (cooked_on, rating, comment, photo_path) on public.cook_log to authenticated;

-- Diary photos live in the recipe folder; their authors may delete them
create policy "authors can delete their diary photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'recipe-images'
    and exists (select 1 from public.cook_log l where l.photo_path = name and l.user_id = (select auth.uid()))
  );
