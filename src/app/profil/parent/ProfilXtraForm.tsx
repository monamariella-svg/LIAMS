"use client";

import { useActionState } from "react";
import { updateProfilXtra } from "./actions";

export function ProfilXtraForm({
  enfantId,
  profil,
}: {
  enfantId: string;
  profil: {
    routines_apaisantes: string | null;
    declencheurs_a_eviter: string | null;
    moyens_communication_preferes: string | null;
  } | null;
}) {
  const [state, formAction, pending] = useActionState(updateProfilXtra, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="enfant_id" value={enfantId} />
      <p className="text-sm font-medium text-liams-navy">
        Profil enrichi &laquo;&nbsp;Xtra&nbsp;&raquo;{" "}
        <span className="font-normal text-gray-500">
          — facultatif, pour les enfants à besoins particuliers
        </span>
      </p>
      <textarea
        name="routines_apaisantes"
        defaultValue={profil?.routines_apaisantes ?? ""}
        placeholder="Routines apaisantes (ce qui rassure l'enfant, rituels à respecter)"
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
        rows={2}
      />
      <textarea
        name="declencheurs_a_eviter"
        defaultValue={profil?.declencheurs_a_eviter ?? ""}
        placeholder="Déclencheurs à éviter (situations, bruits, changements...)"
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
        rows={2}
      />
      <textarea
        name="moyens_communication_preferes"
        defaultValue={profil?.moyens_communication_preferes ?? ""}
        placeholder="Moyens de communication préférés (pictogrammes, LSF, mots clés...)"
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
        rows={2}
      />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-liams-teal">Profil Xtra enregistré.</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full border border-liams-teal px-5 py-2 text-sm font-medium text-liams-teal hover:bg-liams-teal hover:text-white disabled:opacity-50"
      >
        {pending ? "Enregistrement..." : "Enregistrer le profil Xtra"}
      </button>
    </form>
  );
}
