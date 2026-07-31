-- =========================================================================
-- Zone géographique du parent : ville OU trajet, dans les deux cas assortie
-- d'une distance d'éloignement en km.
--
-- Jusqu'ici le point de départ était implicitement l'adresse du profil et le
-- couloir de trajet était figé à 3 km. Le parent choisit désormais
-- explicitement son mode, et le rayon saisi s'applique aux deux : distance
-- autour de la ville, ou largeur du couloir autour du trajet.
-- =========================================================================

alter table public.parent_profiles
  add column mode_zone text not null default 'ville'
    check (mode_zone in ('ville', 'trajet')),
  add column ville text,
  add column ville_latitude double precision,
  add column ville_longitude double precision;
