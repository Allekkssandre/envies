-- Envies · schéma initial
-- Supabase (Postgres 15+). Pas de Supabase Auth : lecture publique via RLS,
-- toutes les écritures passent par le serveur avec la clé service role.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.ambiance as enum ('feuillage', 'ciel', 'ambre');
create type public.tag_color as enum ('rouille', 'ocre', 'miel', 'olive', 'sauge', 'ardoise', 'prune', 'sable');
create type public.fetch_status as enum ('none', 'pending', 'ok', 'partial', 'failed');
create type public.price_source as enum ('page', 'manual', 'import');

-- ---------------------------------------------------------------------------
-- Fonctions utilitaires
-- ---------------------------------------------------------------------------

-- Clé de comparaison : minuscules, sans accents, espaces normalisés.
create or replace function public.normalize_key(p text)
returns text
language sql
stable
set search_path = ''
as $$
  select regexp_replace(lower(extensions.unaccent(trim(coalesce(p, '')))), '\s+', ' ', 'g');
$$;

-- Identifiant court lisible pour les URL d'articles (10 caractères hexadécimaux).
create or replace function public.short_ref()
returns text
language sql
volatile
set search_path = ''
as $$
  select substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.set_name_key()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name_key := public.normalize_key(new.name);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Listes
-- ---------------------------------------------------------------------------
create table public.lists (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique
                     check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 1 and 80),
  title              text not null check (length(trim(title)) between 1 and 80),
  owner_name         text not null check (length(trim(owner_name)) between 1 and 40),
  description        text check (description is null or length(description) <= 500),
  ambiance           public.ambiance not null default 'feuillage',
  currency           char(3) not null default 'EUR',
  search_key         text not null default '',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  content_updated_at timestamptz not null default now(),
  deleted_at         timestamptz
);

create index lists_active_recent_idx on public.lists (content_updated_at desc) where deleted_at is null;
create index lists_search_trgm_idx on public.lists using gin (search_key extensions.gin_trgm_ops);

create or replace function public.lists_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_key := public.normalize_key(new.title || ' ' || new.owner_name);
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger lists_before_write
  before insert or update on public.lists
  for each row execute function public.lists_before_write();

-- Anciens slugs → redirection vers la liste.
create table public.list_redirects (
  old_slug   text primary key,
  list_id    uuid not null references public.lists (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Secrets : jamais lisibles par le client (RLS sans politique).
create table public.list_secrets (
  list_id       uuid primary key references public.lists (id) on delete cascade,
  password_hash text not null,                 -- format : scrypt$N$r$p$saltB64$hashB64
  edit_key      text not null unique,          -- XXXX-XXXX-XXXX (base32 sans 0/O/1/I/L)
  auth_version  integer not null default 1,    -- +1 à chaque changement de mot de passe ou de clé
  updated_at    timestamptz not null default now()
);

create trigger list_secrets_updated_at
  before update on public.list_secrets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Catégories et tags
-- ---------------------------------------------------------------------------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  list_id    uuid not null references public.lists (id) on delete cascade,
  ref        text not null default public.short_ref(),
  name       text not null check (length(trim(name)) between 1 and 40),
  name_key   text not null default '',
  position   text not null collate "C",
  created_at timestamptz not null default now(),
  unique (list_id, name_key),
  unique (list_id, ref)
);

create index categories_list_position_idx on public.categories (list_id, position);

create trigger categories_name_key
  before insert or update of name on public.categories
  for each row execute function public.set_name_key();

create table public.tags (
  id         uuid primary key default gen_random_uuid(),
  list_id    uuid not null references public.lists (id) on delete cascade,
  name       text not null check (length(trim(name)) between 1 and 30),
  name_key   text not null default '',
  color      public.tag_color not null default 'ocre',
  position   text not null collate "C",
  created_at timestamptz not null default now(),
  unique (list_id, name_key)
);

create index tags_list_position_idx on public.tags (list_id, position);

create trigger tags_name_key
  before insert or update of name on public.tags
  for each row execute function public.set_name_key();

-- ---------------------------------------------------------------------------
-- Articles
-- ---------------------------------------------------------------------------
create table public.items (
  id                    uuid primary key default gen_random_uuid(),
  list_id               uuid not null references public.lists (id) on delete cascade,
  ref                   text not null default public.short_ref(),
  category_id           uuid references public.categories (id) on delete set null,

  title                 text check (title is null or length(title) <= 200),
  url                   text check (url is null or length(url) <= 2048),
  url_key               text,                 -- URL normalisée (doublons), voir 07-extraction-liens.md
  domain                text,                 -- « etsy.com »
  description           text check (description is null or length(description) <= 1000),
  note                  text check (note is null or length(note) <= 500),

  price_cents           integer check (price_cents is null or price_cents >= 0),
  currency              char(3),
  price_source          public.price_source,
  price_checked_at      timestamptz,

  image_path            text,                 -- préfixe Storage : items/<list_id>/<item_id>/<hash>
  image_width           integer,
  image_height          integer,
  image_source_url      text,
  image_candidates      jsonb not null default '[]'::jsonb,  -- string[] (6 max)

  is_favorite           boolean not null default false,
  position              text not null collate "C",
  sorted_at             timestamptz,          -- null = « À trier »
  suggested_category_id uuid references public.categories (id) on delete set null,

  fetch_status          public.fetch_status not null default 'none',
  fetch_error           text,
  fetch_attempts        smallint not null default 0,
  fetch_started_at      timestamptz,
  fetched_at            timestamptz,
  meta                  jsonb not null default '{}'::jsonb,  -- siteName, brand, availability, breadcrumb[], lightBackground

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,

  constraint items_title_or_url check (title is not null or url is not null),
  unique (list_id, ref)
);

create index items_list_position_idx on public.items (list_id, position) where deleted_at is null;
create index items_list_category_idx on public.items (list_id, category_id) where deleted_at is null;
create index items_inbox_idx on public.items (list_id, created_at) where sorted_at is null and deleted_at is null;
create index items_pending_idx on public.items (fetch_started_at) where fetch_status = 'pending' and deleted_at is null;
create index items_deleted_idx on public.items (deleted_at) where deleted_at is not null;
create unique index items_list_url_key_uq on public.items (list_id, url_key)
  where url_key is not null and deleted_at is null;

create trigger items_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

-- La liste est « modifiée » quand son contenu change (tri « Récentes » de l'accueil).
create or replace function public.touch_list_content()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.lists
     set content_updated_at = now()
   where id = coalesce(new.list_id, old.list_id)
     and content_updated_at < now() - interval '5 seconds';
  return null;
end;
$$;

create trigger items_touch_list
  after insert or update or delete on public.items
  for each row execute function public.touch_list_content();

create table public.item_tags (
  item_id uuid not null references public.items (id) on delete cascade,
  tag_id  uuid not null references public.tags (id) on delete cascade,
  primary key (item_id, tag_id)
);

create index item_tags_tag_idx on public.item_tags (tag_id);

-- Un tag et son article doivent appartenir à la même liste.
create or replace function public.item_tags_same_list()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select list_id from public.items where id = new.item_id)
     is distinct from (select list_id from public.tags where id = new.tag_id) then
    raise exception 'tag and item belong to different lists';
  end if;
  return new;
end;
$$;

create trigger item_tags_same_list
  before insert or update on public.item_tags
  for each row execute function public.item_tags_same_list();

-- Même garde-fou pour la catégorie d'un article.
create or replace function public.items_category_same_list()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.category_id is not null
     and (select list_id from public.categories where id = new.category_id) is distinct from new.list_id then
    raise exception 'category belongs to another list';
  end if;
  if new.suggested_category_id is not null
     and (select list_id from public.categories where id = new.suggested_category_id) is distinct from new.list_id then
    new.suggested_category_id := null;
  end if;
  return new;
end;
$$;

create trigger items_category_same_list
  before insert or update of category_id, suggested_category_id on public.items
  for each row execute function public.items_category_same_list();

-- ---------------------------------------------------------------------------
-- Limites de fréquence (déverrouillage, création, ajouts)
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  bucket   text primary key,
  count    integer not null,
  reset_at timestamptz not null
);

