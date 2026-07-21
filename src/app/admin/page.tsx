import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { computeProfessionalProgress } from "@/lib/progress";

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
  ]);

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-liams-navy">Tableau de bord admin</h1>
        <Link href="/admin/professionnels" className="text-sm text-liams-navy underline">
          Vérification des professionnels
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Parents inscrits" value={nbParents ?? 0} />
        <StatCard label="Professionnels inscrits" value={nbProfessionnels ?? 0} />
        <StatCard label="Mises en relation" value={nbMatches ?? 0} />
        <StatCard label="Gardes d'urgence déclenchées" value={nbGardesUrgence ?? 0} />
        <StatCard label="Complétion moyenne des profils pro" value={`${tauxCompletionMoyen}%`} />
        <StatCard label="Score NPS moyen" value={scoreNpsMoyen ?? "—"} sousTitre={`${scoresNps.length} réponse(s)`} />
      </div>

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
