// Fenêtre de réservation d'urgence (4.6).
//
// Un créneau déclaré "urgence" par le professionnel répond à un besoin de
// dernière minute : il ne se demande qu'entre 20 h et 2 h avant son début.
// En deçà de 2 h, plus aucune réservation n'est possible, quel que soit le
// type de créneau — le professionnel n'aurait pas le temps de s'organiser.
//
// Conséquence directe : une demande d'urgence porte forcément sur la semaine
// en cours, sans qu'il soit besoin d'une règle supplémentaire.

export const HEURES_OUVERTURE_URGENCE = 20;
export const HEURES_FERMETURE = 2;

const FUSEAU = "Europe/Paris";

/** Instant réel correspondant à une date + heure stockées sans fuseau.
 *
 * Les créneaux sont saisis en heure locale française mais stockés en `date` +
 * `time` nus : les interpréter avec le fuseau du serveur (UTC sur Vercel)
 * décalerait les fenêtres de 1 à 2 heures selon la saison. */
export function instantCreneau(dateISO: string, heure: string): Date {
  const naif = new Date(`${dateISO}T${heure.slice(0, 5)}:00Z`);
  // Décalage de Paris à cet instant, obtenu en comparant le même instant
  // rendu dans les deux fuseaux (approximation pendant l'heure de bascule).
  const enParis = new Date(naif.toLocaleString("en-US", { timeZone: FUSEAU }));
  const enUTC = new Date(naif.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(naif.getTime() - (enParis.getTime() - enUTC.getTime()));
}

export type Disponibilite = { demandable: boolean; raison?: string };

export function disponibiliteCreneau(
  slot: { date: string; heure_debut: string; statut: string },
  maintenant: Date = new Date(),
): Disponibilite {
  const heuresAvant =
    (instantCreneau(slot.date, slot.heure_debut).getTime() - maintenant.getTime()) / 3_600_000;

  if (heuresAvant < HEURES_FERMETURE) {
    return { demandable: false, raison: "trop tard (moins de 2 h avant)" };
  }
  if (slot.statut === "libre_urgence" && heuresAvant > HEURES_OUVERTURE_URGENCE) {
    return { demandable: false, raison: "demandable à partir de 20 h avant" };
  }
  return { demandable: true };
}
