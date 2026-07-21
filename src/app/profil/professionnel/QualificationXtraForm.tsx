"use client";

import { useActionState, useState } from "react";
import { updateQualificationXtra } from "./actions";

const STATUT_LABELS: Record<string, { label: string; className: string }> = {
  en_attente: { label: "En attente de vérification", className: "bg-amber-100 text-amber-800" },
  valide: { label: "Validé", className: "bg-green-100 text-green-800" },
  refuse: { label: "Refusé", className: "bg-red-100 text-red-800" },
};

export function QualificationXtraForm({
  qualification,
}: {
  qualification: {
    declare_qualifie: boolean;
    type_justificatif: string | null;
    fichier_url: string | null;
    statut: string;
  } | null;
}) {
  const [state, formAction, pending] = useActionState(updateQualificationXtra, undefined);
  const [declareQualifie, setDeclareQualifie] = useState(qualification?.declare_qualifie ?? false);
  const statut = qualification ? STATUT_LABELS[qualification.statut] : null;

  return (
    <div className="rounded-xl border-2 border-liams-teal/30 bg-liams-teal/5 p-6">
      <h2 className="text-base font-semibold text-liams-navy">
        Accueil des Xtras — espace dédié
      </h2>
      <p className="mt-2 text-sm text-gray-700">
        Avez-vous des qualifications pour accueillir des Xtras (enfants TSA,
        TDAH, DYS, handicap physique) ? Si oui, merci de fournir un
        justificatif.
      </p>

      <form action={formAction} className="mt-4 flex flex-col gap-3">
        <fieldset className="flex gap-6 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="declare_qualifie"
              value="oui"
              checked={declareQualifie}
              onChange={() => setDeclareQualifie(true)}
            />
            Oui
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="declare_qualifie"
              value="non"
              checked={!declareQualifie}
              onChange={() => setDeclareQualifie(false)}
            />
            Non
          </label>
        </fieldset>

        {declareQualifie && (
          <>
            <label className="flex flex-col gap-1 text-sm">
              Type de justificatif
              <select
                name="type_justificatif"
                defaultValue={qualification?.type_justificatif ?? ""}
                className="rounded-lg border border-gray-300 px-4 py-2"
              >
                <option value="">Choisir...</option>
                <option value="diplome">
                  Diplôme (DEAES, CAP AEPE, BEP sanitaire et social...)
                </option>
                <option value="attestation_aesh">
                  Attestation de contrat AESH / du rectorat
                </option>
                <option value="autre">Autre justificatif d&apos;expérience</option>
              </select>
            </label>
            <input type="file" name="fichier" className="text-sm" />
            {qualification?.fichier_url && (
              <p className="text-xs text-gray-500">
                Justificatif déjà déposé — choisis un nouveau fichier pour le remplacer.
              </p>
            )}
          </>
        )}

        {statut && (
          <span
            className={`w-fit rounded-full px-2 py-0.5 text-xs font-medium ${statut.className}`}
          >
            {statut.label}
          </span>
        )}

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state?.success && <p className="text-sm text-liams-teal">Enregistré.</p>}

        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-full bg-liams-teal px-6 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Enregistrement..." : "Enregistrer"}
        </button>
      </form>
    </div>
  );
}
