-- Liams — Un seul nom pour la même distinction
--
-- La 0036 a donné au badge `nounou_extra` un second libellé, « Établissement
-- Extra », pour que la langue d'une crèche ne soit pas celle d'une nounou.
-- L'intention était juste ; le mot était mauvais, et j'avais manqué que la
-- question était déjà tranchée.
--
-- La 0017 avait renommé ce badge « Accueil de qualité », précisément parce que
-- tous les professionnels de Liams ne sont pas des nounous — assistantes
-- maternelles, éducateurs, auxiliaires de puériculture. Le badge nommait un
-- métier là où il désigne une manière de faire.
--
-- Résultat depuis la 0036 : un indépendant lisait « Accueil de qualité », une
-- crèche « Établissement Extra ». Deux noms pour une même distinction, et le
-- second ressuscitait le vocabulaire que la 0017 avait retiré.
--
-- « Accueil de qualité » convient aux deux. C'était déjà la bonne réponse.

update public.badges
  set label_etablissement = null
  where code = 'nounou_extra';

-- La colonne reste : elle sert à d'autres badges le jour où un mot ne
-- conviendra vraiment pas aux deux publics. C'est le mécanisme qui était bon,
-- pas son premier usage.
