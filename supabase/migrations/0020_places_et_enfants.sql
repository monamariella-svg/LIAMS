-- Liams — Les réservations disent enfin pour qui, et les places se comptent
--
-- Une réservation n'enregistrait aucun enfant : on savait qu'un parent
-- réservait chez un professionnel, jamais pour qui. Impossible donc de
-- consommer deux places pour deux enfants, et impossible au professionnel de
-- savoir quel enfant il accueille — alors que la fiche santé et le profil
-- Xtra, seuls documents qui comptent pour accueillir un enfant Xtra, sont
-- attachés à l'enfant.

-- =========================================================================
-- Pour quels enfants
-- =========================================================================

-- Un tableau d'identifiants plutôt qu'une table de liaison : les règles de
-- sécurité de chaque réservation s'appliquent alors telles quelles à la liste
-- des enfants, sans avoir à les réécrire pour trois tables de plus. En
-- contrepartie, la suppression d'un enfant laisse un identifiant orphelin —
-- acceptable, la lecture filtrant sur les enfants réellement existants.
alter table public.urgent_bookings
  add column enfant_ids uuid[] not null default '{}';

alter table public.recurring_bookings
  add column enfant_ids uuid[] not null default '{}';

-- Au niveau de la demande, pas de la ligne : les créneaux d'une même demande
-- concernent les mêmes enfants.
alter table public.demandes_creneaux
  add column enfant_ids uuid[] not null default '{}';

-- =========================================================================
-- La période d'un accueil longue durée
-- =========================================================================

-- Une réservation récurrente n'avait ni début ni fin : elle ne pouvait donc
-- représenter un accueil longue durée, dont le parent fixe la période. Une fin
-- nulle vaut durée indéterminée, cas courant d'un contrat d'assistante
-- maternelle.
alter table public.recurring_bookings
  add column date_debut date,
  add column date_fin date;

update public.recurring_bookings
set date_debut = created_at::date
where date_debut is null;

-- =========================================================================
-- Combien de places sont prises
-- =========================================================================

-- Calculées à la volée plutôt que matérialisées : un accueil à durée
-- indéterminée ne peut pas se matérialiser à l'infini, et une tâche de fond
-- chargée de prolonger l'horizon est une pièce de plus à surveiller.
--
-- En « security definer » : la fonction doit voir toutes les réservations d'un
-- créneau pour le compter juste, y compris celles d'autres familles — qu'elle
-- ne divulgue pas, ne rendant qu'un nombre.
create or replace function public.places_reservees(p_slot_id uuid)
returns integer
language sql stable
security definer set search_path = public
as $$
  with creneau as (
    select id, professional_id, date, heure_debut
    from public.availability_slots
    where id = p_slot_id
  )
  select
    -- Une réservation sans enfant déclaré date d'avant cette migration : elle
    -- occupe une place, comme elle le faisait alors.
    coalesce((
      select sum(greatest(coalesce(array_length(ub.enfant_ids, 1), 1), 1))
      from public.urgent_bookings ub, creneau c
      where ub.slot_id = c.id and ub.statut = 'confirme'
    ), 0)
    + coalesce((
      select sum(greatest(coalesce(array_length(d.enfant_ids, 1), 1), 1))
      from public.demande_creneau_lignes l
      join public.demandes_creneaux d on d.id = l.demande_id
      cross join creneau c
      where l.slot_id = c.id and l.statut = 'accepte'
    ), 0)
    + coalesce((
      select sum(greatest(coalesce(array_length(rb.enfant_ids, 1), 1), 1))
      from public.recurring_bookings rb, creneau c
      where rb.professional_id = c.professional_id
        and rb.statut = 'actif'
        and rb.heure_debut = c.heure_debut
        -- Convention du projet : 0 = lundi (voir disponibilites.ts).
        and rb.jour_semaine = (extract(isodow from c.date)::int - 1)
        and (rb.date_debut is null or rb.date_debut <= c.date)
        and (rb.date_fin is null or rb.date_fin >= c.date)
    ), 0);
$$;

create or replace function public.places_restantes(p_slot_id uuid)
returns integer
language sql stable
security definer set search_path = public
as $$
  select greatest(
    0,
    coalesce((select capacite from public.availability_slots where id = p_slot_id), 0)
      - public.places_reservees(p_slot_id)
  );
$$;

-- Une semaine de calendrier compte des dizaines de créneaux : les interroger
-- un par un ferait autant d'allers-retours. Cette variante répond pour toute
-- une liste d'un coup.
create or replace function public.places_restantes_creneaux(p_slot_ids uuid[])
returns table (slot_id uuid, restantes integer)
language sql stable
security definer set search_path = public
as $$
  select s.id, greatest(0, s.capacite - public.places_reservees(s.id))
  from public.availability_slots s
  where s.id = any(p_slot_ids);
$$;

-- =========================================================================
-- Le garde-fou contre la concurrence
-- =========================================================================

-- L'ancienne contrainte interdisait toute deuxième confirmation sur un
-- créneau : elle contredit frontalement la capacité multiple. On la remplace
-- par la même protection, qui sait compter jusqu'à la capacité.
drop index if exists public.urgent_bookings_one_confirmed_per_slot;

-- Ce contrôle ne remplace pas le filtrage des créneaux complets côté
-- application : il n'attrape que ce que le filtrage ne peut pas voir — deux
-- parents confirmant la dernière place au même instant, chacun ayant vu le
-- créneau libre au moment de l'affichage.
create or replace function public.verifier_capacite_creneau()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  slot_concerne uuid;
  capacite_creneau integer;
begin
  if tg_table_name = 'urgent_bookings' then
    if new.statut <> 'confirme' then return new; end if;
    slot_concerne := new.slot_id;
  else
    if new.statut <> 'accepte' then return new; end if;
    slot_concerne := new.slot_id;
  end if;

  select capacite into capacite_creneau
  from public.availability_slots where id = slot_concerne;

  if public.places_reservees(slot_concerne) > capacite_creneau then
    raise exception 'Ce créneau n''a plus assez de places disponibles.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create constraint trigger urgent_bookings_capacite
  after insert or update on public.urgent_bookings
  deferrable initially immediate
  for each row execute function public.verifier_capacite_creneau();

create constraint trigger demande_lignes_capacite
  after insert or update on public.demande_creneau_lignes
  deferrable initially immediate
  for each row execute function public.verifier_capacite_creneau();
