-- =========================================================================
-- Ouvre la lecture des calendriers professionnels à tout utilisateur connecté
--
-- L'ancienne policy limitait la lecture aux pros du réseau du parent : le
-- matching (recherche par jour/horaire, propositions de profils sur les
-- besoins du parent) ne voyait donc jamais les créneaux des pros hors
-- réseau. Les lignes d'availability_slots ne contiennent aucune donnée
-- personnelle (l'identité des réservataires est dans urgent_bookings, qui
-- reste protégée) : un créneau "libre" ou "occupé" est une information de
-- place de marché, comme le profil public du professionnel.
-- =========================================================================

drop policy "availability_slots_select" on public.availability_slots;

create policy "availability_slots_select" on public.availability_slots
  for select using (auth.uid() is not null or public.is_admin());
