"use client";

import { useActionState, useState } from "react";
import { JOURS_SEMAINE } from "@/lib/disponibilites";
import { addDays, todayISO } from "@/lib/calendar";
import { libelleTranche, type TrancheOption } from "@/lib/tranches";
import {
  ajouterCreneauxRecurrents,
  modifierCreneauxRecurrents,
  ajouterBesoinsRecurrents,
  modifierBesoinsRecurrents,
} from "./actions";

export type RecurrenceExistante = {
  id: string;
  jours: number[];
  heure_debut: string;
  heure_fin: string;
  statut?: string;
  date_debut: string;
  date_fin: string;
  capacite?: number;
  types_accueil?: string[];
  lieu_accueil?: string | null;
  tranche_id?: string | null;
  enfant_ids?: string[] | null;
  /** Nombre de créneaux de la série qu'une famille a réservés. Décide de la
   * question posée avant suppression. */
  reservations?: number;
};

const TYPES_ACCUEIL = [
  { value: "longue_duree", label: "Longue durée" },
  { value: "ponctuel", label: "Ponctuel" },
  { value: "urgence", label: "Urgence" },
];

/** Deux variantes du même formulaire : les créneaux de disponibilité du
 * professionnel ("creneaux", avec choix du type) et les besoins de garde du
 * parent ("besoins", sans type). */
export type VarianteRecurrence = "creneaux" | "besoins";

const TEXTES: Record<
  VarianteRecurrence,
  { titre: string; description: string; bouton: string; succesAjout: string }
> = {
  creneaux: {
    titre: "Créneaux récurrents (répétition hebdomadaire)",
    description:
      "Comme dans Outlook : choisissez les jours de la semaine, l'horaire, et la période sur laquelle ça se répète.",
    bouton: "Ajouter les créneaux récurrents",
    succesAjout: "Créneaux récurrents ajoutés.",
  },
  besoins: {
    titre: "Besoins récurrents (répétition hebdomadaire)",
    description:
      "Choisissez les jours de la semaine, l'horaire, et la période sur laquelle votre besoin de garde se répète.",
    bouton: "Ajouter mes besoins récurrents",
    succesAjout: "Besoins récurrents ajoutés.",
  },
};

const ACTIONS: Record<VarianteRecurrence, { creer: typeof ajouterCreneauxRecurrents; modifier: typeof modifierCreneauxRecurrents }> = {
  creneaux: { creer: ajouterCreneauxRecurrents, modifier: modifierCreneauxRecurrents },
  besoins: { creer: ajouterBesoinsRecurrents, modifier: modifierBesoinsRecurrents },
};

/** Sans prop `recurrence` : création d'une nouvelle série. Avec : édition de
 * la série existante (champs préremplis, toute la série est régénérée sauf
 * les créneaux déjà réservés). */
