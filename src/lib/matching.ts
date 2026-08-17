// Algorithme de matching V1 (4.3) — scoring simple par règles pondérées, sans ML.
// Ordre : (1) compatibilité de planning, (2) proximité géo/trajet, (3) score qualitatif.

import { distanceKm, distanceToSegmentKm, type Point } from "@/lib/geo";
import { addDays, isoWeekday, todayISO } from "@/lib/calendar";

export type CritereRecherche = {
  jour?: number;
  heureDebut?: string;
  heureFin?: string;
  origine?: Point;
  rayonKm?: number;
  trajetDepart?: Point;
  trajetArrivee?: Point;
  couloirTrajetKm?: number;
  badgesRequis?: string[];
  /** Les badges qu'une structure ne peut pas déclarer, parce qu'ils ne veulent
   *  rien dire d'elle — un véhicule personnel, l'absence de tabac qu'impose
   *  déjà la loi. Voir la 0036. Un établissement les satisfait d'office : sans
   *  cela, une famille qui coche « Non fumeur » écarterait toutes les crèches
   *  du pays, pour un critère qu'elles remplissent toutes. */
  badgesSansObjetPourEtablissement?: string[];
  /** Les enfants pour qui l'on cherche. Décide des créneaux retenus — un
   *  établissement accueille par sections — et du nombre de places qu'il faut
   *  y trouver. Vide ou absent : aucun filtrage par âge. */
  enfants?: EnfantConcerne[];
  tagsBesoins?: string[];
};

export type CreneauCalendrier = {
  id: string;
  date: string;
  heure_debut: string;
  heure_fin: string;
  statut: "libre" | "libre_urgence" | "occupe";
  /** Bornes d'âge du créneau, en mois. Nulles chez un indépendant, qui
   *  n'accueille pas par sections ; recopiées de sa section chez un
   *  établissement, par le trigger de la 0035. */
  age_min_mois?: number | null;
  age_max_mois?: number | null;
  /** Places encore libres, réservations décomptées. Absent : on retombe sur la
   *  capacité, puis sur une place — un créneau non réservé en vaut une. */
  placesRestantes?: number | null;
  capacite?: number | null;
};

/** Un enfant pour qui l'on cherche une place. */
export type EnfantConcerne = {
  id: string;
  dateNaissance: string;
};

/** Ce qu'un professionnel peut offrir à un enfant donné, sur un besoin donné. */
export type CouvertureEnfant = {
  enfantId: string;
  creneaux: CreneauCalendrier[];
};

/** Âge en mois révolus à une date donnée. */
function ageEnMois(dateNaissance: string, aLaDate: string): number {
  const [an, mn] = dateNaissance.split("-").map(Number);
  const jn = Number(dateNaissance.slice(8, 10));
  const [ad, md] = aLaDate.split("-").map(Number);
  const jd = Number(aLaDate.slice(8, 10));
  return (ad - an) * 12 + (md - mn) - (jd < jn ? 1 : 0);
}

/** Ce créneau peut-il accueillir l'un des enfants concernés.
 *
 * Un créneau sans bornes accueille tout le monde : c'est le cas d'un
 * indépendant, et celui d'un établissement dont les créneaux sont antérieurs
 * aux sections. Une date de naissance manquante ne fait écarter personne non
 * plus — on ne cache pas une place faute de savoir, on laisse la structure
 * répondre.
 *
 * Sans ce filtre, une famille se voyait proposer des créneaux réservés aux
 * grands pour un bébé de six mois : la demande serait partie, puis refusée,
 * après avoir fait espérer. */
function ageCompatible(
  creneau: CreneauCalendrier,
  naissances: string[] | undefined,
): boolean {
  if (creneau.age_min_mois == null && creneau.age_max_mois == null) return true;

  // Une naissance vide est un enfant indéterminé — le catalogue parcouru sans
  // besoin déclaré. Elle n'écarte rien : le laisser au calcul donnerait un âge
  // NaN, dont les comparaisons sont fausses des deux côtés, et le créneau
  // passerait par accident plutôt que par décision.
  const connues = (naissances ?? []).filter(Boolean);
  if (connues.length === 0) return true;

  return connues.some((naissance) => {
    const age = ageEnMois(naissance, creneau.date);
    if (creneau.age_min_mois != null && age < creneau.age_min_mois) return false;
    if (creneau.age_max_mois != null && age > creneau.age_max_mois) return false;
    return true;
  });
}

export type ProfessionalCandidat = {
  user_id: string;
  slots: CreneauCalendrier[];
  latitude: number | null;
  longitude: number | null;
  rayon_km: number;
  specialisations: string[];
  note_moyenne: number | null;
  badges: string[];
  /** Porte une fiche d'établissement. Décide de la lecture des badges qui ne
   *  s'adressent qu'aux personnes. */
  est_etablissement?: boolean;
  /** Va au domicile des familles. Seul cas où son rayon limite la recherche. */
  se_deplace?: boolean;
};

