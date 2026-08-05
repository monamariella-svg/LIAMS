-- Liams — Le statut « occupé » n'a plus cours
--
-- Un créneau n'est plus libre ou occupé : il a des places, dont il reste un
-- certain nombre. Le décompte fait autorité (voir places_reservees), et le
-- code ne marque plus aucun créneau comme occupé.
--
-- Restent ceux que l'ancien code a marqués. Sous le nouveau modèle ils ne
-- redeviendraient jamais disponibles : le statut ne se recalcule pas, et plus
-- rien ne le remet à zéro. On les libère donc.
--
-- Ce n'est pas rendre disponible ce qui est pris : les réservations qui les
-- occupaient sont toujours là — urgences confirmées, lignes de demandes
-- acceptées, récurrences actives — et places_reservees les compte. Un créneau
-- réellement plein le restera, mais parce qu'il est plein, pas parce qu'un
-- champ le dit.
--
-- Seul cas où quelque chose change : un créneau marqué occupé sans aucune
-- réservation correspondante redevient disponible. C'est le comportement
-- juste — rien ne l'occupait.

update public.availability_slots
set statut = 'libre'
where statut = 'occupe';

-- Le champ reste en place, sans plus être écrit par le code : le supprimer
-- demanderait de reprendre chaque requête qui le lit encore, et il ne coûte
-- rien à conserver. À retirer lors d'un passage dédié.
comment on column public.availability_slots.statut is
  'HÉRITÉ — ne fait plus autorité sur la disponibilité, qui se déduit de
   places_restantes(). Conservé le temps que les requêtes qui le lisent encore
   soient reprises. Ne plus écrire « occupe ».';
