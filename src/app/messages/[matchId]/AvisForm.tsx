"use client";

import { useActionState } from "react";
import { laisserAvis } from "../actions";

export function AvisForm({ matchId, estParent }: { matchId: string; estParent: boolean }) {
  const [state, formAction, pending] = useActionState(laisserAvis, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-xl border border-gray-200 p-4">
      <input type="hidden" name="match_id" value={matchId} />
      <p className="text-sm font-medium text-liams-navy">
        {estParent
          ? "Laisser un avis sur ce professionnel"
          : "Noter ce parent (privé, non affiché publiquement)"}
      </p>
      <select name="note" required defaultValue="" className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm">
        <option value="" disabled>
          Note
        </option>
        {[5, 4, 3, 2, 1].map((n) => (
          <option key={n} value={n}>
            {n} / 5
          </option>
        ))}
      </select>
      <textarea
        name="commentaire"
        placeholder="Commentaire (optionnel)"
        rows={2}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state?.success && <p className="text-xs text-liams-teal">Avis enregistré.</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-liams-orange px-4 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Envoi..." : "Envoyer l'avis"}
      </button>
    </form>
  );
}
