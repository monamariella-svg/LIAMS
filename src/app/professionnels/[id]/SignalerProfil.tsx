"use client";

import { useActionState, useState } from "react";
import { signalerProfil } from "./actions";

const MOTIFS = [
  {
    value: "securite_enfant",
    label: "Quelque chose m'inquiète pour la sécurité d'un enfant",
  },
  { value: "contenu_inapproprie", label: "Photo ou texte déplacé" },
  { value: "informations_fausses", label: "Informations qui me semblent fausses" },
  { value: "usurpation_identite", label: "Ce profil se fait passer pour quelqu'un d'autre" },
  { value: "autre", label: "Autre" },
];

/** Signalement d'un profil.
 *
 * Discret et replié : la très grande majorité des fiches n'a rien à se
 * reprocher, et mettre un bouton d'alerte en évidence sous chacune installerait
 * une suspicion que rien ne justifie. Mais il doit se trouver sans chercher le
 * jour où l'on en a besoin. */
export function SignalerProfil({ cibleId }: { cibleId: string }) {
  const [ouvert, setOuvert] = useState(false);
  const [state, formAction, pending] = useActionState(signalerProfil, undefined);

  if (state?.success) {
    return <p className="text-xs text-liams-teal">{state.message}</p>;
  }

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="self-start text-xs text-gray-400 underline hover:text-gray-600"
      >
        Signaler ce profil
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4">
      <input type="hidden" name="cible_id" value={cibleId} />

      <p className="text-sm font-medium text-liams-navy">Signaler ce profil</p>
      <p className="text-xs text-gray-500">
        Votre signalement est transmis à l&apos;équipe Liams, jamais au
        professionnel. La fiche reste visible le temps que nous l&apos;examinions.
      </p>

      <div className="flex flex-col gap-1.5">
        {MOTIFS.map((motif) => (
          <label key={motif.value} className="flex items-start gap-2 text-sm">
            <input type="radio" name="motif" value={motif.value} required className="mt-1" />
            {motif.label}
          </label>
        ))}
      </div>

      <textarea
        name="commentaire"
        rows={3}
        placeholder="Ce que vous avez constaté (facultatif, mais très utile)"
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-liams-navy px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Envoi..." : "Envoyer le signalement"}
        </button>
        <button
          type="button"
          onClick={() => setOuvert(false)}
          className="text-xs text-gray-500 underline"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
