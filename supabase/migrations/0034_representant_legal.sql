-- Liams — Le représentant légal revient, et ce n'est pas un doublon
--
-- La 0032 avait supprimé `representant_legal` au motif que le nom de la
-- personne vivait déjà dans `identites`. C'était confondre deux rôles qui ne
-- coïncident pas toujours : le représentant légal engage la société — c'est
-- lui qui signe, et son nom figure sur les statuts — tandis que le titulaire
-- du compte fait tourner la structure au quotidien. Dans une association, le
-- premier est souvent le président du conseil d'administration et le second la
-- directrice ; le premier ne se connecte jamais.
--
-- Le nom du représentant appartient donc aux papiers de l'entreprise, au même
-- titre que le SIRET et la forme juridique, et se saisit là où on les saisit.
-- L'identité du compte reste dans `identites`, comme pour tout le monde.

alter table public.etablissements
  add column representant_prenom text,
  add column representant_nom text;

comment on column public.etablissements.representant_nom is
  'Nom du représentant légal de la structure — celui qui engage la société.';

-- Et le titulaire du compte, pour la même raison inversée.
--
-- `identites` porte, pour un établissement, la raison sociale : c'est elle que
-- les familles doivent lire partout — dans la recherche, les messages, le
-- réseau. Y mettre le nom d'une personne ferait apparaître « Marie Dupont » là
-- où un parent cherche « Crèche les doudous », dans une quinzaine d'écrans.
--
-- Le nom de la personne qui tient le compte principal reste néanmoins
-- nécessaire : c'est elle que l'on appelle quand quelque chose ne va pas, et
-- c'est elle que l'admin doit pouvoir nommer en contrôlant le dossier. Il
-- devient donc une information de la fiche, et non l'identité publique du
-- compte.
alter table public.etablissements
  add column titulaire_prenom text,
  add column titulaire_nom text;

comment on column public.etablissements.titulaire_nom is
  'Nom de la personne qui tient le compte principal. Distinct de identites.nom,
   qui porte la raison sociale et sert d''affichage public.';
