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

// Barre de progression d'un établissement
//
// Un établissement ne produit ni casier, ni CV, ni diplôme : ces trois-là
// pesaient 55 % d'un dossier qu'il n'aurait jamais pu compléter, et le
// bulletin n°3 le bloquait à lui seul. Ce qui atteste son droit d'exercer,
// c'est son agrément, et ce qui couvre son activité, son assurance.
//
// Le bulletin n°3 reste demandé sur le profil, mais c'est celui du
// représentant : une pièce qui concerne une personne, pas la structure, et
// dont l'absence ne dit rien de l'établissement.
export type EtablissementProgressInput = {
  infosGeneralesCompletes: boolean;
  ficheEtablissementComplete: boolean;
  agrementDepose: boolean;
  assuranceDeposee: boolean;
  auMoinsUneSection: boolean;
  questionXtrasRepondue: boolean;
  aUnePhoto: boolean;
};

const POIDS_ETABLISSEMENT = {
  infosGeneralesCompletes: 20,
  ficheEtablissementComplete: 20,
  agrementDepose: 20,
  assuranceDeposee: 15,
  auMoinsUneSection: 10,
  questionXtrasRepondue: 5,
  aUnePhoto: 10,
} as const;

export function computeEtablissementProgress(input: EtablissementProgressInput) {
  let total = 0;
  const manquants: string[] = [];

  if (input.infosGeneralesCompletes) total += POIDS_ETABLISSEMENT.infosGeneralesCompletes;
  else manquants.push("infos générales (tarif, adresse, téléphone)");

  if (input.ficheEtablissementComplete) total += POIDS_ETABLISSEMENT.ficheEtablissementComplete;
  else manquants.push("fiche de l'établissement (SIRET, agrément, représentant)");

  if (input.agrementDepose) total += POIDS_ETABLISSEMENT.agrementDepose;
  else manquants.push("agrément PMI");

  if (input.assuranceDeposee) total += POIDS_ETABLISSEMENT.assuranceDeposee;
  else manquants.push("attestation de responsabilité civile");

  if (input.auMoinsUneSection) total += POIDS_ETABLISSEMENT.auMoinsUneSection;
  else manquants.push("au moins une section déclarée");

  if (input.questionXtrasRepondue) total += POIDS_ETABLISSEMENT.questionXtrasRepondue;
  else manquants.push("réponse à la question Xtras");

  if (input.aUnePhoto) total += POIDS_ETABLISSEMENT.aUnePhoto;
  else manquants.push("photo");

  return { pourcentage: total, manquants };
}

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
