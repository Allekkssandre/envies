-- Données de démonstration (développement local et previews uniquement).
-- Mots de passe : « Mes 30 ans » → bouleau · « Noël en famille » → sapin · « Appart à Lyon » → bouleau
-- Les photos ne sont pas fournies : les cartes affichent l'initiale. Lancer l'extraction
-- (bouton « Relire la page du lien ») pour en récupérer, ou ajouter des liens réels.

do $$
declare
  l1 uuid := '11111111-1111-4111-8111-111111111111';
  l2 uuid := '22222222-2222-4222-8222-222222222222';
  l3 uuid := '33333333-3333-4333-8333-333333333333';
  c_maison uuid := gen_random_uuid();
  c_lecture uuid := gen_random_uuid();
  c_musique uuid := gen_random_uuid();
  c_sport uuid := gen_random_uuid();
  t_prio uuid := gen_random_uuid();
  t_petit uuid := gen_random_uuid();
  t_folle uuid := gen_random_uuid();
  t_occas uuid := gen_random_uuid();
  pw_bouleau text := 'scrypt$16384$8$1$ZW52aWVzLWRlbW8tc2FsdA$d9HRTj0BPKg7n7nG1nGpbdD1ZcRnj0OZcz1EZse-ho4';
  pw_sapin text := 'scrypt$16384$8$1$ZW52aWVzLWRlbW8tc2FsdA$2ybqcXL12HynbuL-o_SYzssw-T01m3UUNkTkNgdophk';
  i_lampe uuid; i_fauteuil uuid; i_bougie uuid; i_vase uuid; i_bd uuid; i_liseuse uuid;
