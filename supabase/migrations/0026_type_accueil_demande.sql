-- Liams — Une demande dit ce qu'elle cherche, et se voit refuser sinon
--
-- Le professionnel déclare depuis le lot 1 les types d'accueil qu'il accepte,
-- créneau par créneau. Rien ne s'en servait : un parent pouvait demander un
-- créneau ponctuel à une assistante maternelle qui ne veut que des contrats
-- longue durée, et elle devait refuser à la main.
--
-- C'est une contrainte de métier, pas un confort : une assistante maternelle a
-- un agrément pour un nombre de places, et son intérêt est de les remplir en
-- contrats annuels. Un créneau ponctuel lui coûte une place qu'elle réservait
-- à un contrat.
--
-- Un filtre d'affichage ne suffirait pas — rien n'empêche une requête forgée.
-- Le refus se fait donc en base, comme celui qui protège la capacité.

alter table public.demandes_creneaux
  add column type_accueil type_accueil not null default 'ponctuel';

alter table public.recurring_bookings
  add column type_accueil type_accueil not null default 'longue_duree';

comment on column public.demandes_creneaux.type_accueil is
  'Ce que le parent cherche. Doit figurer parmi les types d''accueil de chaque
   créneau demandé, faute de quoi la ligne est refusée.';

comment on column public.recurring_bookings.type_accueil is
  'Une réservation récurrente vaut longue durée par défaut : c''est le contrat
   régulier qu''elle représente le plus souvent.';

-- =========================================================================
-- Le refus
-- =========================================================================

create or replace function public.verifier_type_accueil()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  type_demande type_accueil;
  types_acceptes type_accueil[];
begin
  if tg_table_name = 'demande_creneau_lignes' then
    select d.type_accueil into type_demande
    from public.demandes_creneaux d
    where d.id = new.demande_id;

    select s.types_accueil into types_acceptes
    from public.availability_slots s
    where s.id = new.slot_id;
  else
    -- Une réservation récurrente ne vise aucun créneau : on la confronte à ce
    -- que le professionnel accepte au global.
    type_demande := new.type_accueil;

    select p.types_accueil into types_acceptes
    from public.professional_profiles p
    where p.user_id = new.professional_id;
  end if;

  if type_demande is not null
     and types_acceptes is not null
     and not (type_demande = any(types_acceptes)) then
    raise exception 'Ce professionnel ne propose pas ce type d''accueil sur ce créneau.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create constraint trigger demande_lignes_type_accueil
  after insert on public.demande_creneau_lignes
  deferrable initially immediate
  for each row execute function public.verifier_type_accueil();

create constraint trigger recurring_bookings_type_accueil
  after insert on public.recurring_bookings
  deferrable initially immediate
  for each row execute function public.verifier_type_accueil();
