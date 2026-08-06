# Chantier réservation et calendrier

Ce document consigne les décisions prises sur la refonte de la réservation et
du calendrier, **avec leurs raisons**. Il existe pour qu'on ne retranche pas
deux fois la même question, et pour reprendre le fil après une interruption.

Il ne remplace pas le code : quand les deux divergent, le code fait foi et ce
document est à corriger.

---

## Pourquoi ce chantier

Un créneau ne portait qu'un champ, `statut`, valant `libre`, `libre_urgence`
ou `occupe`. Ce champ unique répondait à trois questions à la fois — le
créneau est-il libre, pour quel type d'accueil, pour combien d'enfants — ce
qui est précisément pourquoi aucune ne pouvait recevoir de vraie réponse.

Le produit demande désormais de les distinguer.

---

## Les lots

| Lot | Contenu | État |
|-----|---------|------|
| **1a** | Le créneau devient descriptif : métier, cadre d'exercice, lieu et types d'accueil au profil ; capacité, types et lieu sur les créneaux | **En production** (migration 0019) |
| **1b** | Les réservations portent les enfants ; les places se comptent réellement | En cours (migration 0020 écrite, non appliquée) |
| **2** | Page d'orientation du parent : urgence, ou longue durée et ponctuel | À faire |
| **3** | Parcours urgence | À faire |
| **4** | Parcours longue durée et ponctuel | À faire |
| **5** | Type de compte établissement | À faire, après le calendrier |

---

## Décisions et leurs raisons

### Le vocabulaire

**« Accueil longue durée », pas « annuel ».** La période est fixée par le
parent et peut dépasser l'année comme rester en deçà. Nommer une durée qu'on
ne maîtrise pas induirait en erreur.

**Trois types d'accueil** : longue durée, ponctuel, urgence. Un créneau peut
en porter un, deux ou trois.

### Le choix du type d'accueil appartient au besoin, pas au compte

Un même parent peut vouloir un accueil longue durée pour son bébé et du
ponctuel pour son aîné. Rien n'est donc demandé à l'inscription : le parent
choisit à chaque recherche et désigne les enfants concernés.

### La capacité se consomme par enfant

Un créneau déclare combien d'enfants il accueille simultanément. Une
réservation consomme autant de places que d'enfants concernés : deux enfants
sur un créneau de deux places le rendent indisponible.

C'est ce qui a révélé un manque : **les réservations n'enregistraient aucun
enfant**. On savait qu'un parent réservait chez un professionnel, jamais pour
qui — impossible donc de compter les places, et impossible au professionnel de
savoir quel enfant il accueille, alors que la fiche santé et le profil Xtra
sont attachés à l'enfant.

### Les places sont calculées, jamais stockées

Les places prises d'un créneau se déduisent à la volée : urgences confirmées,
lignes de demandes acceptées, et récurrences actives dont le jour, l'horaire
et la période correspondent.

L'alternative — matérialiser une réservation par date à la validation — donne
un calendrier plus honnête et permettrait les exceptions (« sauf la semaine
des vacances »), mais un accueil à durée indéterminée ne peut pas se
matérialiser à l'infini : il faudrait une tâche périodique prolongeant
l'horizon, soit une pièce de plus à surveiller. À reconsidérer si le besoin
d'exceptions apparaît ; ce sera alors une optimisation, pas une reprise.

### Filtrage **et** garde-fou, pas l'un ou l'autre

Un créneau complet ne doit pas apparaître dans les propositions — c'est le
chemin normal, et il couvre presque tous les cas.

Le contrôle en base ne sert qu'à ce que le filtrage ne peut pas voir : **deux
parents confirmant la dernière place au même instant**, chacun ayant vu le
créneau libre à l'affichage. Il remplace l'ancienne contrainte qui interdisait
toute deuxième confirmation sur un créneau — même protection, mais qui sait
compter jusqu'à la capacité.

### Un créneau partiellement occupé reste proposé