/** Ce professionnel répond-il aux badges demandés.
 *
 * Extrait des deux fonctions de recherche, qui portaient la même règle écrite
 * deux fois — et l'auraient donc corrigée une fois sur deux. */
function badgesCompatibles(
  candidat: ProfessionalCandidat,
  criteres: CritereRecherche,
): boolean {
  if (!criteres.badgesRequis?.length) return true;

  const sansObjet = new Set(criteres.badgesSansObjetPourEtablissement ?? []);

  return criteres.badgesRequis.every(
    (badge) =>
      candidat.badges.includes(badge) ||
      (candidat.est_etablissement === true && sansObjet.has(badge)),
  );
}

// Horizon de recherche : un créneau du calendrier n'est pris en compte pour le
// matching que s'il tombe dans les N prochains jours (au-delà, le professionnel
// n'a probablement pas encore déclaré ses disponibilités).
const HORIZON_RECHERCHE_JOURS = 60;

export type ResultatMatch = {
  candidat: ProfessionalCandidat;
  score: number;
  distanceKm: number | null;
};

function planningCompatible(
  slots: CreneauCalendrier[],
  jour?: number,
  heureDebut?: string,
  heureFin?: string,
) {
  if (jour === undefined || !heureDebut || !heureFin) return true;

  const aujourdHui = todayISO();
  const limite = addDays(aujourdHui, HORIZON_RECHERCHE_JOURS);

  return slots.some(
    (s) =>
      s.statut !== "occupe" &&
      s.date >= aujourdHui &&
      s.date <= limite &&
      isoWeekday(s.date) === jour &&
      s.heure_debut <= heureDebut &&
      s.heure_fin >= heureFin,
  );
}

function distanceCandidat(candidat: ProfessionalCandidat, criteres: CritereRecherche): number | null {
  if (candidat.latitude === null || candidat.longitude === null) return null;
  const point: Point = { latitude: candidat.latitude, longitude: candidat.longitude };

  if (criteres.trajetDepart && criteres.trajetArrivee) {
    return distanceToSegmentKm(point, criteres.trajetDepart, criteres.trajetArrivee);
  }
  if (criteres.origine) {
    return distanceKm(criteres.origine, point);
  }
  return null;
}

function geoCompatible(distance: number | null, candidat: ProfessionalCandidat, criteres: CritereRecherche) {
  if (distance === null) return true;
  const couloir = criteres.couloirTrajetKm ?? 3;
  if (criteres.trajetDepart && criteres.trajetArrivee) {
    return distance <= couloir;
  }

  // Le rayon d'un professionnel dit jusqu'où *il* se déplace. Chez un
  // établissement, ou chez quelqu'un qui reçoit à son domicile, il ne veut
  // rien dire : c'est la famille qui fait la route, et elle seule décide de la
  // distance qu'elle accepte. L'appliquer quand même rendait une crèche ayant
  // déclaré 15 km invisible à 20 km, pour une famille prête à venir.
  if (!candidat.se_deplace) {
    return criteres.rayonKm == null || distance <= criteres.rayonKm;
  }

  const rayon = Math.min(candidat.rayon_km, criteres.rayonKm ?? candidat.rayon_km);
  return distance <= rayon;
}

function scoreQualitatif(candidat: ProfessionalCandidat, criteres: CritereRecherche): number {
  let score = 0;
  score += (candidat.note_moyenne ?? 0) * 10;
  score += candidat.badges.length * 5;
  if (criteres.tagsBesoins?.length) {
    // Les compétences se déclarent désormais en badges, seuls normalisés — le
    // texte libre des anciens profils reste pris en compte, « TSA » et
    // « autisme » n'y ayant jamais eu de raison de se rencontrer.
    const declarations = [...candidat.badges, ...candidat.specialisations];
    const overlap = new Set(
      declarations.filter((d) =>
        criteres.tagsBesoins!.some((t) => d.toLowerCase().includes(t.toLowerCase())),
      ),
    ).size;
    score += overlap * 20;
  }
  return score;
}

