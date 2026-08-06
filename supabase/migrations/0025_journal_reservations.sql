-- Liams — Journal des étapes d'une réservation
--
-- Une réservation ne portait qu'un statut, écrasé à chaque changement. Quand
-- un professionnel refuse, le « en attente » disparaît sans laisser de trace :
-- on ne sait ni quand le statut a changé, ni qui l'a changé, ni pourquoi.
--
-- En cas de litige, c'est précisément ce qui manque. L'état final ne dit pas
-- si le parent a annulé la veille ou une heure avant, ni si le professionnel
-- avait donné un motif.
--
-- D'où ce journal : une ligne par étape, écrite au moment où elle se produit,
-- jamais modifiée ensuite. Il ne remplace pas les tables de réservation, qui
-- continuent de porter l'état courant — il raconte comment on y est arrivé.

create table public.evenements_reservation (
  id uuid primary key default gen_random_uuid(),
  -- Les deux parties, pour retrouver l'historique par l'une ou par l'autre.
  parent_id uuid references public.users (id) on delete set null,
  professional_id uuid references public.users (id) on delete set null,
  -- Qui a agi : ce n'est pas toujours l'un des deux (un admin peut intervenir).
  acteur_id uuid references public.users (id) on delete set null,
  type text not null,
  -- Ce que l'étape avait de particulier : créneaux, enfants, motif. Libre par
  -- nature, les étapes n'ayant pas les mêmes attributs.
  detail jsonb not null default '{}'::jsonb,
  date timestamptz not null default now()
);

create index evenements_parent_idx on public.evenements_reservation (parent_id, date desc);
create index evenements_pro_idx on public.evenements_reservation (professional_id, date desc);

alter table public.evenements_reservation enable row level security;

-- Lecture réservée à l'admin : c'est un instrument de preuve, pas une donnée
-- de service. Chacun voit par ailleurs ses propres réservations.
create policy "evenements_select_admin" on public.evenements_reservation
  for select using (public.is_admin());

-- Chacun peut consigner ce qu'il fait, et rien d'autre : un acteur ne saurait
-- écrire une étape au nom d'un tiers.
create policy "evenements_insert" on public.evenements_reservation
  for insert with check (acteur_id = auth.uid());

-- Aucune politique de mise à jour ni de suppression : un journal qu'on peut
-- réécrire ne prouve rien.

comment on table public.evenements_reservation is
  'Journal en écriture seule des étapes d''une réservation. Sert en cas de
   litige : qui a fait quoi, quand, et avec quel motif.';
