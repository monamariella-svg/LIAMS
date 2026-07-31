"use client";

import { useActionState } from "react";
import { enregistrerDonneesContractuelles } from "./actions";

export type DonneesContractuelles = {
  date_naissance: string | null;
  lieu_naissance: string | null;
  statut_juridique: string | null;
  siret: string | null;
  assurance_rc_assureur: string | null;
  assurance_rc_numero: string | null;
  assurance_rc_expiration: string | null;
};

const STATUTS = [
  { value: "auto_entrepreneur", label: "Auto-entrepreneur" },
  { value: "micro_entreprise", label: "Micro-entreprise" },
  { value: "societe", label: "Société" },
  { value: "autre", label: "Autre" },
];

export function DonneesContractuellesForm({
  donnees,
}: {
  donnees: DonneesContractuelles | null;
}) {
  const [state, formAction, pending] = useActionState(
    enregistrerDonneesContractuelles,
    undefined,
  );

  return (
    <section className="rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-liams-navy">
        Informations pour un futur contrat
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        Facultatif aujourd&apos;hui : rien ici ne bloque votre activité sur
        Liams. Ces informations sont visibles de vous seul et de l&apos;équipe
        Liams, jamais des parents. Les renseigner maintenant vous évitera de le
        faire le jour où les prestations seront contractualisées.
      </p>

      <form action={formAction} className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row">
          <label className="flex w-full flex-col gap-1 text-sm">
            Date de naissance
            <input
              type="date"
              name="date_naissance"
              defaultValue={donnees?.date_naissance ?? ""}
              className="rounded-lg border border-gray-300 px-4 py-2"
            />
          </label>
          <label className="flex w-full flex-col gap-1 text-sm">
            Lieu de naissance
            <input
              name="lieu_naissance"
              placeholder="Commune, département"
              defaultValue={donnees?.lieu_naissance ?? ""}
              className="rounded-lg border border-gray-300 px-4 py-2"
            />
          </label>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <label className="flex w-full flex-col gap-1 text-sm">
            Statut juridique
            <select
              name="statut_juridique"
              defaultValue={donnees?.statut_juridique ?? ""}
              className="rounded-lg border border-gray-300 px-4 py-2"
            >
              <option value="">Non renseigné</option>
              {STATUTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex w-full flex-col gap-1 text-sm">
            SIRET
            <input
              name="siret"
              inputMode="numeric"
              placeholder="14 chiffres"
              defaultValue={donnees?.siret ?? ""}
              className="rounded-lg border border-gray-300 px-4 py-2"
            />
          </label>
        </div>

        <fieldset className="flex flex-col gap-4 rounded-lg bg-gray-50 p-4">
          <legend className="px-1 text-sm font-medium text-liams-navy">
            Responsabilité civile professionnelle
          </legend>
          <div className="flex flex-col gap-4 sm:flex-row">
            <label className="flex w-full flex-col gap-1 text-sm">
              Assureur
              <input
                name="assurance_rc_assureur"
                defaultValue={donnees?.assurance_rc_assureur ?? ""}
                className="rounded-lg border border-gray-300 px-4 py-2"
              />
            </label>
            <label className="flex w-full flex-col gap-1 text-sm">
              N° de police
              <input
                name="assurance_rc_numero"
                defaultValue={donnees?.assurance_rc_numero ?? ""}
                className="rounded-lg border border-gray-300 px-4 py-2"
              />
            </label>
            <label className="flex w-full flex-col gap-1 text-sm">
              Échéance
              <input
                type="date"
                name="assurance_rc_expiration"
                defaultValue={donnees?.assurance_rc_expiration ?? ""}
                className="rounded-lg border border-gray-300 px-4 py-2"
              />
            </label>
          </div>
        </fieldset>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state?.success && (
          <p className="text-sm text-green-700">Informations enregistrées.</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-full bg-liams-orange px-6 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Enregistrement..." : "Enregistrer"}
        </button>
      </form>
    </section>
  );
}