export type PropositionPro = {
  candidat: ProfessionalCandidat;
  distanceKm: number | null;
  score: number;
  /** Nombre de dates du besoin où au moins un enfant trouve une place. */
  datesCouvertes: number;
  totalDates: number;
  /** Les créneaux effectivement couvrants, pour que le parent puisse en
   * cocher plusieurs et les demander en une seule fois. */
  creneaux: CreneauCalendrier[];
  /** Les créneaux qui conviennent à chaque enfant — son éligibilité, non son
   *  affectation. Deux enfants peuvent y figurer sur le même créneau alors
   *  qu'il n'y reste qu'une place : c'est `placesSimultanees` qui le dit, et
   *  le parent qui tranche. */
  couvertures: CouvertureEnfant[];
  /** Ceux pour qui aucun créneau ne convient — une question d'âge, pas de
   *  place. Vide quand tous ont au moins une section à leur mesure. */
  enfantsNonCouverts: string[];
  /** Combien d'enfants peuvent être accueillis, date par date.
   *
   *  Le détail plutôt qu'un chiffre unique : sur une série de dix mardis dont
   *  un seul manque de place, un « une place » global ferait renoncer à un
   *  professionnel qui convient neuf fois sur dix. Le parent doit voir lesquels
   *  posent problème pour ne chercher une solution que pour ceux-là. */
  placesParDate: { date: string; places: number }[];
};

/** Places encore libres sur un créneau.
 *
 * Le décompte fait autorité depuis la 0021 — un créneau n'est plus « libre »
 * ou « occupé », il a des places dont il reste un certain nombre. À défaut de
 * décompte fourni, la capacité déclarée ; à défaut de capacité, une place,
 * qui est ce que valait un créneau avant la 0019.
 */
function placesLibres(creneau: CreneauCalendrier): number {
  if (creneau.placesRestantes != null) return creneau.placesRestantes;
  if (creneau.capacite != null) return creneau.capacite;
  return 1;
}

/** Combien d'enfants peuvent être accueillis en même temps, au mieux.
 *
 * On ne décide pas *lesquels*. Quand une place unique convient à deux enfants,
 * le choix appartient au parent : lui seul sait lequel a une solution de repli,
 * et lequel n'en a pas. Choisir à sa place — au plus jeune, au plus contraint,
 * au premier inscrit — reviendrait à trancher une question qu'on ne lui a même
 * pas posée.
 *
 * On répond donc à une question de dénombrement, pas d'attribution : combien de
 * places sont réellement mobilisables. Le parent apprend « une seule place pour
 * vos deux enfants » et désigne lui-même qui la prend, au moment de la demande.
 *
 * Toutes les affectations possibles sont essayées, l'ordre changeant le
 * résultat quand deux enfants se disputent la même section. Le nombre d'enfants
 * concernés se compte sur les doigts d'une main : au-delà de quatre on se
 * contente d'un passage glouton, l'exhaustivité n'y valant plus son coût.
 */
function placesSimultanees(
  creneauxDuJour: CreneauCalendrier[],
  enfants: EnfantConcerne[],
): number {
  const possiblesPar = new Map(
    enfants.map((e) => [e.id, creneauxDuJour.filter((c) => ageCompatible(c, [e.dateNaissance]))]),
  );

  const essayer = (ordre: EnfantConcerne[]) => {
    const restant = new Map(creneauxDuJour.map((c) => [c.id, placesLibres(c)]));
    let places = 0;
    for (const enfant of ordre) {
      const creneau = (possiblesPar.get(enfant.id) ?? []).find(
        (c) => (restant.get(c.id) ?? 0) > 0,
      );
      if (!creneau) continue;
      restant.set(creneau.id, (restant.get(creneau.id) ?? 0) - 1);
      places += 1;
    }
    return places;
  };

  if (enfants.length > 4) return essayer(enfants);

  const permutations = (liste: EnfantConcerne[]): EnfantConcerne[][] =>
    liste.length <= 1
      ? [liste]
      : liste.flatMap((tete, i) =>
          permutations([...liste.slice(0, i), ...liste.slice(i + 1)]).map((reste) => [
            tete,
            ...reste,
          ]),
        );

  return Math.max(...permutations(enfants).map(essayer));
}

/** Propose des professionnels pour un besoin du parent, défini par des dates
 * concrètes (une seule pour un besoin ponctuel, toutes les occurrences pour
 * une récurrence) et une plage horaire. Un candidat est retenu s'il couvre au
 * moins une date avec un créneau libre et respecte les contraintes géo ; le
 * tri favorise la couverture la plus complète puis le score qualitatif. */
