"use client";

import { supprimerEnfant } from "./actions";

export function SupprimerEnfantButton({ enfantId }: { enfantId: string }) {
  return (
    <form
      action={supprimerEnfant}
      onSubmit={(e) => {
        if (!confirm("Supprimer cet enfant et toutes ses données associées ?")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="enfant_id" value={enfantId} />
      <button type="submit" className="text-xs text-red-600 hover:underline">
        Supprimer
      </button>
    </form>
  );
}
