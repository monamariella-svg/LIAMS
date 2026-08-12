-- Liams — Trois façons de compter des places, qu'on cessait de distinguer
--
-- La 0032 avait écrit que « le total agréé se lit par la somme des tranches »,
-- et supprimé `agrement_places` en conséquence. C'était confondre deux
-- questions différentes, et en oublier une troisième. Il y en a trois :
--
--   1. Ce que l'agrément AUTORISE, par tranche. C'est le département qui le
--      fixe, l'établissement ne fait que le recopier. Il ne bouge qu'au
--      renouvellement.
--
--   2. Ce que l'établissement OUVRE réellement, par tranche. Toujours
--      inférieur ou égal au premier : une section fermée faute
--      d'encadrement reste agréée, mais n'accueille personne. L'écart entre
--      les deux est une information en soi, et le confondre avec zéro
--      reviendrait à croire l'agrément perdu.
--
--   3. Ce qui est PROPOSÉ sur un créneau donné, un mardi de 8h à 12h. C'est
--      `availability_slots.capacite`, qui existe depuis la 0019, et dont
--      `places_restantes()` déduit ce qu'il reste une fois les réservations
--      décomptées. C'est le seul des trois chiffres qu'une famille voit.
--
-- Le troisième ne se rattachait à aucun âge. La 0028 avait pourtant ajouté
-- `age_min_mois` et `age_max_mois` sur les créneaux — colonnes restées mortes,
-- que rien n'écrivait ni ne lisait. Une crèche ouvrait donc « six places »
-- sans dire pour quelle section, ce qui ne veut rien dire dans un
-- établissement : six places bébés et six places grands ne se remplacent pas.

-- =========================================================================
-- 1 et 2 — ce qui est agréé, ce qui est ouvert
-- =========================================================================

alter table public.etablissement_tranches
  rename column places to places_ouvertes;

alter table public.etablissement_tranches
  add column places_agreees smallint;

-- Ce qui était saisi jusqu'ici valait pour les deux, faute de pouvoir les
-- distinguer. On ne peut pas deviner mieux : l'établissement corrigera si son
-- agrément l'autorise à davantage.
update public.etablissement_tranches
  set places_agreees = places_ouvertes
  where places_agreees is null;

alter table public.etablissement_tranches
  alter column places_agreees set not null,
  add constraint etablissement_tranches_places_agreees_positif
    check (places_agreees > 0),
  -- Ouvrir plus de places que le département n'en autorise est précisément ce
  -- que l'agrément interdit.
  add constraint etablissement_tranches_ouvertes_sous_agreees
    check (places_ouvertes <= places_agreees);

comment on column public.etablissement_tranches.places_agreees is
  'Ce que l''agrément autorise pour cette tranche. Recopié de l''arrêté, ne
   bouge qu''au renouvellement.';

comment on column public.etablissement_tranches.places_ouvertes is
  'Ce que l''établissement exploite réellement. Inférieur ou égal aux places
   agréées — une section fermée faute d''encadrement reste agréée.';

-- =========================================================================
-- 3 — un créneau dit pour quelle section il est ouvert
-- =========================================================================

-- Nul pour un professionnel indépendant : il n'a pas de sections, et ses
-- créneaux n'en désigneront jamais.
--
-- `on delete restrict` : retirer une tranche qui porte des créneaux effacerait
-- silencieusement la section à laquelle des familles ont réservé. Le refus
-- remonte à l'application, qui sait le dire.
alter table public.availability_slots
  add column tranche_id uuid
    references public.etablissement_tranches (id) on delete restrict;

alter table public.slot_recurrences
  add column tranche_id uuid
    references public.etablissement_tranches (id) on delete restrict;

create index availability_slots_tranche_idx
  on public.availability_slots (tranche_id)
  where tranche_id is not null;

comment on column public.availability_slots.tranche_id is
  'La section pour laquelle ce créneau est ouvert. Les âges du créneau en
   découlent, et sa capacité ne peut pas dépasser les places ouvertes de la
   tranche.';

-- =========================================================================
-- Ce que la base tient elle-même
-- =========================================================================

create or replace function public.verifier_tranche_creneau()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_age_min smallint;
  v_age_max smallint;
  v_ouvertes smallint;
  v_a_des_tranches boolean;
begin
  if new.tranche_id is null then
    -- Un établissement qui a déclaré ses sections doit dire de laquelle il
    -- s'agit : sans cela, la capacité du créneau ne se rattache à aucun
    -- agrément et ne veut rien dire.
    --
    -- Un établissement qui n'en a pas encore déclaré n'est pas bloqué : il
    -- vient de s'inscrire, et l'enfermer avant qu'il ait commencé le
    -- laisserait sans issue. C'est la même prudence que pour l'agrément non
    -- renseigné, en 0033.
    select exists (
      select 1
      from public.etablissements e
      join public.etablissement_tranches t on t.etablissement_id = e.id
      where e.professional_id = new.professional_id
    ) into v_a_des_tranches;

    -- À l'insertion seulement. Un établissement qui déclare ses sections après
    -- coup garde des créneaux plus anciens qui n'en portent pas ; lui refuser
    -- d'en corriger la capacité l'obligerait à les supprimer, et avec eux les
    -- gardes qu'ils portent.
    if tg_op = 'INSERT' and v_a_des_tranches then
      raise exception 'Indiquez la section pour laquelle ce créneau est ouvert.'
        using errcode = 'check_violation';
    end if;

    return new;
  end if;

  -- La tranche doit être une des siennes. Sans cette vérification, un compte
  -- pourrait accrocher ses créneaux aux sections d'une autre crèche et
  -- emprunter son agrément.
  select t.age_min_mois, t.age_max_mois, t.places_ouvertes
    into v_age_min, v_age_max, v_ouvertes
  from public.etablissement_tranches t
  join public.etablissements e on e.id = t.etablissement_id
  where t.id = new.tranche_id
    and e.professional_id = new.professional_id;

  if not found then
    raise exception 'Cette section n''appartient pas à votre établissement.'
      using errcode = 'check_violation';
  end if;

  if new.capacite > v_ouvertes then
    raise exception 'Cette section compte % places ouvertes : vous ne pouvez pas en proposer % sur un créneau.', v_ouvertes, new.capacite
      using errcode = 'check_violation';
  end if;

  -- Les âges ne se saisissent pas deux fois. Ils sont ceux de la section, et
  -- les recopier ici évite d'avoir à joindre la tranche pour lire un créneau —
  -- la recherche interroge des créneaux, pas des établissements.
  new.age_min_mois := v_age_min;
  new.age_max_mois := v_age_max;

  return new;
end;
$$;

create trigger verifier_tranche_creneau
  before insert or update of tranche_id, capacite, professional_id
  on public.availability_slots
  for each row execute function public.verifier_tranche_creneau();

comment on function public.verifier_tranche_creneau() is
  'Rattache un créneau à une section de son propre établissement, en recopie
   les âges et refuse d''y ouvrir plus de places que la section n''en exploite.';
