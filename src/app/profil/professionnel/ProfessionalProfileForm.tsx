"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AdresseAutocomplete } from "@/components/AdresseAutocomplete";
import { updateProfessionalProfile } from "./actions";

export function ProfessionalProfileForm({
  tarifHoraire,
  tarifHoraireUrgence,
  adresse,
  rayonKm,
  accueilADomicile,
}: {
  tarifHoraire: number | null;
  tarifHoraireUrgence: number | null;
  adresse: string;
  rayonKm: number;
  accueilADomicile: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateProfessionalProfile, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-liams-navy">Mon profil</h2>

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
