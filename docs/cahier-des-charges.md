# Liams — Cahier des charges technique — MVP Pilote

## 1. Contexte du projet

Liams est une application de mise en relation entre parents et professionnels de la garde d'enfants, avec un positionnement différenciant sur l'accompagnement des familles d'enfants à besoins particuliers.

**Terminologie produit** : dans l'application et les communications, les enfants en situation de handicap ou à besoins particuliers sont désignés sous le nom **"Les Xtras"** (clin d'œil à "extra-ordinaire"), en écho direct au badge professionnel "Accueil des Xtras ordinaires". Ce terme doit être utilisé de façon cohérente dans toute l'interface (libellés, filtres, présentation) plutôt que des formulations cliniques ou génériques.

**Objectif de cette phase** : livrer une première version fonctionnelle réelle, utilisée par un groupe pilote (environ 50 utilisateurs : parents + professionnels), sans paiement intégré, pour valider le parcours et le matching avant d'ajouter la monétisation.

**Modèle économique cible (à activer plus tard)** :
- Commission de 12% sur les prestations (tarif marché ~11€/h)
- Abonnement professionnel premium : 9,90€/mois
- Non activé dans cette version pilote.

## 2. Identité de marque

- Orange : `#EB6601`
- Teal : `#319386`
- Navy : `#281264`
- Ton : rassurant, professionnel, chaleureux. Cible incluant des familles avec des besoins spécifiques → accessibilité et clarté prioritaires (contrastes suffisants, texte simple, pas de surcharge visuelle).

**Logo** : deux silhouettes stylisées (un adulte et un enfant) en dégradé orange → navy, avec un cercle teal, accompagnées du nom "LIAMS" en navy — symbolise la relation de confiance et d'accompagnement au cœur de Liams.

Fourni dans le dossier `/logo` à côté de ce document, en 6 déclinaisons :

| Fichier | Format | Usage recommandé |
|---|---|---|
| `Carré_Couleur.png` | Carré, dégradé couleur | Favicon, icône d'application, avatars par défaut, réseaux sociaux |
| `Rectangle_Couleur.png` | Rectangle, dégradé couleur + texte "LIAMS" | Header du site/app, en-têtes d'email, documents officiels, pitch deck — version par défaut sur fond blanc/clair |
| `Carré_Noir.png` / `Rectangle_Noir.png` | Version noire (monochrome) | Usage sur fond clair quand la couleur n'est pas souhaitée (impression N&B, filigrane, footer discret) |
| `Carré_Blanc.png` / `Rectangle_Blanc.png` | Version blanche | Sur fond foncé uniquement (ex. footer navy, écrans sombres) — invisible sur fond blanc |

## 3. Stack technique recommandée

| Couche | Choix | Justification |
|---|---|---|
| Frontend | Next.js (React) + Tailwind CSS | Une seule base de code pour site + web app, bon SEO pour les pages publiques, responsive natif |
| Backend / DB | Supabase (PostgreSQL + Auth + Storage) | Auth intégrée, upload de fichiers (docs justificatifs), le tier gratuit couvre largement 50 utilisateurs |
| Hébergement | Vercel (frontend) + Supabase Cloud | Gratuit/très bon marché au démarrage, adapté à un budget contraint |
| Paiement | Non intégré dans cette version (ajout futur : Stripe Connect, adapté aux commissions marketplace) | Décision produit : hors plateforme pour le pilote |

Cette web app est responsive (utilisable sur mobile via navigateur). Un packaging en app native (via Capacitor) pourra être fait après validation du pilote, sans réécrire le code.

## 4. Périmètre fonctionnel du pilote

