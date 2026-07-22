"use client";

import { useActionState } from "react";
import { soumettreDossier } from "./actions";

export function SoumettreDossierForm() {
  const [state, formAction, pending] = useActionState(soumettreDossier, undefined);

  return (
    <section className="rounded-xl border-2 border-liams-navy/20 bg-liams-navy/5 p-6">
      <h2 className="text-base font-semibold text-liams-navy">Soumettre mon dossier</h2>
      <p className="mt-1 text-sm text-gray-600">
        Une fois ton bulletin n°3, ton CV (et ton justificatif Xtras si
        applicable) déposés, soumets ton dossier pour vérification.
      </p>

      <form action={formAction} className="mt-4">
        {state?.error && <p className="mb-3 text-sm text-red-600">{state.error}</p>}
        {state?.dossierComplet && (
          <p className="mb-3 rounded-lg bg-liams-teal/10 px-4 py-3 text-sm font-medium text-liams-teal">
            Ton dossier est complet ! Il sera analysé et validé par notre équipe sous 24 à 48h.
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-liams-navy px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Vérification..." : "Soumettre mon dossier pour validation"}
        </button>
      </form>
    </section>
  );
}
