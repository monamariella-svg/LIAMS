// Convention utilisée dans toute l'app : 0 = lundi ... 6 = dimanche.
export const JOURS_SEMAINE = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
] as const;

export type CreneauDisponibilite = {
  jour: number;
  debut: string;
  fin: string;
};

export function parseDisponibilitesFromFormData(formData: FormData): CreneauDisponibilite[] {
  const creneaux: CreneauDisponibilite[] = [];
  for (let jour = 0; jour < JOURS_SEMAINE.length; jour++) {
    const actif = formData.get(`jour_${jour}_actif`) === "on";
    if (!actif) continue;
    const debut = String(formData.get(`jour_${jour}_debut`) ?? "");
    const fin = String(formData.get(`jour_${jour}_fin`) ?? "");
    if (debut && fin) {
      creneaux.push({ jour, debut, fin });
    }
  }
  return creneaux;
}
