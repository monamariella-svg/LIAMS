-- Liams — Le créneau cesse d'être un interrupteur
--
-- Jusqu'ici un créneau portait un unique champ `statut` valant libre,
-- libre_urgence ou occupe. Ce seul champ mélangeait trois questions que le
-- produit doit désormais distinguer : le créneau est-il disponible, pour quel
-- type d'accueil, et pour combien d'enfants.
--
-- Cette migration ajoute ce que le professionnel déclare. Le décompte réel des
-- places, lui, viendra avec les réservations qui portent enfin les enfants
-- concernés — aujourd'hui une réservation ne dit pas pour qui elle est faite,
-- ce qui interdit de consommer deux places pour deux enfants.

-- =========================================================================
-- Vocabulaire
-- =========================================================================

-- Crèches et haltes-garderies sont volontairement absentes : ce sont des
-- établissements, dont le calendrier est celui de la structure et non d'une
-- personne. Elles feront l'objet d'un type de compte distinct.
create type type_professionnel as enum (
  'assistante_maternelle',
  'auxiliaire_puericulture',
  'auxiliaire_vie',
  'educateur_jeunes_enfants',
  'garde_domicile',
  'aesh',
  'autre'
);

-- Ce que « chez le professionnel » veut dire concrètement. Facultatif : une
-- garde d'enfants qui n'exerce qu'au domicile des familles n'a rien à y
-- déclarer.
create type cadre_exercice as enum ('domicile', 'mam');

-- « Longue durée » plutôt qu'« annuel » : la période est fixée par le parent
-- et peut dépasser l'année comme rester en deçà. Nommer une durée qu'on ne
-- maîtrise pas induirait en erreur.
create type type_accueil as enum ('longue_duree', 'ponctuel', 'urgence');

-- Sur le profil, « les_deux » signifie que le professionnel tranchera créneau
-- par créneau. Sur un créneau, ce choix n'a plus de sens : il faut dire où.
create type lieu_accueil as enum ('domicile_parent', 'chez_le_pro', 'les_deux');

-- =========================================================================
-- Ce que le professionnel déclare une fois pour toutes
-- =========================================================================

alter table public.professional_profiles
  add column type_professionnel type_professionnel,
  add column cadre_exercice cadre_exercice,
  add column lieu_accueil lieu_accueil not null default 'chez_le_pro',
  add column types_accueil type_accueil[] not null default '{ponctuel}';

comment on column public.professional_profiles.types_accueil is
  'Types d''accueil que le professionnel accepte, tous créneaux confondus.
   Sert à filtrer les propositions avant même de regarder les disponibilités.';

comment on column public.professional_profiles.lieu_accueil is
  'Où le professionnel accepte d''accueillir. « les_deux » signifie qu''il
   tranchera créneau par créneau.';

-- =========================================================================
-- Ce qu'il précise créneau par créneau
-- =========================================================================

-- La capacité par défaut vaut 1 : c'est le comportement actuel, où un créneau
-- réservé était perdu pour tout le monde. Les créneaux existants gardent donc
-- exactement le sens qu'ils avaient.
alter table public.availability_slots
  add column capacite smallint not null default 1 check (capacite between 1 and 20),
  add column types_accueil type_accueil[] not null default '{ponctuel}',
  add column lieu_accueil lieu_accueil
    check (lieu_accueil is null or lieu_accueil <> 'les_deux');

comment on column public.availability_slots.capacite is
  'Nombre d''enfants accueillis simultanément. Une réservation consomme autant
   de places que d''enfants concernés : deux enfants sur un créneau de deux
   places le rendent indisponible.';

alter table public.slot_recurrences
  add column capacite smallint not null default 1 check (capacite between 1 and 20),
  add column types_accueil type_accueil[] not null default '{ponctuel}',
  add column lieu_accueil lieu_accueil
    check (lieu_accueil is null or lieu_accueil <> 'les_deux');

-- Les créneaux déclarés « libre_urgence » disaient déjà accepter l'urgence :
-- on traduit cette information dans le nouveau vocabulaire plutôt que de la
-- perdre. Le champ statut reste en place le temps que les réservations sachent
-- décompter les places.
update public.availability_slots
set types_accueil = '{ponctuel,urgence}'
where statut = 'libre_urgence';

update public.slot_recurrences
set types_accueil = '{ponctuel,urgence}'
where statut = 'libre_urgence';

-- Un créneau doit servir à quelque chose.
alter table public.availability_slots
  add constraint availability_slots_types_accueil_non_vide
  check (array_length(types_accueil, 1) >= 1);

alter table public.slot_recurrences
  add constraint slot_recurrences_types_accueil_non_vide
  check (array_length(types_accueil, 1) >= 1);

-- Recherche par type d'accueil : c'est le premier filtre de toute proposition.
create index availability_slots_types_accueil_idx
  on public.availability_slots using gin (types_accueil);

create index professional_profiles_types_accueil_idx
  on public.professional_profiles using gin (types_accueil);
