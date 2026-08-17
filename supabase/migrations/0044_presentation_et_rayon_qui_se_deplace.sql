-- Liams — Deux mots sur soi, et un rayon qui ne s'applique qu'à qui se déplace
--
-- =========================================================================
-- Se présenter
-- =========================================================================
--
-- La fiche publique affiche un tarif, une zone, des badges et des réponses aux
-- prompts. Rien qui dise, en une phrase, qui est là et depuis combien de
-- temps. Les prompts s'y prêtent mal : ils sont faits pour la personnalité —
-- « ce que les enfants adorent chez moi » — et une famille qui compare trois
-- fiches cherche d'abord un repère.
--
-- L'expérience en années plutôt qu'en badge : « Super Expérience » dit qu'il y
-- en a beaucoup sans dire combien, et c'est le nombre que les parents
-- demandent au téléphone.

alter table public.professional_profiles
  add column presentation text,
  add column annees_experience smallint check (annees_experience between 0 and 60);

comment on column public.professional_profiles.presentation is
  'Deux ou trois phrases affichées avec le tarif et la zone. Le repère qu''une
   famille cherche avant de lire les prompts, qui parlent de personnalité.';

alter table public.professional_profiles
  add constraint professional_profiles_presentation_courte
    check (presentation is null or length(presentation) <= 400);

-- =========================================================================
-- Le rayon ne concerne que ceux qui se déplacent
-- =========================================================================
--
-- `rayon_km` était appliqué à tout le monde, et plafonnait la recherche : une
-- crèche ayant déclaré 15 km restait invisible pour une famille à 20 km, alors
-- que c'est la famille qui fait la route et qu'elle était prête à la faire.
--
-- Le rayon d'un professionnel dit jusqu'où *il* va. Chez un établissement, ou
-- chez quelqu'un qui reçoit chez lui, il ne veut rien dire : la seule distance
-- qui compte est celle que la famille accepte, et elle la fixe elle-même. On
-- se contente alors de la lui montrer.
--
-- Rien à changer dans le schéma : `lieu_accueil` le dit déjà depuis la 0019.
-- Cette colonne existe, elle n'était simplement pas lue au bon endroit — le
-- correctif est dans matching.ts. On le note ici pour que la migration qui
-- accompagne le changement en garde la trace.

comment on column public.professional_profiles.rayon_km is
  'Jusqu''où le professionnel se déplace. Ne s''applique qu''à ceux qui vont au
   domicile des familles : pour un établissement ou un accueil chez le
   professionnel, c''est la famille qui se déplace, et elle seule décide de la
   distance qu''elle accepte.';
