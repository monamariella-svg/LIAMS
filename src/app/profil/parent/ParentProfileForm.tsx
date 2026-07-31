"use client";

import { useActionState } from "react";
import { AdresseAutocomplete } from "@/components/AdresseAutocomplete";
import { updateParentProfile } from "./actions";

export function ParentProfileForm({ adresse }: { adresse: string }) {
  const [state, formAction, pending] = useActionState(updateParentProfile, undefined);

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
