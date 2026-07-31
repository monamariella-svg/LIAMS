-- =========================================================================
-- Tarif horaire des créneaux d'urgence
--
-- Un créneau d'urgence se demande entre 20 h et 2 h avant son début (voir
-- lib/urgence.ts) : le professionnel s'organise dans l'urgence, ces créneaux
-- sont donc facturés à part. Le tarif reste facultatif — sans valeur, le
-- tarif horaire habituel s'applique.
-- =========================================================================

alter table public.professional_profiles
  add column tarif_horaire_urgence numeric(6, 2);
