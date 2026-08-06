import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { NavigationBas } from "@/components/NavigationBas";
import {
  validerDocument,
  validerQualificationXtra,
  toggleBadge,
  traiterDemandeBadge,
} from "../../actions";

const DOCUMENT_LABELS: Record<string, string> = {
  casier: "Bulletin n°3 du casier judiciaire",
  cv: "CV",
  diplome: "Diplôme",
  certificat: "Certificat",
  photo_logement: "Photo du logement",
};

const STATUT_LABELS: Record<string, { label: string; className: string }> = {
  en_attente: { label: "En attente", className: "bg-amber-100 text-amber-800" },
  valide: { label: "Validé", className: "bg-green-100 text-green-800" },
  refuse: { label: "Refusé", className: "bg-red-100 text-red-800" },
};

export default async function AdminProfessionnelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireAdmin();

  const [
    { data: profile },
    { data: documents },
    { data: qualification },
    { data: badges },
    { data: badgesAttribues },
    { data: lectures },
    { data: identite },
    { data: compte },
    { data: coordonnees },
  ] = await Promise.all([
    supabase.from("professional_profiles").select("*").eq("user_id", id).maybeSingle(),
    supabase.from("professional_documents").select("*").eq("professional_id", id).order("date_upload"),
    supabase.from("professional_qualification_xtra").select("*").eq("professional_id", id).maybeSingle(),
    supabase.from("badges").select("*").eq("source", "manuel"),
    supabase
      .from("professional_badges")
      .select("badge_code, statut, demande_le")
      .eq("professional_id", id),
    supabase
      .from("lectures_fiches")
      .select("lu_le, enfants(prenom)")
      .eq("professional_id", id)
      .order("lu_le", { ascending: false }),
    supabase.from("identites").select("prenom, nom").eq("user_id", id).maybeSingle(),
    supabase.from("users").select("email").eq("id", id).maybeSingle(),
    supabase.from("coordonnees").select("telephone").eq("user_id", id).maybeSingle(),
  ]);

  if (!profile) notFound();

  const badgesAttribuesSet = new Set(
    (badgesAttribues ?? []).filter((b) => b.statut === "valide").map((b) => b.badge_code),
  );

  const libelleParCode = new Map((badges ?? []).map((b) => [b.code, b.label as string]));
  const demandesEnAttente = (badgesAttribues ?? []).filter((b) => b.statut === "en_attente");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      {/* Contrôler des justificatifs sans savoir de qui il s'agit n'a pas de
          sens : l'identité passe en tête de page. */}
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-400">
          Vérification professionnel
        </p>
        <h1 className="text-2xl font-semibold text-liams-navy">
          {[identite?.prenom, identite?.nom].filter(Boolean).join(" ") ||
            "Identité non renseignée"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {compte?.email}
          {coordonnees?.telephone ? ` · ${coordonnees.telephone}` : ""}
        </p>
      </div>

      <p className="text-sm text-gray-500">
        Statut global casier :{" "}
        <span className={`rounded-full px-2 py-0.5 text-xs ${STATUT_LABELS[profile.statut_verification_casier]?.className}`}>
          {STATUT_LABELS[profile.statut_verification_casier]?.label}
        </span>
      </p>

      <section className="rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-liams-navy">Documents</h2>
        <div className="mt-3 flex flex-col gap-3">
          {(documents ?? []).length === 0 && <p className="text-sm text-gray-500">Aucun document déposé.</p>}
          {(documents ?? []).map((doc) => {
            const statut = STATUT_LABELS[doc.statut] ?? STATUT_LABELS.en_attente;
            return (
              <div key={doc.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-2 text-sm">
                <span>
                  {DOCUMENT_LABELS[doc.type] ?? doc.type}{" "}
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${statut.className}`}>{statut.label}</span>
                </span>
                <div className="flex gap-2">
                  <form action={validerDocument}>
                    <input type="hidden" name="document_id" value={doc.id} />
                    <input type="hidden" name="professional_id" value={id} />
                    <input type="hidden" name="type" value={doc.type} />
                    <input type="hidden" name="statut" value="valide" />
                    <button type="submit" className="rounded-full bg-green-600 px-3 py-1 text-xs text-white">
                      Valider
                    </button>
                  </form>
                  <form action={validerDocument}>
                    <input type="hidden" name="document_id" value={doc.id} />
                    <input type="hidden" name="professional_id" value={id} />
                    <input type="hidden" name="type" value={doc.type} />
                    <input type="hidden" name="statut" value="refuse" />
                    <button type="submit" className="rounded-full bg-red-600 px-3 py-1 text-xs text-white">
                      Refuser
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border-2 border-liams-teal/30 bg-liams-teal/5 p-6">
        <h2 className="text-lg font-semibold text-liams-navy">Justificatif Xtras</h2>
        {qualification?.declare_qualifie ? (
          <>
            <p className="mt-2 text-sm text-gray-700">
              Type : {qualification.type_justificatif} —{" "}
              <span className={`rounded-full px-2 py-0.5 text-xs ${STATUT_LABELS[qualification.statut]?.className}`}>
                {STATUT_LABELS[qualification.statut]?.label}
              </span>
            </p>
            <div className="mt-3 flex gap-2">
              <form action={validerQualificationXtra}>
                <input type="hidden" name="professional_id" value={id} />
                <input type="hidden" name="statut" value="valide" />
                <button type="submit" className="rounded-full bg-green-600 px-3 py-1 text-xs text-white">
                  Valider
                </button>
              </form>
              <form action={validerQualificationXtra}>
                <input type="hidden" name="professional_id" value={id} />
                <input type="hidden" name="statut" value="refuse" />
                <button type="submit" className="rounded-full bg-red-600 px-3 py-1 text-xs text-white">
                  Refuser
                </button>
              </form>
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-gray-500">Ce professionnel n&apos;a pas déclaré de qualification Xtras.</p>
        )}
      </section>

      {/* Trace de ce qui a été porté à la connaissance du professionnel :
          c'est ce qu'on cherchera le jour où un incident sera examiné. */}
      <section className="rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-liams-navy">
          Fiches sanitaires consultées
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Confirmations de lecture. Une confirmation se périme si la famille
          modifie la fiche : le professionnel doit alors la relire.
        </p>
        {(lectures ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">Aucune fiche confirmée lue.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-1 text-sm">
            {(lectures ?? []).map((l, i) => (
              <li key={i} className="flex justify-between border-b border-gray-100 py-1">
                <span>
                  {(l.enfants as unknown as { prenom: string } | null)?.prenom ??
                    "Enfant supprimé"}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(l.lu_le).toLocaleString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-liams-navy">
          Spécialités demandées
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Ces badges ne sont pas visibles des parents tant qu&apos;ils ne sont pas
          validés. À contrôler au vu des justificatifs déposés ci-dessus :
          attestation de contrat, certificat de formation, attestation
          d&apos;employeur.
        </p>

        {demandesEnAttente.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">Aucune demande en attente.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {demandesEnAttente.map((demande) => (
              <div
                key={demande.badge_code}
                className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
              >
                <span className="text-sm font-medium text-liams-navy">
                  {libelleParCode.get(demande.badge_code) ?? demande.badge_code}
                  {demande.demande_le && (
                    <span className="ml-2 text-xs font-normal text-gray-500">
                      demandé le{" "}
                      {new Date(demande.demande_le).toLocaleDateString("fr-FR")}
                    </span>
                  )}
                </span>
                <div className="flex gap-2">
                  <form action={traiterDemandeBadge}>
                    <input type="hidden" name="professional_id" value={id} />
                    <input type="hidden" name="badge_code" value={demande.badge_code} />
                    <input type="hidden" name="decision" value="valider" />
                    <button
                      type="submit"
                      className="rounded-full bg-green-600 px-3 py-1 text-xs text-white"
                    >
                      Valider
                    </button>
                  </form>
                  <form action={traiterDemandeBadge}>
                    <input type="hidden" name="professional_id" value={id} />
                    <input type="hidden" name="badge_code" value={demande.badge_code} />
                    <input type="hidden" name="decision" value="refuser" />
                    <button
                      type="submit"
                      className="rounded-full bg-red-600 px-3 py-1 text-xs text-white"
                    >
                      Refuser
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-liams-navy">Badges</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {(badges ?? []).map((badge) => {
            const attribue = badgesAttribuesSet.has(badge.code);
            return (
              <form action={toggleBadge} key={badge.code}>
                <input type="hidden" name="professional_id" value={id} />
                <input type="hidden" name="badge_code" value={badge.code} />
                <input type="hidden" name="coche" value={(!attribue).toString()} />
                <button
                  type="submit"
                  className={`rounded-full border px-3 py-1 text-xs ${
                    attribue
                      ? "border-liams-teal bg-liams-teal text-white"
                      : "border-gray-300 text-gray-600"
                  }`}
                >
                  {attribue ? "✓ " : "+ "}
                  {badge.label}
                </button>
              </form>
            );
          })}
        </div>
      </section>

      <NavigationBas href="/admin/professionnels" label="Liste des professionnels" />
    </div>
  );
}
