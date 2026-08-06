"use client";

import { confirmerLectureFiche } from "./actions";

export type Contact = { nom?: string; lien?: string; telephone?: string };

export type EnfantAccueilli = {
  id: string;
  prenom: string;
  date_naissance: string | null;
  besoins_particuliers_libre: string | null;
  besoins_particuliers_tags: string[] | null;
  enfant_fiche_sante: Record<string, unknown> | null;
  enfant_profil_xtra: Record<string, unknown> | null;
  /** Accueil d'urgence : consultation seule, aucun export. */
  urgence: boolean;
  quand: string[];
  /** Date de la confirmation de lecture, si elle porte encore sur la version
   * actuelle de la fiche. Nulle si jamais lue, ou lue avant une mise à jour. */
  luLe: string | null;
  /** La fiche a changé depuis la dernière confirmation : il faut la relire. */
  aRelire: boolean;
};

const texte = (fiche: Record<string, unknown> | null, champ: string) => {
  const valeur = fiche?.[champ];
  return typeof valeur === "string" && valeur.trim() ? valeur : null;
};

const contacts = (fiche: Record<string, unknown> | null, champ: string): Contact[] => {
  const valeur = fiche?.[champ];
  return Array.isArray(valeur) ? (valeur as Contact[]) : [];
};

/** Fiche d'un enfant accueilli.
 *
 * Deux régimes selon la nature de l'accueil. Une garde d'urgence se consulte
 * sans laisser de copie : la fiche est masquée à l'impression et le texte
 * n'est pas sélectionnable. Un accueil de longue durée mérite au contraire une
 * fiche affichée près du lit, et reste imprimable.
 *
 * Aucune de ces mesures n'empêche une capture d'écran, et il ne faut pas
 * laisser croire le contraire aux familles — seulement qu'il n'existe aucun
 * moyen simple d'en faire une copie. */
