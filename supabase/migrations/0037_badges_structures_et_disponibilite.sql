-- Liams — Ce qu'une famille veut savoir avant d'appeler
--
-- Le catalogue de la 0001 décrit surtout ce que le professionnel *est* :
-- diplômé, véhiculé, expérimenté. Il ne dit presque rien de ce qu'il *offre* —
-- les repas, un jardin, des locaux où un fauteuil passe, une nuit de garde.
--
-- Ce sont pourtant les premières questions posées au téléphone, et celles qui
-- font qu'un parent rappelle ou non. Les laisser hors de l'application, c'est
-- laisser la mise en relation se jouer ailleurs.

-- =========================================================================
-- Ce que les locaux permettent
-- =========================================================================

-- Déclaratif : un jardin, une cuisine, un accès de plain-pied se constatent à
-- la visite, et personne n'a intérêt à mentir sur ce qu'une famille verra dès
-- le premier rendez-vous.
--
-- L'accessibilité est classée avec les Xtras plutôt qu'avec le pratique : pour
-- une famille dont l'enfant se déplace en fauteuil, ce n'est pas un confort,
-- c'est ce qui décide si la porte s'ouvre ou non.
insert into public.badges (code, label, description, source, mode) values
  (
    'locaux_pmr',
    'Locaux accessibles',
    'Accès de plain-pied ou aménagé, et sanitaires adaptés',
    'manuel',
    'auto_declare'
  ),
  (
    'espace_exterieur',
    'Espace extérieur',
    'Jardin, cour ou terrasse accessible aux enfants',
    'manuel',
    'auto_declare'
  ),
  (
    'repas_fournis',
    'Repas fournis',
    'Les repas sont préparés ou fournis sur place',
    'manuel',
    'auto_declare'
  ),
  (
    'hygiene_fournie',
    'Couches et hygiène fournies',
    'Couches et produits d''hygiène fournis, sans que la famille ait à les apporter',
    'manuel',
    'auto_declare'
  )
on conflict (code) do nothing;

-- =========================================================================
-- Quand l'accueil est possible
-- =========================================================================

-- Trois moments distincts, et il fallait qu'ils le restent : sans quoi un
-- professionnel coche les trois pour la même réalité et l'information ne vaut
-- plus rien. Les bornes sont donc dans la description, pas dans le libellé.
--
-- Ces trois-là valent pour tout le monde. Une assistante maternelle garde le
-- samedi ; certains établissements — crèches hospitalières, structures en
-- horaires atypiques — accueillent la nuit.
insert into public.badges (code, label, description, source, mode) values
  (
    'horaires_elargis',
    'Horaires élargis',
    'Accueil possible avant 7h30 ou après 19h',
    'manuel',
    'auto_declare'
  ),
  (
    'accueil_nuit',
    'Accueil de nuit',
    'L''enfant peut dormir sur place',
    'manuel',
    'auto_declare'
  ),
  (
    'accueil_weekend',
    'Accueil le week-end',
    'Accueil possible le samedi ou le dimanche',
    'manuel',
    'auto_declare'
  )
on conflict (code) do nothing;

-- =========================================================================
-- Ce qui suppose une équipe, et se contrôle
-- =========================================================================

-- Sur validation, comme les spécialités depuis la 0016. Annoncer une
-- infirmière sur place ou un partenariat CAMSP à une famille dont l'enfant est
-- suivi, puis ne pas l'avoir, ne ferait pas qu'une déception : cela
-- décrédibiliserait tous les autres badges, y compris ceux qui sont vrais.
insert into public.badges (code, label, description, source, mode) values
  (
    'sante_sur_place',
    'Professionnel de santé sur place',
    'Infirmière, psychomotricienne ou éducatrice spécialisée dans l''équipe',
    'manuel',
    'sur_validation'
  ),
  (
    'partenariat_camsp',
    'Partenariat CAMSP / SESSAD',
    'La structure travaille avec un service de suivi : le suivi de l''enfant continue pendant l''accueil',
    'manuel',
    'sur_validation'
  )
on conflict (code) do nothing;

-- Ces deux-là supposent une équipe salariée : un professionnel indépendant qui
-- les cocherait décrirait autre chose. Il déclare ses propres qualifications
-- avec les badges de spécialité, qui existent pour cela.
update public.badges
  set pour_independant = false
  where code in ('sante_sur_place', 'partenariat_camsp');
