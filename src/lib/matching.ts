// Algorithme de matching V1 (4.3) — scoring simple par règles pondérées, sans ML.
// Ordre : (1) compatibilité de planning, (2) proximité géo/trajet, (3) score qualitatif.

import { distanceKm, distanceToSegmentKm, type Point } from "@/lib/geo";
import type { CreneauDisponibilite } from "@/lib/disponibilites";

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

export type ProfessionalCandidat = {
  user_id: string;
  disponibilites: CreneauDisponibilite[];
  latitude: number | null;
  longitude: number | null;
  rayon_km: number;
  specialisations: string[];
  note_moyenne: number | null;
  badges: string[];
};

export type ResultatMatch = {
  candidat: ProfessionalCandidat;
  score: number;
  distanceKm: number | null;
};

function creneauCouvre(creneau: CreneauDisponibilite, heureDebut: string, heureFin: string) {
  return creneau.debut <= heureDebut && creneau.fin >= heureFin;
}

function planningCompatible(
  disponibilites: CreneauDisponibilite[],
  jour?: number,
  heureDebut?: string,
  heureFin?: string,
) {
  if (jour === undefined || !heureDebut || !heureFin) return true;
  return disponibilites.some((c) => c.jour === jour && creneauCouvre(c, heureDebut, heureFin));
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
    const overlap = candidat.specialisations.filter((s) =>
      criteres.tagsBesoins!.some((t) => s.toLowerCase().includes(t.toLowerCase())),
    ).length;
    score += overlap * 20;
  }
  return score;
}

export function matchProfessionnels(
  candidats: ProfessionalCandidat[],
  criteres: CritereRecherche,
): ResultatMatch[] {
  return candidats
    .filter((c) => planningCompatible(c.disponibilites, criteres.jour, criteres.heureDebut, criteres.heureFin))
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
