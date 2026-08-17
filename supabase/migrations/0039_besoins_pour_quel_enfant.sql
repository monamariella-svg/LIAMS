-- Liams — Un besoin de garde est toujours le besoin d'un enfant précis
--
-- La 0020 avait ajouté `enfant_ids` aux trois tables de réservation : une
-- garde d'urgence, une demande de créneaux et un accueil récurrent disent tous
-- pour qui. Les deux tables de *besoin* — ce que le parent déclare chercher —
-- ne l'ont jamais dit.
--
-- L'asymétrie ne se voyait pas tant que l'âge ne servait à rien. Depuis la
-- 0035, un établissement accueille par sections et l'âge décide de ce qui peut
-- être proposé : un besoin qui ne nomme personne ne peut donc plus être
-- satisfait autrement qu'en devinant. L'application se rabattait sur les
-- enfants cochés en haut du calendrier — un filtre d'affichage détourné en
-- déclaration d'intention, ce qu'il n'a jamais été.
--
-- Et le modèle y gagne au-delà de l'âge : « les mardis pour Léa, les mercredis
-- pour les deux » est le cas ordinaire d'une famille, et rien ne permettait de
-- l'exprimer.

alter table public.besoins_garde
  add column enfant_ids uuid[] not null default '{}';

alter table public.besoin_recurrences
  add column enfant_ids uuid[] not null default '{}';

comment on column public.besoins_garde.enfant_ids is
  'Les enfants concernés par ce besoin. Vide pour les besoins déclarés avant la
   0039 : ceux-là se rabattent sur les enfants sélectionnés à l''écran.';

-- Pas de `not null` sur le contenu, ni de contrainte exigeant au moins un
-- enfant. Les besoins déjà déclarés n'en portent aucun, et les bloquer
-- reviendrait à interrompre la migration — comme la 0038 l'a fait — pour une
-- donnée bien moins critique qu'une date de naissance. L'exigence est posée à
-- la saisie, où elle ne concerne que les besoins nouveaux.

-- Retrouver les besoins d'un enfant donné, pour les écrans qui filtrent par
-- enfant. Un index GIN est ce qui convient à l'opérateur `&&` sur tableau.
create index besoins_garde_enfants_idx
  on public.besoins_garde using gin (enfant_ids);

create index besoin_recurrences_enfants_idx
  on public.besoin_recurrences using gin (enfant_ids);