-- Renvoie true si l'action est autorisée, et compte l'essai.
create or replace function public.hit_rate_limit(p_bucket text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.rate_limits as r (bucket, count, reset_at)
  values (p_bucket, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (bucket) do update
     set count    = case when r.reset_at <= now() then 1 else r.count + 1 end,
         reset_at = case when r.reset_at <= now() then now() + make_interval(secs => p_window_seconds) else r.reset_at end
  returning count into v_count;
  return v_count <= p_max;
end;
$$;

-- ---------------------------------------------------------------------------
-- Vue de l'accueil
-- ---------------------------------------------------------------------------
create view public.list_summaries
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
  coalesce(t.thumbs, '[]'::jsonb) as thumbs
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

-- ---------------------------------------------------------------------------
-- RLS : lecture publique des données actives, aucune écriture côté client
-- ---------------------------------------------------------------------------
alter table public.lists          enable row level security;
alter table public.list_redirects enable row level security;
alter table public.list_secrets   enable row level security;
alter table public.categories     enable row level security;
alter table public.tags           enable row level security;
alter table public.items          enable row level security;
alter table public.item_tags      enable row level security;
alter table public.rate_limits    enable row level security;

create policy "lists: public read" on public.lists
  for select to anon, authenticated
  using (deleted_at is null);

create policy "list_redirects: public read" on public.list_redirects
  for select to anon, authenticated
  using (true);

create policy "categories: public read" on public.categories
  for select to anon, authenticated
  using (exists (select 1 from public.lists l where l.id = list_id and l.deleted_at is null));

create policy "tags: public read" on public.tags
  for select to anon, authenticated
  using (exists (select 1 from public.lists l where l.id = list_id and l.deleted_at is null));

create policy "items: public read" on public.items
  for select to anon, authenticated
  using (deleted_at is null
         and exists (select 1 from public.lists l where l.id = list_id and l.deleted_at is null));

create policy "item_tags: public read" on public.item_tags
  for select to anon, authenticated
  using (exists (select 1 from public.items i
                 where i.id = item_id and i.deleted_at is null));

-- list_secrets et rate_limits : RLS activée, aucune politique = inaccessibles au client.

-- Ceinture et bretelles : le client (clés anon / authenticated) ne peut rien écrire.
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
revoke select on public.list_secrets, public.rate_limits from anon, authenticated;

revoke all on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;

-- La colonne search_key n'a pas d'intérêt côté client mais n'est pas sensible.
-- Les colonnes meta / fetch_* sont lisibles : elles ne contiennent que des infos publiques de la page.

-- ---------------------------------------------------------------------------
-- Temps réel : mises à jour des articles (fin d'extraction)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.items;

-- ---------------------------------------------------------------------------
-- Stockage des images (lecture publique, écriture serveur uniquement)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-images', 'item-images', true, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;
