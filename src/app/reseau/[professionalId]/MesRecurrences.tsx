"use client";

import { useState } from "react";
import { JOURS_SEMAINE } from "@/lib/disponibilites";
import { RecurrenceForm, type ReservationRecurrente } from "./RecurrenceForm";
import { annulerReservationRecurrente } from "./actions";

type ReservationAvecStatut = ReservationRecurrente & { statut: string };

const STATUT_BADGES: Record<string, { label: string; className: string }> = {
  en_attente: { label: "En attente de validation", className: "bg-liams-orange/10 text-liams-orange" },
  actif: { label: "Validée", className: "bg-liams-teal/10 text-liams-teal" },
};

export function MesRecurrences({
  professionalId,
  reservations,
}: {
  professionalId: string;
  reservations: ReservationAvecStatut[];
}) {
  const [idEnEdition, setIdEnEdition] = useState<string | null>(null);

  if (reservations.length === 0) return null;

  return (
    <section className="rounded-xl border border-gray-200 p-6">
      <h2 className="text-sm font-semibold text-liams-navy">Mes réservations récurrentes</h2>
      <p className="mt-1 text-xs text-gray-500">
        Modifier une réservation la renvoie en validation chez le professionnel.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {reservations.map((rec) => {
          const badge = STATUT_BADGES[rec.statut];
          return (
            <div key={rec.id} className="rounded-lg border border-gray-100 px-4 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  Tous les <strong>{JOURS_SEMAINE[rec.jour_semaine]}</strong>{" "}
                  {rec.heure_debut.slice(0, 5)}–{rec.heure_fin.slice(0, 5)}
                  {badge && (
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${badge.className}`}>
                      {badge.label}
                    </span>
                  )}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIdEnEdition(idEnEdition === rec.id ? null : rec.id)}
                    className="rounded-full border border-liams-navy px-3 py-1 text-xs text-liams-navy hover:bg-liams-navy hover:text-white transition-colors"
                  >
                    {idEnEdition === rec.id ? "Fermer" : "Modifier"}
                  </button>
                  <form action={annulerReservationRecurrente}>
                    <input type="hidden" name="recurrence_id" value={rec.id} />
                    <input type="hidden" name="professional_id" value={professionalId} />
                    <button
                      type="submit"
                      className="rounded-full border border-red-300 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                    >
                      Annuler
                    </button>
                  </form>
                </div>
              </div>
              {idEnEdition === rec.id && (
                <RecurrenceForm professionalId={professionalId} recurrence={rec} />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
