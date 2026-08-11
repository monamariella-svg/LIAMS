"use client";

import { useActionState } from "react";
import { ajouterTranche, retirerTranche } from "./actions";

export type Tranche = {
  id: string;
  libelle: string | null;
  age_min_mois: number;
  age_max_mois: number;
  /** Ce que l'agrément autorise pour cette section. */
  places_agreees: number;
  /** Ce que l'établissement en exploite réellement. */
  places_ouvertes: number;
};

/** « 18 mois » se lit sans effort, « 54 mois » non. Au-delà de deux ans on
 *  ajoute l'équivalent en années, sans remplacer les mois : c'est en mois que
 *  l'agrément et les créneaux sont écrits. */
function enClair(mois: number) {
  if (mois < 24) return `${mois} mois`;
  const annees = mois / 12;
  const arrondi = Number.isInteger(annees) ? annees : annees.toFixed(1).replace(".", ",");
  return `${mois} mois (${arrondi} ans)`;
}

function RetirerTrancheButton({ trancheId }: { trancheId: string }) {
  const [state, formAction, pending] = useActionState(retirerTranche, undefined);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="tranche_id" value={trancheId} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-red-600 underline hover:opacity-80 disabled:opacity-50"
      >
        {pending ? "Retrait..." : "Retirer"}
      </button>
      {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}

export function TranchesManager({ tranches }: { tranches: Tranche[] }) {
  const [state, formAction, pending] = useActionState(ajouterTranche, undefined);
  const totalAgreees = tranches.reduce((somme, t) => somme + t.places_agreees, 0);
  const totalOuvertes = tranches.reduce((somme, t) => somme + t.places_ouvertes, 0);

  return (
    <section className="rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-liams-navy">Vos sections</h2>
      <p className="mt-1 text-sm text-gray-500">
        Un agrément ne dit jamais un nombre global : il dit combien d&apos;enfants
        par tranche d&apos;âge. Déclarez vos sections telles qu&apos;elles sont
        écrites sur votre agrément — un multi-accueil ne les découpe pas comme une
        micro-crèche.
      </p>
      <p className="mt-2 text-sm text-gray-500">
        Deux nombres par section, et ce ne sont pas les mêmes : ce que
        l&apos;agrément vous <strong className="font-medium">autorise</strong>, et
        ce que vous <strong className="font-medium">ouvrez</strong> réellement. Une
        section fermée faute d&apos;encadrement reste agréée. C&apos;est ensuite
        parmi les places ouvertes que vous répartissez vos créneaux, au planning.
      </p>

      {tranches.length > 0 ? (
        <>
          <ul className="mt-4 flex flex-col divide-y divide-gray-100">
            {tranches.map((tranche) => (
              <li key={tranche.id} className="flex items-center justify-between py-3">
                <span className="flex flex-col">
                  <span className="text-sm font-medium text-liams-navy">
                    {tranche.libelle || "Sans nom"} —{" "}
                    {tranche.places_ouvertes} place
                    {tranche.places_ouvertes > 1 ? "s" : ""} ouverte
                    {tranche.places_ouvertes > 1 ? "s" : ""}
                    {tranche.places_ouvertes < tranche.places_agreees && (
                      <span className="ml-1 font-normal text-gray-500">
                        sur {tranche.places_agreees} agréée
                        {tranche.places_agreees > 1 ? "s" : ""}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-gray-500">
                    De {enClair(tranche.age_min_mois)} à {enClair(tranche.age_max_mois)}
                  </span>
                </span>
                <RetirerTrancheButton trancheId={tranche.id} />
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-gray-600">
            <strong className="font-medium">{totalOuvertes}</strong> place
            {totalOuvertes > 1 ? "s" : ""} ouverte{totalOuvertes > 1 ? "s" : ""}, sur{" "}
            <strong className="font-medium">{totalAgreees}</strong> agréée
            {totalAgreees > 1 ? "s" : ""}.
            {totalOuvertes < totalAgreees && (
              <span className="text-gray-500">
                {" "}
                L&apos;écart n&apos;est pas une perte : ces places restent à vous
                le jour où vous pourrez les rouvrir.
              </span>
            )}
          </p>
        </>
      ) : (
        <p className="mt-4 text-sm text-gray-500">Aucune tranche déclarée.</p>
      )}

      <form action={formAction} className="mt-6 flex flex-col gap-3 border-t border-gray-200 pt-6">
        <p className="text-sm font-medium text-liams-navy">Ajouter une section</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex w-full flex-col gap-1 text-sm">
            Nom (facultatif)
            <input
              name="libelle"
              placeholder="Les bébés, la section des moyens..."
              className="rounded-lg border border-gray-300 px-4 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:w-32">
            De (mois)
            <input
              type="number"
              name="age_min_mois"
              min={0}
              required
              className="rounded-lg border border-gray-300 px-4 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:w-32">
            À (mois)
            <input
              type="number"
              name="age_max_mois"
              min={1}
              required
              className="rounded-lg border border-gray-300 px-4 py-2"
            />
          </label>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex flex-col gap-1 text-sm sm:w-56">
            Places agréées
            <input
              type="number"
              name="places_agreees"
              min={1}
              required
              className="rounded-lg border border-gray-300 px-4 py-2"
            />
            <span className="text-xs text-gray-500">
              Le chiffre de votre arrêté, recopié tel quel.
            </span>
          </label>
          <label className="flex flex-col gap-1 text-sm sm:w-56">
            Places ouvertes
            <input
              type="number"
              name="places_ouvertes"
              min={1}
              placeholder="Toutes"
              className="rounded-lg border border-gray-300 px-4 py-2"
            />
            <span className="text-xs text-gray-500">
              À laisser vide si vous les exploitez toutes.
            </span>
          </label>
        </div>
        <p className="text-xs text-gray-500">
          Les âges en mois, parce que c&apos;est la seule unité qui sépare un bébé
          de six mois d&apos;un enfant de dix-huit. Pour mémoire : 1 an = 12 mois,
          3 ans = 36 mois, 6 ans = 72 mois.
        </p>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state?.success && <p className="text-sm text-green-700">{state.message}</p>}

        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-full bg-liams-teal px-6 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Ajout..." : "Ajouter"}
        </button>
      </form>
    </section>
  );
}
