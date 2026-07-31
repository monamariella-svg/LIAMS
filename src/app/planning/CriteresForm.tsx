"use client";

import { useActionState, useState } from "react";
import { enregistrerCriteres } from "./actions";

export type CriteresParent = {
  badges_souhaites: string[];
  rayon_km: number | null;
  mode_zone: "ville" | "trajet" | null;
  ville: string | null;
  trajet_depart: string | null;
  trajet_arrivee: string | null;
};

export type BadgeOption = { code: string; label: string };

// Badges liés à l'accueil des Xtras — mis en avant visuellement.
const XTRA_BADGES = [
  "accueil_xtras_ordinaires",
  "specialiste_tsa",
  "specialiste_tdah",
  "specialiste_dys",
  "specialiste_handicap_moteur",
];

/** Les critères qui ne dépendent pas d'un besoin en particulier : ils sont
 * enregistrés sur le profil parent et s'appliquent à toutes les propositions
 * de professionnels. Le "quand" vient du calendrier des besoins. */
export function CriteresForm({
  criteres,
  badgesCatalogue,
  ouvertParDefaut = false,
}: {
  criteres: CriteresParent | null;
  badgesCatalogue: BadgeOption[];
  ouvertParDefaut?: boolean;
}) {
  const [state, formAction, pending] = useActionState(enregistrerCriteres, undefined);
  const [modeZone, setModeZone] = useState<"ville" | "trajet">(criteres?.mode_zone ?? "ville");

  return (
    <details
      open={ouvertParDefaut}
      className="rounded-xl border border-gray-200 p-6 [&[open]>summary]:mb-4"
    >
      <summary className="cursor-pointer text-base font-semibold text-liams-navy">
        Ce que je recherche
        <span className="ml-2 text-xs font-normal text-gray-500">
          (accompagnement, distance, trajet)
        </span>
      </summary>

      <form action={formAction} className="flex flex-col gap-4">
        <div>
          <p className="text-sm font-medium text-gray-700">
            Accompagnement souhaité
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {badgesCatalogue.map((badge) => (
              <label
                key={badge.code}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
                  XTRA_BADGES.includes(badge.code)
                    ? "border-liams-teal text-liams-teal"
                    : "border-gray-300 text-gray-600"
                }`}
              >
                <input
                  type="checkbox"
                  name="badges"
                  value={badge.code}
                  defaultChecked={criteres?.badges_souhaites?.includes(badge.code)}
                />
                {badge.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700">Où chercher</p>
          <div className="mt-2 flex flex-wrap gap-4">
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="mode_zone"
                value="ville"
                checked={modeZone === "ville"}
                onChange={() => setModeZone("ville")}
              />
              Autour d&apos;une ville
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="mode_zone"
                value="trajet"
                checked={modeZone === "trajet"}
                onChange={() => setModeZone("trajet")}
              />
              Le long d&apos;un trajet
            </label>
          </div>

          {modeZone === "ville" ? (
            <input
              name="ville"
              defaultValue={criteres?.ville ?? ""}
              placeholder="Ville (ex : Créteil)"
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm sm:w-80"
            />
          ) : (
            <>
              <p className="mt-2 text-xs text-gray-500">
                Par exemple domicile → école : les professionnels proches de ce
                chemin vous seront proposés.
              </p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <input
                  name="trajet_depart"
                  defaultValue={criteres?.trajet_depart ?? ""}
                  placeholder="Point de départ"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <input
                  name="trajet_arrivee"
                  defaultValue={criteres?.trajet_arrivee ?? ""}
                  placeholder="Point d'arrivée"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </>
          )}
        </div>

        <label className="flex flex-col gap-1 text-sm">
          {modeZone === "ville"
            ? "Distance maximale autour de cette ville (km)"
            : "Distance maximale de part et d'autre du trajet (km)"}
          <input
            type="number"
            name="rayon"
            min="1"
            defaultValue={criteres?.rayon_km ?? ""}
            placeholder={modeZone === "ville" ? "ex : 15" : "ex : 3"}
            className="rounded-lg border border-gray-300 px-3 py-2 sm:w-64"
          />
        </label>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state?.success && (
          <p className="text-sm text-liams-teal">Critères enregistrés.</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-full bg-liams-navy px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Enregistrement..." : "Enregistrer mes critères"}
        </button>
      </form>
    </details>
  );
}
