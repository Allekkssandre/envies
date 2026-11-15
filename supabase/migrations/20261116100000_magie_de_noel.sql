-- La Magie de Noël (docs/14-magie-de-noel.md) : jeu à rôles cachés adossé à un Secret Santa.
-- Tables lues et écrites par le serveur seulement (RLS sans politique).
-- Le rôle, le pseudonyme et la carte de chaque joueur sont chiffrés (`magic_players.secret`).
-- Tchats, votes et visites ne portent que des pseudonymes : la base ne relie pas une personne
-- à un camp.

create table public.magic_games (
  santa_id    uuid primary key references public.santas (id) on delete cascade,
  status      text not null default 'joining' check (status in ('joining', 'playing', 'over', 'revealed')),
  -- Incrémenté à chaque changement d'état : deux écritures concurrentes ne se mélangent pas.
  version     integer not null default 0,
  start_gauge smallint not null check (start_gauge between 3 and 5),
  gauge       smallint not null,
  -- Dernière manche résolue (0 à 5).
  round       smallint not null default 0,
  -- Fin du choix des camps et début de la manche 1.
  starts_at   timestamptz not null,
  round_days  smallint not null default 7 check (round_days between 1 and 14),
  winner      text check (winner in ('pn', 'gr')),
  -- { frozenNext, maxLoss }
  state       jsonb not null default '{}'::jsonb,
  -- Rôles et classement, écrits à la révélation.
  reveal      jsonb,
  created_at  timestamptz not null default now()
);

create table public.magic_players (
  participant_id uuid primary key references public.santa_participants (id) on delete cascade,
  santa_id       uuid not null references public.magic_games (santa_id) on delete cascade,
  -- { role, pseudo, card } chiffré ; null tant que le joueur n'a pas rejoint le jeu.
  secret         text
);
create index magic_players_santa_idx on public.magic_players (santa_id);

create table public.magic_messages (
  id         bigint generated always as identity primary key,
  santa_id   uuid not null references public.magic_games (santa_id) on delete cascade,
  chat       text not null check (chat in ('pn', 'gr')),
  pseudo     text,
  kind       text not null default 'chat' check (kind in ('chat', 'gazette', 'system')),
  body       text not null check (length(body) <= 4000),
  created_at timestamptz not null default now()
);
create index magic_messages_chat_idx on public.magic_messages (santa_id, chat, id);

create table public.magic_votes (
  santa_id uuid not null references public.magic_games (santa_id) on delete cascade,
  round    smallint not null,
  chat     text not null check (chat in ('pn', 'gr')),
  voter    text not null,
  target   text not null,
  primary key (santa_id, round, chat, voter)
);

create table public.magic_rounds (
  santa_id    uuid not null references public.magic_games (santa_id) on delete cascade,
  round       smallint not null,
  pn_pseudo   text not null,
  gr_pseudo   text not null,
  data        jsonb not null,
  resolved_at timestamptz not null default now(),
  primary key (santa_id, round)
);

-- Visite d'espionnage : `pseudo` lit et écrit dans `chat` entre deux identifiants de message.
create table public.magic_visits (
  id              bigint generated always as identity primary key,
  santa_id        uuid not null references public.magic_games (santa_id) on delete cascade,
  round           smallint not null,
  pseudo          text not null,
  chat            text not null check (chat in ('pn', 'gr')),
  from_message_id bigint not null,
  to_message_id   bigint
);
create index magic_visits_santa_idx on public.magic_visits (santa_id);

create table public.magic_accusations (
  id         bigint generated always as identity primary key,
  santa_id   uuid not null references public.magic_games (santa_id) on delete cascade,
  accuser    uuid not null references public.santa_participants (id) on delete cascade,
  target     uuid not null references public.santa_participants (id) on delete cascade,
  role       text not null check (role in ('pn', 'gr', 'inf')),
  created_at timestamptz not null default now(),
  unique (accuser, target),
  check (accuser <> target)
);
create index magic_accusations_santa_idx on public.magic_accusations (santa_id);
create index magic_accusations_target_idx on public.magic_accusations (target);

