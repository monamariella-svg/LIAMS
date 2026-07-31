"use client";

import { useState } from "react";
import { JOURS_SEMAINE } from "@/lib/disponibilites";
import { formatDateLabel, isoWeekday } from "@/lib/calendar";
import { traiterDemandeCreneaux } from "./actions";

export type DemandeRecue = {
  id: string;
  creneaux: { id: string; date: string; heure_debut: string; heure_fin: string }[];
};

/** Une demande groupée reçue d'un parent : tous les créneaux sont cochés par
 * défaut, le professionnel décoche ceux qui ne lui conviennent pas et valide
 * le reste d'un seul geste. */
function Demande({ demande }: { demande: DemandeRecue }) {
  const [coches, setCoches] = useState<string[]>(() => demande.creneaux.map((c) => c.id));
  const tousCoches = coches.length === demande.creneaux.length;

  return (
    <form action={traiterDemandeCreneaux} className="rounded-lg bg-white px-4 py-3">
      <input type="hidden" name="demande_id" value={demande.id} />

      <p className="text-sm font-medium text-liams-navy">
        Demande de {demande.creneaux.length} créneau
        {demande.creneaux.length > 1 ? "x" : ""}
      </p>

      <label className="mt-2 flex items-center gap-1.5 text-xs font-medium text-liams-navy">
        <input
          type="checkbox"
          checked={tousCoches}
          onChange={() => setCoches(tousCoches ? [] : demande.creneaux.map((c) => c.id))}
        />
        Tout cocher
      </label>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {demande.creneaux.map((creneau) => (
          <label key={creneau.id} className="flex items-center gap-1.5 text-xs text-gray-700">
            <input
              type="checkbox"
              name="slot_ids"
              value={creneau.id}
              checked={coches.includes(creneau.id)}
              onChange={() =>
                setCoches((actuels) =>
                  actuels.includes(creneau.id)
                    ? actuels.filter((id) => id !== creneau.id)
                    : [...actuels, creneau.id],
                )
              }
            />
            {JOURS_SEMAINE[isoWeekday(creneau.date)]} {formatDateLabel(creneau.date)}{" "}
            {creneau.heure_debut.slice(0, 5)}–{creneau.heure_fin.slice(0, 5)}
          </label>
        ))}
      </div>

      <button
        type="submit"
        className="mt-3 rounded-full bg-liams-teal px-4 py-1.5 text-xs font-medium text-white hover:opacity-90"
      >
        {coches.length === 0
          ? "Refuser toute la demande"
          : `Valider ${coches.length} créneau${coches.length > 1 ? "x" : ""}`}
      </button>
    </form>
  );
}

export function DemandesRecues({ demandes }: { demandes: DemandeRecue[] }) {
  if (demandes.length === 0) return null;

  return (
    <section className="rounded-xl border-2 border-liams-teal/30 bg-liams-teal/5 p-6">
      <h2 className="text-base font-semibold text-liams-navy">Demandes de créneaux</h2>
      <p className="mt-1 text-xs text-gray-600">
        Décochez les créneaux qui ne vous conviennent pas, puis validez : seuls les
        créneaux cochés seront réservés.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {demandes.map((demande) => (
          <Demande key={demande.id} demande={demande} />
        ))}
      </div>
    </section>
  );
}
