-- =========================================================================
-- Séries de créneaux récurrents du professionnel (4.6)
--
-- Jusqu'ici, le formulaire "créneaux récurrents" générait des
-- availability_slots individuels sans lien entre eux : impossible de
-- modifier ou supprimer la série d'un coup. Cette migration ajoute
-- l'entité de série et rattache les créneaux générés via recurrence_id.
-- =========================================================================

create table public.slot_recurrences (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles (user_id) on delete cascade,
  -- 0 = lundi ... 6 = dimanche (convention du projet, voir disponibilites.ts)
  jours smallint[] not null check (array_length(jours, 1) >= 1),
  heure_debut time not null,
  heure_fin time not null,
  statut slot_statut not null default 'libre' check (statut <> 'occupe'),
  date_debut date not null,
  date_fin date not null,
  created_at timestamptz not null default now()
);

-- Les créneaux d'une série supprimée redeviennent des créneaux "simples"
-- (on delete set null) : on ne touche jamais aux créneaux occupés.
alter table public.availability_slots
  add column recurrence_id uuid references public.slot_recurrences (id) on delete set null;

create index availability_slots_recurrence_idx
  on public.availability_slots (recurrence_id);

alter table public.slot_recurrences enable row level security;

create policy "slot_recurrences_select" on public.slot_recurrences
  for select using (professional_id = auth.uid() or public.is_admin());
create policy "slot_recurrences_write" on public.slot_recurrences
  for all using (professional_id = auth.uid() or public.is_admin())
  with check (professional_id = auth.uid() or public.is_admin());
