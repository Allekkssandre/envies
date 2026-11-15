-- Quantité voulue d'un article (« × 2 ») : comptée dans le total et le total dépensé.

alter table public.items
  add column quantity smallint not null default 1 check (quantity between 1 and 99);
