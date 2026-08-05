"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AdresseAutocomplete } from "@/components/AdresseAutocomplete";
import { updateProfessionalProfile } from "./actions";

const METIERS = [
  { value: "assistante_maternelle", label: "Assistante maternelle" },
  { value: "auxiliaire_puericulture", label: "Auxiliaire de puériculture" },
  { value: "auxiliaire_vie", label: "Auxiliaire de vie" },
  { value: "educateur_jeunes_enfants", label: "Éducateur de jeunes enfants" },
  { value: "garde_domicile", label: "Garde d'enfants à domicile" },
  { value: "aesh", label: "AESH" },
  { value: "autre", label: "Autre" },
];

const TYPES_ACCUEIL = [
  {
    value: "longue_duree",
    label: "Accueil longue durée",
    aide: "Un contrat sur plusieurs mois, aux mêmes plages chaque semaine.",
  },
  {
    value: "ponctuel",
    label: "Accueil ponctuel",
    aide: "Des gardes ponctuelles, réservées créneau par créneau.",
  },
  {
    value: "urgence",
    label: "Accueil d'urgence",
    aide: "Demandé entre 20 h et 2 h avant le début de la garde.",
  },
];

const LIEUX_ACCUEIL = [
  { value: "chez_le_pro", label: "Uniquement chez moi", aide: null },
  {
    value: "domicile_parent",
    label: "Uniquement au domicile des familles",
    aide: null,
  },
  {
    value: "les_deux",
    label: "L'un ou l'autre",
    aide: "Vous préciserez le lieu sur chaque créneau.",
  },
];

export function ProfessionalProfileForm({
  tarifHoraire,
  tarifHoraireUrgence,
  adresse,
  rayonKm,
  accueilADomicile,
  typeProfessionnel,
  cadreExercice,
  lieuAccueil,
  typesAccueil,
}: {
  tarifHoraire: number | null;
  tarifHoraireUrgence: number | null;
  adresse: string;
  rayonKm: number;
  accueilADomicile: boolean;
  typeProfessionnel: string | null;
  cadreExercice: string | null;
  lieuAccueil: string;
  typesAccueil: string[];
}) {
  const [state, formAction, pending] = useActionState(updateProfessionalProfile, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-liams-navy">Mon profil</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Mon métier
          <select
            name="type_professionnel"
            defaultValue={typeProfessionnel ?? ""}
            className="rounded-lg border border-gray-300 px-4 py-2"
          >
            <option value="">Non renseigné</option>
            {METIERS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Où j&apos;exerce
          <select
            name="cadre_exercice"
            defaultValue={cadreExercice ?? ""}
            className="rounded-lg border border-gray-300 px-4 py-2"
          >
            <option value="">Sans lieu propre</option>
            <option value="domicile">À mon domicile</option>
            <option value="mam">En maison d&apos;assistantes maternelles</option>
          </select>
          <span className="text-xs text-gray-500">
            Laissez vide si vous n&apos;intervenez qu&apos;au domicile des
            familles.
          </span>
        </label>
      </div>

      <fieldset className="flex flex-col gap-2 rounded-lg bg-gray-50 p-4">
        <legend className="px-1 text-sm font-medium text-liams-navy">
          Les accueils que j&apos;accepte
        </legend>
        <p className="text-xs text-gray-500">
          Vous préciserez ensuite, créneau par créneau, lesquels s&apos;appliquent.
        </p>
        {TYPES_ACCUEIL.map((t) => (
          <label key={t.value} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="types_accueil"
              value={t.value}
              defaultChecked={typesAccueil.includes(t.value)}
              className="mt-1"
            />
            <span>
              <span className="font-medium">{t.label}</span>
              <span className="block text-xs text-gray-500">{t.aide}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-2 rounded-lg bg-gray-50 p-4">
        <legend className="px-1 text-sm font-medium text-liams-navy">
          Le lieu d&apos;accueil
        </legend>
        {LIEUX_ACCUEIL.map((l) => (
          <label key={l.value} className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="lieu_accueil"
              value={l.value}
              defaultChecked={lieuAccueil === l.value}
              className="mt-1"
            />
            <span>
              <span className="font-medium">{l.label}</span>
              {l.aide && (
                <span className="block text-xs text-gray-500">{l.aide}</span>
              )}
            </span>
          </label>
        ))}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Tarif horaire indicatif (€/h)
          <input
            name="tarif_horaire"
            type="number"
            step="0.5"
            min="0"
            defaultValue={tarifHoraire ?? ""}
            className="rounded-lg border border-gray-300 px-4 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Tarif horaire en urgence (€/h)
          <input
            name="tarif_horaire_urgence"
            type="number"
            step="0.5"
            min="0"
            defaultValue={tarifHoraireUrgence ?? ""}
            className="rounded-lg border border-gray-300 px-4 py-2"
          />
          <span className="text-xs text-gray-500">
            Appliqué aux créneaux « Urgence », demandés entre 20 h et 2 h avant
            leur début. Sans valeur, votre tarif habituel s&apos;applique.
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Rayon d&apos;intervention (km)
          <input
            name="rayon_km"
            type="number"
            min="1"
            defaultValue={rayonKm}
            className="rounded-lg border border-gray-300 px-4 py-2"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Zone géographique d&apos;intervention
        <AdresseAutocomplete
          name="adresse"
          defaultValue={adresse}
          placeholder="Ville ou adresse"
          className="w-full rounded-lg border border-gray-300 px-4 py-2"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="accueil_a_domicile" defaultChecked={accueilADomicile} />
        J&apos;accueille les enfants à mon domicile ou dans un établissement
      </label>

      <p className="text-xs text-gray-500">
        Tes disponibilités se gèrent maintenant directement dans ton{" "}
        <Link href="/planning" className="underline">
          calendrier
        </Link>
        .
      </p>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-liams-teal">Profil enregistré.</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-liams-navy px-6 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Enregistrement..." : "Enregistrer"}
      </button>
    </form>
  );
}
