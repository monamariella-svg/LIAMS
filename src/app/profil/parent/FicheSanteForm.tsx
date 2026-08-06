"use client";

import { useActionState } from "react";
import { updateFicheSante } from "./actions";

export type Contact = { nom?: string; lien?: string; telephone?: string };

export type FicheSante = {
  allergies: string | null;
  traitements_en_cours: string | null;
  contact_medecin: string | null;
  contact_urgence: string | null;
  contacts_urgence?: Contact[] | null;
  personnes_autorisees?: Contact[] | null;
  medecin_nom?: string | null;
  medecin_telephone?: string | null;
  allergies_alimentaires?: string | null;
  allergies_medicamenteuses?: string | null;
  allergies_autres?: string | null;
  conduite_a_tenir_allergie?: string | null;
  antecedents_medicaux?: string | null;
  regime_alimentaire?: string | null;
  appareillages?: string | null;
  vaccins_a_jour?: boolean | null;
  pai_existe?: boolean | null;
  pai_objet?: string | null;
  pai_protocole_urgence?: string | null;
  autorisation_soins_urgence?: boolean | null;
  autorisation_soins_precisions?: string | null;
} | null;

/** Deux contacts d'urgence et deux personnes autorisées : au-delà, la saisie
 * décourage, en deçà un parent injoignable laisse le professionnel sans
 * recours. */
const RANGS = [0, 1];

