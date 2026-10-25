-- Index des clés étrangères (suppression d'une catégorie ou d'une liste sans parcours complet).
create index if not exists items_category_id_idx on public.items (category_id);
create index if not exists items_suggested_category_id_idx on public.items (suggested_category_id);
create index if not exists list_redirects_list_id_idx on public.list_redirects (list_id);