begin
  insert into public.lists (id, slug, title, owner_name, description, ambiance) values
    (l1, 'mes-30-ans', 'Mes 30 ans', 'Merin', 'Pour le 14 décembre. Les coups de cœur d''abord, la seconde main me va très bien.', 'feuillage'),
    (l2, 'noel-en-famille', 'Noël en famille', 'Camille', 'Une idée par personne, on se répartit.', 'ambre'),
    (l3, 'appart-a-lyon', 'Appart à Lyon', 'Jo & Sam', null, 'ciel');

  insert into public.list_secrets (list_id, password_hash, edit_key) values
    (l1, pw_bouleau, 'Q8WN-4TZE-K7HC'),
    (l2, pw_sapin, '7F3K-9QPA-M2XD'),
    (l3, pw_bouleau, 'HV6R-WB3N-T9EK');

  insert into public.categories (id, list_id, name, position) values
    (c_maison, l1, 'Maison & déco', 'a0'),
    (c_lecture, l1, 'Lecture & carnets', 'a1'),
    (c_musique, l1, 'Musique', 'a2'),
    (c_sport, l1, 'Sport', 'a3');

  insert into public.tags (id, list_id, name, color, position) values
    (t_prio, l1, 'Priorité', 'rouille', 'a0'),
    (t_petit, l1, 'Petit prix', 'miel', 'a1'),
    (t_folle, l1, 'Envie folle', 'prune', 'a2'),
    (t_occas, l1, 'Seconde main OK', 'olive', 'a3');

  insert into public.items (list_id, category_id, title, url, url_key, domain, price_cents, currency, price_source, price_checked_at,
                            note, is_favorite, position, sorted_at, fetch_status)
  values
    (l1, c_maison, 'Lampe champignon en verre soufflé', 'https://www.etsy.com/fr/listing/000000001/lampe-champignon', 'etsy.com/fr/listing/000000001', 'etsy.com',
     8900, 'EUR', 'page', now() - interval '13 days', 'En vert sauge si possible, sinon ambre.', true, 'a0', now(), 'ok')
  returning id into i_lampe;

  insert into public.items (list_id, category_id, title, url, url_key, domain, price_cents, currency, price_source, is_favorite, position, sorted_at, fetch_status)
  values (l1, c_maison, 'Fauteuil en rotin', 'https://www.leboncoin.fr/ad/ameublement/000000002', 'leboncoin.fr/ad/ameublement/000000002', 'leboncoin.fr',
          24000, 'EUR', 'page', false, 'a1', now(), 'ok')
  returning id into i_fauteuil;

  insert into public.items (list_id, category_id, title, url, url_key, domain, price_cents, currency, price_source, is_favorite, position, sorted_at, fetch_status)
  values (l1, c_maison, 'Bougie figue et cèdre', 'https://www.etsy.com/fr/listing/000000003/bougie', 'etsy.com/fr/listing/000000003', 'etsy.com',
          2800, 'EUR', 'page', false, 'a2', now(), 'ok')
  returning id into i_bougie;

  insert into public.items (list_id, category_id, title, url, url_key, domain, price_cents, currency, price_source, is_favorite, position, sorted_at, fetch_status)
  values (l1, c_maison, 'Vase boule en céramique', 'https://www.leboncoin.fr/ad/decoration/000000004', 'leboncoin.fr/ad/decoration/000000004', 'leboncoin.fr',
          7400, 'EUR', 'page', true, 'a3', now(), 'ok')
  returning id into i_vase;

  insert into public.items (list_id, category_id, title, url, url_key, domain, price_cents, currency, price_source, is_favorite, position, sorted_at, fetch_status)
  values (l1, c_lecture, 'Coffret BD, intégrale en 4 tomes', 'https://www.fnac.com/a0000005/coffret-bd', 'fnac.com/a0000005/coffret-bd', 'fnac.com',
          5900, 'EUR', 'page', true, 'a4', now(), 'ok')
  returning id into i_bd;

  insert into public.items (list_id, category_id, title, url, url_key, domain, price_cents, currency, price_source, is_favorite, position, sorted_at, fetch_status)
  values (l1, c_lecture, 'Liseuse 7 pouces étanche', 'https://www.fnac.com/a0000006/liseuse', 'fnac.com/a0000006/liseuse', 'fnac.com',
          19900, 'EUR', 'page', false, 'a5', now(), 'ok')
  returning id into i_liseuse;

  insert into public.items (list_id, category_id, title, price_cents, currency, price_source, position, sorted_at) values
    (l1, c_lecture, 'Carnet ligné A5 en lin', 1800, 'EUR', 'manual', 'a6', now()),
    (l1, c_lecture, 'Marque-pages en laiton, lot de 3', 1500, 'EUR', 'manual', 'a7', now()),
    (l1, c_musique, 'Vinyle d''occasion, n''importe quel Nina Simone', null, null, null, 'a8', now()),
    (l1, c_sport, 'Gourde isotherme 750 ml', 3500, 'EUR', 'manual', 'a9', now());

  -- À trier (sorted_at null)
  insert into public.items (list_id, title, position) values
    (l1, 'Un bon pour un massage', 'aA');
  insert into public.items (list_id, title, url, url_key, domain, position, fetch_status, fetch_error) values
    (l1, null, 'https://www.amazon.fr/dp/B0C7XQ0000', 'amazon.fr/dp/B0C7XQ0000', 'amazon.fr', 'aB', 'failed', 'blocked');

  insert into public.item_tags (item_id, tag_id) values
    (i_lampe, t_prio), (i_fauteuil, t_occas), (i_bougie, t_petit), (i_vase, t_occas), (i_bd, t_folle), (i_liseuse, t_prio);

  -- Deux autres listes, plus courtes
  insert into public.items (list_id, title, price_cents, currency, price_source, position, sorted_at, is_favorite) values
    (l2, 'Puzzle 1000 pièces, carte du ciel', 2400, 'EUR', 'manual', 'a0', now(), true),
    (l2, 'Gants en laine pour papa', 3000, 'EUR', 'manual', 'a1', now(), false),
    (l3, 'Étagère murale en chêne', 12000, 'EUR', 'manual', 'a0', now(), true),
    (l3, 'Rideaux en lin lavé', 8900, 'EUR', 'manual', 'a1', now(), false);
end $$;
