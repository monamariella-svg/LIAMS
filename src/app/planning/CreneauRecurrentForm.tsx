"use client";

import { useActionState } from "react";
import { JOURS_SEMAINE } from "@/lib/disponibilites";
import { addDays, todayISO } from "@/lib/calendar";
import { ajouterCreneauxRecurrents, modifierCreneauxRecurrents } from "./actions";

export type RecurrenceExistante = {
  id: string;
  jours: number[];
  heure_debut: string;
  heure_fin: string;
  statut: string;
  date_debut: string;
  date_fin: string;
};

/** Sans prop `recurrence` : création d'une nouvelle série. Avec : édition de
 * la série existante (champs préremplis, toute la série est régénérée sauf
 * les créneaux déjà réservés). */
export function CreneauRecurrentForm({ recurrence }: { recurrence?: RecurrenceExistante }) {
  const [state, formAction, pending] = useActionState(
    recurrence ? modifierCreneauxRecurrents : ajouterCreneauxRecurrents,
    undefined,
  );
  const today = todayISO();
  const dansHuitSemaines = addDays(today, 56);

  const formulaire = (
    <form action={formAction} className="mt-4 flex flex-col gap-3">
      {recurrence && <input type="hidden" name="recurrence_id" value={recurrence.id} />}
      <div>
        <p className="text-xs font-medium text-gray-700">Se répète le</p>
        <div className="mt-1 flex flex-wrap gap-3">
          {JOURS_SEMAINE.map((label, jour) => (
            <label key={jour} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                name="jours"
                value={jour}
                defaultChecked={recurrence?.jours.includes(jour)}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          De
          <input
            type="time"
            name="heure_debut"
            defaultValue={recurrence ? recurrence.heure_debut.slice(0, 5) : "16:00"}
            className="rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          À
          <input
            type="time"
            name="heure_fin"
            defaultValue={recurrence ? recurrence.heure_fin.slice(0, 5) : "18:00"}
            className="rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Type de créneau
        <select
          name="statut"
          defaultValue={recurrence?.statut ?? "libre"}
          className="rounded-lg border border-gray-300 px-3 py-2"
        >
          <option value="libre">Régulier</option>
          <option value="libre_urgence">Urgence</option>
        </select>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Du
          <input
            type="date"
            name="date_debut"
            defaultValue={recurrence?.date_debut ?? today}
            className="rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Au
          <input
            type="date"
            name="date_fin"
            defaultValue={recurrence?.date_fin ?? dansHuitSemaines}
            className="rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && (
        <p className="text-sm text-liams-teal">
          {recurrence ? "Récurrence modifiée." : "Créneaux récurrents ajoutés."}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-liams-navy px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending
          ? "Enregistrement..."
          : recurrence
            ? "Enregistrer les modifications"
            : "Ajouter les créneaux récurrents"}
      </button>
    </form>
  );

  if (recurrence) return formulaire;

  return (
    <section className="rounded-xl border border-dashed border-gray-300 p-6">
      <h2 className="text-sm font-semibold text-liams-navy">
        Créneaux récurrents (répétition hebdomadaire)
      </h2>
      <p className="mt-1 text-xs text-gray-500">
        Comme dans Outlook : choisissez les jours de la semaine, l&apos;horaire,
        et la période sur laquelle ça se répète.
      </p>
      {formulaire}
    </section>
  );
}
