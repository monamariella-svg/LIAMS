// Barre de progression du profil parent
//
// Le profil Xtra n'entre volontairement pas dans le calcul : il est facultatif
// (4.13), et un enfant sans besoin particulier n'a rien à y déclarer. L'exiger
// laisserait ces familles avec un dossier éternellement incomplet.
export type ParentProgressInput = {
  identiteComplete: boolean;
  telephoneRenseigne: boolean;
  adresseRenseignee: boolean;
  auMoinsUnEnfant: boolean;
  fichesSanteCompletes: boolean;
};

const POIDS_PARENT = {
  identiteComplete: 20,
  telephoneRenseigne: 20,
  adresseRenseignee: 20,
  auMoinsUnEnfant: 20,
  fichesSanteCompletes: 20,
} as const;

export function computeParentProgress(input: ParentProgressInput) {
  let total = 0;
  const manquants: string[] = [];

  if (input.identiteComplete) total += POIDS_PARENT.identiteComplete;
  else manquants.push("prénom et nom");

  // Sans numéro joignable, personne ne peut vous prévenir pendant une garde.
  if (input.telephoneRenseigne) total += POIDS_PARENT.telephoneRenseigne;
  else manquants.push("téléphone");

  if (input.adresseRenseignee) total += POIDS_PARENT.adresseRenseignee;
  else manquants.push("adresse");

  if (input.auMoinsUnEnfant) total += POIDS_PARENT.auMoinsUnEnfant;
  else manquants.push("au moins un enfant");

  // Sans enfant, il n'y a pas de fiche santé à réclamer : on ne compte ce
  // quart que lorsqu'il a un sens.
  if (input.auMoinsUnEnfant && input.fichesSanteCompletes) {
    total += POIDS_PARENT.fichesSanteCompletes;
  } else if (input.auMoinsUnEnfant) {
    manquants.push("fiche santé de chaque enfant");
  }

  return { pourcentage: total, manquants };
}

// Barre de progression du profil professionnel (4.2.4)
export type ProfessionalProgressInput = {
  infosGeneralesCompletes: boolean;
  casierDepose: boolean;
  cvDepose: boolean;
  diplomeOuCertificatDepose: boolean;
  questionXtrasRepondue: boolean;
  aUnePhoto: boolean;
};

const POIDS = {
  infosGeneralesCompletes: 25,
  casierDepose: 25,
  cvDepose: 15,
  diplomeOuCertificatDepose: 15,
  questionXtrasRepondue: 10,
  aUnePhoto: 10,
} as const;

export function computeProfessionalProgress(input: ProfessionalProgressInput) {
  let total = 0;
  const manquants: string[] = [];

  if (input.infosGeneralesCompletes) total += POIDS.infosGeneralesCompletes;
  else manquants.push("infos générales (tarif, adresse, téléphone)");

  if (input.casierDepose) total += POIDS.casierDepose;
  else manquants.push("bulletin n°3 du casier judiciaire");

  if (input.cvDepose) total += POIDS.cvDepose;
  else manquants.push("CV");

  if (input.diplomeOuCertificatDepose) total += POIDS.diplomeOuCertificatDepose;
  else manquants.push("diplôme ou certificat");

  if (input.questionXtrasRepondue) total += POIDS.questionXtrasRepondue;
  else manquants.push("réponse à la question Xtras");

  if (input.aUnePhoto) total += POIDS.aUnePhoto;
  else manquants.push("photo de profil");

  return { pourcentage: total, manquants };
}
