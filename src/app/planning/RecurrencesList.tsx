"use client";

import { useState } from "react";
import { JOURS_SEMAINE } from "@/lib/disponibilites";
import { formatDateLabel } from "@/lib/calendar";
import {
  CreneauRecurrentForm,
  type RecurrenceExistante,
  type VarianteRecurrence,
} from "./CreneauRecurrentForm";
import { supprimerRecurrence, supprimerBesoinRecurrence } from "./actions";

const TYPE_LABELS: Record<string, string> = {
  libre: "Régulier",
  libre_urgence: "Urgence",
};

const TEXTES: Record<VarianteRecurrence, { titre: string; description: string }> = {
  creneaux: {
    titre: "Mes créneaux récurrents",
    description:
      "Modifier ou supprimer une série met à jour tous ses créneaux à venir ; les créneaux déjà réservés ne sont jamais touchés.",
  },
  besoins: {
    titre: "Mes besoins récurrents",
    description: "Modifier ou supprimer une série met à jour tous les besoins correspondants.",
  },
};

export function RecurrencesList({
  recurrences,
  variante = "creneaux",
}: {
  recurrences: RecurrenceExistante[];
  variante?: VarianteRecurrence;
}) {
  const [idEnEdition, setIdEnEdition] = useState<string | null>(null);
  const supprimerAction =
    variante === "besoins" ? supprimerBesoinRecurrence : supprimerRecurrence;
  const textes = TEXTES[variante];

  /** Supprimer une série efface des semaines de garde. Le motif y est exigé,
   * là où il reste facultatif sur un créneau isolé : les familles ont organisé
   * leur vie autour, elles méritent une explication. */
  const demanderMotif = (reservations: number) => (evenement: React.FormEvent) => {
    const formulaire = evenement.currentTarget as HTMLFormElement;

    if (
      !window.confirm(
        reservations > 0
          ? `Cette série porte ${reservations} garde(s) déjà réservée(s) par des familles.\n\nSupprimer la série ?`
          : "Supprimer cette série effacera tous ses créneaux à venir.\n\nContinuer ?",
      )
    ) {
      evenement.preventDefault();
      return;
    }

    // Le choix n'est proposé que s'il se pose : sans réservation, il n'y a
    // rien à épargner.
    if (reservations > 0) {
      const toutAnnuler = window.confirm(
        "Souhaitez-vous annuler aussi les gardes déjà réservées ?\n\n" +
          "OK — tout annuler, les familles seront prévenues.\n" +
          "Annuler — ne retirer que les créneaux libres, les gardes réservées sont conservées.",
      );
      const champPortee = formulaire.elements.namedItem(
        "portee",
      ) as HTMLInputElement | null;
      if (champPortee) champPortee.value = toutAnnuler ? "tout" : "libres";
    }

    const motif = window.prompt(
      "Expliquez aux familles pourquoi vous supprimez cette série. Ce message leur sera transmis.",
      "",
    );

    if (!motif || !motif.trim()) {
      window.alert("Une explication est nécessaire — la suppression est annulée.");
      evenement.preventDefault();
      return;
    }

    // Le formulaire soumis, et non une référence partagée : la liste en compte
    // autant que de séries, et une référence unique désignerait la dernière
    // rendue plutôt que celle sur laquelle on vient de cliquer.
    const champ = (evenement.currentTarget as HTMLFormElement).elements.namedItem(
      "motif",
    ) as HTMLInputElement | null;
    if (champ) champ.value = motif.trim();
  };

  if (recurrences.length === 0) return null;

  return (
    <section className="rounded-xl border border-gray-200 p-6">
      <h2 className="text-sm font-semibold text-liams-navy">{textes.titre}</h2>
      <p className="mt-1 text-xs text-gray-500">{textes.description}</p>
      <div className="mt-3 flex flex-col gap-2">
        {recurrences.map((rec) => (
          <div key={rec.id} className="rounded-lg border border-gray-100 px-4 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                Tous les{" "}
                <strong>{rec.jours.map((j) => JOURS_SEMAINE[j]).join(", ")}</strong>{" "}
                {rec.heure_debut.slice(0, 5)}–{rec.heure_fin.slice(0, 5)}
                <span className="ml-2 text-xs text-gray-500">
                  {rec.statut ? `${TYPE_LABELS[rec.statut] ?? rec.statut} · ` : ""}du{" "}
                  {formatDateLabel(rec.date_debut)} au {formatDateLabel(rec.date_fin)}
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
                <form
                  action={supprimerAction}
                  onSubmit={
                    variante === "creneaux"
                      ? demanderMotif(rec.reservations ?? 0)
                      : undefined
                  }
                >
                  <input type="hidden" name="recurrence_id" value={rec.id} />
                  {variante === "creneaux" && (
                    <>
                      <input type="hidden" name="motif" />
                      <input type="hidden" name="portee" defaultValue="tout" />
                    </>
                  )}
                  <button
                    type="submit"
                    className="rounded-full border border-red-300 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    Supprimer
                  </button>
                </form>
              </div>
            </div>
            {idEnEdition === rec.id && (
              <CreneauRecurrentForm recurrence={rec} variante={variante} />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
