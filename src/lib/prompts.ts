// Suggestions de prompts pour le profil dynamique "cartes" (4.8)
export const PROMPTS_SUGGERES = [
  "Ma philosophie avec les enfants...",
  "Ce que les enfants adorent chez moi...",
  "Une activité que j'aime faire avec eux...",
  "Mon expérience avec les besoins particuliers...",
  "Une anecdote qui me représente...",
] as const;

/** Les mêmes questions, posées à une équipe.
 *
 *  Une crèche qui écrit « ma philosophie » parle au nom d'une personne qui
 *  n'existe pas : ce n'est ni la directrice, ni l'auxiliaire qui accueillera
 *  l'enfant le mardi. Le « nous » n'est pas une tournure de politesse, c'est ce
 *  que la structure est. */
export const PROMPTS_SUGGERES_ETABLISSEMENT = [
  "Notre philosophie avec les enfants...",
  "Ce que les enfants adorent chez nous...",
  "Une activité que nous aimons faire avec eux...",
  "Notre expérience avec les besoins particuliers...",
  "Ce qui fait notre particularité...",
] as const;

/** Les suggestions qui conviennent à ce professionnel-ci. */
export function promptsSugeres(estEtablissement: boolean) {
  return estEtablissement ? PROMPTS_SUGGERES_ETABLISSEMENT : PROMPTS_SUGGERES;
}

export const NB_PROMPTS_MIN = 3;
export const NB_PROMPTS_MAX = 5;
export const NB_PHOTOS_MAX = 6;
