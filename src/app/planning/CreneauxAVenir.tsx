"use client";

import { useActionState, useState } from "react";
import { formatDateLabel } from "@/lib/calendar";
import { libelleTranche, type TrancheOption } from "@/lib/tranches";
import { modifierCreneau } from "./actions";

export type CreneauModifiable = {
  id: string;
  date: string;
  heure_debut: string;
  heure_fin: string;
  capacite: number;
  types_accueil: string[];
  lieu_accueil: string | null;
  placesRestantes: number;
  tranche_id: string | null;
};

const TYPES_ACCUEIL = [
  { value: "longue_duree", label: "Longue durée" },
  { value: "ponctuel", label: "Ponctuel" },
  { value: "urgence", label: "Urgence" },
];

const TYPE_COURT: Record<string, string> = {
  longue_duree: "longue durée",
  ponctuel: "ponctuel",
  urgence: "urgence",
};

/** Réglages d'un créneau isolé, après sa création.
 *
 * Le calendrier montre où sont les créneaux ; cette liste sert à les régler.
 * Une cellule de calendrier est trop étroite pour trois réglages, et un
 * professionnel qui vient ajuster une capacité cherche une liste, pas une
 * grille. */
export function CreneauxAVenir({
  creneaux,
  lieuAccueilProfil,
  tranches = [],
}: {
  creneaux: CreneauModifiable[];
  lieuAccueilProfil?: string;
  tranches?: TrancheOption[];
}) {
  const [ouvert, setOuvert] = useState<string | null>(null);
  const trancheParId = new Map(tranches.map((t) => [t.id, t]));

  if (creneaux.length === 0) return null;

  return (
    <section className="rounded-xl border border-gray-200 p-6">
      <h2 className="text-sm font-semibold text-liams-navy">Mes créneaux à venir</h2>
      <p className="mt-1 text-xs text-gray-500">
        Ajustez le nombre d&apos;enfants, les accueils concernés ou le lieu, sans
        avoir à supprimer le créneau.
      </p>

      <div className="mt-3 flex flex-col gap-2">
        {creneaux.map((creneau) => (
          <div key={creneau.id} className="rounded-lg border border-gray-100 px-4 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                {formatDateLabel(creneau.date)} · {creneau.heure_debut.slice(0, 5)}–
                {creneau.heure_fin.slice(0, 5)}
                <span className="ml-2 text-xs text-gray-500">
                  {creneau.placesRestantes}/{creneau.capacite} libre
                  {creneau.capacite > 1 ? "s" : ""} ·{" "}
                  {creneau.types_accueil.map((t) => TYPE_COURT[t] ?? t).join(", ")}
                  {/* Sans le nom de la section, deux créneaux du même jour à la
                      même heure sont indiscernables dans la liste. */}
                  {creneau.tranche_id && trancheParId.has(creneau.tranche_id) && (
                    <span className="ml-1 text-liams-teal">
                      · {trancheParId.get(creneau.tranche_id)!.libelle ?? "section"}
                    </span>
                  )}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setOuvert(ouvert === creneau.id ? null : creneau.id)}
                className="rounded-full border border-liams-navy px-3 py-1 text-xs text-liams-navy transition-colors hover:bg-liams-navy hover:text-white"
              >
                {ouvert === creneau.id ? "Fermer" : "Modifier"}
              </button>
            </div>

            {ouvert === creneau.id && (
              <FormulaireCreneau
                creneau={creneau}
                lieuAccueilProfil={lieuAccueilProfil}
                tranches={tranches}
              />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function FormulaireCreneau({
  creneau,
  lieuAccueilProfil,
  tranches,
}: {
  creneau: CreneauModifiable;
  lieuAccueilProfil?: string;
  tranches: TrancheOption[];
}) {
  const [state, formAction, pending] = useActionState(modifierCreneau, undefined);
  const [trancheChoisie, setTrancheChoisie] = useState(creneau.tranche_id ?? "");
  const placesPrises = creneau.capacite - creneau.placesRestantes;

  // Le maximum d'un créneau, c'est ce que sa section ouvre — pas les vingt
  // enfants du plafond général, qui vise une assistante maternelle. Laisser
  // saisir au-delà pour se faire refuser en base serait une perte de temps.
  const tranche = tranches.find((t) => t.id === trancheChoisie);
  const capaciteMax = tranche ? tranche.places_ouvertes : 20;

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-3 border-t border-gray-100 pt-3">
      <input type="hidden" name="slot_id" value={creneau.id} />

      {/* L'horaire se corrige ici plutôt qu'en supprimant le créneau : une
          crèche qui ferme à 17h au lieu de 18h n'a pas à annuler ses gardes
          pour le dire. Élargir est toujours possible ; raccourcir un créneau
          réservé est refusé par le serveur, qui explique pourquoi. */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          De
          <input
            type="time"
            name="heure_debut"
            defaultValue={creneau.heure_debut.slice(0, 5)}
            className="rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          À
          <input
            type="time"
            name="heure_fin"
            defaultValue={creneau.heure_fin.slice(0, 5)}
            className="rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>
        {placesPrises > 0 && (
          <span className="pb-2 text-xs text-gray-500">
            {placesPrises} garde{placesPrises > 1 ? "s" : ""} réservée
            {placesPrises > 1 ? "s" : ""} : vous pouvez élargir, pas raccourcir.
          </span>
        )}
      </div>

      {tranches.length > 0 && (
        <label className="flex flex-col gap-1 text-sm">
          Section accueillie
          <select
            name="tranche_id"
            required
            value={trancheChoisie}
            onChange={(e) => setTrancheChoisie(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="">Quelle section ?</option>
            {tranches.map((t) => (
              <option key={t.id} value={t.id}>
                {libelleTranche(t)}
              </option>
            ))}
          </select>
          <span className="text-xs text-gray-500">
            Les âges accueillis sur ce créneau sont ceux de la section : ils ne se
            saisissent pas deux fois.
          </span>
        </label>
      )}

      <fieldset className="flex flex-wrap gap-3">
        <legend className="text-xs font-medium text-liams-navy">
          Pour quels accueils
        </legend>
        {TYPES_ACCUEIL.map((t) => (
          <label key={t.value} className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              name="types_accueil"
              value={t.value}
              defaultChecked={creneau.types_accueil.includes(t.value)}
            />
            {t.label}
          </label>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1 text-sm">
        Nombre d&apos;enfants en même temps
        <input
          type="number"
          name="capacite"
          min={Math.max(1, placesPrises)}
          max={capaciteMax}
          defaultValue={creneau.capacite}
          className="w-24 rounded-lg border border-gray-300 px-3 py-2"
        />
        {tranche && (
          <span className="text-xs text-gray-500">
            {tranche.places_ouvertes} place{tranche.places_ouvertes > 1 ? "s" : ""}{" "}
            ouverte{tranche.places_ouvertes > 1 ? "s" : ""} dans cette section :
            vous ne pouvez pas en proposer davantage sur un créneau.
          </span>
        )}
        {placesPrises > 0 && (
          <span className="text-xs text-gray-500">
            {placesPrises} place{placesPrises > 1 ? "s" : ""} déjà réservée
            {placesPrises > 1 ? "s" : ""} — la capacité ne peut pas descendre en
            dessous.
          </span>
        )}
      </label>

      {lieuAccueilProfil === "les_deux" && (
        <label className="flex flex-col gap-1 text-sm">
          Lieu de cet accueil
          <select
            name="lieu_accueil"
            defaultValue={creneau.lieu_accueil ?? "chez_le_pro"}
            className="rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="chez_le_pro">Chez moi</option>
            <option value="domicile_parent">Au domicile de la famille</option>
          </select>
        </label>
      )}

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-liams-teal">Créneau mis à jour.</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-liams-teal px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Enregistrement..." : "Enregistrer"}
      </button>
    </form>
  );
}
