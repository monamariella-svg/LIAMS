"use client";

import { useActionState, useState } from "react";
import { JOURS_SEMAINE } from "@/lib/disponibilites";
import { formatDateLabel, isoWeekday } from "@/lib/calendar";
import { demanderCreneaux } from "./actions";

export type CreneauProposable = {
  id: string;
  date: string;
  heure_debut: string;
  heure_fin: string;
};

/** Le parent coche les créneaux du professionnel qui couvrent son besoin et
 * les demande d'un seul coup. Tout est coché par défaut : le cas courant est
 * de vouloir toute la série, décocher reste possible. */
export function DemandeCreneauxForm({
  professionalId,
  creneaux,
}: {
  professionalId: string;
  creneaux: CreneauProposable[];
}) {
  const [state, formAction, pending] = useActionState(demanderCreneaux, undefined);
  const [coches, setCoches] = useState<string[]>(() => creneaux.map((c) => c.id));

  const tousCoches = coches.length === creneaux.length;

  if (state?.success) {
    return (
      <p className="mt-2 text-xs text-liams-teal">
        Demande envoyée — en attente de validation du professionnel.
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-3 rounded-lg bg-gray-50 p-3">
      <input type="hidden" name="professional_id" value={professionalId} />

      <label className="flex items-center gap-1.5 text-xs font-medium text-liams-navy">
        <input
          type="checkbox"
          checked={tousCoches}
          onChange={() => setCoches(tousCoches ? [] : creneaux.map((c) => c.id))}
        />
        Cocher tous les créneaux disponibles ({creneaux.length})
      </label>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {creneaux.map((creneau) => (
          <label key={creneau.id} className="flex items-center gap-1.5 text-xs text-gray-700">
            <input
              type="checkbox"
              name="slot_ids"
              value={creneau.id}
              checked={coches.includes(creneau.id)}
              onChange={() =>
                setCoches((actuels) =>
                  actuels.includes(creneau.id)
                    ? actuels.filter((id) => id !== creneau.id)
                    : [...actuels, creneau.id],
                )
              }
            />
            {JOURS_SEMAINE[isoWeekday(creneau.date)]} {formatDateLabel(creneau.date)}{" "}
            {creneau.heure_debut.slice(0, 5)}–{creneau.heure_fin.slice(0, 5)}
          </label>
        ))}
      </div>

      {state?.error && <p className="mt-2 text-xs text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending || coches.length === 0}
        className="mt-3 rounded-full bg-liams-teal px-4 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending
          ? "Envoi..."
          : `Demander ${coches.length} créneau${coches.length > 1 ? "x" : ""}`}
      </button>
    </form>
  );
}
