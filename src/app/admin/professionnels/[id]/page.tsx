import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { validerDocument, validerQualificationXtra, toggleBadge } from "../../actions";

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
  ] = await Promise.all([
    supabase.from("professional_profiles").select("*").eq("user_id", id).maybeSingle(),
    supabase.from("professional_documents").select("*").eq("professional_id", id).order("date_upload"),
    supabase.from("professional_qualification_xtra").select("*").eq("professional_id", id).maybeSingle(),
    supabase.from("badges").select("*").eq("source", "manuel"),
    supabase.from("professional_badges").select("badge_code").eq("professional_id", id),
  ]);

  if (!profile) notFound();

  const badgesAttribuesSet = new Set((badgesAttribues ?? []).map((b) => b.badge_code));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <div className="flex gap-4">
        <Link href="/admin" className="text-sm text-liams-navy underline">
          ← Retour au tableau de bord admin
        </Link>
        <Link href="/admin/professionnels" className="text-sm text-liams-navy underline">
          ← Retour à la liste des professionnels
        </Link>
      </div>
      <h1 className="text-2xl font-semibold text-liams-navy">Vérification professionnel</h1>
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
    </div>
  );
}