export function FicheSanteForm({
  enfantId,
  fiche,
}: {
  enfantId: string;
  fiche: FicheSante;
}) {
  const [state, formAction, pending] = useActionState(updateFicheSante, undefined);

  const contact = (liste: Contact[] | null | undefined, rang: number): Contact =>
    (liste ?? [])[rang] ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="enfant_id" value={enfantId} />

      <p className="text-sm font-medium text-liams-navy">
        Fiche sanitaire de liaison <span className="text-red-600">*</span>{" "}
        <span className="font-normal text-gray-500">
          — visible uniquement des professionnels qui accueillent votre enfant,
          et jusqu&apos;au lendemain de la garde
        </span>
      </p>

      {/* Ce qu'on lit dans l'urgence vient en premier, ici comme sur la fiche
          que verra le professionnel. */}
      <Section titre="En cas d'urgence">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="pai_existe"
            defaultChecked={fiche?.pai_existe ?? false}
            className="mt-1"
          />
          <span>
            Mon enfant a un PAI (Projet d&apos;Accueil Individualisé)
            <span className="block text-xs text-gray-500">
              Document qui formalise les aménagements liés à son état de santé.
            </span>
          </span>
        </label>
        <Zone
          nom="pai_objet"
          libelle="Objet du PAI"
          valeur={fiche?.pai_objet}
          lignes={2}
        />
        <Zone
          nom="pai_protocole_urgence"
          libelle="Protocole d'urgence"
          aide="Les gestes à faire en cas de crise. Court et impératif : il sera lu debout, dans l'urgence."
          valeur={fiche?.pai_protocole_urgence}
          lignes={3}
        />
        <Zone
          nom="conduite_a_tenir_allergie"
          libelle="Conduite à tenir en cas de réaction allergique"
          valeur={fiche?.conduite_a_tenir_allergie}
          lignes={2}
        />
      </Section>

      <Section titre="Qui appeler">
        {RANGS.map((rang) => (
          <div key={rang} className="grid gap-2 sm:grid-cols-3">
            <input
              name={`contact_urgence_nom_${rang}`}
              defaultValue={contact(fiche?.contacts_urgence, rang).nom ?? ""}
              placeholder={rang === 0 ? "Nom (1er appelé)" : "Nom (si injoignable)"}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
            />
            <input
              name={`contact_urgence_lien_${rang}`}
              defaultValue={contact(fiche?.contacts_urgence, rang).lien ?? ""}
              placeholder="Lien (mère, voisin...)"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
            />
            <input
              name={`contact_urgence_tel_${rang}`}
              type="tel"
              defaultValue={contact(fiche?.contacts_urgence, rang).telephone ?? ""}
              placeholder="Téléphone"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
            />
          </div>
        ))}
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            name="medecin_nom"
            defaultValue={fiche?.medecin_nom ?? ""}
            placeholder="Médecin traitant"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
          />
          <input
            name="medecin_telephone"
            type="tel"
            defaultValue={fiche?.medecin_telephone ?? ""}
            placeholder="Téléphone du médecin"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
          />
        </div>
      </Section>

      <Section titre="Santé">
        <Zone
          nom="allergies_alimentaires"
          libelle="Allergies alimentaires"
          valeur={fiche?.allergies_alimentaires}
        />
        <Zone
          nom="allergies_medicamenteuses"
          libelle="Allergies médicamenteuses"
          valeur={fiche?.allergies_medicamenteuses}
        />
        <Zone
          nom="allergies_autres"
          libelle="Autres allergies"
          aide="Pollens, animaux, latex..."
          valeur={fiche?.allergies_autres}
        />
        <Zone
          nom="traitements_en_cours"
          libelle="Traitements en cours"
          valeur={fiche?.traitements_en_cours}
        />
        <Zone
          nom="antecedents_medicaux"
          libelle="Antécédents médicaux"
          aide="Asthme, épilepsie, opérations, maladies déjà eues."
          valeur={fiche?.antecedents_medicaux}
        />
        <Zone
          nom="regime_alimentaire"
          libelle="Régime alimentaire"
          valeur={fiche?.regime_alimentaire}
        />
        <Zone
          nom="appareillages"
          libelle="Appareillages"
          aide="Lunettes, prothèses auditives, attelles — ce qui se perd, se casse, ou ne doit pas être retiré."
          valeur={fiche?.appareillages}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="vaccins_a_jour"
            defaultChecked={fiche?.vaccins_a_jour ?? false}
          />
          Vaccinations obligatoires à jour
        </label>
      </Section>

      <Section titre="Qui peut venir chercher l'enfant">
        {RANGS.map((rang) => (
          <div key={rang} className="grid gap-2 sm:grid-cols-3">
            <input
              name={`autorisee_nom_${rang}`}
              defaultValue={contact(fiche?.personnes_autorisees, rang).nom ?? ""}
              placeholder="Nom"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
            />
            <input
              name={`autorisee_lien_${rang}`}
              defaultValue={contact(fiche?.personnes_autorisees, rang).lien ?? ""}
              placeholder="Lien"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
            />
            <input
              name={`autorisee_tel_${rang}`}
              type="tel"
              defaultValue={contact(fiche?.personnes_autorisees, rang).telephone ?? ""}
              placeholder="Téléphone"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
            />
          </div>
        ))}
      </Section>

      <Section titre="Autorisation">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="autorisation_soins_urgence"
            defaultChecked={fiche?.autorisation_soins_urgence ?? false}
            className="mt-1"
          />
          <span>
            J&apos;autorise les soins et le transport en urgence
            <span className="block text-xs text-gray-500">
              Déclaratif : ne remplace pas l&apos;autorisation écrite et signée
              qui accompagnera votre contrat.
            </span>
          </span>
        </label>
        <Zone
          nom="autorisation_soins_precisions"
          libelle="Précisions"
          valeur={fiche?.autorisation_soins_precisions}
          lignes={2}
        />
      </Section>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-liams-teal">Fiche enregistrée.</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full border border-liams-navy px-5 py-2 text-sm font-medium text-liams-navy hover:bg-liams-navy hover:text-white disabled:opacity-50"
      >
        {pending ? "Enregistrement..." : "Enregistrer la fiche sanitaire"}
      </button>
    </form>
  );
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3 rounded-lg bg-gray-50 p-4">
      <legend className="px-1 text-sm font-medium text-liams-navy">{titre}</legend>
      {children}
    </fieldset>
  );
}

function Zone({
  nom,
  libelle,
  aide,
  valeur,
  lignes = 2,
}: {
  nom: string;
  libelle: string;
  aide?: string;
  valeur?: string | null;
  lignes?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {libelle}
      {aide && <span className="text-xs text-gray-500">{aide}</span>}
      <textarea
        name={nom}
        defaultValue={valeur ?? ""}
        rows={lignes}
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
      />
    </label>
  );
}
