-- Article acheté : il reste dans la liste, marqué « Acheté », et compte dans le total dépensé.
-- null = pas encore acheté ; sinon la date à laquelle il a été marqué.

alter table public.items add column purchased_at timestamptz;
