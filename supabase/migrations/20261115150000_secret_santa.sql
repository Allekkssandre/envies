-- Secret Santa (docs/13-secret-santa.md).
-- Toutes les tables sont lues et écrites par le serveur seulement (clé service role) :
-- RLS activée sans aucune politique, rien n'est lisible avec la clé publique.
-- Le tirage (qui offre à qui, quel thème) est chiffré par le serveur (AES-256-GCM,
-- clé SANTA_SECRET_KEY) : la base ne le contient jamais en clair.

-- Listes d'idées des lutins : des listes ordinaires, masquées de l'accueil.
alter table public.lists add column hidden boolean not null default false;

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
where l.deleted_at is null and not l.hidden;

revoke all on public.list_summaries from anon, authenticated;

-- ---------------------------------------------------------------------------

create table public.santas (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9-]{3,90}$'),
  title         text not null check (length(trim(title)) between 1 and 80),
  message       text check (message is null or length(message) <= 600),
  budget        text check (budget is null or length(budget) <= 40),
  exchange_date date,
  status        text not null default 'draft' check (status in ('draft', 'launched')),
  launched_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.santa_secrets (
  santa_id      uuid primary key references public.santas (id) on delete cascade,
  password_hash text not null,
  edit_key      text not null unique,
  auth_version  integer not null default 1
);

create table public.santa_themes (
  id         uuid primary key default gen_random_uuid(),
  santa_id   uuid not null references public.santas (id) on delete cascade,
  label      text not null check (length(trim(label)) between 1 and 80),
  position   integer not null
);
create index santa_themes_santa_idx on public.santa_themes (santa_id, position);

create table public.santa_participants (
  id            uuid primary key default gen_random_uuid(),
  santa_id      uuid not null references public.santas (id) on delete cascade,
  first_name    text not null check (length(trim(first_name)) between 1 and 40),
  last_name     text not null check (length(last_name) <= 60),
  email         text not null check (length(email) between 3 and 254),
  position      integer not null,
  -- Lien personnel : seule son empreinte SHA-256 est gardée.
  token_hash    text unique,
  -- Tirage chiffré : { receiverId, themeId } (AES-256-GCM, lié à ce participant).
  assignment    text,
  mailed_at     timestamptz,
  mail_error    text,
  opened_at     timestamptz,
  confirmed_at  timestamptz,
  -- Fiche pour son Santa
  age           text check (age is null or length(age) <= 20),
  shoe_size     text check (shoe_size is null or length(shoe_size) <= 20),
  clothing_size text check (clothing_size is null or length(clothing_size) <= 40),
  tastes        text check (tastes is null or length(tastes) <= 1500),
  list_id       uuid references public.lists (id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (santa_id, email)
);
create index santa_participants_santa_idx on public.santa_participants (santa_id, position);
create index santa_participants_list_idx on public.santa_participants (list_id);

alter table public.santas             enable row level security;
alter table public.santa_secrets      enable row level security;
alter table public.santa_themes       enable row level security;
alter table public.santa_participants enable row level security;
revoke all on public.santas, public.santa_secrets, public.santa_themes, public.santa_participants
  from anon, authenticated;

create trigger santas_updated_at
  before update on public.santas
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Lancement et annulation : tout ou rien, sur un Secret Santa verrouillé.
-- ---------------------------------------------------------------------------

-- p_rows : [{ "id": uuid, "token_hash": text, "assignment": text }], un par participant.
create or replace function public.santa_launch(p_santa uuid, p_rows jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
  v_count int;
  v_rows int;
  v_updated int;
begin
  select status into v_status from public.santas where id = p_santa for update;
  if v_status is null then raise exception 'santa introuvable'; end if;
  if v_status <> 'draft' then raise exception 'tirage déjà lancé'; end if;

  select count(*) into v_count from public.santa_participants where santa_id = p_santa;
  v_rows := jsonb_array_length(p_rows);
  if v_rows <> v_count or v_count < 3 then raise exception 'participants incomplets'; end if;
  if (select count(distinct r->>'id') from jsonb_array_elements(p_rows) r) <> v_rows then
    raise exception 'participant en double';
  end if;

  update public.santa_participants p
     set token_hash = r->>'token_hash',
         assignment = r->>'assignment',
         mailed_at = null,
         mail_error = null,
         opened_at = null,
         confirmed_at = null
    from jsonb_array_elements(p_rows) r
   where p.santa_id = p_santa and p.id = (r->>'id')::uuid;
  get diagnostics v_updated = row_count;
  if v_updated <> v_count then raise exception 'participants incomplets'; end if;

  update public.santas set status = 'launched', launched_at = now() where id = p_santa;
end;
$$;

create or replace function public.santa_cancel(p_santa uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform 1 from public.santas where id = p_santa for update;
  update public.santa_participants
     set token_hash = null, assignment = null, mailed_at = null, mail_error = null,
         opened_at = null, confirmed_at = null
   where santa_id = p_santa;
  update public.santas set status = 'draft', launched_at = null where id = p_santa;
end;
$$;

revoke all on function public.santa_launch(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.santa_cancel(uuid) from public, anon, authenticated;
grant execute on function public.santa_launch(uuid, jsonb) to service_role;
grant execute on function public.santa_cancel(uuid) to service_role;
