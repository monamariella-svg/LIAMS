-- Liams — Une crèche ouvre plusieurs sections à la même heure
--
-- La 0001 tenait un créneau pour unique par professionnel, date et heure de
-- début. C'était vrai d'une assistante maternelle : elle est disponible, ou
-- elle ne l'est pas, et son planning n'a qu'une ligne à 16h.
--
-- Un établissement, lui, ouvre plusieurs sections en même temps. « Deux bébés
-- et deux moyens de 16h à 18h » est le fonctionnement ordinaire d'une crèche,
-- et le schéma le refusait : la deuxième ligne violait la contrainte. La
-- structure devait choisir une section et taire l'autre.
--
-- La contradiction était déjà écrite ailleurs. Le calcul des propositions pour
-- une fratrie, depuis la 0039, suppose noir sur blanc que deux enfants d'âges
-- différents « occupent deux créneaux distincts à la même heure ». La
-- recherche attendait donc ce que la base interdisait.
--
-- Ce qui reste unique, c'est un créneau *par section* : rouvrir deux fois la
-- même section au même horaire n'ouvrirait pas de place, cela dédoublerait la
-- même.

alter table public.availability_slots
  drop constraint if exists availability_slots_professional_id_date_heure_debut_key;

-- `nulls not distinct` est indispensable ici. Sans lui, Postgres tient deux
-- NULL pour différents et un professionnel indépendant — dont les créneaux ne
-- portent aucune section — pourrait en créer autant qu'il veut à 16h, ce que
-- la 0001 empêchait justement.
alter table public.availability_slots
  add constraint availability_slots_creneau_par_section
    unique nulls not distinct (professional_id, date, heure_debut, tranche_id);

comment on constraint availability_slots_creneau_par_section
  on public.availability_slots is
  'Un créneau par section et par horaire. Une crèche ouvre ses sections en
   parallèle ; un indépendant, qui n''en a pas, retrouve l''unicité par
   horaire que garantissait la 0001.';
