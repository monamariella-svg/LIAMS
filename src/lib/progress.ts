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
  else manquants.push("infos générales (tarif, adresse)");

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
