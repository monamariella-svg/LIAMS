"use client";

import { useActionState, useState } from "react";
import { formatDateLabel } from "@/lib/calendar";
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
}: {
  creneaux: CreneauModifiable[];
  lieuAccueilProfil?: string;
}) {
  const [ouvert, setOuvert] = useState<string | null>(null);

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
}: {
  creneau: CreneauModifiable;
  lieuAccueilProfil?: string;
}) {
  const [state, formAction, pending] = useActionState(modifierCreneau, undefined);
  const placesPrises = creneau.capacite - creneau.placesRestantes;

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-3 border-t border-gray-100 pt-3">
      <input type="hidden" name="slot_id" value={creneau.id} />

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
          max="20"
          defaultValue={creneau.capacite}
          className="w-24 rounded-lg border border-gray-300 px-3 py-2"
        />
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
