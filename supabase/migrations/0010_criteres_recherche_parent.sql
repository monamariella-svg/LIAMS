-- =========================================================================
-- Critères de recherche persistants du parent
--
-- La page de recherche redemandait à chaque fois des critères qui, eux, ne
-- changent pas d'un besoin à l'autre (badges souhaités, rayon, trajet
-- domicile → école). Ils deviennent des préférences du profil parent,
-- saisies une fois et appliquées à toutes les propositions de profils.
-- Le "quand" reste porté par les besoins de garde (migration 0008).
-- =========================================================================

alter table public.parent_profiles
  add column badges_souhaites text[] not null default '{}',
  add column rayon_km numeric(5, 1),
  add column trajet_depart text,
  add column trajet_depart_latitude double precision,
  add column trajet_depart_longitude double precision,
  add column trajet_arrivee text,
  add column trajet_arrivee_latitude double precision,
  add column trajet_arrivee_longitude double precision;
