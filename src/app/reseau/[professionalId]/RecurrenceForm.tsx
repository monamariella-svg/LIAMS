"use client";

import { useActionState } from "react";
import { JOURS_SEMAINE } from "@/lib/disponibilites";
import { demanderReservationRecurrente } from "./actions";

export function RecurrenceForm({ professionalId }: { professionalId: string }) {
  const [state, formAction, pending] = useActionState(demanderReservationRecurrente, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-dashed border-gray-300 p-6">
      <input type="hidden" name="professional_id" value={professionalId} />
      <h2 className="text-sm font-semibold text-liams-navy">
        Demander une réservation récurrente
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <select name="jour_semaine" required className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="">Jour...</option>
          {JOURS_SEMAINE.map((label, i) => (
            <option key={label} value={i}>
              {label}
            </option>
          ))}
        </select>
        <input type="time" name="heure_debut" required defaultValue="16:00" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        <input type="time" name="heure_fin" required defaultValue="18:00" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-liams-teal">Demande envoyée — en attente de validation.</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-liams-teal px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Envoi..." : "Demander"}
      </button>
    </form>
  );
}
