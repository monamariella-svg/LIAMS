import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { NavigationBas } from "@/components/NavigationBas";
import { traiterSignalement, masquerProfil } from "../actions";

const MOTIFS: Record<string, { label: string; grave?: boolean }> = {
  securite_enfant: { label: "Sécurité d'un enfant", grave: true },
  contenu_inapproprie: { label: "Contenu déplacé" },
  informations_fausses: { label: "Informations fausses" },
  usurpation_identite: { label: "Usurpation d'identité" },
  autre: { label: "Autre" },
};

/** Les signalements reçus.
 *
 * Rien n'étant contrôlé avant publication, c'est ici que se rattrape ce qui ne
 * devrait pas être en ligne. Les signalements touchant à la sécurité d'un
 * enfant passent en tête et se voient de loin : noyés parmi des photos
 * déplacées, ils attendraient leur tour. */
export default async function AdminSignalementsPage() {
  const { supabase } = await requireAdmin();

  const { data: signalements } = await supabase
    .from("signalements")
    .select("*")
    .order("statut")
    .order("created_at", { ascending: false });

  const ids = [
    ...new Set((signalements ?? []).flatMap((s) => [s.cible_id, s.auteur_id] as string[])),
  ];
  const { data: identites } = ids.length
    ? await supabase.from("identites").select("user_id, prenom, nom").in("user_id", ids)
    : { data: [] };
  const nomDe = (userId: string) => {
    const i = (identites ?? []).find((x) => x.user_id === userId);
    return [i?.prenom, i?.nom].filter(Boolean).join(" ") || "Compte sans nom";
  };

  const { data: masques } = await supabase
    .from("professional_profiles")
    .select("user_id, masque, masque_le, masque_motif")
    .eq("masque", true);
  const estMasque = new Set((masques ?? []).map((m) => m.user_id as string));

  // La gravité d'abord, l'ancienneté ensuite. Un signalement « sécurité » de ce
  // matin passe avant une photo déplacée d'hier.
  const aTraiter = (signalements ?? [])
    .filter((s) => s.statut === "nouveau")
    .sort((a, b) =>
      Number(b.motif === "securite_enfant") - Number(a.motif === "securite_enfant") ||
      a.created_at.localeCompare(b.created_at),
    );
  const traites = (signalements ?? []).filter((s) => s.statut !== "nouveau");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-400">Modération</p>
        <h1 className="text-2xl font-semibold text-liams-navy">
          Signalements ({aTraiter.length} à traiter)
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Une fiche signalée reste visible jusqu&apos;à votre décision : un
          masquage automatique se retournerait contre les professionnels, trois
          signalements complices suffisant à écarter une concurrente.
        </p>
      </div>

      {aTraiter.length === 0 && (
        <p className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-500">
          Aucun signalement en attente.
        </p>
      )}

      {aTraiter.map((s) => {
        const motif = MOTIFS[s.motif] ?? { label: s.motif };
        return (
          <section
            key={s.id}
            className={`rounded-xl border p-6 ${
              motif.grave ? "border-red-300 bg-red-50" : "border-gray-200"
            }`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-liams-navy">
                <Link href={`/admin/professionnels/${s.cible_id}`} className="underline">
                  {nomDe(s.cible_id)}
                </Link>
                {estMasque.has(s.cible_id) && (
                  <span className="ml-2 rounded-full bg-gray-800 px-2 py-0.5 text-xs text-white">
                    déjà masquée
                  </span>
                )}
              </h2>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  motif.grave ? "bg-red-200 text-red-900" : "bg-gray-100 text-gray-700"
                }`}
              >
                {motif.label}
              </span>
            </div>

            <p className="mt-1 text-xs text-gray-500">
              Signalé par {nomDe(s.auteur_id)} le{" "}
              {new Date(s.created_at).toLocaleDateString("fr-FR")}
            </p>

            {s.commentaire && (
              <p className="mt-3 rounded-lg bg-white/70 p-3 text-sm text-gray-800">
                {s.commentaire}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-end gap-3">
              {!estMasque.has(s.cible_id) && (
                <form action={masquerProfil} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="professional_id" value={s.cible_id} />
                  <input type="hidden" name="signalement_id" value={s.id} />
                  <label className="flex flex-col gap-1 text-xs text-gray-500">
                    Motif du masquage (visible de vous seul)
                    <input
                      name="motif"
                      required
                      className="w-72 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                    />
                  </label>
                  <button
                    type="submit"
                    className="rounded-full bg-red-600 px-4 py-1.5 text-sm font-medium text-white"
                  >
                    Masquer la fiche
                  </button>
                </form>
              )}

              <form action={traiterSignalement}>
                <input type="hidden" name="signalement_id" value={s.id} />
                <input type="hidden" name="statut" value="rejete" />
                <button
                  type="submit"
                  className="rounded-full border border-gray-300 px-4 py-1.5 text-sm text-gray-600"
                >
                  Sans suite
                </button>
              </form>
            </div>
          </section>
        );
      })}

      {traites.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-liams-navy">Déjà traités</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-gray-600">
            {traites.map((s) => (
              <li key={s.id}>
                {nomDe(s.cible_id)} — {(MOTIFS[s.motif] ?? { label: s.motif }).label} ·{" "}
                {s.statut === "traite" ? "traité" : "sans suite"}
              </li>
            ))}
          </ul>
        </section>
      )}

      <NavigationBas />
    </div>
  );
}
