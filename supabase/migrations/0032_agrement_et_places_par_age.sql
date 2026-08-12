-- Liams — L'agrément a une durée, et des places qui se comptent par âge
--
-- La fiche de la 0028 traitait l'agrément comme un numéro et une date, et la
-- capacité comme un nombre unique. Les deux sont faux.
--
-- Un agrément est valable d'une date à une autre. Un établissement dont
-- l'agrément a expiré n'est pas un établissement dont la fiche est incomplète :
-- c'est une structure qui n'a plus le droit d'accueillir. Sans date de fin,
-- rien ne permet de le savoir, et c'est précisément ce qu'un parent vient
-- vérifier.
--
-- Quant aux places, elles ne se comptent jamais globalement : un agrément dit
-- combien d'enfants par section, et la différence entre un bébé de six mois et
-- un enfant de trois ans est toute la question. Un total de trente places ne
-- dit pas si celle qu'une famille cherche existe.

-- =========================================================================
-- La durée de l'agrément
-- =========================================================================

alter table public.etablissements
  rename column agrement_date to agrement_debut;

alter table public.etablissements
  add column agrement_fin date;

comment on column public.etablissements.agrement_fin is
  'Fin de validité de l''agrément PMI. Nulle tant qu''elle n''est pas
   renseignée — ce qui vaut agrément non vérifiable, pas agrément valide.';

-- Vrai seulement si la fin est renseignée et pas encore passée. Une fin nulle
-- répond faux : « on ne sait pas » ne peut pas valoir « oui » lorsqu'il s'agit
-- du droit d'accueillir des enfants. Un établissement sans fiche du tout
-- répond faux également.
create or replace function public.agrement_valide(p_professional_id uuid)
returns boolean
language sql stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.etablissements e
    where e.professional_id = p_professional_id
      and e.agrement_numero is not null
      and e.agrement_fin is not null
      and e.agrement_fin >= current_date
  );
$$;

comment on function public.agrement_valide(uuid) is
  'Vrai si cet établissement a un agrément renseigné et non expiré. Faux pour
   un professionnel indépendant, qui n''en a pas : à n''appeler que sur un
   compte dont on sait qu''il porte un établissement.';

-- =========================================================================
-- Le représentant
-- =========================================================================

-- Le nom du représentant vit désormais dans `identites`, comme pour tout le
-- monde : c'est une personne, et c'est elle qui répond du compte. Ne reste ici
-- que sa place dans la structure, qui appartient à l'établissement et non à
-- elle. Garder les deux aurait laissé deux endroits où écrire le même nom, et
-- deux occasions de le laisser diverger.
alter table public.etablissements
  add column representant_fonction text;

alter table public.etablissements
  drop column representant_legal;

-- =========================================================================
-- L'assurance de la structure
-- =========================================================================

-- Elle figurait dans `donnees_contractuelles`, table pensée pour une personne
-- qui exerce en son nom — on y trouve sa date et son lieu de naissance. Pour
-- un établissement, l'assurance est celle de l'entreprise et n'a rien à faire
-- dans le dossier personnel de sa directrice.
alter table public.etablissements
  add column assurance_assureur text,
  add column assurance_numero text,
  add column assurance_expiration date;

-- =========================================================================
-- Les places, par tranche d'âge
-- =========================================================================

-- Les tranches ne sont pas imposées : un multi-accueil ne découpe pas ses
-- sections comme une micro-crèche, et un agrément se lit tel qu'il est écrit.
-- L'établissement déclare donc les siennes, avec leurs bornes et leur nombre
-- de places.
--
-- En mois, comme les créneaux depuis la 0028 : c'est la seule unité qui
-- distingue un bébé de six mois d'un enfant de dix-huit.
create table public.etablissement_tranches (
  id uuid primary key default gen_random_uuid(),
  etablissement_id uuid not null
    references public.etablissements (id) on delete cascade,
  libelle text,
  age_min_mois smallint not null check (age_min_mois >= 0),
  age_max_mois smallint not null check (age_max_mois >= 0),
  places smallint not null check (places > 0),
  ordre smallint not null default 0,
  check (age_max_mois > age_min_mois)
);

create index etablissement_tranches_etablissement_idx
  on public.etablissement_tranches (etablissement_id, ordre);

-- Le total agréé se lit maintenant par la somme des tranches : le garder à
-- part invitait à ce que les deux se contredisent.
alter table public.etablissements drop column agrement_places;

-- =========================================================================
-- Qui voit quoi
-- =========================================================================

alter table public.etablissement_tranches enable row level security;

-- Publiques comme la fiche : un parent doit pouvoir voir que la structure
-- accueille des enfants de l'âge du sien, et combien.
create policy "etablissement_tranches_select" on public.etablissement_tranches
  for select using (true);

create policy "etablissement_tranches_write" on public.etablissement_tranches
  for all using (
    public.is_admin()
    or exists (
      select 1 from public.etablissements e
      where e.id = etablissement_id and public.est_titulaire(e.professional_id)
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.etablissements e
      where e.id = etablissement_id and public.est_titulaire(e.professional_id)
    )
  );

-- =========================================================================
-- Les pièces d'un établissement
-- =========================================================================

-- Un établissement ne dépose ni CV ni diplôme : il dépose ce qui atteste son
-- droit d'exercer. Le bulletin n°3 reste demandé, mais c'est celui du
-- représentant — la personne, pas la structure.
alter type document_type add value if not exists 'agrement';
alter type document_type add value if not exists 'assurance';
