-- Sauvegarde hebdomadaire (tâche quotidienne, le dimanche) : JSON de toutes les listes,
-- sans secrets, dans un bucket privé. Lecture et écriture par la clé service role seulement.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('backups', 'backups', false, 52428800, array['application/json'])
on conflict (id) do nothing;
