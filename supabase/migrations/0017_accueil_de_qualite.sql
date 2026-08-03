-- Liams — « Nounou Extra » devient « Accueil de qualité »
--
-- Tous les professionnels de Liams ne sont pas des nounous : assistantes
-- maternelles, éducateurs, auxiliaires de puériculture. Le badge nommait un
-- métier là où il désigne une manière de faire.
--
-- Le code reste inchangé : il est référencé par l'icône côté application, et
-- le renommer casserait l'affichage sans rien apporter.

update public.badges
set label = 'Accueil de qualité',
    description = 'Qualité d''accueil reconnue : ancienneté sur Liams et avis constamment élogieux'
where code = 'nounou_extra';

-- La règle envisagée — au-delà de 50 prestations et une moyenne d'au moins 4
-- — reste hors de portée tant que l'application n'encaisse pas les paiements :
-- un créneau passé au statut « occupé » atteste d'une réservation, pas d'une
-- garde réellement effectuée. Le badge demeure donc attribué par l'admin,
-- jusqu'à ce qu'une prestation soit une chose que la base sache constater.
