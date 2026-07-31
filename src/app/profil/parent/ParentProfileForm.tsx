"use client";

import { useActionState } from "react";
import { JOURS_SEMAINE, type CreneauDisponibilite } from "@/lib/disponibilites";
import { AdresseAutocomplete } from "@/components/AdresseAutocomplete";
import { updateParentProfile } from "./actions";

export function ParentProfileForm({
  adresse,
  disponibilites,
}: {
  adresse: string;
  disponibilites: CreneauDisponibilite[];
}) {
  const [state, formAction, pending] = useActionState(updateParentProfile, undefined);
  const parJour = new Map(disponibilites.map((c) => [c.jour, c]));

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-liams-navy">Mon profil</h2>

      <label className="flex flex-col gap-1 text-sm">
        Adresse
        <AdresseAutocomplete
          name="adresse"
          defaultValue={adresse}
          placeholder="Ville ou adresse"
          className="w-full rounded-lg border border-gray-300 px-4 py-2"
        />
      </label>

      <div>
        <p className="text-sm font-medium text-gray-700">Disponibilités récurrentes</p>
        <div className="mt-2 flex flex-col gap-2">
          {JOURS_SEMAINE.map((label, jour) => {
            const creneau = parJour.get(jour);
            return (
              <div key={jour} className="flex items-center gap-3 text-sm">
                <label className="flex w-32 items-center gap-2">
                  <input
                    type="checkbox"
                    name={`jour_${jour}_actif`}
                    defaultChecked={Boolean(creneau)}
                  />
                  {label}
                </label>
                <input
                  type="time"
                  name={`jour_${jour}_debut`}
                  defaultValue={creneau?.debut ?? "08:00"}
                  className="rounded border border-gray-300 px-2 py-1"
                />
                <span>à</span>
                <input
                  type="time"
                  name={`jour_${jour}_fin`}
                  defaultValue={creneau?.fin ?? "18:00"}
                  className="rounded border border-gray-300 px-2 py-1"
                />
              </div>
            );
          })}
        </div>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-liams-teal">Profil enregistré.</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-liams-navy px-6 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Enregistrement..." : "Enregistrer"}
      </button>
    </form>
  );
}
