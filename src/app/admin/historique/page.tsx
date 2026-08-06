import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { NavigationBas } from "@/components/NavigationBas";

const LIBELLES: Record<string, string> = {
  demande_creneaux: "Demande de créneaux",
  demande_urgence: "Demande de garde d'urgence",
  demande_recurrente: "Demande de réservation récurrente",
  creneaux_valides: "Créneaux traités par le professionnel",
  urgence_confirmee: "Garde d'urgence confirmée",
  urgence_refusee: "Garde d'urgence refusée",
  recurrente_validee: "Réservation récurrente validée",
  recurrente_refusee: "Réservation récurrente refusée",
  annulation_parent: "Annulation par le parent",
  retrait_enfant: "Enfant retiré d'une réservation",
  annulation_pro_creneau: "Créneau annulé par le professionnel",
  annulation_pro_serie: "Série annulée par le professionnel",
};

/** Historique des réservations, par professionnel et par parent.
 *
 * Ce que l'état courant d'une réservation ne dit pas : quand elle a changé,
 * qui l'a changée, et avec quel motif. C'est ce qu'on cherche en cas de
 * litige, et c'est la seule raison d'être de cette page. */
export default async function HistoriquePage({
  searchParams,
}: {
  searchParams: Promise<{ personne?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const { personne } = await searchParams;

  let requete = supabase
    .from("evenements_reservation")
    .select("*")
    .order("date", { ascending: false })
    .limit(200);

  if (personne) {
    requete = requete.or(`parent_id.eq.${personne},professional_id.eq.${personne}`);
  }

  const { data: evenements } = await requete;

  // Noms des personnes citées, pour ne pas afficher une colonne d'identifiants.
  const ids = [
    ...new Set(
      (evenements ?? []).flatMap((e) =>
        [e.parent_id, e.professional_id, e.acteur_id].filter(Boolean),
      ),
    ),
  ] as string[];

  const { data: identites } = ids.length
    ? await supabase.from("identites").select("user_id, prenom, nom").in("user_id", ids)
    : { data: [] };
  const nomParId = new Map(
    (identites ?? []).map((i) => [
      i.user_id,
      [i.prenom, i.nom].filter(Boolean).join(" ") || "Identité non renseignée",
    ]),
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold text-liams-navy">
          Historique des réservations
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Chaque étape est consignée au moment où elle se produit et n&apos;est
          jamais modifiée ensuite. Les 200 dernières sont affichées.
        </p>
      </div>

      {personne && (
        <p className="text-sm">
          Filtré sur <strong>{nomParId.get(personne) ?? personne}</strong> —{" "}
          <Link href="/admin/historique" className="text-liams-navy underline">
            voir tout
          </Link>
        </p>
      )}

      {(evenements ?? []).length === 0 && (
        <p className="rounded-lg bg-gray-50 px-4 py-6 text-sm text-gray-500">
          Aucune étape consignée. Le journal ne porte que ce qui s&apos;est
          produit depuis sa mise en service.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {(evenements ?? []).map((e) => (
          <article key={e.id} className="rounded-lg border border-gray-200 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-liams-navy">
                {LIBELLES[e.type] ?? e.type}
              </span>
              <span className="text-xs text-gray-500">
                {new Date(e.date).toLocaleString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>

            <p className="mt-1 text-xs text-gray-600">
              {e.parent_id && (
                <>
                  Parent :{" "}
                  <Link
                    href={`/admin/historique?personne=${e.parent_id}`}
                    className="underline"
                  >
                    {nomParId.get(e.parent_id) ?? e.parent_id}
                  </Link>{" "}
                </>
              )}
              {e.professional_id && (
                <>
                  · Professionnel :{" "}
                  <Link
                    href={`/admin/historique?personne=${e.professional_id}`}
                    className="underline"
                  >
                    {nomParId.get(e.professional_id) ?? e.professional_id}
                  </Link>{" "}
                </>
              )}
              {e.acteur_id && <>· À l&apos;initiative de {nomParId.get(e.acteur_id)}</>}
            </p>

            {/* Le détail est libre par nature : les étapes n'ont pas les mêmes
                attributs. On l'affiche tel quel plutôt que d'en perdre. */}
            {e.detail && Object.keys(e.detail).length > 0 && (
              <dl className="mt-2 flex flex-col gap-0.5 text-xs text-gray-600">
                {Object.entries(e.detail as Record<string, unknown>)
                  .filter(([, v]) => v !== null && v !== "" && !(Array.isArray(v) && !v.length))
                  .map(([cle, valeur]) => (
                    <div key={cle} className="flex gap-2">
                      <dt className="font-mono text-gray-400">{cle}</dt>
                      <dd className="whitespace-pre-wrap break-all">
                        {Array.isArray(valeur) ? valeur.join(", ") : String(valeur)}
                      </dd>
                    </div>
                  ))}
              </dl>
            )}
          </article>
        ))}
      </div>

      <NavigationBas href="/admin" label="Tableau de bord admin" />
    </div>
  );
}
