"use client";

import { useActionState } from "react";
import { updateFicheSante } from "./actions";

export function FicheSanteForm({
  enfantId,
  fiche,
}: {
  enfantId: string;
  fiche: {
    allergies: string | null;
    traitements_en_cours: string | null;
    contact_medecin: string | null;
    contact_urgence: string | null;
  } | null;
}) {
  const [state, formAction, pending] = useActionState(updateFicheSante, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="enfant_id" value={enfantId} />
      <p className="text-sm font-medium text-liams-navy">
        Fiche santé / urgence <span className="text-red-600">*</span>{" "}
        <span className="font-normal text-gray-500">
          — visible uniquement des professionnels en mise en relation active
        </span>
      </p>
      <textarea
        name="allergies"
        defaultValue={fiche?.allergies ?? ""}
        placeholder="Allergies"
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
        rows={2}
      />
      <textarea
        name="traitements_en_cours"
        defaultValue={fiche?.traitements_en_cours ?? ""}
        placeholder="Traitements en cours"
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
        rows={2}
      />
      <input
        name="contact_medecin"
        defaultValue={fiche?.contact_medecin ?? ""}
        placeholder="Contact du médecin traitant"
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
      />
      <input
        name="contact_urgence"
        defaultValue={fiche?.contact_urgence ?? ""}
        placeholder="Personne à prévenir en cas d'urgence"
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
      />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-liams-teal">Fiche enregistrée.</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full border border-liams-navy px-5 py-2 text-sm font-medium text-liams-navy hover:bg-liams-navy hover:text-white disabled:opacity-50"
      >
        {pending ? "Enregistrement..." : "Enregistrer la fiche santé"}
      </button>
    </form>
  );
}