export function CreneauRecurrentForm({
  recurrence,
  variante = "creneaux",
  lieuAccueilProfil,
  tranches = [],
  enfants = [],
}: {
  recurrence?: RecurrenceExistante;
  variante?: VarianteRecurrence;
  /** Lieu déclaré au profil : le choix par créneau n'a de sens que si le
   * professionnel a répondu « l'un ou l'autre ». */
  lieuAccueilProfil?: string;
  /** Sections de l'établissement. Vide pour un indépendant et pour un parent,
   * qui n'en ont pas. */
  tranches?: TrancheOption[];
  /** Les enfants du parent, pour dire qui ce besoin concerne. Vide côté
   * professionnel : un créneau ouvert n'a personne à nommer. */
  enfants?: { id: string; prenom: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    recurrence ? ACTIONS[variante].modifier : ACTIONS[variante].creer,
    undefined,
  );
  const [retouche, setRetouche] = useState(false);
  const [trancheChoisie, setTrancheChoisie] = useState(recurrence?.tranche_id ?? "");
  const trancheSelectionnee = tranches.find((t) => t.id === trancheChoisie);
  const capaciteMax = trancheSelectionnee ? trancheSelectionnee.places_ouvertes : 20;
  const textes = TEXTES[variante];
  const today = todayISO();
  const dansHuitSemaines = addDays(today, 56);

  const formulaire = (
    <form
      action={formAction}
      // Le résultat de l'envoi précédent reste affiché tant qu'on n'a rien
      // retouché : dès que le professionnel modifie un champ, il prépare autre
      // chose et le message d'avant ne le concerne plus.
      onChange={() => setRetouche(true)}
      onSubmit={() => setRetouche(false)}
      className="mt-4 flex flex-col gap-3"
    >
      {recurrence && <input type="hidden" name="recurrence_id" value={recurrence.id} />}

      {/* Pour qui. En tête, parce que c'est ce qui décide de tout le reste :
          l'âge détermine les sections susceptibles d'accueillir, et le nombre
          d'enfants le nombre de places à trouver. */}
      {enfants.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-700">Pour</p>
          <div className="mt-1 flex flex-wrap gap-3">
            {enfants.map((enfant) => (
              <label key={enfant.id} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  name="enfant_ids"
                  value={enfant.id}
                  defaultChecked={
                    // Un seul enfant : la question ne se pose pas, on coche pour
                    // lui. Une série ancienne n'en nomme aucun — la 0039 les a
                    // laissées telles quelles — et se rouvre donc décochée.
                    enfants.length === 1 ||
                    (recurrence?.enfant_ids ?? []).includes(enfant.id)
                  }
                />
                {enfant.prenom}
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-gray-700">Se répète le</p>
        <div className="mt-1 flex flex-wrap gap-3">
          {JOURS_SEMAINE.map((label, jour) => (
            <label key={jour} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                name="jours"
                value={jour}
                defaultChecked={recurrence?.jours.includes(jour)}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          De
          <input
            type="time"
            name="heure_debut"
            defaultValue={recurrence ? recurrence.heure_debut.slice(0, 5) : "16:00"}
            className="rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          À
          <input
            type="time"
            name="heure_fin"
            defaultValue={recurrence ? recurrence.heure_fin.slice(0, 5) : "18:00"}
            className="rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>
      </div>

      {variante === "creneaux" && (
        <div className="flex flex-col gap-3 rounded-lg bg-gray-50 p-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="px-1 text-sm font-medium text-liams-navy">
              Pour quels accueils
            </legend>
            {TYPES_ACCUEIL.map((t) => (
              <label key={t.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="types_accueil"
                  value={t.value}
                  defaultChecked={(
                    recurrence?.types_accueil ?? ["ponctuel"]
                  ).includes(t.value)}
                />
                {t.label}
              </label>
            ))}
          </fieldset>

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
                Toute la série ouvre pour cette section. Une crèche qui ouvre
                plusieurs sections aux mêmes horaires crée une série par section.
              </span>
            </label>
          )}

          <label className="flex flex-col gap-1 text-sm">
            Nombre d&apos;enfants accueillis en même temps
            <input
              type="number"
              name="capacite"
              min="1"
              max={capaciteMax}
              defaultValue={recurrence?.capacite ?? 1}
              className="w-24 rounded-lg border border-gray-300 px-3 py-2"
            />
            {trancheSelectionnee && (
              <span className="text-xs text-gray-500">
                {trancheSelectionnee.places_ouvertes} place
                {trancheSelectionnee.places_ouvertes > 1 ? "s" : ""} ouverte
                {trancheSelectionnee.places_ouvertes > 1 ? "s" : ""} dans cette
                section.
              </span>
            )}
          </label>

          {/* Le lieu ne se demande que si le professionnel a déclaré faire les
              deux : sinon la réponse est déjà connue et la question est du
              bruit. */}
          {lieuAccueilProfil === "les_deux" && (
            <label className="flex flex-col gap-1 text-sm">
              Lieu de ces accueils
              <select
                name="lieu_accueil"
                defaultValue={recurrence?.lieu_accueil ?? "chez_le_pro"}
                className="rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="chez_le_pro">Chez moi</option>
                <option value="domicile_parent">Au domicile de la famille</option>
              </select>
            </label>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Du
          <input
            type="date"
            name="date_debut"
            defaultValue={recurrence?.date_debut ?? today}
            className="rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Au
          <input
            type="date"
            name="date_fin"
            defaultValue={recurrence?.date_fin ?? dansHuitSemaines}
            className="rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>
      </div>

      {!retouche && state?.error && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      {!retouche && state?.success && (
        <p className="text-sm text-liams-teal">
          {state.message ?? (recurrence ? "Récurrence modifiée." : textes.succesAjout)}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-liams-navy px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending
          ? "Enregistrement..."
          : recurrence
            ? "Enregistrer les modifications"
            : textes.bouton}
      </button>
    </form>
  );

  if (recurrence) return formulaire;

  return (
    <section className="rounded-xl border border-dashed border-gray-300 p-6">
      <h2 className="text-sm font-semibold text-liams-navy">{textes.titre}</h2>
      <p className="mt-1 text-xs text-gray-500">{textes.description}</p>
      {formulaire}
    </section>
  );
}
