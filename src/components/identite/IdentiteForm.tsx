"use client";

import { useActionState } from "react";
import { enregistrerIdentite } from "./actions";

export function IdentiteForm({
  prenom,
  nom,
  telephone,
  estEtablissement = false,
}: {
  prenom: string | null;
  nom: string | null;
  telephone: string | null;
  /** Une structure n'a pas de prénom : un seul champ, sa raison sociale. */
  estEtablissement?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    enregistrerIdentite,
    undefined,
  );

  return (
    <section className="rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-liams-navy">
        {estEtablissement ? "L'identité de l'établissement" : "Mon identité"}
      </h2>

      <form action={formAction} className="mt-4 flex flex-col gap-4">
        {estEtablissement ? (
          <label className="flex flex-col gap-1 text-sm">
            Nom de l&apos;établissement
            <input
              name="nom"
              required
              defaultValue={nom ?? ""}
              className="rounded-lg border border-gray-300 px-4 py-2"
            />
            <span className="text-xs text-gray-500">
              C&apos;est sous ce nom que les familles vous verront.
            </span>
          </label>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row">
            <label className="flex w-full flex-col gap-1 text-sm">
              Prénom
              <input
                name="prenom"
                required
                defaultValue={prenom ?? ""}
                className="rounded-lg border border-gray-300 px-4 py-2"
              />
            </label>
            <label className="flex w-full flex-col gap-1 text-sm">
              Nom
              <input
                name="nom"
                required
                defaultValue={nom ?? ""}
                className="rounded-lg border border-gray-300 px-4 py-2"
              />
            </label>
          </div>
        )}

        <label className="flex flex-col gap-1 text-sm sm:w-1/2 sm:pr-2">
          Téléphone
          <input
            name="telephone"
            type="tel"
            required
            placeholder="06 12 34 56 78"
            defaultValue={telephone ?? ""}
            className="rounded-lg border border-gray-300 px-4 py-2"
          />
          <span className="text-xs text-gray-500">
            Indispensable pour vous joindre en cas d&apos;urgence pendant une
            garde. Visible uniquement des personnes avec qui vous avez une mise
            en relation acceptée.
          </span>
        </label>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state?.success && (
          <p className="text-sm text-green-700">Identité enregistrée.</p>
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