export function FicheEnfant({ enfant }: { enfant: EnfantAccueilli }) {
  const sante = enfant.enfant_fiche_sante;
  const xtra = enfant.enfant_profil_xtra;

  const urgences = contacts(sante, "contacts_urgence");
  const autorisees = contacts(sante, "personnes_autorisees");
  const protocole = texte(sante, "pai_protocole_urgence");
  const conduite = texte(sante, "conduite_a_tenir_allergie");

  return (
    <article
      className={`rounded-xl border p-6 ${
        enfant.urgence
          ? "select-none border-liams-orange/40 bg-liams-orange/5 print:hidden"
          : "border-gray-200"
      }`}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-liams-navy">{enfant.prenom}</h2>
        <span className="text-xs text-gray-500">{enfant.quand.join(" · ")}</span>
      </header>

      {enfant.urgence && (
        <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs text-liams-orange">
          Accueil d&apos;urgence — fiche consultable ici seulement, sans
          impression ni téléchargement. Elle disparaîtra le lendemain de la
          garde.
        </p>
      )}

      {/* Ce qui se lit debout, dans l'urgence, vient en premier. */}
      {(protocole || conduite) && (
        <section className="mt-4 rounded-lg border-2 border-red-200 bg-red-50 p-4">
          <h3 className="text-sm font-semibold text-red-800">En cas d&apos;urgence</h3>
          {protocole && (
            <p className="mt-1 whitespace-pre-line text-sm text-red-900">{protocole}</p>
          )}
          {conduite && (
            <p className="mt-1 whitespace-pre-line text-sm text-red-900">
              Réaction allergique : {conduite}
            </p>
          )}
        </section>
      )}

      {urgences.length > 0 && (
        <Bloc titre="Qui appeler">
          <ol className="flex flex-col gap-1 text-sm">
            {urgences.map((c, i) => (
              <li key={i}>
                <strong>{c.nom}</strong>
                {c.lien ? ` (${c.lien})` : ""} — {c.telephone}
              </li>
            ))}
          </ol>
        </Bloc>
      )}

      {(texte(sante, "medecin_nom") || texte(sante, "medecin_telephone")) && (
        <Bloc titre="Médecin traitant">
          <p className="text-sm">
            {texte(sante, "medecin_nom")} {texte(sante, "medecin_telephone")}
          </p>
        </Bloc>
      )}

      <Champ titre="Allergies alimentaires" valeur={texte(sante, "allergies_alimentaires")} />
      <Champ
        titre="Allergies médicamenteuses"
        valeur={texte(sante, "allergies_medicamenteuses")}
      />
      <Champ titre="Autres allergies" valeur={texte(sante, "allergies_autres")} />
      <Champ titre="Allergies (fiche ancienne)" valeur={texte(sante, "allergies")} />
      <Champ titre="Traitements en cours" valeur={texte(sante, "traitements_en_cours")} />
      <Champ titre="Antécédents médicaux" valeur={texte(sante, "antecedents_medicaux")} />
      <Champ titre="Régime alimentaire" valeur={texte(sante, "regime_alimentaire")} />
      <Champ titre="Appareillages" valeur={texte(sante, "appareillages")} />
      <Champ titre="Objet du PAI" valeur={texte(sante, "pai_objet")} />

      {autorisees.length > 0 && (
        <Bloc titre="Personnes autorisées à venir chercher l'enfant">
          <ul className="flex flex-col gap-1 text-sm">
            {autorisees.map((c, i) => (
              <li key={i}>
                {c.nom}
                {c.lien ? ` (${c.lien})` : ""} {c.telephone ? `— ${c.telephone}` : ""}
              </li>
            ))}
          </ul>
        </Bloc>
      )}

      {sante?.autorisation_soins_urgence === true && (
        <p className="mt-3 text-xs text-gray-600">
          Le parent autorise les soins et le transport en urgence.
          {texte(sante, "autorisation_soins_precisions")
            ? ` ${texte(sante, "autorisation_soins_precisions")}`
            : ""}
        </p>
      )}

      {/* Le profil Xtra dit comment accompagner, là où la fiche santé dit quoi
          craindre. Les deux sont nécessaires, aucun ne remplace l'autre. */}
      {xtra && (
        <div className="mt-4 rounded-lg bg-liams-teal/5 p-4">
          <h3 className="text-sm font-semibold text-liams-navy">
            Accompagnement au quotidien
          </h3>
          <Champ titre="Routines apaisantes" valeur={texte(xtra, "routines_apaisantes")} />
          <Champ
            titre="Déclencheurs à éviter"
            valeur={texte(xtra, "declencheurs_a_eviter")}
          />
          <Champ
            titre="Moyens de communication préférés"
            valeur={texte(xtra, "moyens_communication_preferes")}
          />
        </div>
      )}

      <Champ
        titre="Besoins particuliers"
        valeur={enfant.besoins_particuliers_libre}
      />

      {/* La confirmation ferme la fiche : on la coche après avoir lu, pas
          avant. Elle est datée, et se périme si la famille modifie la fiche. */}
      <div className="mt-5 border-t border-gray-200 pt-4 print:hidden">
        {enfant.luLe ? (
          <p className="text-xs text-green-800">
            Lecture confirmée le{" "}
            {new Date(enfant.luLe).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            })}
            .
          </p>
        ) : (
          <form action={confirmerLectureFiche}>
            <input type="hidden" name="enfant_id" value={enfant.id} />
            {enfant.aRelire && (
              <p className="mb-2 text-xs text-liams-orange">
                La famille a modifié cette fiche depuis votre dernière lecture.
                Merci de la relire.
              </p>
            )}
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                required
                onChange={(e) => e.currentTarget.form?.requestSubmit()}
                className="mt-1"
              />
              <span>
                Je confirme avoir lu la fiche sanitaire de {enfant.prenom} et
                m&apos;engage à en respecter les consignes.
                <span className="block text-xs text-gray-500">
                  Votre confirmation est enregistrée avec sa date, et communiquée
                  à la famille.
                </span>
              </span>
            </label>
          </form>
        )}
      </div>

      {!enfant.urgence && (
        <p className="mt-4 text-xs text-gray-400 print:hidden">
          Cette fiche peut être imprimée depuis votre navigateur.
        </p>
      )}
    </article>
  );
}

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="mt-3">
      <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {titre}
      </h3>
      <div className="mt-1">{children}</div>
    </section>
  );
}

function Champ({ titre, valeur }: { titre: string; valeur: string | null }) {
  if (!valeur) return null;
  return (
    <Bloc titre={titre}>
      <p className="whitespace-pre-line text-sm">{valeur}</p>
    </Bloc>
  );
}