Avec la mention du nombre de places restantes. Un parent de deux enfants peut
vouloir en placer un ici et l'autre ailleurs ; le masquer déciderait à sa
place.

### Priorité d'affichage des professionnels

1. Réseau, places suffisantes
2. Réseau, places partielles — avec le nombre restant
3. Hors réseau

### Tri des propositions (lot 4)

Prix, distance, note, places restantes. Et un besoin qui n'est pas évident :
un parent plaçant deux enfants chez deux professionnels se soucie d'abord de
**la distance entre les deux**, pas de leur distance depuis chez lui — c'est
lui qui fera le trajet, deux fois par jour. Une fois le premier choisi, les
candidats pour le second doivent afficher leur distance depuis celui-là.

### Un créneau isolé hérite du profil

Poser trois questions de plus pour ajouter un mardi découragerait l'usage. Le
professionnel ajuste ensuite si besoin.

*Reste à faire : l'écran d'ajustement d'un créneau isolé n'existe pas encore.*

---

## Les établissements

**Une crèche n'est pas un professionnel d'un genre particulier.** Son
calendrier est celui de la structure, pas d'une éducatrice ; elle n'a pas de
casier judiciaire personnel mais un agrément PMI, pas de « mon domicile » mais
une adresse d'établissement, et une capacité qui se compte en dizaines. Tout
ce qui est construit — identité, casier, badges, données contractuelles —
suppose une personne. Il leur faut donc un type de compte distinct.

Les MAM, en revanche, ne posent pas ce problème : une assistante maternelle en
MAM reste une assistante maternelle, elle exerce simplement ailleurs qu'à son
domicile. D'où deux champs séparés au profil : le **métier** et le **cadre
d'exercice**.

### Les établissements figurent d'office dans les propositions d'urgence

Hors réseau, le parcours d'urgence ne retient que les professionnels portant
« Accueil de qualité » ou « Super Expérience ». **Les établissements
échapperont à ce filtre** : un agrément PMI, des inspections régulières et une
équipe salariée offrent des garanties qu'un particulier ne donne pas seul, et
exiger d'eux un badge attribué à la main n'aurait pas de sens.

C'est aussi ce qui répond au problème de la liste vide au lancement : un parent
sans réseau trouvera des établissements là où il n'aurait trouvé personne.

*Repère laissé dans `src/app/recherche/urgence/page.tsx`, à l'endroit exact où
la condition devra s'élargir.*

**L'ordre importe** : le calendrier pour les personnes d'abord, les
établissements ensuite. La capacité multi-enfants est précisément ce dont une
crèche a besoin — construite d'abord pour les individus, elle leur sera
acquise au lieu de compliquer un chantier inachevé.

### L'accès aux données de l'enfant est borné par la prestation

**Décision structurante, et elle vaut aussi pour les professionnels
individuels.**

Le réseau de confiance donne aujourd'hui un accès permanent au nom du parent
et au prénom de ses enfants. Cette règle est écrite pour une personne : un
compte d'établissement partagé par dix salariés changerait le sens de
« visible par le professionnel ».

Plutôt que d'étendre le réseau aux structures :

> Dès la validation d'une réservation, et jusqu'à J+1 après la fin du créneau,
> le professionnel ou l'établissement accède au prénom de l'enfant, à sa fiche
> santé, à son profil Xtra et aux coordonnées du parent — que la mise en
> relation existe ou non.

Le droit naît de la garde et s'éteint avec elle. Le J+1 laisse le temps de
signaler un incident ou de joindre le parent.

**Ce n'est pas un confort mais une exigence de sécurité.** Le parcours
d'urgence permet de réserver sans mise en relation préalable — c'est tout son
intérêt. Avec les règles actuelles, ce professionnel accepterait la garde
**sans voir les allergies ni le handicap de l'enfant**. En urgence, le besoin
d'information est plus fort, pas moins : une halte-garderie qui reçoit un
enfant autiste dans deux heures sans l'avoir jamais vu n'a pas eu droit aux
mille choses qu'un parent transmet de vive voix.

