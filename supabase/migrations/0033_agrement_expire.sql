-- Liams — Un agrément qui expire ferme la structure, et prévient avant
--
-- Un établissement d'accueil du jeune enfant ne peut pas accueillir sans
-- l'autorisation du président du conseil départemental (CSP, art. L2324-1).
-- Ce n'est pas une pièce administrative de plus au dossier : sans elle,
-- accueillir est illégal. Le refus doit donc être dur, et tenu par la base —
-- un écran qui masque un bouton laisse passer une requête forgée, et c'est
-- l'établissement qui se retrouverait en faute.
--
-- Ce que cette migration installe :
--
--   un créneau ne peut pas être ouvert au-delà de la fin de l'agrément, ni
--   par un établissement dont l'agrément n'est pas renseigné ;
--
--   de quoi tenir le compte des relances, pour que le rappel mensuel parte
--   une fois et non chaque nuit.
--
-- L'annulation des réservations déjà prises au-delà de la date de fin, une
-- semaine avant l'échéance, est faite par la tâche planifiée : elle envoie des
-- emails, ce qu'un trigger n'a pas à faire.

-- =========================================================================
-- Aucun créneau au-delà de l'agrément
-- =========================================================================

create or replace function public.verifier_agrement_creneau()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_numero text;
  v_fin date;
begin
  select e.agrement_numero, e.agrement_fin into v_numero, v_fin
  from public.etablissements e
  where e.professional_id = new.professional_id;

  -- Pas d'établissement : un professionnel indépendant n'a pas d'agrément à
  -- produire, la règle ne le concerne pas.
  if not found then
    return new;
  end if;

  if v_numero is null or v_fin is null then
    raise exception 'Renseignez le numéro et la date de fin de votre agrément avant d''ouvrir des créneaux.'
      using errcode = 'check_violation';
  end if;

  if new.date > v_fin then
    raise exception 'Votre agrément se termine le %. Vous ne pouvez pas ouvrir de créneau au-delà.', to_char(v_fin, 'DD/MM/YYYY')
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger verifier_agrement_creneau
  before insert or update of date, professional_id on public.availability_slots
  for each row execute function public.verifier_agrement_creneau();

-- Un accueil récurrent n'a pas de créneau à contrôler : il porte sa propre
-- fin, éventuellement nulle, qui vaut durée indéterminée. Une durée
-- indéterminée ne peut pas dépasser un agrément qui, lui, se termine.
create or replace function public.verifier_agrement_recurrence()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_fin date;
begin
  select e.agrement_fin into v_fin
  from public.etablissements e
  where e.professional_id = new.professional_id;

  if not found then
    return new;
  end if;

  if v_fin is null then
    raise exception 'Renseignez la date de fin de votre agrément avant d''accepter un accueil récurrent.'
      using errcode = 'check_violation';
  end if;

  if new.date_fin is null or new.date_fin > v_fin then
    raise exception 'Votre agrément se termine le %. Un accueil récurrent ne peut pas aller au-delà.', to_char(v_fin, 'DD/MM/YYYY')
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger verifier_agrement_recurrence
  before insert or update of date_fin, professional_id on public.recurring_bookings
  for each row execute function public.verifier_agrement_recurrence();

-- =========================================================================
-- Le compte des relances
-- =========================================================================

-- La tâche tourne toutes les nuits ; le rappel doit partir une fois par palier
-- et non chaque nuit pendant un mois. La date de fin fait partie de la clé :
-- un agrément renouvelé porte une nouvelle échéance, et la série de relances
-- doit repartir de zéro pour elle.
create table public.etablissement_relances_agrement (
  etablissement_id uuid not null
    references public.etablissements (id) on delete cascade,
  agrement_fin date not null,
  -- Mois restants au moment de l'envoi : 4, 3, 2, 1. Zéro marque l'annulation
  -- des réservations, exécutée une semaine avant l'échéance.
  palier smallint not null check (palier between 0 and 4),
  envoye_le timestamptz not null default now(),
  primary key (etablissement_id, agrement_fin, palier)
);

alter table public.etablissement_relances_agrement enable row level security;

-- Lecture seule, et seulement pour qui est concerné : c'est la trace de ce qui
-- a été envoyé, utile le jour où un établissement affirme n'avoir rien reçu.
-- Personne n'y écrit depuis l'application — seule la tâche planifiée le fait,
-- avec la clé de service.
create policy "relances_agrement_select" on public.etablissement_relances_agrement
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.etablissements e
      where e.id = etablissement_id and public.agit_pour(e.professional_id)
    )
  );

comment on table public.etablissement_relances_agrement is
  'Ce qui a déjà été envoyé à un établissement au sujet de l''échéance de son
   agrément, pour ne pas le lui répéter chaque nuit.';
