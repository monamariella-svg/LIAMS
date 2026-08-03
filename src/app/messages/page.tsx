import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NavigationBas } from "@/components/NavigationBas";
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

  // Sans nom, une liste de mises en relation est une liste d'inconnus.
  const contactIds = (matches ?? []).map((m) =>
    isParent ? m.professional_id : m.parent_id,
  );

  const { data: identites } = contactIds.length
    ? await supabase.from("identites").select("user_id, prenom, nom").in("user_id", contactIds)
    : { data: [] };
  const identiteParId = new Map((identites ?? []).map((i) => [i.user_id, i]));

  const enfantsParParent = new Map<string, string[]>();
  if (!isParent) {
    await Promise.all(
      contactIds.map(async (parentId) => {
        const { data } = await supabase.rpc("prenoms_enfants", { p_parent_id: parentId });
        if (data?.length) enfantsParParent.set(parentId, data as string[]);
      }),
    );
  }

  const professionalIds = isParent ? (matches ?? []).map((m) => m.professional_id) : [];
  const { data: professionalProfiles } = isParent && professionalIds.length
    ? await supabase.from("professional_profiles").select("*").in("user_id", professionalIds)
    : { data: [] };
  const professionnelsParId = new Map((professionalProfiles ?? []).map((p) => [p.user_id, p]));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-liams-navy">Mes mises en relation</h1>

      {(matches ?? []).length === 0 && (
        <p className="text-sm text-gray-500">Aucune mise en relation pour le moment.</p>
      )}

      <div className="flex flex-col gap-3">
        {(matches ?? []).map((match) => {
          const professionnel = professionnelsParId.get(match.professional_id);
          const contactId = isParent ? match.professional_id : match.parent_id;
          const identite = identiteParId.get(contactId);
          const nomAffiche =
            [identite?.prenom, identite?.nom].filter(Boolean).join(" ") ||
            (isParent ? "Professionnel" : "Demande d'un parent");
          const enfants = enfantsParParent.get(contactId) ?? [];
          return (
            <div key={match.id} className="flex items-center justify-between rounded-xl border border-gray-200 p-4">
              <div>
                <p className="font-medium text-liams-navy">
                  {nomAffiche}
                  {isParent && professionnel?.tarif_horaire
                    ? ` — ${professionnel.tarif_horaire} €/h`
                    : ""}
                </p>
                {enfants.length > 0 && (
                  <p className="text-xs text-gray-600">
                    {enfants.length > 1 ? "Enfants" : "Enfant"} : {enfants.join(", ")}
                  </p>
                )}
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

      <NavigationBas />
    </div>
  );
}
