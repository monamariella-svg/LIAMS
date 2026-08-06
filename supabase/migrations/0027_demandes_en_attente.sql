-- Liams — Savoir qu'une place est déjà convoitée
--
-- Deux familles peuvent demander la même dernière place : on ne les fait pas
-- attendre chacune leur tour, ce serait pire en urgence. Mais la seconde doit
-- le savoir avant de demander, plutôt que de découvrir un refus alors qu'elle
-- cherchait une solution pour le soir même.
--
-- Une fonction plutôt qu'une règle de lecture élargie : un parent n'a pas à
-- voir les réservations des autres familles, seulement à savoir combien de
-- demandes attendent. La fonction ne rend qu'un nombre.

create or replace function public.demandes_en_attente_creneaux(p_slot_ids uuid[])
returns table (slot_id uuid, en_attente integer)
language sql stable
security definer set search_path = public
as $$
  select
    s.id,
    coalesce((
      select count(*)::integer
      from public.urgent_bookings ub
      where ub.slot_id = s.id
        and ub.statut = 'en_attente'
        -- Les siennes ne l'intéressent pas : elle sait déjà les avoir faites,
        -- et l'application l'empêche par ailleurs d'en refaire.
        and ub.parent_id <> auth.uid()
    ), 0)
  from public.availability_slots s
  where s.id = any(p_slot_ids);
$$;

comment on function public.demandes_en_attente_creneaux(uuid[]) is
  'Nombre de demandes d''urgence en attente sur chaque créneau, hors celles de
   l''appelant. Ne révèle ni qui a demandé, ni pour quel enfant.';
