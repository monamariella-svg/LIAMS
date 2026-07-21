"use client";

import { useActionState, useRef } from "react";
import { ajouterEnfant } from "./actions";

export function AjouterEnfantForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(async (prevState: unknown, formData: FormData) => {
    const result = await ajouterEnfant(prevState as never, formData);
    if (result?.success) formRef.current?.reset();
    return result;
  }, undefined);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-dashed border-gray-300 p-6"
    >
      <h3 className="text-sm font-semibold text-liams-navy">Ajouter un enfant</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          name="prenom"
          required
          placeholder="Prénom"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
        />
        <input
          name="date_naissance"
          type="date"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
        />
      </div>
      <textarea
        name="besoins_particuliers_libre"
        placeholder="Besoins particuliers éventuels (champ libre)"
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
        rows={2}
      />
      <input
        name="besoins_particuliers_tags"
        placeholder="Tags séparés par des virgules (ex: TSA, allergies alimentaires)"
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
      />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-liams-orange px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Ajout..." : "Ajouter"}
      </button>
    </form>
  );
}