export function proposerPourBesoin(
  candidats: ProfessionalCandidat[],
  dates: string[],
  heureDebut: string,
  heureFin: string,
  criteres: Omit<CritereRecherche, "jour" | "heureDebut" | "heureFin"> = {},
): PropositionPro[] {
  const datesSet = new Set(dates);

  // Sans enfant désigné, on cherche une place pour « quelqu'un » : un enfant
  // fictif sans date de naissance, que tout créneau accueille. C'est le cas du
  // catalogue, parcouru avant même d'avoir déclaré un besoin.
  const enfants: EnfantConcerne[] = criteres.enfants?.length
    ? criteres.enfants
    : [{ id: "__indetermine__", dateNaissance: "" }];

  return candidats
    .map((candidat) => {
      const parEnfant = new Map<string, CreneauCalendrier[]>();
      const retenus = new Map<string, CreneauCalendrier>();
      const datesCouvertes = new Set<string>();
      const placesParDate: { date: string; places: number }[] = [];

      for (const date of dates) {
        const creneauxDuJour = candidat.slots.filter(
          (s) =>
            s.statut !== "occupe" &&
            datesSet.has(s.date) &&
            s.date === date &&
            s.heure_debut <= heureDebut &&
            s.heure_fin >= heureFin &&
            placesLibres(s) > 0,
        );
        if (creneauxDuJour.length === 0) continue;

        const places = placesSimultanees(creneauxDuJour, enfants);
        if (places === 0) continue;

        placesParDate.push({ date, places });
        datesCouvertes.add(date);
        // On note ce qui convient à chacun, sans attribuer : deux enfants
        // peuvent viser le même créneau, et c'est au parent de dire lequel
        // l'occupera.
        for (const enfant of enfants) {
          const possibles = creneauxDuJour.filter((c) =>
            ageCompatible(c, [enfant.dateNaissance]),
          );
          if (possibles.length === 0) continue;
          const liste = parEnfant.get(enfant.id) ?? [];
          liste.push(...possibles);
          parEnfant.set(enfant.id, liste);
          for (const c of possibles) retenus.set(c.id, c);
        }
      }

      const trier = (a: CreneauCalendrier, b: CreneauCalendrier) =>
        a.date.localeCompare(b.date) || a.heure_debut.localeCompare(b.heure_debut);

      const creneaux = [...retenus.values()].sort(trier);
      const couvertures: CouvertureEnfant[] = enfants
        .filter((e) => parEnfant.has(e.id))
        .map((e) => ({ enfantId: e.id, creneaux: parEnfant.get(e.id)!.sort(trier) }));

      return {
        candidat,
        creneaux,
        couvertures,
        enfantsNonCouverts: enfants.filter((e) => !parEnfant.has(e.id)).map((e) => e.id),
        placesParDate,
        datesCouvertes: datesCouvertes.size,
        distance: distanceCandidat(candidat, criteres),
      };
    })
    .filter(({ creneaux }) => creneaux.length > 0)
    .filter(({ candidat, distance }) => geoCompatible(distance, candidat, criteres))
    .filter(({ candidat }) => badgesCompatibles(candidat, criteres))
    .map(
      ({
        candidat,
        creneaux,
        couvertures,
        enfantsNonCouverts,
        placesParDate,
        datesCouvertes,
        distance,
      }) => ({
        candidat,
        distanceKm: distance,
        score: scoreQualitatif(candidat, criteres),
        datesCouvertes,
        totalDates: dates.length,
        creneaux,
        couvertures,
        enfantsNonCouverts,
        placesParDate,
      }),
    )
    // Ceux qui prennent toute la fratrie le plus souvent d'abord. Un
    // professionnel qui n'en prend qu'un, ou qui ne les prend tous que
    // certains jours, reste proposé — un parent sans meilleure solution s'en
    // contente et cherche ailleurs pour les jours manquants — mais après.
    .sort((a, b) => {
      const completes = (p: typeof a) =>
        p.placesParDate.filter((d) => d.places >= enfants.length).length;
      return completes(b) - completes(a) || b.datesCouvertes - a.datesCouvertes || b.score - a.score;
    });
}

export function matchProfessionnels(
  candidats: ProfessionalCandidat[],
  criteres: CritereRecherche,
): ResultatMatch[] {
  return candidats
    .filter((c) => planningCompatible(c.slots, criteres.jour, criteres.heureDebut, criteres.heureFin))
    // Le catalogue n'a pas de date : on retient un professionnel dès qu'un de
    // ses créneaux accueille l'âge de l'enfant. Celui qui n'a que des sections
    // de grands n'a rien à proposer pour un bébé, et l'afficher ferait perdre
    // un rendez-vous à tout le monde.
    .filter(
      (c) =>
        c.slots.length === 0 ||
        c.slots.some((s) =>
          ageCompatible(
            s,
            (criteres.enfants ?? []).map((e) => e.dateNaissance),
          ),
        ),
    )
    .map((c) => ({ candidat: c, distance: distanceCandidat(c, criteres) }))
    .filter(({ candidat, distance }) => geoCompatible(distance, candidat, criteres))
    .filter(({ candidat }) => badgesCompatibles(candidat, criteres))
    .map(({ candidat, distance }) => ({
      candidat,
      distanceKm: distance,
      score: scoreQualitatif(candidat, criteres),
    }))
    .sort((a, b) => b.score - a.score);
}
