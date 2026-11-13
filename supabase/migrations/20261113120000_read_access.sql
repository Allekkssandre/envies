-- Accès en lecture pour les listes privées, distinct de la modification.
-- Un lien de lecture (`/l/<slug>#acces=XXXX-XXXX-XXXX`) et un mot de passe de lecture
-- facultatif ouvrent le contenu sans permettre de modifier. Le mot de passe de modification
-- ouvre aussi la lecture. `read_version` invalide les accès en lecture déjà donnés.

create or replace function public.random_access_key() returns text
language sql volatile
set search_path = ''
as $$
  -- Même alphabet que la clé d'édition : chiffres 2–9, majuscules sans I, L, O.
  select substr(k, 1, 4) || '-' || substr(k, 5, 4) || '-' || substr(k, 9, 4)
  from (
    select string_agg(
             substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', 1 + (get_byte(b, i) % 31), 1), ''
             order by i) as k
    from (select extensions.gen_random_bytes(12) as b) r, generate_series(0, 11) i
  ) x;
$$;

revoke all on function public.random_access_key() from public, anon, authenticated;

alter table public.list_secrets
  add column read_password_hash text,
  add column read_key text not null default public.random_access_key(),
  add column read_version integer not null default 1;

alter table public.list_secrets add constraint list_secrets_read_key_key unique (read_key);
