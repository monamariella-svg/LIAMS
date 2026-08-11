"use client";

import { useActionState } from "react";
import { AdresseAutocomplete } from "@/components/AdresseAutocomplete";
import { enregistrerEtablissement } from "./actions";

export type Etablissement = {
  raison_sociale: string;
  siret: string | null;
  forme_juridique: string | null;
  adresse_siege: string | null;
  titulaire_prenom: string | null;
  titulaire_nom: string | null;
  representant_prenom: string | null;
  representant_nom: string | null;
  representant_fonction: string | null;
  type_etablissement: string;
  agrement_numero: string | null;
  agrement_debut: string | null;
  agrement_fin: string | null;
  assurance_assureur: string | null;
  assurance_numero: string | null;
  assurance_expiration: string | null;
};

const TYPES = [
  { value: "creche_collective", label: "Crèche collective" },
  { value: "micro_creche", label: "Micro-crèche" },
  { value: "halte_garderie", label: "Halte-garderie" },
  { value: "multi_accueil", label: "Multi-accueil" },
  { value: "autre", label: "Autre" },
];

export function EtablissementForm({
  etablissement,
  raisonSocialeParDefaut = "",
}: {
  etablissement: Etablissement | null;
  /** Le nom donné à l'inscription, repris tel quel plutôt que redemandé. */
  raisonSocialeParDefaut?: string;
}) {
  const [state, formAction, pending] = useActionState(enregistrerEtablissement, undefined);

  return (
    <section className="rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-liams-navy">
        {etablissement ? "La fiche de votre établissement" : "Déclarer un établissement"}
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        {etablissement
          ? "Ces informations figurent sur votre fiche publique : un parent doit pouvoir vérifier l'agrément de la structure à qui il confie son enfant."
          : "Si vous inscrivez une crèche, une micro-crèche ou une halte-garderie plutôt que votre activité personnelle, renseignez sa fiche ici. Vous pourrez ensuite rattacher les comptes de votre équipe."}
      </p>

      <form action={formAction} className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row">
          <label className="flex w-full flex-col gap-1 text-sm">
            Raison sociale
            <input
              name="raison_sociale"
              required
              defaultValue={etablissement?.raison_sociale ?? raisonSocialeParDefaut}
              className="rounded-lg border border-gray-300 px-4 py-2"
            />
          </label>
          <label className="flex w-full flex-col gap-1 text-sm">
            Type d&apos;établissement
            <select
              name="type_etablissement"
              defaultValue={etablissement?.type_etablissement ?? "creche_collective"}
              className="rounded-lg border border-gray-300 px-4 py-2"
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <label className="flex w-full flex-col gap-1 text-sm">
            SIRET
            <input
              name="siret"
              inputMode="numeric"
              placeholder="14 chiffres"
              defaultValue={etablissement?.siret ?? ""}
              className="rounded-lg border border-gray-300 px-4 py-2"
            />
          </label>
          <label className="flex w-full flex-col gap-1 text-sm">
            Forme juridique
            <input
              name="forme_juridique"
              placeholder="SAS, association, régie municipale..."
              defaultValue={etablissement?.forme_juridique ?? ""}
              className="rounded-lg border border-gray-300 px-4 py-2"
            />
          </label>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <label className="flex w-full flex-col gap-1 text-sm">
            Adresse du siège
            <AdresseAutocomplete
              name="adresse_siege"
              defaultValue={etablissement?.adresse_siege ?? ""}
              className="rounded-lg border border-gray-300 px-4 py-2"
            />
          </label>
        </div>

        <fieldset className="flex flex-col gap-4 rounded-lg bg-gray-50 p-4">
          <legend className="px-1 text-sm font-medium text-liams-navy">
            Qui tient ce compte
          </legend>
          <p className="text-xs text-gray-500">
            Les familles vous voient sous votre raison sociale, et c&apos;est bien
            ainsi. Reste qu&apos;il faut savoir qui appeler quand quelque chose ne
            va pas : donnez le nom de la personne qui suit ce compte au
            quotidien. Il n&apos;apparaît pas sur votre fiche publique.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <label className="flex w-full flex-col gap-1 text-sm">
              Prénom
              <input
                name="titulaire_prenom"
                defaultValue={etablissement?.titulaire_prenom ?? ""}
                className="rounded-lg border border-gray-300 px-4 py-2"
              />
            </label>
            <label className="flex w-full flex-col gap-1 text-sm">
              Nom
              <input
                name="titulaire_nom"
                defaultValue={etablissement?.titulaire_nom ?? ""}
                className="rounded-lg border border-gray-300 px-4 py-2"
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-4 rounded-lg bg-gray-50 p-4">
          <legend className="px-1 text-sm font-medium text-liams-navy">
            Représentant légal
          </legend>
          <p className="text-xs text-gray-500">
            La personne qui engage la société, telle qu&apos;elle figure sur les
            statuts. Ce n&apos;est pas nécessairement celle qui tient ce compte :
            dans une association, le président signe et la directrice se
            connecte.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <label className="flex w-full flex-col gap-1 text-sm">
              Prénom
              <input
                name="representant_prenom"
                defaultValue={etablissement?.representant_prenom ?? ""}
                className="rounded-lg border border-gray-300 px-4 py-2"
              />
            </label>
            <label className="flex w-full flex-col gap-1 text-sm">
              Nom
              <input
                name="representant_nom"
                defaultValue={etablissement?.representant_nom ?? ""}
                className="rounded-lg border border-gray-300 px-4 py-2"
              />
            </label>
            <label className="flex w-full flex-col gap-1 text-sm">
              Poste
              <input
                name="representant_fonction"
                placeholder="Président, gérante, directrice..."
                defaultValue={etablissement?.representant_fonction ?? ""}
                className="rounded-lg border border-gray-300 px-4 py-2"
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-4 rounded-lg bg-gray-50 p-4">
          <legend className="px-1 text-sm font-medium text-liams-navy">
            Agrément PMI
          </legend>
          <p className="text-xs text-gray-500">
            C&apos;est l&apos;agrément qui atteste que la structure est autorisée à
            accueillir des enfants. Il tient, pour un établissement, la place que
            le bulletin n°3 du casier judiciaire tient pour un professionnel
            indépendant. Sa date de fin est contrôlée : sans elle, l&apos;agrément
            est traité comme non vérifiable.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <label className="flex w-full flex-col gap-1 text-sm">
              Numéro
              <input
                name="agrement_numero"
                defaultValue={etablissement?.agrement_numero ?? ""}
                className="rounded-lg border border-gray-300 px-4 py-2"
              />
            </label>
            <label className="flex w-full flex-col gap-1 text-sm">
              Début de validité
              <input
                type="date"
                name="agrement_debut"
                defaultValue={etablissement?.agrement_debut ?? ""}
                className="rounded-lg border border-gray-300 px-4 py-2"
              />
            </label>
            <label className="flex w-full flex-col gap-1 text-sm">
              Fin de validité
              <input
                type="date"
                name="agrement_fin"
                defaultValue={etablissement?.agrement_fin ?? ""}
                className="rounded-lg border border-gray-300 px-4 py-2"
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-4 rounded-lg bg-gray-50 p-4">
          <legend className="px-1 text-sm font-medium text-liams-navy">
            Responsabilité civile de la structure
          </legend>
          <p className="text-xs text-gray-500">
            Celle de l&apos;établissement, et non celle de sa directrice à titre
            personnel.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <label className="flex w-full flex-col gap-1 text-sm">
              Assureur
              <input
                name="assurance_assureur"
                defaultValue={etablissement?.assurance_assureur ?? ""}
                className="rounded-lg border border-gray-300 px-4 py-2"
              />
            </label>
            <label className="flex w-full flex-col gap-1 text-sm">
              N° de police
              <input
                name="assurance_numero"
                defaultValue={etablissement?.assurance_numero ?? ""}
                className="rounded-lg border border-gray-300 px-4 py-2"
              />
            </label>
            <label className="flex w-full flex-col gap-1 text-sm">
              Échéance
              <input
                type="date"
                name="assurance_expiration"
                defaultValue={etablissement?.assurance_expiration ?? ""}
                className="rounded-lg border border-gray-300 px-4 py-2"
              />
            </label>
          </div>
        </fieldset>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state?.success && <p className="text-sm text-green-700">{state.message}</p>}

        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-full bg-liams-orange px-6 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Enregistrement..." : "Enregistrer"}
        </button>
      </form>
    </section>
  );
}
