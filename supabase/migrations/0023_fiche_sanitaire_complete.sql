-- Liams — Une vraie fiche sanitaire de liaison
--
-- La fiche ne portait que quatre champs libres : allergies, traitements en
-- cours, contact médecin, contact urgence. C'est très en deçà de ce qu'un
-- professionnel doit savoir pour accueillir un enfant en sécurité, et très en
-- deçà de ce qu'une annexe d'accompagnement contient habituellement.
--
-- Les champs ajoutés s'inspirent de la fiche sanitaire de liaison des accueils
-- collectifs de mineurs et des annexes qui accompagnent un PAI (Projet
-- d'Accueil Individualisé).
--
-- Deux principes ont guidé le choix :
--
-- 1. Ne demander que ce qui sert pendant une garde. Le numéro de sécurité
--    sociale, l'historique complet des vaccins ou le carnet de santé n'ont pas
--    leur place ici : ce sont des données de santé dont personne n'aurait
--    l'usage en gardant un enfant deux heures.
--
-- 2. Séparer ce qui s'urge de ce qui s'explique. Un professionnel qui cherche
--    la conduite à tenir devant une crise ne doit pas la trouver noyée dans un
--    historique médical.

-- =========================================================================
-- Contacts
-- =========================================================================

-- Plusieurs contacts d'urgence plutôt qu'un seul champ libre : un parent
-- injoignable ne doit pas laisser le professionnel sans recours. Le lien de
-- parenté compte autant que le numéro — on n'appelle pas une grand-mère comme
-- on appelle un voisin.
alter table public.enfant_fiche_sante
  add column contacts_urgence jsonb not null default '[]'::jsonb,
  add column personnes_autorisees jsonb not null default '[]'::jsonb,
  add column medecin_nom text,
  add column medecin_telephone text;

comment on column public.enfant_fiche_sante.contacts_urgence is
  'Tableau d''objets {nom, lien, telephone}, dans l''ordre d''appel.';

comment on column public.enfant_fiche_sante.personnes_autorisees is
  'Tableau d''objets {nom, lien, telephone} : qui peut venir chercher
   l''enfant. Sa présence évite au professionnel d''avoir à trancher seul.';

-- =========================================================================
-- Santé
-- =========================================================================

alter table public.enfant_fiche_sante
  add column allergies_alimentaires text,
  add column allergies_medicamenteuses text,
  add column allergies_autres text,
  add column conduite_a_tenir_allergie text,
  add column antecedents_medicaux text,
  add column regime_alimentaire text,
  add column appareillages text,
  add column vaccins_a_jour boolean;

comment on column public.enfant_fiche_sante.conduite_a_tenir_allergie is
  'Que faire en cas de réaction : c''est la ligne qu''on lit dans l''urgence,
   d''où sa séparation d''avec la description des allergies.';

comment on column public.enfant_fiche_sante.appareillages is
  'Lunettes, prothèses auditives, attelles, appareil dentaire — ce qui se perd,
   se casse, ou ne doit pas être retiré.';

-- =========================================================================
-- Projet d'Accueil Individualisé
-- =========================================================================

-- Le PAI est le document qui formalise l'accueil d'un enfant dont l'état de
-- santé demande des aménagements. Savoir qu'il existe, ce qu'il vise et quel
-- protocole il prévoit en urgence est ce qui distingue un accueil averti d'un
-- accueil improvisé.
alter table public.enfant_fiche_sante
  add column pai_existe boolean not null default false,
  add column pai_objet text,
  add column pai_protocole_urgence text;

comment on column public.enfant_fiche_sante.pai_protocole_urgence is
  'Les gestes prévus par le PAI en cas de crise. Se lit debout, dans
   l''urgence : à garder court et impératif.';

-- =========================================================================
-- Autorisation
-- =========================================================================

-- Sans elle, un professionnel confronté à une urgence hésite. Elle est
-- déclarative ici, ce qui ne remplace pas un écrit signé : la mention le dit
-- au parent comme au professionnel.
alter table public.enfant_fiche_sante
  add column autorisation_soins_urgence boolean not null default false,
  add column autorisation_soins_precisions text;

comment on column public.enfant_fiche_sante.autorisation_soins_urgence is
  'Le parent autorise les soins et le transport en urgence. Déclaratif : ne
   remplace pas une autorisation écrite et signée, à prévoir au contrat.';
