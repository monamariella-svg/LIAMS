-- Liams — Les établissements d'accueil du jeune enfant
--
-- Une crèche n'est pas un professionnel d'un genre particulier : son
-- calendrier est celui de la structure, pas d'une éducatrice. Elle n'a pas de
-- casier judiciaire personnel mais un agrément PMI, pas de « mon domicile »
-- mais une adresse d'établissement, et une capacité qui se compte en dizaines.
--
-- Elle reçoit néanmoins un profil professionnel, et ce n'est pas une facilité :
-- tout ce qui rend quelqu'un réservable — créneaux, capacité, décompte des
-- places, réservations portant les enfants, accès aux fiches pendant la garde,
-- demandes d'urgence — y est accroché. Lui donner une nature séparée
-- reviendrait à écrire tout cela en double, et à le maintenir en double.
--
-- L'établissement a donc deux faces : un profil professionnel qui le rend
-- réservable comme les autres, et cette fiche-ci, qui porte ce qui n'appartient
-- qu'à lui.

alter type user_role add value if not exists 'etablissement';

create type type_etablissement as enum (
  'creche_collective',
  'micro_creche',
  'halte_garderie',
  'multi_accueil',
  'autre'
);

create table public.etablissements (
  id uuid primary key default gen_random_uuid(),
  -- Le compte qui porte le calendrier. Les autres membres agissent en son nom.
  professional_id uuid not null unique
    references public.professional_profiles (user_id) on delete cascade,

  -- Identité de l'entreprise : pour un établissement, ce ne sont pas des
  -- informations complémentaires, ce sont ses papiers.
  raison_sociale text not null,
  siret text,
  forme_juridique text,
  adresse_siege text,
  representant_legal text,

  type_etablissement type_etablissement not null default 'creche_collective',

  -- L'agrément remplace le casier judiciaire : c'est lui qui atteste que la
  -- structure est autorisée à accueillir des enfants. Une halte-garderie y est
  -- soumise au même titre qu'une crèche, étant un établissement d'accueil du
  -- jeune enfant.
  agrement_numero text,
  agrement_date date,
  agrement_places smallint,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.etablissements
  for each row execute function public.set_updated_at();

-- =========================================================================
-- Les membres
-- =========================================================================

-- Plusieurs comptes plutôt qu'un seul partagé : la confirmation de lecture
-- d'une fiche sanitaire doit désigner quelqu'un. « La crèche a lu » ne vaut
-- rien le jour où un incident est examiné.
create table public.etablissement_membres (
  etablissement_id uuid not null references public.etablissements (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  fonction text,
  created_at timestamptz not null default now(),
  primary key (etablissement_id, user_id)
);

create index etablissement_membres_user_idx on public.etablissement_membres (user_id);

-- Cinq membres : assez pour une équipe, assez peu pour qu'un accès reste
-- attribuable à une personne.
create or replace function public.limiter_membres_etablissement()
returns trigger
language plpgsql
as $$
begin
  if (
    select count(*) from public.etablissement_membres
    where etablissement_id = new.etablissement_id
  ) > 5 then
    raise exception 'Un établissement ne peut pas compter plus de 5 comptes.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create constraint trigger etablissement_membres_limite
  after insert on public.etablissement_membres
  deferrable initially immediate
  for each row execute function public.limiter_membres_etablissement();

-- =========================================================================
-- Agir au nom de l'établissement
-- =========================================================================

-- Les règles existantes comparent partout `professional_id` à `auth.uid()` :
-- elles supposent qu'un professionnel est une personne. Cette fonction dit si
-- l'appelant agit légitimement pour ce compte — lui-même, ou membre de
-- l'établissement qui le porte.
--
-- Les règles seront reprises pour l'utiliser ; tant que ce n'est pas fait,
-- seul le compte principal peut agir.
create or replace function public.agit_pour(p_professional_id uuid)
returns boolean
language sql stable
security definer set search_path = public
as $$
  select
    p_professional_id = auth.uid()
    or exists (
      select 1
      from public.etablissement_membres m
      join public.etablissements e on e.id = m.etablissement_id
      where m.user_id = auth.uid()
        and e.professional_id = p_professional_id
    );
$$;

-- =========================================================================
-- Les tranches d'âge
-- =========================================================================

-- Un agrément précise un nombre de places et des âges. Sans cette notion,
-- l'outil ne convient pas à un établissement : il ne peut pas déclarer trois
-- places sans dire pour quels âges.
--
-- En mois plutôt qu'en années : la différence entre un enfant de six mois et
-- un de dix-huit est précisément ce qui sépare deux sections.
alter table public.availability_slots
  add column age_min_mois smallint check (age_min_mois >= 0),
  add column age_max_mois smallint check (age_max_mois >= 0);

alter table public.slot_recurrences
  add column age_min_mois smallint check (age_min_mois >= 0),
  add column age_max_mois smallint check (age_max_mois >= 0);

comment on column public.availability_slots.age_min_mois is
  'Âge minimum accueilli sur ce créneau, en mois. Nul : sans limite déclarée.';

-- =========================================================================
-- Qui voit quoi
-- =========================================================================

alter table public.etablissements enable row level security;
alter table public.etablissement_membres enable row level security;

-- La fiche d'un établissement est publique dans ses grandes lignes : un parent
-- doit pouvoir vérifier l'agrément de la structure à qui il confie son enfant.
create policy "etablissements_select" on public.etablissements
  for select using (true);

create policy "etablissements_write" on public.etablissements
  for all using (public.agit_pour(professional_id) or public.is_admin())
  with check (public.agit_pour(professional_id) or public.is_admin());

create policy "etablissement_membres_select" on public.etablissement_membres
  for select using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.etablissements e
      where e.id = etablissement_id and public.agit_pour(e.professional_id)
    )
  );

create policy "etablissement_membres_write" on public.etablissement_membres
  for all using (
    public.is_admin()
    or exists (
      select 1 from public.etablissements e
      where e.id = etablissement_id and e.professional_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.etablissements e
      where e.id = etablissement_id and e.professional_id = auth.uid()
    )
  );
