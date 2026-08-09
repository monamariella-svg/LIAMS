"use client";

import { useActionState } from "react";
import { attacherMembre, detacherMembre } from "./actions";

export type Membre = {
  user_id: string;
  fonction: string | null;
  nom: string;
};

/** Le retrait ne demande pas de confirmation en fenêtre : il est réversible en
 *  dix secondes, et ce qui a été fait pendant le passage du compte — lectures
 *  de fiches, entrées de journal — n'est pas effacé pour autant. */
function RetirerMembreButton({ userId }: { userId: string }) {
  const [state, formAction, pending] = useActionState(detacherMembre, undefined);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="user_id" value={userId} />
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

export function MembresManager({ membres }: { membres: Membre[] }) {
  const [state, formAction, pending] = useActionState(attacherMembre, undefined);
  const restants = 5 - membres.length;

  return (
    <section className="rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-liams-navy">Les comptes de votre équipe</h2>
      <p className="mt-1 text-sm text-gray-500">
        Chaque personne de l&apos;équipe se connecte avec son propre compte plutôt
        qu&apos;avec un identifiant partagé. C&apos;est ce qui permet à une
        confirmation de lecture de fiche sanitaire de désigner quelqu&apos;un :
        « la crèche a lu » ne vaudrait rien le jour où un incident serait examiné.
      </p>
      <p className="mt-3 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
        Un compte secondaire tient le calendrier, répond aux demandes, échange
        avec les familles et consulte la fiche de l&apos;enfant qu&apos;il
        accueille. Il ne touche ni au tarif, ni à l&apos;agrément, ni aux
        documents de la structure — cela reste à votre compte.
      </p>

      {membres.length > 0 ? (
        <ul className="mt-4 flex flex-col divide-y divide-gray-100">
          {membres.map((membre) => (
            <li key={membre.user_id} className="flex items-center justify-between py-3">
              <span className="flex flex-col">
                <span className="text-sm font-medium text-liams-navy">{membre.nom}</span>
                {membre.fonction && (
                  <span className="text-xs text-gray-500">{membre.fonction}</span>
                )}
              </span>
              <RetirerMembreButton userId={membre.user_id} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-gray-500">
          Aucun compte secondaire pour l&apos;instant.
        </p>
      )}

      {restants > 0 ? (
        <form action={formAction} className="mt-6 flex flex-col gap-3 border-t border-gray-200 pt-6">
          <p className="text-sm font-medium text-liams-navy">
            Rattacher un compte
            <span className="ml-2 font-normal text-gray-500">
              {restants} place{restants > 1 ? "s" : ""} restante{restants > 1 ? "s" : ""}
            </span>
          </p>
          <p className="text-xs text-gray-500">
            La personne s&apos;inscrit d&apos;abord elle-même sur Liams, du côté
            professionnel, avec son mot de passe. Vous la rattachez ensuite avec
            l&apos;adresse email de son compte. Vous ne créez pas ses
            identifiants : personne ne doit pouvoir agir sous le nom d&apos;un
            autre.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex w-full flex-col gap-1 text-sm">
              Adresse email du compte
              <input
                type="email"
                name="email"
                required
                className="rounded-lg border border-gray-300 px-4 py-2"
              />
            </label>
            <label className="flex w-full flex-col gap-1 text-sm">
              Fonction (facultatif)
              <input
                name="fonction"
                placeholder="Directrice, auxiliaire de puériculture..."
                className="rounded-lg border border-gray-300 px-4 py-2"
              />
            </label>
          </div>

          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
          {state?.success && <p className="text-sm text-green-700">{state.message}</p>}

          <button
            type="submit"
            disabled={pending}
            className="self-start rounded-full bg-liams-teal px-6 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Rattachement..." : "Rattacher"}
          </button>
        </form>
      ) : (
        <p className="mt-6 border-t border-gray-200 pt-6 text-sm text-gray-600">
          Votre établissement compte cinq comptes, le maximum. Assez pour une
          équipe, assez peu pour qu&apos;un accès reste attribuable à une
          personne. Retirez-en un pour en rattacher un autre.
        </p>
      )}
    </section>
  );
}
