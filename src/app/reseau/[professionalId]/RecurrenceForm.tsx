"use client";

import { useActionState } from "react";
import { JOURS_SEMAINE } from "@/lib/disponibilites";
import { demanderReservationRecurrente, modifierReservationRecurrente } from "./actions";

export type ReservationRecurrente = {
  id: string;
  jour_semaine: number;
  heure_debut: string;
  heure_fin: string;
};

/** Sans prop `recurrence` : nouvelle demande. Avec : modification d'une
 * demande existante — qui repasse en attente de validation du professionnel. */
export function RecurrenceForm({
  professionalId,
  recurrence,
}: {
  professionalId: string;
  recurrence?: ReservationRecurrente;
}) {
  const [state, formAction, pending] = useActionState(
    recurrence ? modifierReservationRecurrente : demanderReservationRecurrente,
    undefined,
  );

  return (
    <form
      action={formAction}
      className={
        recurrence
          ? "mt-3 flex flex-col gap-3"
          : "flex flex-col gap-3 rounded-xl border border-dashed border-gray-300 p-6"
      }
    >
      <input type="hidden" name="professional_id" value={professionalId} />
      {recurrence && <input type="hidden" name="recurrence_id" value={recurrence.id} />}
      {!recurrence && (
        <h2 className="text-sm font-semibold text-liams-navy">
          Demander une réservation récurrente
        </h2>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <select
          name="jour_semaine"
          required
          defaultValue={recurrence?.jour_semaine ?? ""}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Jour...</option>
          {JOURS_SEMAINE.map((label, i) => (
            <option key={label} value={i}>
              {label}
            </option>
          ))}
        </select>
        <input
          type="time"
          name="heure_debut"
          required
          defaultValue={recurrence ? recurrence.heure_debut.slice(0, 5) : "16:00"}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          type="time"
          name="heure_fin"
          required
          defaultValue={recurrence ? recurrence.heure_fin.slice(0, 5) : "18:00"}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && (
        <p className="text-sm text-liams-teal">
          {recurrence
            ? "Demande modifiée — en attente de validation."
            : "Demande envoyée — en attente de validation."}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-liams-teal px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Envoi..." : recurrence ? "Modifier ma demande" : "Demander"}
      </button>
    </form>
  );
}
