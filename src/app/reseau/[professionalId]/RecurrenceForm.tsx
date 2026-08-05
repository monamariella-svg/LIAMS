"use client";

import { useActionState } from "react";
import { JOURS_SEMAINE } from "@/lib/disponibilites";
import {
  SelectionEnfants,
  type EnfantSelectionnable,
} from "@/components/SelectionEnfants";
import { demanderReservationRecurrente, modifierReservationRecurrente } from "./actions";

export type ReservationRecurrente = {
  id: string;
  jour_semaine: number;
  heure_debut: string;
  heure_fin: string;
  date_debut?: string | null;
  date_fin?: string | null;
  enfant_ids?: string[];
};

/** Sans prop `recurrence` : nouvelle demande. Avec : modification d'une
 * demande existante — qui repasse en attente de validation du professionnel. */
export function RecurrenceForm({
  professionalId,
  recurrence,
  enfants,
}: {
  professionalId: string;
  recurrence?: ReservationRecurrente;
  enfants: EnfantSelectionnable[];
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
      {/* Un accueil de longue durée court sur une période que le parent fixe :
          une fin laissée vide vaut durée indéterminée. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          À partir du
          <input
            type="date"
            name="date_debut"
            defaultValue={recurrence?.date_debut ?? ""}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Jusqu&apos;au
          <input
            type="date"
            name="date_fin"
            defaultValue={recurrence?.date_fin ?? ""}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <span className="text-xs text-gray-500">
            Laissez vide pour une durée indéterminée.
          </span>
        </label>
      </div>

      <SelectionEnfants enfants={enfants} selection={recurrence?.enfant_ids} />

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
