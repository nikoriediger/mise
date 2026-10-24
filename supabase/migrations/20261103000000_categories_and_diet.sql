-- Fixed, translatable categories (several per recipe) and diet flags instead of
-- a free-text category. Old free-text categories are mapped where they clearly
-- match; everything else becomes a tag, so nothing is lost.

alter table public.recipes
  add column categories text[] not null default '{}',
  add column diet text[] not null default '{}';

alter table public.recipes add constraint recipes_categories_check check (
  categories <@ array['breakfast', 'starters', 'salads', 'soups', 'mains', 'pasta', 'sides', 'bread', 'cakes', 'cookies', 'desserts', 'sauces', 'drinks']::text[]
);
alter table public.recipes add constraint recipes_diet_check check (
  diet <@ array['meat', 'fish', 'vegetarian', 'vegan', 'gluten_free', 'lactose_free']::text[]
);

-- Map old free-text categories (German, English, Italian)
with map (pattern, category, diet) as (
  values
    ('%frühstück%', 'breakfast', null), ('%breakfast%', 'breakfast', null), ('%brunch%', 'breakfast', null), ('%colazione%', 'breakfast', null),
    ('%vorspeise%', 'starters', null), ('%snack%', 'starters', null), ('%fingerfood%', 'starters', null), ('%starter%', 'starters', null),
    ('%appetizer%', 'starters', null), ('%antipast%', 'starters', null), ('%aperitivo%', 'starters', null),
    ('%salat%', 'salads', null), ('%salad%', 'salads', null), ('%insalat%', 'salads', null),
    ('%suppe%', 'soups', null), ('%eintopf%', 'soups', null), ('%soup%', 'soups', null), ('%stew%', 'soups', null),
    ('%zuppa%', 'soups', null), ('%minestr%', 'soups', null),
    ('%hauptgericht%', 'mains', null), ('%hauptspeise%', 'mains', null), ('%main%', 'mains', null), ('%secondo%', 'mains', null),
    ('%fleisch%', 'mains', 'meat'), ('%meat%', 'mains', 'meat'), ('%carne%', 'mains', 'meat'),
    ('%fisch%', 'mains', 'fish'), ('%fish%', 'mains', 'fish'), ('%pesce%', 'mains', 'fish'),
    ('%nudel%', 'pasta', null), ('%pasta%', 'pasta', null), ('%risotto%', 'pasta', null), ('%reis%', 'pasta', null),
    ('%rice%', 'pasta', null), ('%primo%', 'pasta', null),
    ('%beilage%', 'sides', null), ('%side%', 'sides', null), ('%contorn%', 'sides', null),
    ('%brot%', 'bread', null), ('%bread%', 'bread', null), ('%pane%', 'bread', null),
    ('%kuchen%', 'cakes', null), ('%torte%', 'cakes', null), ('%cake%', 'cakes', null), ('%torta%', 'cakes', null), ('%tarte%', 'cakes', null),
    ('%plätzchen%', 'cookies', null), ('%keks%', 'cookies', null), ('%gebäck%', 'cookies', null), ('%cookie%', 'cookies', null),
    ('%biscott%', 'cookies', null), ('%pasticc%', 'cookies', null),
    ('%dessert%', 'desserts', null), ('%nachtisch%', 'desserts', null), ('%nachspeise%', 'desserts', null), ('%süßspeise%', 'desserts', null),
    ('%dolc%', 'desserts', null), ('%pudding%', 'desserts', null),
    ('%sauce%', 'sauces', null), ('%soße%', 'sauces', null), ('%dip%', 'sauces', null), ('%marmelade%', 'sauces', null),
    ('%eingemacht%', 'sauces', null), ('%chutney%', 'sauces', null), ('%pesto%', 'sauces', null), ('%salsa%', 'sauces', null),
    ('%getränk%', 'drinks', null), ('%drink%', 'drinks', null), ('%cocktail%', 'drinks', null), ('%bevand%', 'drinks', null), ('%likör%', 'drinks', null),
    ('%vegetari%', null, 'vegetarian'), ('%vegan%', null, 'vegan')
),
matches as (
  select r.id,
    array_remove(array_agg(distinct m.category), null) as categories,
    array_remove(array_agg(distinct m.diet), null) as diet
  from public.recipes r
  join map m on r.category ilike m.pattern
  group by r.id
)
update public.recipes r
set categories = m.categories,
    diet = case when 'vegan' = any(m.diet) and not ('vegetarian' = any(m.diet)) then array_append(m.diet, 'vegetarian') else m.diet end
from matches m
where m.id = r.id;

-- Unmatched old categories become a tag
update public.recipes
set tags = array_append(tags, trim(category))
where coalesce(trim(category), '') <> ''
  and categories = '{}'
  and diet = '{}'
  and not (trim(category) = any(tags));

alter table public.recipes drop column category;

create index recipes_categories_idx on public.recipes using gin (categories);

-- ---------------------------------------------------------------------------
-- Push: a device belongs to whoever is signed in on it now. Re-registering an
-- endpoint that was registered by another account moves it to the new account.
-- ---------------------------------------------------------------------------
create function public.register_push_device(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not signed in';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values ((select auth.uid()), p_endpoint, p_p256dh, p_auth);
end;
$$;
grant execute on function public.register_push_device(text, text, text) to authenticated;
