-- La Magie de Noël : atouts, courrier des lecteurs, carnet d'enquête (docs/14-magie-de-noel.md).
-- Rien ici ne change le score. Tables lues et écrites par le serveur seulement (RLS sans politique).

-- Atout : un par joueur et par partie. Son contenu (Loupe, Fausse piste ou Alibi, cibles,
-- résultat) est chiffré : la nature de l'atout trahirait le rôle.
create table public.magic_atouts (
  participant_id uuid primary key references public.santa_participants (id) on delete cascade,
  santa_id       uuid not null references public.magic_games (santa_id) on delete cascade,
  -- Semaine où l'atout a été joué.
  round          smallint not null,
  secret         text not null,
  created_at     timestamptz not null default now()
);
create index magic_atouts_santa_idx on public.magic_atouts (santa_id);

-- Courrier des lecteurs : une lettre par joueur et par semaine, publiée sans nom dans la gazette.
create table public.magic_letters (
  santa_id   uuid not null references public.magic_games (santa_id) on delete cascade,
  round      smallint not null,
  author     uuid not null references public.santa_participants (id) on delete cascade,
  body       text not null check (length(body) between 1 and 280),
  updated_at timestamptz not null default now(),
  primary key (santa_id, round, author)
);

-- Carnet d'enquête : notes privées d'un joueur sur les autres.
create table public.magic_notes (
  santa_id uuid not null references public.magic_games (santa_id) on delete cascade,
  owner    uuid not null references public.santa_participants (id) on delete cascade,
  target   uuid not null references public.santa_participants (id) on delete cascade,
  mark     text not null check (mark in ('suspect', 'innocent')),
  primary key (owner, target),
  check (owner <> target)
);
create index magic_notes_santa_idx on public.magic_notes (santa_id);

alter table public.magic_atouts  enable row level security;
alter table public.magic_letters enable row level security;
alter table public.magic_notes   enable row level security;
revoke all on public.magic_atouts, public.magic_letters, public.magic_notes from anon, authenticated;
