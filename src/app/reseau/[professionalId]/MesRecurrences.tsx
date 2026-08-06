"use client";

import { useState } from "react";
import { JOURS_SEMAINE } from "@/lib/disponibilites";
import type { EnfantSelectionnable } from "@/components/SelectionEnfants";
import { AnnulerReservationButton } from "@/app/planning/AnnulerReservationButton";
import { RecurrenceForm, type ReservationRecurrente } from "./RecurrenceForm";

type ReservationAvecStatut = ReservationRecurrente & { statut: string };

const STATUT_BADGES: Record<string, { label: string; className: string }> = {
  en_attente: { label: "En attente de validation", className: "bg-liams-orange/10 text-liams-orange" },
  actif: { label: "Validée", className: "bg-liams-teal/10 text-liams-teal" },
};

export function MesRecurrences({
  professionalId,
  reservations,
  enfants,
}: {
  professionalId: string;
  reservations: ReservationAvecStatut[];
  enfants: EnfantSelectionnable[];
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
                  {/* Retirer un enfant d'une récurrence qui en porte deux
                      libère une place et laisse la garde du second : une
                      famille n'a pas à tout défaire pour un seul changement. */}
                  <AnnulerReservationButton
                    type="recurrente"
                    reservationId={rec.id}
                    enfants={(rec.enfant_ids ?? [])
                      .map((id) => ({
                        id,
                        prenom: enfants.find((e) => e.id === id)?.prenom ?? "",
                      }))
                      .filter((e) => e.prenom)}
                  />
                </div>
              </div>
              {idEnEdition === rec.id && (
                <RecurrenceForm
                  professionalId={professionalId}
                  recurrence={rec}
                  enfants={enfants}
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