### 4.1 Parcours Parent
1. Inscription (email/mot de passe via Supabase Auth), avec **acceptation obligatoire des CGU et de la politique de confidentialité** (case à cocher, voir 4.11)
2. Création de profil : informations sur le(s) enfant(s), besoins particuliers éventuels (champ libre + tags), localisation, disponibilités récurrentes
3. **Fiche santé/urgence par enfant** (obligatoire, visible uniquement par les professionnels mis en relation) : allergies, traitements en cours, contact du médecin traitant, personne à prévenir en cas d'urgence
4. **Profil enrichi "Xtra"** (facultatif, à remplir si l'enfant est en situation de handicap ou à besoins particuliers) : routines apaisantes, déclencheurs à éviter, moyens de communication préférés (pictogrammes, mots clés, supports visuels) — voir détail en 4.13
5. Recherche / matching de professionnels selon : disponibilité (planning) → proximité géographique/trajet → critères qualitatifs (besoins particuliers Xtras, langues, badges de spécialisation, etc.)
6. Consultation des profils professionnels matchés (format dynamique, voir 4.8)
7. Mise en relation (envoi d'une demande de contact au professionnel)
8. Messagerie simple entre parent et professionnel une fois la mise en relation acceptée
9. Constitution d'un réseau de professionnels de confiance, avec possibilité de réservation récurrente automatique (voir 4.6)
10. **Avis/notation du professionnel** après une garde effectuée (voir 4.10)
11. Participation au feedback pilote (NPS) envoyé automatiquement après quelques semaines d'usage (voir 4.14)

### 4.2 Parcours Professionnel
1. Inscription (email/mot de passe), avec **acceptation obligatoire des CGU et de la politique de confidentialité** (case à cocher, voir 4.11)
2. Création de profil : expérience, tarif horaire indicatif, zone géographique d'intervention, disponibilités, spécialisations (dont besoins particuliers)
3. **Profil dynamique façon "cartes"** : photos personnelles + prompts (questions/réponses courtes) — voir 4.8, remplace un simple champ de présentation textuelle
4. **Barre de progression du profil** affichée au professionnel (ex. "profil complété à 60% — il manque : diplôme, photo") pour encourager la complétion
5. **Documents justificatifs** (upload multiple, chacun avec un statut de vérification propre) :
   - Bulletin n°3 du casier judiciaire (obligatoire)
   - CV
   - Diplôme(s)
   - Certificat(s) (ex. PSC1, formations spécifiques besoins particuliers, etc.)
   - Photos du logement/lieu d'accueil, réservées aux professionnels accueillant les enfants à leur domicile ou dans un établissement (champ `accueil_a_domicile` = vrai) ; non proposées aux professionnels qui se déplacent uniquement chez le parent (facultatif même pour les profils concernés, affichées sur le profil public une fois validées par le gérant)
6. **Question dédiée "Xtras"** (espace différencié, distinct des documents généraux ci-dessus) : *"Avez-vous des qualifications pour accueillir des Xtras (enfants TSA, TDAH, DYS, handicap physique) ? Si oui, merci de fournir un justificatif."*
   - Réponse oui/non
   - Si oui : upload d'un justificatif spécifique — diplôme (DEAES, CAP AEPE, BEP sanitaire et social...), **ou attestation de contrat AESH/du rectorat** (reconnue comme preuve d'expérience équivalente), ou tout autre justificatif d'expérience avec des enfants à besoins particuliers
   - Ce justificatif est vérifié séparément par le gérant et conditionne l'attribution des badges de spécialisation (Spécialiste TSA, TDAH, DYS, handicap moteur — voir 4.4), sans se substituer aux documents généraux ni les remplacer
7. **Déclaration d'honorabilité** : upload du bulletin n°3, statut "en attente de vérification" affiché tant que non validé manuellement par Liams
8. Réception et acceptation/refus des demandes de mise en relation
9. Messagerie avec les parents mis en relation
10. Validation des demandes d'ajout à un réseau parent (voir 4.6)
11. Consultation des avis reçus (voir 4.10)

### 4.3 Algorithme de matching (V1 simplifié)
Ordre de filtrage :
1. Compatibilité de planning (créneaux demandés vs disponibilités déclarées)
2. Proximité géographique (rayon paramétrable, ex. 15 km, ou option "recherche par trajet", voir 4.5)
3. Critères qualitatifs (besoins particuliers, langues, expérience, badges obtenus — voir 4.4) → score de pertinence

Pas de machine learning à ce stade : un système de scoring simple par règles pondérées suffit. Les badges peuvent servir de filtre optionnel côté parent (ex. "afficher uniquement les profils avec le badge Accueil des Xtras ordinaires").

### 4.4 Badges de profil professionnel

Les badges sont des marqueurs de confiance affichés sur le profil professionnel, visibles par les parents et utilisables comme filtre de recherche.

| Badge | Signification | Critère de validation |
|---|---|---|
| **Accueil des Xtras ordinaires** | Expérience avérée avec des enfants à besoins particuliers (Xtras), toutes spécialités confondues | Manuel — gérant, via justificatifs/expérience déclarée |
| **Spécialiste TSA** | Expérience/formation spécifique aux troubles du spectre autistique | Manuel — gérant, via le justificatif de la question dédiée "Xtras" (voir 4.2) : diplôme, attestation AESH, ou autre preuve d'expérience |
| **Spécialiste TDAH** | Expérience/formation spécifique au trouble déficit de l'attention/hyperactivité | Manuel — gérant, via le justificatif de la question dédiée "Xtras" |
| **Spécialiste troubles DYS** | Expérience/formation spécifique aux troubles dys (dyslexie, dyspraxie, etc.) | Manuel — gérant, via le justificatif de la question dédiée "Xtras" |
| **Spécialiste handicap moteur** | Expérience/formation spécifique à l'accompagnement de handicaps moteurs | Manuel — gérant, via le justificatif de la question dédiée "Xtras" |
| **Véhiculé(e)** | Dispose d'un véhicule personnel pour les trajets | Manuel — gérant, via déclaratif (permis + véhicule) |
| **Nounou Extra** | Statut de confiance renforcé / professionnel recommandé | Manuel — gérant, appréciation qualitative |
| **Diplômé(e)** | Diplôme dans la petite enfance (CAP AEPE, BEP, etc.) | Manuel — gérant, via justificatif de diplôme uploadé |
| **Super Expérience** | Nombre d'années d'expérience significatif | Manuel — gérant, via déclaratif (seuil à définir, ex. 5+ ans) |
| **Premiers Secours** | Formation PSC1/SST à jour | Manuel — gérant, via certificat uploadé |
| **Multilingue** | Pratique une langue étrangère avec l'enfant | Manuel — gérant, via déclaratif |
| **Aide aux devoirs** | Compétence/expérience en accompagnement scolaire | Manuel — gérant, via déclaratif |
| **Non-fumeur** | Ne fume pas en présence des enfants | Manuel — gérant, via déclaratif |
| **Coup de cœur des parents** | Note moyenne élevée sur la plateforme | **Automatique** : note moyenne ≥ 4,5/5 sur un minimum de 3 avis (voir 4.10) |

**Filtre de recherche parent (badges) :** le parent d'un enfant "Xtra" peut filtrer directement sa recherche de professionnels par spécialité précise — ex. "afficher uniquement les profils avec le badge Spécialiste TSA" — en plus du filtre générique "Accueil des Xtras ordinaires". Ce filtre s'ajoute aux critères de l'algorithme de matching (section 4.3).

**Fonctionnement dans l'interface admin :**
- Sur l'écran de vérification d'un professionnel (là où le gérant contrôle le bulletin n°3), une liste de cases à cocher pour chaque badge **manuel** (tous sauf "Coup de cœur des parents").
- Le gérant coche/décoche les badges en même temps qu'il valide le casier judiciaire ; il peut retirer un badge à tout moment.
- Les badges cochés apparaissent immédiatement sur le profil public du professionnel.
- Le badge "Coup de cœur des parents" est calculé automatiquement par le système et n'apparaît jamais dans la liste à cocher manuellement.

### 4.5 Recherche par trajet (option de matching complémentaire)

En plus du filtre par rayon géographique (vol d'oiseau), une option de recherche **le long d'un trajet** :
- Le parent renseigne un point de départ et un point d'arrivée récurrents (ex. domicile → école, domicile → travail).
- Le système propose des professionnels dont la zone d'intervention est proche de ce trajet (et pas seulement du domicile), utile pour une garde qui inclut la sortie d'école ou un dépose-minute.
- Techniquement : utiliser une API de géocodage/itinéraire (ex. l'API Adresse du gouvernement français, gratuite, ou Google Maps Directions API si budget disponible) pour calculer un couloir géographique le long du trajet, puis filtrer les professionnels dont la zone déclarée intersecte ce couloir.
- Cette option s'ajoute aux critères existants, elle ne les remplace pas.

### 4.6 Réseau de confiance parent-professionnel

Un parent peut se constituer un **réseau personnel** de professionnels de confiance, distinct du matching classique.

**Fonctionnement :**
1. Le parent envoie une demande d'ajout à un professionnel (typiquement après une première mise en relation réussie).
2. Le professionnel doit **valider** la demande pour que l'ajout au réseau soit effectif (double consentement). **Un professionnel peut valider plusieurs parents différents** : le réseau est une relation many-to-many, pas exclusive.
3. Une fois dans le réseau du parent, le professionnel partage avec **chacun** des parents qui l'ont dans leur réseau une **visibilité en temps réel de son planning** : créneaux libres, occupés, ou marqués disponibles pour une **garde d'urgence**.
4. Le parent peut alors **réserver directement** un créneau marqué "disponible garde d'urgence" chez un professionnel de son réseau, sans repasser par tout le parcours de mise en relation — validation quasi instantanée puisque la confiance mutuelle est déjà établie.
5. **Réservation récurrente automatique** : pour un professionnel de son réseau, le parent peut créer une réservation qui se répète chaque semaine sur un créneau fixe (ex. tous les mardis 16h-18h), sans avoir à renvoyer une demande à chaque fois. Le professionnel valide une seule fois la récurrence ; chaque occurrence future apparaît automatiquement sur son planning comme `occupé`, sauf annulation ponctuelle par l'une des deux parties.

**Gestion de la concurrence sur un créneau d'urgence :** puisqu'un professionnel peut être dans le réseau de plusieurs parents, un même créneau `libre_urgence` peut être demandé par plusieurs parents. Règle retenue : premier confirmé, premier servi — dès que le professionnel confirme une réservation, le créneau passe en `occupé` et les autres demandes en attente sont annulées avec notification.

**Implications techniques :**
- Le planning distingue trois états par créneau : `occupé` / `libre` / `libre_urgence` (paramétré par le professionnel lui-même).
- Le partage du planning n'est visible que par les parents dont le réseau inclut ce professionnel.
- Pour un pilote à 50 utilisateurs, un simple rafraîchissement à l'ouverture de l'écran suffit (le parent voit l'état à jour à chaque consultation) ; le vrai temps réel (WebSockets) n'est pas nécessaire à ce stade et pourra être ajouté plus tard.

### 4.7 Garde d'urgence

Deux façons de déclencher une garde d'urgence :
1. **Via le réseau personnel** (voir 4.6) : réservation directe sur un créneau `libre_urgence` d'un professionnel déjà dans le réseau du parent — le plus rapide.
2. **Via le matching élargi** : si aucun professionnel du réseau n'est disponible, le mode "besoin urgent" élargit automatiquement le rayon géographique et notifie en priorité les professionnels disponibles immédiatement, même hors réseau.

### 4.8 Profils professionnels dynamiques (format "cartes")

Pour rendre les profils plus vivants et engageants (inspiration Hinge), le profil professionnel n'est pas un simple bloc de texte mais une suite de **cartes** consultables :

- **Photos personnelles multiples** (distinctes des photos du logement, section 4.2) : le professionnel peut ajouter plusieurs photos de lui/elle, affichées en carrousel en tête de profil.
- **Prompts (questions/réponses courtes)** : le professionnel choisit 3 à 5 questions dans une liste proposée et y répond brièvement, par exemple :
  - "Ma philosophie avec les enfants..."
  - "Ce que les enfants adorent chez moi..."
  - "Une activité que j'aime faire avec eux..."
  - "Mon expérience avec les besoins particuliers..."
  - "Une anecdote qui me représente..."
- Ce format remplace le champ de présentation textuelle unique par une structure de cartes courtes et lisibles, adaptées à une consultation rapide sur mobile.
- Documents, badges et note moyenne restent affichés en complément, mais la première impression du profil devient ce format dynamique plutôt qu'un CV textuel classique.

### 4.9 Présentation de la plateforme, différenciée par profil

Une page de présentation (accessible depuis l'accueil, "Comment ça marche") dont le contenu s'adapte selon qui la consulte :

| Visiteur | Message principal |
|---|---|
| **Non connecté** | Présentation générale de Liams : la mise en relation de confiance, le focus sur les besoins particuliers, comment ça marche en 3 étapes |
| **Parent connecté** | Orienté bénéfices parent : trouver rapidement un professionnel de confiance et vérifié, réseau personnel, garde d'urgence en un clic, sécurité (vérification du casier, badges, avis) |
| **Professionnel connecté** | Orienté bénéfices pro : développer son activité, valoriser son profil (badges, avis, présentation dynamique), recevoir des demandes ciblées, gérer son planning et ses gardes d'urgence |

**Fonctionnement technique** : le contenu est déterminé par le rôle de l'utilisateur en session (parent/professionnel/non connecté) — un simple rendu conditionnel côté frontend suffit.

### 4.10 Avis et notation

Après une garde effectuée, le parent peut laisser un **avis** sur le professionnel (note de 1 à 5 + commentaire libre optionnel). Réciproquement, le professionnel peut noter le parent (utile pour la qualité globale de la plateforme, non affiché publiquement dans cette version pilote).

- La note moyenne du professionnel est affichée sur son profil public.
- Le badge "Coup de cœur des parents" est attribué automatiquement si la note moyenne dépasse un seuil (ex. ≥ 4,5/5) sur un nombre minimum d'avis (ex. 3), sans intervention du gérant.
- Les avis contribuent à la donnée qualitative du pilote (utile pour un futur argumentaire investisseur).

### 4.11 Conformité, notifications et support

- **CGU et politique de confidentialité** : case à cocher obligatoire à l'inscription (parent et professionnel), horodatée en base, condition bloquante pour créer un compte.
- **Fiche santé/urgence par enfant** : rattachée au profil de chaque enfant. Visible uniquement par les professionnels en mise en relation active avec ce parent — jamais publique.
- **Notifications par email** (suffisant pour 50 utilisateurs, pas besoin de push) déclenchées sur : nouvelle demande de mise en relation, acceptation/refus, nouvelle demande d'ajout au réseau, confirmation d'un créneau de garde d'urgence, nouvel avis reçu.
- **Contact/Support** : un lien "Signaler un problème / Suggestion" accessible depuis n'importe quelle page une fois connecté, reprenant le même formulaire que la page publique de contact (voir section 6), avec l'identité de l'utilisateur pré-remplie. Les messages arrivent par email au gérant ; pas de système de ticketing pour ce pilote.

### 4.12 Administration (interface minimale)
- Liste des professionnels avec, pour chacun, l'ensemble de leurs documents uploadés (casier, CV, diplôme, certificats, photos du logement) et un statut individuel par document (en attente/validé/refusé)
- Le gérant valide chaque document séparément ; seul le bulletin n°3 conditionne le statut global "vérifié" du profil
- **Justificatif "Xtras"** (voir 4.2) traité comme un espace de vérification à part : le gérant valide ou refuse ce justificatif spécifique, ce qui déclenche l'éligibilité aux badges de spécialisation (Spécialiste TSA/TDAH/DYS/handicap moteur)
- Sur ce même écran : cases à cocher pour attribuer les badges manuels (voir 4.4)
- Les photos du logement et les documents validés deviennent visibles sur le profil public dès validation ; les photos de logement ne sont jamais affichées avant validation
- Vue simple des inscriptions parents/pros
- **Tableau de bord** : nombre total d'inscrits (parents/professionnels), nombre de mises en relation effectuées, nombre de gardes d'urgence déclenchées, taux de complétion moyen des profils professionnels

### 4.13 Profil enfant enrichi — Les Xtras

Pour les enfants en situation de handicap ou à besoins particuliers, désignés dans l'application sous le nom **"Les Xtras"**, le parent peut compléter un profil enrichi en plus de la fiche santé/urgence obligatoire :

- **Routines apaisantes** : ce qui rassure l'enfant, les habitudes à respecter (ex. rituel du coucher, objet transitionnel, ordre des activités)
- **Déclencheurs à éviter** : situations, bruits, changements qui peuvent provoquer une crise ou un mal-être, avec si possible une indication de la réaction à adopter
- **Moyens de communication préférés** : pictogrammes, mots clés, supports visuels, langue des signes française (LSF), ou toute méthode augmentative/alternative de communication utilisée par l'enfant

Ce profil enrichi est facultatif à la création mais fortement encouragé pour les familles Xtras ; il est visible uniquement par les professionnels en mise en relation active avec ce parent, au même titre que la fiche santé/urgence, et jamais rendu public.

### 4.14 Feedback pilote (NPS)

Pour capitaliser sur le pilote à des fins de démonstration auprès de BGE PaRIF et des investisseurs, un **formulaire de feedback structuré** est envoyé automatiquement par email à chaque utilisateur (parent et professionnel) après quelques semaines d'usage effectif de la plateforme.

- **Format** : question NPS classique ("Sur une échelle de 0 à 10, recommanderiez-vous Liams ?") + 2-3 questions ciblées complémentaires (ex. facilité du matching, confiance ressentie, fonctionnalité la plus utile).
- **Fréquence** : envoi unique après une période d'usage définie (ex. 3-4 semaines après inscription), pas de sollicitation répétée pour ce pilote.
- **Exploitation** : les réponses sont consultables depuis le tableau de bord admin (voir 4.12), sous forme de score NPS agrégé et de liste de réponses brutes — donnée qualitative directement réutilisable dans un dossier investisseur.

## 5. Modèle de données (base)

- `users` (id, email, rôle: parent/professionnel, date création, cgu_acceptees_le)
- `parent_profiles` (user_id, enfants[], besoins_particuliers, localisation, disponibilités)
- `enfant_fiche_sante` (enfant_id, allergies, traitements_en_cours, contact_medecin, contact_urgence)
- `enfant_profil_xtra` (enfant_id, routines_apaisantes, declencheurs_a_eviter, moyens_communication_preferes) — profil enrichi facultatif, voir 4.13
- `professional_profiles` (user_id, tarif_horaire, zone_geo, disponibilités, specialisations[], accueil_a_domicile: bool, statut_verification_casier, badges[], note_moyenne)
- `professional_photos` (id, professional_id, fichier_url, ordre) — photos personnelles pour le profil dynamique, voir 4.8
- `professional_prompts` (id, professional_id, question, reponse, ordre) — cartes questions/réponses, voir 4.8
- `professional_documents` (id, professional_id, type: casier/cv/diplome/certificat/photo_logement, fichier_url, statut: en_attente/validé/refusé, date_upload)
- `professional_qualification_xtra` (professional_id, declare_qualifie: bool, type_justificatif: diplome/attestation_aesh/autre, fichier_url, statut: en_attente/validé/refusé) — espace différencié dédié à la question Xtras, voir 4.2
- `matches` (parent_id, professional_id, statut: en_attente/accepté/refusé, date)
- `messages` (match_id, sender_id, contenu, date)
- `parent_networks` (parent_id, professional_id, statut: en_attente/accepté/refusé, date) — réseau de confiance, many-to-many, voir 4.6
- `availability_slots` (professional_id, date, heure_debut, heure_fin, statut: occupé/libre/libre_urgence)
- `urgent_bookings` (parent_id, professional_id, slot_id, statut: en_attente/confirmé/refusé, date)
- `recurring_bookings` (parent_id, professional_id, jour_semaine, heure_debut, heure_fin, statut: actif/annulé) — réservation récurrente, voir 4.6
- `avis` (match_id, auteur_id, cible_id, note: 1-5, commentaire, date, visible_publiquement: bool)
- `feedback_pilote` (user_id, score_nps, reponses_complementaires, date_envoi, date_reponse) — voir 4.14

## 6. Pages du site public (vitrine, avant connexion)

- Accueil (proposition de valeur, focus besoins particuliers)
- Pour les parents
- Pour les professionnels
- Comment ça marche (contenu différencié selon le profil connecté, voir 4.9)
- Contact / À propos — formulaire de contact simple (nom, email, message) pour signaler un problème ou proposer une amélioration, envoyé par email au gérant
- **CGU (Conditions Générales d'Utilisation)** — texte consultable publiquement, référencé par la case à cocher obligatoire à l'inscription (voir 4.11)
- **Politique de confidentialité (RGPD)** — traitement des données, notamment sensibles (fiche santé/urgence, profil Xtra), durée de conservation, droits d'accès et de suppression, contact
- **Mentions légales** — identité de l'éditeur (SIRET à ajouter une fois obtenu), hébergeur (Vercel/Supabase), directeur de publication — obligation légale (LCEN) indépendante des CGU
- Connexion / Inscription

## 7. Points de vigilance légaux

- Aucune API officielle pour le bulletin n°3 → workflow déclaratif + upload + vérification manuelle obligatoire avant de considérer un profil "vérifié"
- Données sensibles (infos sur mineurs, besoins particuliers) → attention RGPD dès la conception (minimisation des données, consentement explicite)
- Photos du domicile/lieu d'accueil : consentement explicite du professionnel à leur publication ; éviter les éléments identifiants (adresse visible, plaques, visages de tiers)
- Photos personnelles du profil dynamique (4.8) : mêmes précautions de consentement, en particulier si des enfants apparaissent sur les photos (consentement des parents concernés obligatoire, floutage recommandé)
- **Fiche santé/urgence et profil enrichi "Xtra"** : données de santé/situation de handicap, catégorie "sensible" au sens du RGPD (article 9) — accès strictement limité aux professionnels en mise en relation active, jamais stocké en clair dans des logs ou exports, consentement explicite du parent
- **CGU, politique de confidentialité et mentions légales** : le contenu technique/fonctionnel de ces pages est décrit en section 6, mais leur **texte juridique définitif doit être rédigé ou relu par un professionnel** (avocat, ou via l'accompagnement BGE PaRIF) avant mise en ligne, en particulier compte tenu du traitement de données de santé d'enfants

## 8. Livrable attendu de cette phase pilote

Une application web fonctionnelle, déployée, avec :
- Inscription réelle parents + professionnels, avec acceptation obligatoire des CGU
- Profils professionnels dynamiques (photos + prompts façon Hinge), upload multi-documents, barre de progression
- Fiche santé/urgence par enfant, et profil enrichi "Xtra" facultatif (routines, déclencheurs, communication), visibles uniquement des professionnels en mise en relation active
- Matching fonctionnel avec option recherche par trajet et filtre par badges, y compris les badges de spécialisation Xtras (TSA, TDAH, DYS, handicap moteur)
- Mise en relation + messagerie
- Réseau de confiance parent-professionnel (many-to-many), visibilité du planning, et réservation récurrente automatique
- Réservation directe d'un créneau de garde d'urgence chez un professionnel du réseau, avec gestion de la concurrence
- Système d'avis/notation, avec attribution automatique du badge "Coup de cœur des parents"
- Page de présentation différenciée selon le profil connecté
- Notifications par email sur les événements clés
- Formulaire de contact/support, accessible publiquement et depuis l'application une fois connecté
- Formulaire de feedback pilote (NPS) envoyé automatiquement après quelques semaines d'usage
- Interface admin : vérification documentaire, attribution des badges, tableau de bord simple avec score NPS agrégé

Le paiement, les notifications push, et l'app mobile native sont explicitement **hors périmètre** de cette phase.

## 9. Instruction de démarrage pour Claude Code

> Construis une application web Next.js + Tailwind + Supabase selon ce cahier des charges. Commence par : (1) le schéma de base de données Supabase (toutes les tables de la section 5), (2) l'authentification parent/professionnel avec acceptation obligatoire des CGU, (3) les formulaires de création de profil parent (avec fiche santé/urgence et profil enrichi "Xtra" facultatif) et professionnel (avec barre de progression, upload multi-documents conditionnel, et un espace différencié dédié à la question "Avez-vous des qualifications pour accueillir des Xtras ? Si oui, merci de fournir un justificatif" avec upload spécifique diplôme/attestation AESH/autre), (4) le profil professionnel dynamique façon "cartes" (photos personnelles + prompts, inspiration Hinge), (5) l'algorithme de matching avec recherche par trajet et filtre par badges (dont les badges de spécialisation Xtras : TSA, TDAH, DYS, handicap moteur), (6) la messagerie basique, (7) le réseau de confiance parent-professionnel (many-to-many) avec partage de planning, réservation directe de garde d'urgence (gestion de la concurrence) et réservation récurrente automatique, (8) le système d'avis/notation avec badge automatique, (9) la page de présentation différenciée selon le profil connecté, (10) les notifications email et le formulaire de contact/support, ainsi que les pages CGU, politique de confidentialité et mentions légales (contenu provisoire à valider juridiquement avant mise en ligne réelle), (11) le formulaire de feedback pilote NPS envoyé automatiquement après quelques semaines, (12) l'interface admin (vérification documentaire, badges, tableau de bord avec score NPS). Utilise la charte graphique fournie (couleurs, et les fichiers du dossier `/logo` — couleur par défaut, blanche sur fond foncé, noire pour le monochrome ; carré pour favicon/icône, rectangle pour header et emails). Utilise systématiquement le terme "Les Xtras" dans l'interface pour désigner les enfants à besoins particuliers, jamais de formulation clinique générique. Livre par étapes testables plutôt qu'en un seul bloc.
