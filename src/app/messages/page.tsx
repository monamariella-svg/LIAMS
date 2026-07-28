import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { repondreMiseEnRelation } from "./actions";

const STATUT_LABELS: Record<string, string> = {
  en_attente: "En attente",
  accepte: "Acceptée",
  refuse: "Refusée",
};

export default async function MessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  const isParent = profile?.role === "parent";

  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .eq(isParent ? "parent_id" : "professional_id", user.id)
    .order("date", { ascending: false });

  const professionalIds = isParent ? (matches ?? []).map((m) => m.professional_id) : [];
  const { data: professionalProfiles } = isParent && professionalIds.length
    ? await supabase.from("professional_profiles").select("*").in("user_id", professionalIds)
    : { data: [] };
  const professionnelsParId = new Map((professionalProfiles ?? []).map((p) => [p.user_id, p]));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <Link href="/tableau-de-bord" className="self-start text-sm text-liams-navy underline">
        ← Retour au tableau de bord
      </Link>
      <h1 className="text-2xl font-semibold text-liams-navy">Mes mises en relation</h1>

      {(matches ?? []).length === 0 && (
        <p className="text-sm text-gray-500">Aucune mise en relation pour le moment.</p>
      )}

      <div className="flex flex-col gap-3">
        {(matches ?? []).map((match) => {
          const professionnel = professionnelsParId.get(match.professional_id);
          return (
            <div key={match.id} className="flex items-center justify-between rounded-xl border border-gray-200 p-4">
              <div>
                <p className="font-medium text-liams-navy">
                  {isParent
                    ? professionnel?.tarif_horaire
                      ? `Professionnel — ${professionnel.tarif_horaire} €/h`
                      : "Professionnel"
                    : "Demande d'un parent"}
                </p>
                <p className="text-xs text-gray-500">{STATUT_LABELS[match.statut] ?? match.statut}</p>
              </div>

              {match.statut === "accepte" && (
                <Link
                  href={`/messages/${match.id}`}
                  className="rounded-full bg-liams-teal px-4 py-1.5 text-sm font-medium text-white hover:opacity-90"
                >
                  Discuter
                </Link>
              )}

              {!isParent && match.statut === "en_attente" && (
                <div className="flex gap-2">
                  <form action={repondreMiseEnRelation}>
                    <input type="hidden" name="match_id" value={match.id} />
                    <input type="hidden" name="reponse" value="accepter" />
                    <button
                      type="submit"
                      className="rounded-full bg-liams-orange px-4 py-1.5 text-sm font-medium text-white hover:opacity-90"
                    >
                      Accepter
                    </button>
                  </form>
                  <form action={repondreMiseEnRelation}>
                    <input type="hidden" name="match_id" value={match.id} />
                    <input type="hidden" name="reponse" value="refuser" />
                    <button
                      type="submit"
                      className="rounded-full border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                    >
                      Refuser
                    </button>
                  </form>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
