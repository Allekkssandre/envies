-- La Magie de Noël, version simple (docs/14-magie-de-noel.md).
-- Remplace la première version : plus de camps à choisir, de pseudonymes, de tchats ni de cartes.
-- Chaque semaine, chacun peut désigner un suspect ; le plus désigné est démasqué.
-- Tables lues et écrites par le serveur seulement (RLS sans politique).

drop function if exists public.magic_commit(uuid, integer, jsonb, jsonb, jsonb, boolean, jsonb, jsonb);
drop table if exists public.magic_accusations, public.magic_visits, public.magic_rounds,
  public.magic_votes, public.magic_messages, public.magic_players, public.magic_games cascade;

-- Lien personnel chiffré (clé serveur), pour le remettre dans les mails du jeu.
-- `token_hash` reste la seule colonne qui sert à reconnaître un lien.
alter table public.santa_participants add column token_enc text;

create table public.magic_games (
  santa_id     uuid primary key references public.santas (id) on delete cascade,
  status       text not null default 'waiting' check (status in ('waiting', 'playing', 'over', 'revealed')),
  -- Incrémenté à chaque changement d'état : deux écritures concurrentes ne se mélangent pas.
  version      integer not null default 0,
  start_magic  smallint not null check (start_magic between 1 and 99),
  magic        smallint not null,
  -- Dernière semaine résolue (0 à 5).
  round        smallint not null default 0,
  -- Début de la semaine 1.
  starts_at    timestamptz not null,
  round_days   smallint not null default 7 check (round_days between 1 and 14),
  winner       text check (winner in ('pn', 'gr')),
  -- Rôles et classement, écrits à la révélation.
  reveal       jsonb,
  -- Mail de révélation déjà parti (un seul envoi, même si la page et le cron passent ensemble).
  reveal_mailed_at  timestamptz,
  created_at   timestamptz not null default now()
);

create table public.magic_players (
  participant_id uuid primary key references public.santa_participants (id) on delete cascade,
  santa_id       uuid not null references public.magic_games (santa_id) on delete cascade,
  -- { role, cert? } chiffré : le rôle n'est jamais en clair avant la révélation.
  secret         text not null,
  -- Démasquage : public par nature (annoncé dans la gazette).
  out_round      smallint,
  out_role       text check (out_role in ('pn', 'gr'))
);
create index magic_players_santa_idx on public.magic_players (santa_id);

-- Désignations de la semaine. Secrètes pendant la semaine, publiées dans la gazette.
create table public.magic_votes (
  santa_id uuid not null references public.magic_games (santa_id) on delete cascade,
  round    smallint not null,
  voter    uuid not null references public.santa_participants (id) on delete cascade,
  target   uuid not null references public.santa_participants (id) on delete cascade,
  primary key (santa_id, round, voter),
  check (voter <> target)
);

-- Gazettes : la semaine 0 est l'ouverture (premier indice), puis une par semaine résolue.
-- `mailed_at` : mails de cette gazette déjà partis.
create table public.magic_rounds (
  santa_id    uuid not null references public.magic_games (santa_id) on delete cascade,
  round       smallint not null,
  data        jsonb not null,
  resolved_at timestamptz not null default now(),
  mailed_at   timestamptz,
  primary key (santa_id, round)
);

alter table public.magic_games   enable row level security;
alter table public.magic_players enable row level security;
alter table public.magic_votes   enable row level security;
alter table public.magic_rounds  enable row level security;
revoke all on public.magic_games, public.magic_players, public.magic_votes, public.magic_rounds
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Résolution d'une semaine, d'un bloc, seulement si personne n'a écrit entre-temps.
-- Renvoie false si `p_version` n'est plus la version en base (le serveur relit et recommence).
-- ---------------------------------------------------------------------------
create or replace function public.magic_commit(
  p_santa uuid,
  p_version integer,
  p_game jsonb,
  p_players jsonb,
  p_round jsonb
) returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_version integer;
  r jsonb;
begin
  select version into v_version from public.magic_games where santa_id = p_santa for update;
  if v_version is null or v_version <> p_version then return false; end if;

  update public.magic_games set
    version = version + 1,
    status  = coalesce(p_game->>'status', status),
    magic   = coalesce((p_game->>'magic')::smallint, magic),
    round   = coalesce((p_game->>'round')::smallint, round),
    winner  = coalesce(p_game->>'winner', winner),
    reveal  = coalesce(p_game->'reveal', reveal)
  where santa_id = p_santa;

  for r in select * from jsonb_array_elements(coalesce(p_players, '[]'::jsonb)) loop
    update public.magic_players set
      secret    = coalesce(r->>'secret', secret),
      out_round = coalesce((r->>'out_round')::smallint, out_round),
      out_role  = coalesce(r->>'out_role', out_role)
     where participant_id = (r->>'id')::uuid and santa_id = p_santa;
    if not found then raise exception 'joueur inconnu'; end if;
  end loop;

  if p_round is not null and jsonb_typeof(p_round) = 'object' then
    insert into public.magic_rounds (santa_id, round, data)
    values (p_santa, (p_round->>'round')::smallint, p_round->'data');
  end if;

  return true;
end;
$$;

revoke all on function public.magic_commit(uuid, integer, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.magic_commit(uuid, integer, jsonb, jsonb, jsonb) to service_role;

-- Lancement : enregistre aussi le lien chiffré.
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
         token_enc = r->>'token_enc',
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

-- « Tout annuler » un Secret Santa arrête aussi son jeu.
create or replace function public.santa_cancel(p_santa uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform 1 from public.santas where id = p_santa for update;
  delete from public.magic_games where santa_id = p_santa;
  update public.santa_participants
     set token_hash = null, token_enc = null, assignment = null, mailed_at = null, mail_error = null,
         opened_at = null, confirmed_at = null
   where santa_id = p_santa;
  update public.santas set status = 'draft', launched_at = null where id = p_santa;
end;
$$;

revoke all on function public.santa_launch(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.santa_cancel(uuid) from public, anon, authenticated;
grant execute on function public.santa_launch(uuid, jsonb) to service_role;
grant execute on function public.santa_cancel(uuid) to service_role;
