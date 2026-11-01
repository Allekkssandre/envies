-- Listes privées : la liste reste sur l'accueil (nom, prénom, ambiance), mais son contenu
-- (petit mot, catégories, tags, articles) ne se lit qu'avec le mot de passe ou le lien secret.
-- Le contenu d'une liste privée n'est lu que par le serveur (clé service role), après
-- vérification du jeton d'accès. La clé publique n'y a pas accès.

alter table public.lists add column is_private boolean not null default false;

-- ---------------------------------------------------------------------------
-- Lecture publique : seulement le contenu des listes non privées
-- ---------------------------------------------------------------------------
drop policy "categories: public read" on public.categories;
create policy "categories: public read" on public.categories
  for select to anon, authenticated
  using (exists (select 1 from public.lists l
                 where l.id = list_id and l.deleted_at is null and not l.is_private));

drop policy "tags: public read" on public.tags;
create policy "tags: public read" on public.tags
  for select to anon, authenticated
  using (exists (select 1 from public.lists l
                 where l.id = list_id and l.deleted_at is null and not l.is_private));

drop policy "items: public read" on public.items;
create policy "items: public read" on public.items
  for select to anon, authenticated
  using (deleted_at is null
         and exists (select 1 from public.lists l
                     where l.id = list_id and l.deleted_at is null and not l.is_private));

drop policy "item_tags: public read" on public.item_tags;
create policy "item_tags: public read" on public.item_tags
  for select to anon, authenticated
  using (exists (select 1 from public.items i
                 join public.lists l on l.id = i.list_id
                 where i.id = item_id and i.deleted_at is null
                   and l.deleted_at is null and not l.is_private));

-- Le petit mot fait partie du contenu : la clé publique ne lit plus la colonne `description`
-- (le serveur la lit, et la masque pour une liste privée verrouillée).
revoke select on public.lists from anon, authenticated;
grant select (id, slug, title, owner_name, ambiance, currency, search_key,
              created_at, updated_at, content_updated_at, deleted_at, is_private)
  on public.lists to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Vue de l'accueil : lue par le serveur seulement (compteurs et vignettes masqués
-- côté serveur pour les listes privées).
-- ---------------------------------------------------------------------------
create or replace view public.list_summaries
with (security_invoker = true)
as
select
  l.id,
  l.slug,
  l.title,
  l.owner_name,
  l.description,
  l.ambiance,
  l.currency,
  l.search_key,
  l.created_at,
  l.content_updated_at,
  coalesce(s.item_count, 0)     as item_count,
  coalesce(s.favorite_count, 0) as favorite_count,
  coalesce(s.total_cents, 0)    as total_cents,
  coalesce(s.missing_prices, 0) as missing_prices,
  coalesce(t.thumbs, '[]'::jsonb) as thumbs,
  l.is_private
from public.lists l
left join lateral (
  select
    count(*)::int                                           as item_count,
    count(*) filter (where i.is_favorite)::int              as favorite_count,
    sum(i.price_cents) filter (where i.currency = l.currency)::bigint as total_cents,
    count(*) filter (where i.price_cents is null)::int      as missing_prices
  from public.items i
  where i.list_id = l.id and i.deleted_at is null
) s on true
left join lateral (
  select jsonb_agg(x.image_path order by x.is_favorite desc, x.position) as thumbs
  from (
    select i.image_path, i.is_favorite, i.position
    from public.items i
    where i.list_id = l.id and i.deleted_at is null and i.image_path is not null
    order by i.is_favorite desc, i.position
    limit 3
  ) x
) t on true
where l.deleted_at is null;

revoke all on public.list_summaries from anon, authenticated;
