-- Liams — Tous les badges ne s'adressent pas à tout le monde
--
-- Le catalogue de la 0001 a été écrit pour une personne qui exerce en son nom.
-- Depuis la 0028 un établissement est un professionnel comme un autre, et il
-- s'est retrouvé à cocher des cases qui ne veulent rien dire de lui :
--
--   « Véhiculé(e) » désigne un véhicule personnel pour les trajets. Une crèche
--   ne se déplace pas.
--
--   « Non-fumeur » distingue une personne des autres. Un établissement
--   d'accueil du jeune enfant est non-fumeur par la loi ; l'afficher comme un
--   avantage laisserait croire que les autres ne le sont pas.
--
-- Et « Nounou Extra » nomme un statut de confiance dans une langue qui ne
-- convient qu'à une personne, alors que le statut, lui, vaut pour les deux.

-- =========================================================================
-- À qui s'adresse un badge
-- =========================================================================

alter table public.badges
  add column pour_etablissement boolean not null default true,
  add column pour_independant boolean not null default true;

comment on column public.badges.pour_etablissement is
  'Ce badge a-t-il un sens pour une structure. Faux ne le retire pas des
   badges déjà attribués : il cesse d''être proposé, ce qui est une décision
   d''affichage et non une sanction.';

update public.badges
  set pour_etablissement = false
  where code in ('vehicule', 'non_fumeur');

-- =========================================================================
-- Le même statut, dans la langue de chacun
-- =========================================================================

-- Un second libellé plutôt qu'un second badge : c'est bien la même distinction
-- qu'on accorde, et la dédoubler obligerait à la valider deux fois, à la
-- filtrer deux fois, et à expliquer aux parents pourquoi il y en a deux.
alter table public.badges
  add column label_etablissement text;

comment on column public.badges.label_etablissement is
  'Libellé à employer lorsque le professionnel est un établissement. Nul quand
   le libellé ordinaire convient aux deux.';

update public.badges
  set label_etablissement = 'Établissement Extra'
  where code = 'nounou_extra';

-- =========================================================================
-- L'accueil d'urgence
-- =========================================================================

-- L'urgence existait déjà comme type de créneau : elle disait qu'une place est
-- ouverte ce soir. Elle ne disait pas si le professionnel accepte le principe
-- d'une garde imprévue, ce qu'un parent veut savoir bien avant d'en avoir
-- besoin — au moment de choisir avec qui il s'engage pour l'année.
--
-- Une disposition, donc, et non une disponibilité. La description le dit, pour
-- qu'un professionnel qui coche sans jamais ouvrir de créneau d'urgence sache
-- qu'il n'a rien promis pour ce soir.
--
-- Déclaratif : accepter d'être appelé en urgence n'engage aucune compétence
-- particulière et ne se prouve par aucune pièce. Le contrôler ferait attendre
-- une validation pour une simple intention.
insert into public.badges (code, label, description, source, mode) values
  (
    'accueil_urgence',
    'Accueil d''urgence',
    'Accepte d''être sollicité pour une garde imprévue, quand ses disponibilités le permettent',
    'manuel',
    'auto_declare'
  )
on conflict (code) do nothing;
