import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PhotoProfil } from "@/components/PhotoProfil";
import { NavigationBas } from "@/components/NavigationBas";
import { repondreReseau } from "./actions";

const STATUT_LABELS: Record<string, string> = {
  en_attente: "En attente",
  accepte: "Accepté",
  refuse: "Refusé",
};

export default async function ReseauPage() {
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

  const { data: reseaux } = await supabase
    .from("parent_networks")
    .select("*")
    .eq(isParent ? "parent_id" : "professional_id", user.id)
    .order("date", { ascending: false });

  const professionalIds = isParent ? (reseaux ?? []).map((r) => r.professional_id) : [];
  const { data: professionalProfiles } = isParent && professionalIds.length
    ? await supabase.from("professional_profiles").select("*").in("user_id", professionalIds)
    : { data: [] };
  const professionnelsParId = new Map((professionalProfiles ?? []).map((p) => [p.user_id, p]));

  const { data: photos } = professionalIds.length
    ? await supabase
        .from("professional_photos")
        .select("professional_id, fichier_url")
        .in("professional_id", professionalIds)
        .order("ordre")
    : { data: [] };
  // La requête est triée par ordre : la première photo vue pour un pro est la sienne.
  const photoParPro = new Map<string, string>();
  for (const photo of photos ?? []) {
    if (!photoParPro.has(photo.professional_id)) {
      photoParPro.set(photo.professional_id, photo.fichier_url);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-liams-navy">Mon réseau de confiance</h1>

      {(reseaux ?? []).length === 0 && (
        <p className="text-sm text-gray-500">
          {isParent
            ? "Aucun professionnel dans votre réseau — ajoutez-en un depuis une conversation."
            : "Aucune demande de réseau pour le moment."}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {(reseaux ?? []).map((reseau) => {
          const professionnel = professionnelsParId.get(reseau.professional_id);
          return (
            <div key={`${reseau.parent_id}-${reseau.professional_id}`} className="flex items-center justify-between rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                {isParent && <PhotoProfil fichierUrl={photoParPro.get(reseau.professional_id)} />}
                <div>
                  <p className="font-medium text-liams-navy">
                    {isParent ? "Professionnel" : "Parent"}
                  </p>
                  <p className="text-xs text-gray-500">{STATUT_LABELS[reseau.statut] ?? reseau.statut}</p>
                </div>
              </div>

              {reseau.statut === "accepte" && isParent && (
                <Link
                  href={`/reseau/${reseau.professional_id}`}
                  className="rounded-full bg-liams-teal px-4 py-1.5 text-sm font-medium text-white hover:opacity-90"
                >
                  Voir le planning
                </Link>
              )}

              {!isParent && reseau.statut === "en_attente" && (
                <div className="flex gap-2">
                  <form action={repondreReseau}>
                    <input type="hidden" name="parent_id" value={reseau.parent_id} />
                    <input type="hidden" name="reponse" value="accepter" />
                    <button type="submit" className="rounded-full bg-liams-orange px-4 py-1.5 text-sm font-medium text-white hover:opacity-90">
                      Accepter
                    </button>
                  </form>
                  <form action={repondreReseau}>
                    <input type="hidden" name="parent_id" value={reseau.parent_id} />
                    <input type="hidden" name="reponse" value="refuser" />
                    <button type="submit" className="rounded-full border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                      Refuser
                    </button>
                  </form>
                </div>
              )}
              {isParent && professionnel?.tarif_horaire && (
                <p className="text-xs text-gray-400">
                  {professionnel.tarif_horaire} €/h
                  {professionnel.tarif_horaire_urgence &&
                    ` · ${professionnel.tarif_horaire_urgence} €/h en urgence`}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <NavigationBas />
    </div>
  );
}