alter table public.magic_games       enable row level security;
alter table public.magic_players     enable row level security;
alter table public.magic_messages    enable row level security;
alter table public.magic_votes       enable row level security;
alter table public.magic_rounds      enable row level security;
alter table public.magic_visits      enable row level security;
alter table public.magic_accusations enable row level security;
revoke all on public.magic_games, public.magic_players, public.magic_messages, public.magic_votes,
  public.magic_rounds, public.magic_visits, public.magic_accusations from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Écriture d'un changement d'état, d'un bloc, seulement si personne n'a écrit entre-temps.
-- Renvoie false si `p_version` n'est plus la version en base (le serveur relit et recommence).
-- Ordre : jeu, joueurs, manche, fin des visites en cours, messages, nouvelles visites.
-- ---------------------------------------------------------------------------
create or replace function public.magic_commit(
  p_santa uuid,
  p_version integer,
  p_game jsonb,
  p_players jsonb,
  p_round jsonb,
  p_close_visits boolean,
  p_messages jsonb,
  p_visits jsonb
) returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_version integer;
  v_last bigint;
  r jsonb;
begin
  select version into v_version from public.magic_games where santa_id = p_santa for update;
  if v_version is null or v_version <> p_version then return false; end if;

  update public.magic_games set
    version = version + 1,
    status  = coalesce(p_game->>'status', status),
    gauge   = coalesce((p_game->>'gauge')::smallint, gauge),
    round   = coalesce((p_game->>'round')::smallint, round),
    winner  = coalesce(p_game->>'winner', winner),
    state   = coalesce(p_game->'state', state),
    reveal  = coalesce(p_game->'reveal', reveal)
  where santa_id = p_santa;

  for r in select * from jsonb_array_elements(coalesce(p_players, '[]'::jsonb)) loop
    update public.magic_players set secret = r->>'secret'
     where participant_id = (r->>'id')::uuid and santa_id = p_santa;
    if not found then raise exception 'joueur inconnu'; end if;
  end loop;

  if p_round is not null and jsonb_typeof(p_round) = 'object' then
    insert into public.magic_rounds (santa_id, round, pn_pseudo, gr_pseudo, data)
    values (p_santa, (p_round->>'round')::smallint, p_round->>'pn_pseudo', p_round->>'gr_pseudo', p_round->'data');
  end if;

  if p_close_visits then
    select coalesce(max(id), 0) into v_last from public.magic_messages where santa_id = p_santa;
    update public.magic_visits set to_message_id = v_last
     where santa_id = p_santa and to_message_id is null;
  end if;

  for r in select * from jsonb_array_elements(coalesce(p_messages, '[]'::jsonb)) loop
    insert into public.magic_messages (santa_id, chat, pseudo, kind, body)
    values (p_santa, r->>'chat', r->>'pseudo', r->>'kind', r->>'body');
  end loop;

  select coalesce(max(id), 0) into v_last from public.magic_messages where santa_id = p_santa;
  for r in select * from jsonb_array_elements(coalesce(p_visits, '[]'::jsonb)) loop
    insert into public.magic_visits (santa_id, round, pseudo, chat, from_message_id)
    values (p_santa, (r->>'round')::smallint, r->>'pseudo', r->>'chat', v_last);
  end loop;

  return true;
end;
$$;

revoke all on function public.magic_commit(uuid, integer, jsonb, jsonb, jsonb, boolean, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.magic_commit(uuid, integer, jsonb, jsonb, jsonb, boolean, jsonb, jsonb)
  to service_role;

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
     set token_hash = null, assignment = null, mailed_at = null, mail_error = null,
         opened_at = null, confirmed_at = null
   where santa_id = p_santa;
  update public.santas set status = 'draft', launched_at = null where id = p_santa;
end;
$$;
