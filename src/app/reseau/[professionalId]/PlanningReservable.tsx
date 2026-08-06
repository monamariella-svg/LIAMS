"use client";

import { useActionState, useState } from "react";
import { JOURS_SEMAINE } from "@/lib/disponibilites";
import { formatDateLabel, isoWeekday } from "@/lib/calendar";
import { WeekCalendar, type CalendarSlot } from "@/components/WeekCalendar";
import {
  SelectionEnfants,
  type EnfantSelectionnable,
} from "@/components/SelectionEnfants";
import { demanderCreneaux } from "./actions";

export type CreneauReservable = CalendarSlot & {
  /** Recoupe un besoin déclaré du parent : pré-coché. */
  correspondBesoin: boolean;
  /** Demandable maintenant. Un créneau d'urgence ne l'est que dans sa fenêtre
   * (voir lib/urgence.ts), et rien ne l'est à moins de 2 h du début. */
  demandable: boolean;
  /** Pourquoi il ne l'est pas, affiché à côté du créneau. */
  raison?: string;
  /** Places encore libres. Un créneau à zéro n'arrive pas jusqu'ici. */
  placesRestantes: number;
  /** Places déclarées par le professionnel, pour situer ce qui reste. */
  capacite: number;
};

const TYPE_LABELS: Record<string, string> = {
  libre: "Régulier",
  libre_urgence: "Urgence",
};

/** Le planning du professionnel vu par un parent de son réseau. Le calendrier
 * donne le contexte de la semaine, la liste en dessous couvre toutes les
 * semaines à venir : les deux partagent la même sélection, et le parent
 * envoie une seule demande groupée. */
export function PlanningReservable({
  professionalId,
  weekStart,
  slots,
  mesReservationIds,
  reservables,
  enfants,
  typeAccueil,
}: {
  professionalId: string;
  weekStart: string;
  slots: CalendarSlot[];
  mesReservationIds: string[];
  reservables: CreneauReservable[];
  enfants: EnfantSelectionnable[];
  /** Ce que le parent cherche. Suit la demande jusqu'au contrôle en base. */
  typeAccueil?: string;
}) {
  const [state, formAction, pending] = useActionState(demanderCreneaux, undefined);
  const demandables = reservables.filter((c) => c.demandable);
  const [coches, setCoches] = useState<string[]>(() =>
    demandables.filter((c) => c.correspondBesoin).map((c) => c.id),
  );

  const tousCoches = coches.length === demandables.length && demandables.length > 0;

  const basculer = (id: string) =>
    setCoches((actuels) =>
      actuels.includes(id) ? actuels.filter((x) => x !== id) : [...actuels, id],
    );

  // Case à cocher rendue dans la case du calendrier, à la place de l'ancien
  // bouton "Réserver". Elle ne porte pas de `name` : le calendrier n'affiche
  // qu'une semaine, or la sélection en couvre plusieurs — ce sont les champs
  // cachés qui portent la sélection complète à l'envoi.
  const slotFooters = Object.fromEntries(
    demandables.map((creneau) => [
      creneau.id,
      <input
        key={creneau.id}
        type="checkbox"
        checked={coches.includes(creneau.id)}
        onChange={() => basculer(creneau.id)}
        aria-label="Demander ce créneau"
        className="h-4 w-4 cursor-pointer accent-liams-orange"
      />,
    ]),
  );

  if (state?.success) {
    return (
      <div className="rounded-xl border-2 border-liams-teal/30 bg-liams-teal/5 p-6 text-sm text-liams-navy">
        Demande envoyée — le professionnel va choisir les créneaux qu&apos;il peut
        accepter. Vous recevrez un email dès sa réponse, et les créneaux retenus
        apparaîtront dans votre planning.
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="professional_id" value={professionalId} />
      {typeAccueil && <input type="hidden" name="type_accueil" value={typeAccueil} />}
      {coches.map((id) => (
        <input key={id} type="hidden" name="slot_ids" value={id} />
      ))}

      <WeekCalendar
        weekStart={weekStart}
        basePath={`/reseau/${professionalId}`}
        slots={slots}
        mesReservationIds={mesReservationIds}
        slotFooters={slotFooters}
      />

      <section className="rounded-xl border border-gray-200 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-liams-navy">Créneaux à demander</h2>
          {demandables.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-liams-navy">
              <input
                type="checkbox"
                checked={tousCoches}
                onChange={() => setCoches(tousCoches ? [] : demandables.map((c) => c.id))}
                className="h-4 w-4 accent-liams-orange"
              />
              Cocher tous les créneaux disponibles ({demandables.length})
            </label>
          )}
        </div>

        {reservables.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">
            Ce professionnel n&apos;a aucun créneau libre à venir.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-1">
            {reservables.map((creneau) => (
              <label
                key={creneau.id}
                className={`flex flex-wrap items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${
                  creneau.demandable ? "hover:bg-gray-50" : "opacity-60"
                }`}
              >
                <input
                  type="checkbox"
                  checked={coches.includes(creneau.id)}
                  onChange={() => basculer(creneau.id)}
                  disabled={!creneau.demandable}
                  className="h-4 w-4 accent-liams-orange"
                />
                <span className="text-liams-navy">
                  {JOURS_SEMAINE[isoWeekday(creneau.date)]} {formatDateLabel(creneau.date)}
                </span>
                <span className="text-gray-600">
                  {creneau.heure_debut.slice(0, 5)}–{creneau.heure_fin.slice(0, 5)}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    creneau.statut === "libre_urgence"
                      ? "bg-liams-orange/10 text-liams-orange"
                      : "bg-liams-teal/10 text-liams-teal"
                  }`}
                >
                  {TYPE_LABELS[creneau.statut] ?? creneau.statut}
                </span>
                {creneau.correspondBesoin && (
                  <span className="text-xs text-gray-500">correspond à votre besoin</span>
                )}
                {/* Le nombre restant ne se signale que s'il contraint : sur un
                    créneau qui reste entier, c'est du bruit. */}
                {creneau.placesRestantes < creneau.capacite && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                    {creneau.placesRestantes === 1
                      ? "1 place restante"
                      : `${creneau.placesRestantes} places restantes`}
                  </span>
                )}
                {creneau.raison && <span className="text-xs text-gray-500">{creneau.raison}</span>}
              </label>
            ))}
          </div>
        )}

        {demandables.length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <SelectionEnfants enfants={enfants} />
          </div>
        )}

        {(state?.error || demandables.length > 0) && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={pending || coches.length === 0}
              className="rounded-full bg-liams-orange px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {pending
                ? "Envoi..."
                : `Demander ${coches.length} créneau${coches.length > 1 ? "x" : ""}`}
            </button>
            {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
          </div>
        )}
      </section>
    </form>
  );
}
