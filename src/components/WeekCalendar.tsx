"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { JOURS_SEMAINE } from "@/lib/disponibilites";
import { addDays, formatDateLabel, getWeekDates, todayISO } from "@/lib/calendar";
import { libelleTranche, type TrancheOption } from "@/lib/tranches";

export type SlotFormState = { error?: string; success?: boolean } | undefined;

export type CalendarSlot = {
  id: string;
  date: string;
  heure_debut: string;
  heure_fin: string;
  statut: "libre" | "libre_urgence" | "occupe";
};

const STATUT_STYLES: Record<string, string> = {
  libre: "bg-liams-teal/15 border-liams-teal text-liams-teal",
  libre_urgence: "bg-liams-orange/15 border-liams-orange text-liams-orange",
  occupe: "bg-gray-100 border-gray-300 text-gray-500",
};

const STATUT_LABELS: Record<string, string> = {
  libre: "Régulier",
  libre_urgence: "Urgence",
  occupe: "Occupé",
};

export function WeekCalendar({
  weekStart,
  basePath,
  slots,
  editable = false,
  addSlotAction,
  slotFooters,
  mesReservationIds,
  statutLabels,
  typesCreneau = [
    { value: "libre", label: "Régulier" },
    { value: "libre_urgence", label: "Urgence" },
  ],
  tranches = [],
}: {
  weekStart: string;
  basePath: string;
  slots: CalendarSlot[];
  editable?: boolean;
  addSlotAction?: (prevState: SlotFormState, formData: FormData) => Promise<SlotFormState>;
  /** Pied de créneau pré-rendu côté serveur, indexé par id de créneau. Des
   * ReactNode plutôt qu'une fonction de rendu : les composants serveur ne
   * peuvent pas passer de fonctions ordinaires à un composant client. */
  slotFooters?: Record<string, ReactNode>;
  /** Ids des créneaux occupés réservés par le parent qui consulte le
   * calendrier — on affiche "Votre réservation" au lieu du générique "Occupé",
   * sans jamais révéler qui a réservé les créneaux des autres parents. */
  mesReservationIds?: string[];
  /** Remplace les étiquettes par défaut des statuts (ex. le planning du
   * parent affiche "Garde confirmée" plutôt que "Régulier"). */
  statutLabels?: Record<string, string>;
  /** Types proposés dans le formulaire d'ajout. Avec une seule entrée, le
   * sélecteur disparaît (ex. le parent n'ajoute que des "besoins"). */
  typesCreneau?: { value: string; label: string }[];
  /** Sections de l'établissement. Vide pour un indépendant, qui n'en a pas :
   * le sélecteur disparaît alors entièrement. */
  tranches?: TrancheOption[];
}) {
  const [jourOuvert, setJourOuvert] = useState<string | null>(null);
  const noopAction = async () => undefined;
  const [state, formAction, pending] = useActionState(addSlotAction ?? noopAction, undefined);
  const mesReservations = new Set(mesReservationIds ?? []);

  const weekDates = getWeekDates(weekStart);
  const slotsParJour = new Map<string, CalendarSlot[]>();
  for (const slot of slots) {
    const liste = slotsParJour.get(slot.date) ?? [];
    liste.push(slot);
    slotsParJour.set(slot.date, liste);
  }

  const today = todayISO();

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`${basePath}?week=${addDays(weekStart, -7)}`}
          className="text-sm text-liams-navy underline"
        >
          ◀ Semaine précédente
        </Link>
        <span className="text-center text-sm font-medium text-liams-navy">
          {formatDateLabel(weekDates[0])} – {formatDateLabel(weekDates[6])}
        </span>
        <Link
          href={`${basePath}?week=${addDays(weekStart, 7)}`}
          className="text-sm text-liams-navy underline"
        >
          Semaine suivante ▶
        </Link>
      </div>

      {editable && state?.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-7">
        {weekDates.map((dateIso, i) => (
          <div
            key={dateIso}
            className={`flex flex-col gap-2 rounded-lg border p-2 ${
              dateIso === today ? "border-liams-orange" : "border-gray-100"
            }`}
          >
            <p className="text-xs font-semibold text-liams-navy">
              {JOURS_SEMAINE[i]}
              <br />
              <span className="font-normal text-gray-400">{formatDateLabel(dateIso)}</span>
            </p>

            <div className="flex flex-col gap-1">
              {(slotsParJour.get(dateIso) ?? []).map((slot) => (
                <div
                  key={slot.id}
                  className={`rounded-md border px-2 py-1 text-xs ${STATUT_STYLES[slot.statut]}`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span>
                      {slot.heure_debut.slice(0, 5)}–{slot.heure_fin.slice(0, 5)}
                    </span>
                    {slotFooters?.[slot.id]}
                  </div>
                  <span className="text-[10px] opacity-70">
                    {slot.statut === "occupe" && mesReservations.has(slot.id)
                      ? "Votre réservation"
                      : (statutLabels?.[slot.statut] ?? STATUT_LABELS[slot.statut])}
                  </span>
                </div>
              ))}
            </div>

            {editable &&
              (jourOuvert === dateIso ? (
                <form action={formAction} className="flex flex-col gap-1">
                  <input type="hidden" name="date" value={dateIso} />
                  <div className="flex gap-1">
                    <input
                      type="time"
                      name="heure_debut"
                      defaultValue="16:00"
                      className="w-full rounded border border-gray-300 px-1 py-0.5 text-[11px]"
                    />
                    <input
                      type="time"
                      name="heure_fin"
                      defaultValue="18:00"
                      className="w-full rounded border border-gray-300 px-1 py-0.5 text-[11px]"
                    />
                  </div>
                  {typesCreneau.length > 1 ? (
                    <select
                      name="statut"
                      className="rounded border border-gray-300 px-1 py-0.5 text-[11px]"
                    >
                      {typesCreneau.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input type="hidden" name="statut" value={typesCreneau[0]?.value ?? ""} />
                  )}
                  {/* Une crèche ouvre un créneau POUR une section : six places
                      bébés et six places grands ne se remplacent pas. */}
                  {tranches.length > 0 && (
                    <select
                      name="tranche_id"
                      required
                      defaultValue={tranches.length === 1 ? tranches[0].id : ""}
                      className="rounded border border-gray-300 px-1 py-0.5 text-[11px]"
                    >
                      {tranches.length > 1 && <option value="">Quelle section ?</option>}
                      {tranches.map((tranche) => (
                        <option key={tranche.id} value={tranche.id}>
                          {libelleTranche(tranche)}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="flex gap-1">
                    <button
                      type="submit"
                      disabled={pending}
                      className="flex-1 rounded-full bg-liams-orange px-2 py-1 text-[10px] font-medium text-white disabled:opacity-50"
                    >
                      Ajouter
                    </button>
                    <button
                      type="button"
                      onClick={() => setJourOuvert(null)}
                      className="rounded-full border border-gray-300 px-2 py-1 text-[10px] text-gray-600"
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setJourOuvert(dateIso)}
                  className="rounded-full border border-dashed border-gray-300 px-2 py-1 text-[10px] text-gray-500 hover:border-liams-orange hover:text-liams-orange"
                >
                  + Ajouter
                </button>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
