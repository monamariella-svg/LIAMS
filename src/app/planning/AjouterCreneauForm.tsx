"use client";

import { useActionState, useRef } from "react";
import { ajouterCreneau } from "./actions";

export function AjouterCreneauForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(async (prevState: unknown, formData: FormData) => {
    const result = await ajouterCreneau(prevState as never, formData);
    if (result?.success) formRef.current?.reset();
    return result;
  }, undefined);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3 rounded-xl border border-dashed border-gray-300 p-6">
      <h2 className="text-sm font-semibold text-liams-navy">Ajouter un créneau</h2>
      <div className="grid gap-3 sm:grid-cols-4">
        <input type="date" name="date" required className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        <input type="time" name="heure_debut" required defaultValue="16:00" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        <input type="time" name="heure_fin" required defaultValue="18:00" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        <select name="statut" defaultValue="libre" className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="libre">Libre</option>
          <option value="libre_urgence">Libre — garde d&apos;urgence</option>
          <option value="occupe">Occupé</option>
        </select>
      </div>
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
