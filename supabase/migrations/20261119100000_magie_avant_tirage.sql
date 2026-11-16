-- La Magie de Noël activée avant le tirage (docs/14-magie-de-noel.md § Ouverture).
-- Réglages choisis pendant la préparation ; null : pas de jeu prévu. Au lancement du tirage,
-- le jeu s'ouvre avec ces réglages et chacun reçoit un seul mail (tirage et jeu).
alter table public.santas add column magic_plan jsonb;
