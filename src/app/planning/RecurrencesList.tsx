"use client";

import { useState } from "react";
import { JOURS_SEMAINE } from "@/lib/disponibilites";
import { formatDateLabel } from "@/lib/calendar";
import { CreneauRecurrentForm, type RecurrenceExistante } from "./CreneauRecurrentForm";
import { supprimerRecurrence } from "./actions";

const TYPE_LABELS: Record<string, string> = {
  libre: "Régulier",
  libre_urgence: "Urgence",
};

export function RecurrencesList({ recurrences }: { recurrences: RecurrenceExistante[] }) {
  const [idEnEdition, setIdEnEdition] = useState<string | null>(null);

  if (recurrences.length === 0) return null;

  return (
    <section className="rounded-xl border border-gray-200 p-6">
      <h2 className="text-sm font-semibold text-liams-navy">Mes créneaux récurrents</h2>
      <p className="mt-1 text-xs text-gray-500">
        Modifier ou supprimer une série met à jour tous ses créneaux à venir ;
        les créneaux déjà réservés ne sont jamais touchés.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {recurrences.map((rec) => (
          <div key={rec.id} className="rounded-lg border border-gray-100 px-4 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                Tous les{" "}
                <strong>{rec.jours.map((j) => JOURS_SEMAINE[j]).join(", ")}</strong>{" "}
                {rec.heure_debut.slice(0, 5)}–{rec.heure_fin.slice(0, 5)}
                <span className="ml-2 text-xs text-gray-500">
                  {TYPE_LABELS[rec.statut] ?? rec.statut} · du {formatDateLabel(rec.date_debut)} au{" "}
                  {formatDateLabel(rec.date_fin)}
                </span>
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIdEnEdition(idEnEdition === rec.id ? null : rec.id)}
                  className="rounded-full border border-liams-navy px-3 py-1 text-xs text-liams-navy hover:bg-liams-navy hover:text-white transition-colors"
                >
                  {idEnEdition === rec.id ? "Fermer" : "Modifier"}
                </button>
                <form action={supprimerRecurrence}>
                  <input type="hidden" name="recurrence_id" value={rec.id} />
                  <button
                    type="submit"
                    className="rounded-full border border-red-300 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    Supprimer
                  </button>
                </form>
              </div>
            </div>
            {idEnEdition === rec.id && <CreneauRecurrentForm recurrence={rec} />}
          </div>
        ))}
      </div>
    </section>
  );
}
