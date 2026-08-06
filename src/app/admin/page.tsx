import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { computeProfessionalProgress } from "@/lib/progress";
import { TuileNavigation } from "@/components/TuileNavigation";

export default async function AdminDashboardPage() {
  const { supabase } = await requireAdmin();

  const [
    { count: nbParents },
    { count: nbProfessionnels },
    { count: nbMatches },
    { count: nbGardesUrgence },
    { data: professionalProfiles },
    { data: documents },
    { data: qualifications },
    { data: photos },
    { data: feedbacks },
    { data: demandesBadges },
  ] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "parent"),
    supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "professionnel"),
    supabase.from("matches").select("id", { count: "exact", head: true }),
    supabase.from("urgent_bookings").select("id", { count: "exact", head: true }),
    supabase.from("professional_profiles").select("user_id, adresse, tarif_horaire"),
    supabase.from("professional_documents").select("professional_id, type"),
    supabase.from("professional_qualification_xtra").select("professional_id"),
    supabase.from("professional_photos").select("professional_id"),
    supabase.from("feedback_pilote").select("*").not("date_reponse", "is", null),
    supabase
      .from("professional_badges")
      .select("professional_id, badge_code, demande_le, badges(label)")
      .eq("statut", "en_attente")
      .order("demande_le"),
  ]);

  // Savoir quel badge est demandé sans savoir par qui ne sert à rien.
  const { data: identites } = (demandesBadges ?? []).length
    ? await supabase
        .from("identites")
        .select("user_id, prenom, nom")
        .in("user_id", (demandesBadges ?? []).map((d) => d.professional_id))
    : { data: [] };
  const identiteParId = new Map((identites ?? []).map((i) => [i.user_id, i]));

  const docsParPro = new Map<string, string[]>();
  (documents ?? []).forEach((d) => {
    docsParPro.set(d.professional_id, [...(docsParPro.get(d.professional_id) ?? []), d.type]);
  });
  const qualifiedSet = new Set((qualifications ?? []).map((q) => q.professional_id));
  const photosParPro = new Set((photos ?? []).map((p) => p.professional_id));

  const completions = (professionalProfiles ?? []).map((p) => {
    const types = docsParPro.get(p.user_id) ?? [];
    const { pourcentage } = computeProfessionalProgress({
      infosGeneralesCompletes: Boolean(p.adresse && p.tarif_horaire),
      casierDepose: types.includes("casier"),
      cvDepose: types.includes("cv"),
      diplomeOuCertificatDepose: types.includes("diplome") || types.includes("certificat"),
      questionXtrasRepondue: qualifiedSet.has(p.user_id),
      aUnePhoto: photosParPro.has(p.user_id),
    });
    return pourcentage;
  });
  const tauxCompletionMoyen = completions.length
    ? Math.round(completions.reduce((a, b) => a + b, 0) / completions.length)
    : 0;

  const scoresNps = (feedbacks ?? []).map((f) => f.score_nps).filter((s): s is number => s !== null);
  const scoreNpsMoyen = scoresNps.length
    ? Math.round((scoresNps.reduce((a, b) => a + b, 0) / scoresNps.length) * 10) / 10
    : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <h1 className="text-2xl font-semibold text-liams-navy">Tableau de bord admin</h1>

      <div className="grid gap-3 sm:grid-cols-3">
        <TuileNavigation
          href="/admin/professionnels"
          icone="verification"
          titre="Vérification des professionnels"
          description="Casiers, diplômes, spécialités"
          accent
        />
        <TuileNavigation
          href="/admin/historique"
          icone="historique"
          titre="Historique des réservations"
          description="Qui a fait quoi, et quand"
        />
        <TuileNavigation
          href="/admin/diagnostic-email"
          icone="messages"
          titre="Diagnostic des emails"
          description="Ce que le serveur voit réellement"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Parents inscrits" value={nbParents ?? 0} />
        <StatCard label="Professionnels inscrits" value={nbProfessionnels ?? 0} />
        <StatCard label="Mises en relation" value={nbMatches ?? 0} />
        <StatCard label="Gardes d'urgence déclenchées" value={nbGardesUrgence ?? 0} />
        <StatCard label="Complétion moyenne des profils pro" value={`${tauxCompletionMoyen}%`} />
        <StatCard label="Score NPS moyen" value={scoreNpsMoyen ?? "—"} sousTitre={`${scoresNps.length} réponse(s)`} />
      </div>

      {/* Une demande non traitée est un badge qui n'apparaît pas : le
          professionnel attend, et le parent ne voit pas l'information. */}
      <section className="rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-liams-navy">
            Spécialités à contrôler
          </h2>
          {(demandesBadges ?? []).length > 0 && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
              {demandesBadges!.length} en attente
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-col gap-2">
          {(demandesBadges ?? []).length === 0 && (
            <p className="text-sm text-gray-500">Aucune demande en attente.</p>
          )}
          {(demandesBadges ?? []).map((d) => (
            <Link
              key={`${d.professional_id}-${d.badge_code}`}
              href={`/admin/professionnels/${d.professional_id}`}
              className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-2 text-sm hover:border-liams-orange"
            >
              <span className="flex flex-col">
                <span className="font-medium text-liams-navy">
                  {(() => {
                    const i = identiteParId.get(d.professional_id);
                    return (
                      [i?.prenom, i?.nom].filter(Boolean).join(" ") ||
                      "Identité non renseignée"
                    );
                  })()}
                </span>
                <span className="text-xs text-gray-600">
                  {(d.badges as unknown as { label: string } | null)?.label ?? d.badge_code}
                </span>
              </span>
              <span className="text-xs text-gray-500">
                {d.demande_le
                  ? new Date(d.demande_le).toLocaleDateString("fr-FR")
                  : "—"}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-liams-navy">Réponses NPS brutes</h2>
        <div className="mt-3 flex flex-col gap-2">
          {(feedbacks ?? []).length === 0 && <p className="text-sm text-gray-500">Aucune réponse pour le moment.</p>}
          {(feedbacks ?? []).map((f) => (
            <div key={f.id} className="rounded-lg border border-gray-100 px-4 py-2 text-sm">
              <p className="font-medium">Score : {f.score_nps}/10</p>
              {f.reponses_complementaires && (
                <p className="text-gray-500">{JSON.stringify(f.reponses_complementaires)}</p>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  sousTitre,
}: {
  label: string;
  value: string | number;
  sousTitre?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <p className="text-2xl font-semibold text-liams-navy">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
      {sousTitre && <p className="text-xs text-gray-400">{sousTitre}</p>}
    </div>
  );
}
