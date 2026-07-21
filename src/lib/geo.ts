// Calculs géographiques simples (échelle ville/département) — pas besoin de PostGIS
// pour un pilote à 50 utilisateurs (4.3).

const KM_PER_DEGREE_LAT = 111.32;

function kmPerDegreeLon(latitude: number) {
  return KM_PER_DEGREE_LAT * Math.cos((latitude * Math.PI) / 180);
}

export type Point = { latitude: number; longitude: number };

export function distanceKm(a: Point, b: Point): number {
  const dLat = (b.latitude - a.latitude) * KM_PER_DEGREE_LAT;
  const dLon = (b.longitude - a.longitude) * kmPerDegreeLon((a.latitude + b.latitude) / 2);
  return Math.sqrt(dLat * dLat + dLon * dLon);
}

// Distance approximative d'un point au segment [depart, arrivee] (couloir de trajet, 4.5),
// en projetant sur un plan local (suffisant à l'échelle d'un trajet domicile-école/travail).
export function distanceToSegmentKm(point: Point, depart: Point, arrivee: Point): number {
  const latRef = (depart.latitude + arrivee.latitude) / 2;
  const kmLon = kmPerDegreeLon(latRef);

  const toXY = (p: Point) => ({
    x: p.longitude * kmLon,
    y: p.latitude * KM_PER_DEGREE_LAT,
  });

  const p = toXY(point);
  const a = toXY(depart);
  const b = toXY(arrivee);

  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSq = abx * abx + aby * aby;

  let t = lengthSq === 0 ? 0 : ((p.x - a.x) * abx + (p.y - a.y) * aby) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  const projX = a.x + t * abx;
  const projY = a.y + t * aby;

  return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
}
