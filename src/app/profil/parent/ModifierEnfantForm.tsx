"use client";

import { useActionState, useState } from "react";
import { modifierEnfant } from "./actions";

export type EnfantModifiable = {
  id: string;
  prenom: string;
  date_naissance: string | null;
  besoins_particuliers_libre: string | null;
  besoins_particuliers_tags: string[] | null;
};

/** Correction d'un enfant déjà enregistré.
 *
 * Replié par défaut : cette page sert d'abord à remplir les fiches santé, et
 * un formulaire ouvert par enfant en ferait perdre le fil. Il s'ouvre quand on
 * en a besoin, c'est-à-dire rarement — mais quand on en a besoin, l'autre
 * chemin était de supprimer l'enfant et de recréer tout son dossier. */
export function ModifierEnfantForm({ enfant }: { enfant: EnfantModifiable }) {
  const [ouvert, setOuvert] = useState(false);
  const [state, formAction, pending] = useActionState(modifierEnfant, undefined);

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="self-start text-xs text-liams-navy underline hover:opacity-80"
      >
        Corriger ses informations
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg bg-gray-50 p-4">
      <input type="hidden" name="enfant_id" value={enfant.id} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-gray-500">
          Prénom
          <input
            name="prenom"
            required
            defaultValue={enfant.prenom}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500">
          Date de naissance
          <input
            name="date_naissance"
            type="date"
            required
            max={new Date().toISOString().slice(0, 10)}
            defaultValue={enfant.date_naissance ?? ""}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900"
          />
          <span className="text-xs text-gray-500">
            Elle détermine les places qui conviennent à votre enfant : un
            établissement n&apos;accueille que certaines tranches d&apos;âge par
            section.
          </span>
        </label>
      </div>

      <textarea
        name="besoins_particuliers_libre"
        placeholder="Besoins particuliers éventuels (champ libre)"
        defaultValue={enfant.besoins_particuliers_libre ?? ""}
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
        rows={2}
      />
      <input
        name="besoins_particuliers_tags"
        placeholder="Tags séparés par des virgules (ex: TSA, allergies alimentaires)"
        defaultValue={(enfant.besoins_particuliers_tags ?? []).join(", ")}
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
      />

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-700">{state.message}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-liams-teal px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Enregistrement..." : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={() => setOuvert(false)}
          className="text-xs text-gray-500 underline"
        >
          Fermer
        </button>
      </div>
    </form>
  );
}
