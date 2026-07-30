-- =========================================================================
-- Besoins de garde des parents
--
-- Le parent saisit ses besoins dans son propre calendrier (ponctuels ou en
-- série récurrente, comme les créneaux du professionnel), indépendamment de
-- tout professionnel. Le statut affiché (confirmé / en attente / sans
-- professionnel) est calculé au rendu en croisant avec ses réservations.
-- =========================================================================

create table public.besoin_recurrences (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.users (id) on delete cascade,
  -- 0 = lundi ... 6 = dimanche (convention du projet, voir disponibilites.ts)
  jours smallint[] not null check (array_length(jours, 1) >= 1),
  heure_debut time not null,
  heure_fin time not null,
  date_debut date not null,
  date_fin date not null,
  created_at timestamptz not null default now()
);

create table public.besoins_garde (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.users (id) on delete cascade,
  date date not null,
  heure_debut time not null,
  heure_fin time not null,
  recurrence_id uuid references public.besoin_recurrences (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (parent_id, date, heure_debut)
);

create index besoins_garde_parent_date_idx on public.besoins_garde (parent_id, date);
create index besoins_garde_recurrence_idx on public.besoins_garde (recurrence_id);

alter table public.besoin_recurrences enable row level security;
alter table public.besoins_garde enable row level security;

create policy "besoin_recurrences_select" on public.besoin_recurrences
  for select using (parent_id = auth.uid() or public.is_admin());
create policy "besoin_recurrences_write" on public.besoin_recurrences
  for all using (parent_id = auth.uid() or public.is_admin())
  with check (parent_id = auth.uid() or public.is_admin());

create policy "besoins_garde_select" on public.besoins_garde
  for select using (parent_id = auth.uid() or public.is_admin());
create policy "besoins_garde_write" on public.besoins_garde
  for all using (parent_id = auth.uid() or public.is_admin())
  with check (parent_id = auth.uid() or public.is_admin());