### L'écran qui rend ce droit exerçable

Le droit de lire ne sert à rien sans écran pour le montrer. Une page accessible
depuis le tableau de bord professionnel rassemble **toutes les fiches des
enfants qu'il accueille**, longue durée comme urgence.

**À la validation d'une urgence**, le professionnel est invité à consulter la
fiche du ou des enfants concernés, avec le lien vers cette page. C'est le
moment où il en a le plus besoin et le moins de temps pour la chercher.

**Deux régimes selon la nature de l'accueil :**

| | Consultation | Export |
|---|---|---|
| **Urgence** | Oui, pendant la fenêtre d'accès | Aucun — ni impression ni téléchargement |
| **Longue durée** | Oui | Format imprimable |

Une fiche d'urgence ne doit pas laisser de copie derrière elle une fois la
garde terminée ; un accueil de longue durée mérite au contraire une fiche
affichée près du lit.

> **Ce que la technique garantit réellement.** « Impossible à télécharger »
> n'existe pas au sens strict sur le web : on peut supprimer l'export,
> empêcher l'impression et la sélection du texte, mais jamais une capture
> d'écran ni une photo du téléphone. Ce qui est garanti, c'est qu'il n'existe
> **aucun moyen simple** d'en faire une copie.
>
> À dire aux parents en ces termes — « consultable uniquement, sans
> possibilité d'export » — et jamais « vos données ne peuvent pas être
> copiées », qui serait faux et engagerait Liams.

> **Vérification faite le 2026-08-05 : la réponse est non, et c'est un manque
> actuel, pas futur.**
>
> `enfant_fiche_sante` et `enfant_profil_xtra` ne sont lus nulle part hormis
> sur le profil du parent, là où il les remplit. Aucun écran ne les montre à un
> professionnel — ni depuis le réseau, ni depuis une conversation, ni depuis le
> planning.
>
> Depuis l'origine, les parents renseignent allergies, traitements, contacts
> d'urgence et besoins particuliers, et **aucun professionnel ne peut les
> consulter**. La règle de sécurité leur en donne le droit ; il n'existe pas de
> page pour l'exercer.
>
> Sur une plateforme dédiée à l'accueil d'enfants en situation de handicap,
> cela concerne **toutes les gardes**, pas seulement les urgences à venir. D'où
> la recommandation de construire ce lot avant le parcours d'urgence : celui-ci
> repose entièrement dessus, et donnerait sinon une clé sans porte.

---

## 🔧 Si un décompte de places paraît faux

Le nombre de places restantes n'est **stocké nulle part** : il se recalcule à
chaque affichage. Il n'y a donc jamais rien à « resynchroniser » — si le
résultat est faux, c'est qu'une des trois sources répond mal.

**Les trois sources additionnées** par `places_reservees(slot_id)` :

1. `urgent_bookings` au statut `confirme` sur ce créneau
2. `demande_creneau_lignes` au statut `accepte` sur ce créneau
3. `recurring_bookings` au statut `actif` du même professionnel, dont le jour,
   l'heure de début et la période couvrent la date du créneau

**Pour voir le détail d'un créneau donné**, dans le SQL Editor de Supabase :

```sql
-- Remplacer l'identifiant par celui du créneau en cause
select
  s.date, s.heure_debut, s.capacite,
  public.places_reservees(s.id) as prises,
  public.places_restantes(s.id) as restantes
from public.availability_slots s
where s.id = 'COLLER-ICI-L-ID-DU-CRENEAU';
```

