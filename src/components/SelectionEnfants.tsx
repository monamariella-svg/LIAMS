export type EnfantSelectionnable = { id: string; prenom: string };

/** Choix des enfants concernés par une réservation.
 *
 * Sans cette information, une réservation ne consomme qu'une place quel que
 * soit le nombre d'enfants, et le professionnel ignore qui il accueille —
 * alors que la fiche santé et le profil Xtra sont attachés à l'enfant.
 *
 * Un enfant unique est coché d'office : lui poser la question n'apporterait
 * rien qu'un clic de plus. */
export function SelectionEnfants({
  enfants,
  selection,
}: {
  enfants: EnfantSelectionnable[];
  /** Identifiants déjà retenus, en édition. */
  selection?: string[];
}) {
  if (enfants.length === 0) {
    return (
      <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Ajoutez d&apos;abord un enfant à votre profil : une réservation doit
        dire pour qui elle est faite.
      </p>
    );
  }

  const unSeul = enfants.length === 1;

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-liams-navy">
        {unSeul ? "Pour" : "Pour quels enfants ?"}
      </legend>
      {enfants.map((enfant) => (
        <label key={enfant.id} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="enfant_ids"
            value={enfant.id}
            defaultChecked={unSeul || (selection ?? []).includes(enfant.id)}
          />
          {enfant.prenom}
        </label>
      ))}
      {!unSeul && (
        <span className="text-xs text-gray-500">
          Chaque enfant occupe une place chez le professionnel.
        </span>
      )}
    </fieldset>
  );
}
