-- Language of a recipe's content (not the UI language). Recipes are shown in a
-- mixed feed; the column powers a language badge and an optional filter.
alter table public.recipes
  add column language text check (language in ('de', 'en', 'it'));