```sql
-- Qui consomme ce créneau, source par source
select 'urgence' as source, ub.id, ub.statut, ub.enfant_ids
from public.urgent_bookings ub
where ub.slot_id = 'COLLER-ICI-L-ID-DU-CRENEAU'
union all
select 'demande', l.id, l.statut, d.enfant_ids
from public.demande_creneau_lignes l
join public.demandes_creneaux d on d.id = l.demande_id
where l.slot_id = 'COLLER-ICI-L-ID-DU-CRENEAU'
union all
select 'recurrente', rb.id, rb.statut, rb.enfant_ids
from public.recurring_bookings rb
join public.availability_slots s on s.id = 'COLLER-ICI-L-ID-DU-CRENEAU'
where rb.professional_id = s.professional_id
  and rb.statut = 'actif'
  and rb.heure_debut = s.heure_debut
  and rb.jour_semaine = (extract(isodow from s.date)::int - 1);
```

**Les trois causes probables, par ordre de fréquence :**

**La convention des jours.** Le projet numérote 0 = lundi ; PostgreSQL numérote
1 = lundi avec `isodow`. La fonction traduit par `isodow - 1`. Une récurrence
qui compte pour le mauvais jour vient presque toujours de là.

**Une récurrence sans date de fin** couvre toutes les dates futures, y compris
dans dix ans. C'est voulu — un contrat d'assistante maternelle est souvent à
durée indéterminée — mais elle consommera des places indéfiniment tant qu'elle
reste au statut `actif`. Vérifier qu'une récurrence terminée passe bien à
`annule`.

**Une réservation sans enfant déclaré compte pour une place.** C'est le repli
délibéré pour les réservations antérieures à la migration 0020. Si un parent
de deux enfants voit une seule place consommée, regarder si `enfant_ids` est
vide sur sa réservation.

---

## ⚠️ À porter aux CGU et à la politique de confidentialité

Ce que ce chantier engage vis-à-vis des parents, et qu'ils doivent savoir
**avant** de confier leur enfant. À faire relire par un professionnel du droit
avec le reste des CGU.

**L'accès du professionnel aux données de l'enfant.** Dès la validation d'une
réservation et jusqu'à J+1 après la fin du créneau, le professionnel ou
l'établissement accède au prénom de l'enfant, à sa fiche santé, à son profil
Xtra et aux coordonnées du parent — y compris **sans mise en relation
préalable** dans le cas d'une urgence. Le parent doit le savoir : c'est la
contrepartie d'un accueil sûr, mais c'est une communication de données de
santé à un tiers.

**Ce que la technique ne garantit pas.** La fiche d'urgence est consultable
sans possibilité d'export — pas d'impression, pas de téléchargement. Mais
aucune technologie web n'empêche une capture d'écran ou une photo. Formuler
« consultable uniquement, sans possibilité d'export » et **jamais** « vos
données ne peuvent pas être copiées », qui serait faux et engagerait Liams.

**Le choix d'un professionnel hors réseau.** Un parent qui coche un
professionnel hors de son réseau lors d'une urgence reçoit un avertissement au
moment de cocher : rappel des risques et des vérifications à faire — pièce
d'identité notamment. Cet avertissement et sa portée doivent figurer aux CGU,
en particulier la répartition des responsabilités entre Liams et le parent.

**L'identité partagée.** Le nom et le prénom d'un professionnel sont visibles
de tout compte connecté. Ceux d'un parent, ainsi que son téléphone et le
prénom de ses enfants, ne le sont que des professionnels avec qui il a une
mise en relation acceptée ou un réseau de confiance.

---

## Points ouverts

- **L'ajustement d'un créneau isolé** après création : au clic dans le
  calendrier, ou dans la liste en dessous ?
- **Le filtre hors-réseau en urgence** n'admet que les badges « Accueil de
  qualité » et « Super Expérience », attribués à la main et aujourd'hui à
  personne. La liste serait vide au lancement. Décision prise : les attribuer
  à des profils précis après vérification poussée — appel, rencontre.
- **« Accueil de qualité » et « Super Expérience » en automatique** — au-delà
  de 50 prestations et une moyenne d'au moins 4 — restent hors de portée tant
  que l'application n'encaisse pas : un créneau passé à « occupé » atteste
  d'une réservation, pas d'une garde effectuée.
