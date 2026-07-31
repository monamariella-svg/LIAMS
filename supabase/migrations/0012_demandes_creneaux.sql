-- =========================================================================
-- Demandes groupées de créneaux (parent -> professionnel)
--
-- Un parent dont le besoin s'étale sur plusieurs dates ne veut pas envoyer
-- une demande par créneau : il coche les créneaux du professionnel qui
-- correspondent à son besoin et envoie le tout d'un coup. Le professionnel
-- reçoit la liste, décoche ce qui ne lui convient pas, et valide le reste.
-- Chaque ligne porte donc son propre statut.
-- =========================================================================

create table public.demandes_creneaux (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.users (id) on delete cascade,
  professional_id uuid not null references public.users (id) on delete cascade,
  statut text not null default 'en_attente'
    check (statut in ('en_attente', 'traitee', 'annulee')),
  created_at timestamptz not null default now()
);

create index demandes_creneaux_pro_idx on public.demandes_creneaux (professional_id, statut);
create index demandes_creneaux_parent_idx on public.demandes_creneaux (parent_id);

create table public.demande_creneau_lignes (
  id uuid primary key default gen_random_uuid(),
  demande_id uuid not null references public.demandes_creneaux (id) on delete cascade,
  slot_id uuid not null references public.availability_slots (id) on delete cascade,
  statut text not null default 'propose'
    check (statut in ('propose', 'accepte', 'refuse')),
  unique (demande_id, slot_id)
);

create index demande_creneau_lignes_demande_idx on public.demande_creneau_lignes (demande_id);

alter table public.demandes_creneaux enable row level security;
alter table public.demande_creneau_lignes enable row level security;

create policy "demandes_creneaux_select" on public.demandes_creneaux
  for select using (
    parent_id = auth.uid() or professional_id = auth.uid() or public.is_admin()
  );
create policy "demandes_creneaux_insert" on public.demandes_creneaux
  for insert with check (parent_id = auth.uid() or public.is_admin());
-- Le parent peut annuler, le professionnel peut marquer la demande traitée.
create policy "demandes_creneaux_update" on public.demandes_creneaux
  for update using (
    parent_id = auth.uid() or professional_id = auth.uid() or public.is_admin()
  );

create policy "demande_creneau_lignes_select" on public.demande_creneau_lignes
  for select using (
    exists (
      select 1 from public.demandes_creneaux d
      where d.id = demande_id
        and (d.parent_id = auth.uid() or d.professional_id = auth.uid())
    )
    or public.is_admin()
  );
create policy "demande_creneau_lignes_insert" on public.demande_creneau_lignes
  for insert with check (
    exists (
      select 1 from public.demandes_creneaux d
      where d.id = demande_id and d.parent_id = auth.uid()
    )
    or public.is_admin()
  );
create policy "demande_creneau_lignes_update" on public.demande_creneau_lignes
  for update using (
    exists (
      select 1 from public.demandes_creneaux d
      where d.id = demande_id and d.professional_id = auth.uid()
    )
    or public.is_admin()
  );
