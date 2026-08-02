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
  tagsBesoins?: string[];
};

export type CreneauCalendrier = {
  id: string;
  date: string;
  heure_debut: string;
  heure_fin: string;
  statut: "libre" | "libre_urgence" | "occupe";
};

export type ProfessionalCandidat = {
  user_id: string;
  slots: CreneauCalendrier[];
  latitude: number | null;
  longitude: number | null;
  rayon_km: number;
  specialisations: string[];
  note_moyenne: number | null;
  badges: string[];
};

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
  /** Nombre de dates du besoin où le professionnel a un créneau libre couvrant. */
  datesCouvertes: number;
  totalDates: number;
  /** Les créneaux effectivement couvrants, pour que le parent puisse en
   * cocher plusieurs et les demander en une seule fois. */
  creneaux: CreneauCalendrier[];
};

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

  return candidats
    .map((candidat) => {
      const creneaux = candidat.slots
        .filter(
          (s) =>
            s.statut !== "occupe" &&
            datesSet.has(s.date) &&
            s.heure_debut <= heureDebut &&
            s.heure_fin >= heureFin,
        )
        .sort((a, b) => a.date.localeCompare(b.date) || a.heure_debut.localeCompare(b.heure_debut));
      return { candidat, creneaux, distance: distanceCandidat(candidat, criteres) };
    })
    .filter(({ creneaux }) => creneaux.length > 0)
    .filter(({ candidat, distance }) => geoCompatible(distance, candidat, criteres))
    .filter(({ candidat }) =>
      criteres.badgesRequis?.length
        ? criteres.badgesRequis.every((b) => candidat.badges.includes(b))
        : true,
    )
    .map(({ candidat, creneaux, distance }) => ({
      candidat,
      distanceKm: distance,
      score: scoreQualitatif(candidat, criteres),
      datesCouvertes: new Set(creneaux.map((s) => s.date)).size,
      totalDates: dates.length,
      creneaux,
    }))
    .sort((a, b) => b.datesCouvertes - a.datesCouvertes || b.score - a.score);
}

export function matchProfessionnels(
  candidats: ProfessionalCandidat[],
  criteres: CritereRecherche,
): ResultatMatch[] {
  return candidats
    .filter((c) => planningCompatible(c.slots, criteres.jour, criteres.heureDebut, criteres.heureFin))
    .map((c) => ({ candidat: c, distance: distanceCandidat(c, criteres) }))
    .filter(({ candidat, distance }) => geoCompatible(distance, candidat, criteres))
    .filter(({ candidat }) =>
      criteres.badgesRequis?.length
        ? criteres.badgesRequis.every((b) => candidat.badges.includes(b))
        : true,
    )
    .map(({ candidat, distance }) => ({
      candidat,
      distanceKm: distance,
      score: scoreQualitatif(candidat, criteres),
    }))
    .sort((a, b) => b.score - a.score);
}
