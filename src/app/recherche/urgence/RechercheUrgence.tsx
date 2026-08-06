"use client";

import { useActionState, useState } from "react";
import { BadgeIcone } from "@/components/BadgeIcone";
import {
  SelectionEnfants,
  type EnfantSelectionnable,
} from "@/components/SelectionEnfants";
import { demanderGardeUrgente } from "./actions";

export type CreneauUrgence = {
  id: string;
  date: string;
  heure_debut: string;
  heure_fin: string;
  lieu_accueil: string | null;
  placesRestantes: number;
};

export type ProfessionnelUrgence = {
  userId: string;
  nom: string;
  duReseau: boolean;
  badges: string[];
  typeProfessionnel: string | null;
  tarif: number | null;
  noteMoyenne: number | null;
  nombreAvis: number;
  distanceKm: number | null;
  creneaux: CreneauUrgence[];
};

const METIERS: Record<string, string> = {
  assistante_maternelle: "Assistante maternelle",
  auxiliaire_puericulture: "Auxiliaire de puériculture",
  auxiliaire_vie: "Auxiliaire de vie",
  educateur_jeunes_enfants: "Éducateur de jeunes enfants",
  garde_domicile: "Garde d'enfants à domicile",
  aesh: "AESH",
  autre: "Autre",
};

const LIEUX: Record<string, string> = {
  chez_le_pro: "chez le professionnel",
  domicile_parent: "à votre domicile",
};

const quand = (creneau: CreneauUrgence) =>
  `${new Date(creneau.date).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })} · ${creneau.heure_debut.slice(0, 5)}–${creneau.heure_fin.slice(0, 5)}`;

export function RechercheUrgence({
  professionnels,
  enfants,
  aUnReseau,
}: {
  professionnels: ProfessionnelUrgence[];
  enfants: EnfantSelectionnable[];
  aUnReseau: boolean;
}) {
  const [state, formAction, pending] = useActionState(demanderGardeUrgente, undefined);
  const [coches, setCoches] = useState<string[]>([]);
  const [avertis, setAvertis] = useState<string[]>([]);

  /** L'avertissement se donne au moment de cocher, une fois par professionnel.
   * Le répéter à chaque créneau du même professionnel le viderait de son sens. */
  const basculer = (creneau: CreneauUrgence, pro: ProfessionnelUrgence) => {
    const dejaCoche = coches.includes(creneau.id);

    if (!dejaCoche && !pro.duReseau && !avertis.includes(pro.userId)) {
      const accepte = window.confirm(
        `${pro.nom} ne fait pas partie de votre réseau de confiance.\n\n` +
          "Liams a vérifié son casier judiciaire et ses justificatifs, mais vous ne l'avez jamais rencontré. " +
          "Avant de lui confier votre enfant, demandez-lui une pièce d'identité, vérifiez qu'elle correspond au profil, " +
          "et prenez le temps d'un échange.\n\n" +
          "Souhaitez-vous tout de même le sélectionner ?",
      );
      if (!accepte) return;
      setAvertis((a) => [...a, pro.userId]);
    }

    setCoches((actuels) =>
      dejaCoche ? actuels.filter((id) => id !== creneau.id) : [...actuels, creneau.id],
    );
  };

  if (professionnels.length === 0) {
    return (
      <div className="rounded-xl bg-gray-50 px-4 py-6 text-sm text-gray-600">
        <p className="font-medium text-liams-navy">
          Aucun créneau d&apos;urgence ouvert en ce moment.
        </p>
        <p className="mt-2">
          Les professionnels ouvrent ces créneaux au plus tôt 20 h avant le
          début de la garde. {!aUnReseau && " "}
          {!aUnReseau &&
            "Constituer un réseau de confiance vous donnera accès aux créneaux de professionnels que vous connaissez déjà, ce qui change tout un jour d'imprévu."}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {professionnels.map((pro) => (
        <article
          key={pro.userId}
          className={`rounded-xl border p-5 ${
            pro.duReseau ? "border-liams-teal bg-liams-teal/5" : "border-gray-200"
          }`}
        >
          <header className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-medium text-liams-navy">
              {pro.nom}
              {pro.duReseau && (
                <span className="ml-2 rounded-full bg-liams-teal px-2 py-0.5 text-xs text-white">
                  Mon réseau
                </span>
              )}
            </span>
            <span className="text-xs text-gray-500">
              {pro.typeProfessionnel ? METIERS[pro.typeProfessionnel] : null}
              {pro.distanceKm != null ? ` · ${pro.distanceKm} km` : ""}
              {pro.tarif ? ` · ${pro.tarif} €/h` : ""}
              {pro.noteMoyenne ? ` · ★ ${pro.noteMoyenne}/5 (${pro.nombreAvis})` : ""}
            </span>
          </header>

          {pro.badges.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {pro.badges.map((code) => (
                <BadgeIcone key={code} code={code} label={code} compact taille={24} />
              ))}
            </div>
          )}

          {!pro.duReseau && (
            <p className="mt-2 text-xs text-liams-orange">
              Hors de votre réseau — vérifiez son identité avant de lui confier
              votre enfant.
            </p>
          )}

          <div className="mt-3 flex flex-col gap-1">
            {pro.creneaux.map((creneau) => (
              <label
                key={creneau.id}
                className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  name="slot_ids"
                  value={creneau.id}
                  checked={coches.includes(creneau.id)}
                  onChange={() => basculer(creneau, pro)}
                />
                <span>{quand(creneau)}</span>
                {creneau.lieu_accueil && (
                  <span className="text-xs text-gray-500">
                    {LIEUX[creneau.lieu_accueil]}
                  </span>
                )}
                {creneau.placesRestantes === 1 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                    1 place restante
                  </span>
                )}
              </label>
            ))}
          </div>
        </article>
      ))}

      <div className="rounded-xl border border-gray-200 p-5">
        <SelectionEnfants enfants={enfants} />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && (
        <p className="rounded-lg bg-liams-teal/10 px-4 py-3 text-sm text-liams-teal">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || coches.length === 0}
        className="self-start rounded-full bg-liams-orange px-6 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending
          ? "Envoi..."
          : coches.length === 0
            ? "Choisissez un créneau"
            : `Demander ${coches.length} créneau(x)`}
      </button>
    </form>
  );
}
