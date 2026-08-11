/** Les sections d'un établissement, telles que le planning a besoin de les
 *  proposer.
 *
 *  Un professionnel indépendant n'en a aucune : les formulaires reçoivent alors
 *  une liste vide et ne montrent rien de plus qu'avant. C'est voulu — une
 *  assistante maternelle n'a pas de sections, et lui demander laquelle serait
 *  une question sans réponse. */
export type TrancheOption = {
  id: string;
  libelle: string | null;
  age_min_mois: number;
  age_max_mois: number;
  places_ouvertes: number;
};

/** « 18 mois » se lit sans effort, « 54 mois » non. */
function enMoisEtAnnees(mois: number) {
  if (mois < 24) return `${mois} mois`;
  const annees = mois / 12;
  return Number.isInteger(annees)
    ? `${annees} ans`
    : `${annees.toFixed(1).replace(".", ",")} ans`;
}

/** L'intitulé d'une section dans un menu déroulant.
 *
 *  Les âges y figurent même lorsque la section porte un nom : « Les moyens »
 *  ne dit pas à qui elle s'adresse, et c'est précisément ce qu'on choisit ici.
 *  Les places ouvertes suivent, parce qu'un créneau ne peut pas les dépasser
 *  et qu'on le saura mieux avant de saisir qu'après le refus. */
export function libelleTranche(tranche: TrancheOption): string {
  const ages = `${enMoisEtAnnees(tranche.age_min_mois)} – ${enMoisEtAnnees(tranche.age_max_mois)}`;
  const places = `${tranche.places_ouvertes} place${tranche.places_ouvertes > 1 ? "s" : ""}`;
  return tranche.libelle
    ? `${tranche.libelle} (${ages}, ${places})`
    : `${ages} (${places})`;
}
