-- Liams — la réservation récurrente (4.6.5) nécessite une validation ponctuelle du
-- professionnel avant de devenir active ("le professionnel valide une seule fois la
-- récurrence"). Le schéma initial (0001) ne prévoyait que 'actif'/'annule' ; on ajoute
-- l'état intermédiaire 'en_attente'.

alter table public.recurring_bookings drop constraint if exists recurring_bookings_statut_check;
alter table public.recurring_bookings alter column statut set default 'en_attente';
alter table public.recurring_bookings
  add constraint recurring_bookings_statut_check check (statut in ('en_attente', 'actif', 'annule'));
