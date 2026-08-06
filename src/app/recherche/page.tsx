import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { NavigationBas } from "@/components/NavigationBas";

/** Le choix qui précède toute recherche.
 *
 * Un parent arrivait jusqu'ici directement sur le calendrier, sans savoir
 * qu'une garde imprévue se demande autrement qu'un contrat de plusieurs mois.
 * Les deux besoins n'ont ni le même délai, ni les mêmes professionnels
 * disponibles, ni la même urgence à décider.
 *
 * Longue durée et ponctuel partagent en revanche la même page : la période
 * étant fixée par le parent, ils ne se distinguent que par ce qu'il y déclare.
 */
export default async function RecherchePage() {
  const { supabase, user } = await requireUser("parent");

  const { count: nbBesoins } = await supabase
    .from("besoins_garde")
    .select("id", { count: "exact", head: true })
    .eq("parent_id", user.id);

  const dejaDesBesoins = (nbBesoins ?? 0) > 0;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold text-liams-navy">
          De quel accueil avez-vous besoin ?
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Le chemin n&apos;est pas le même selon que vous cherchez quelqu&apos;un
          pour ce soir ou pour l&apos;année.
        </p>
      </div>

      <Choix
        href="/planning"
        titre="Accueil longue durée ou ponctuel"
        description="Un contrat sur plusieurs mois, quelques matinées par semaine, ou une garde d'un soir. Vous déclarez vos besoins, nous vous proposons les professionnels qui y répondent."
        principal
      />

      <Choix
        href="/recherche/urgence"
        titre="Accueil d'urgence"
        description="Une garde imprévue, dans les heures qui viennent. Les professionnels dont un créneau d'urgence est ouvert vous sont proposés, ceux de votre réseau en premier."
      />

      {dejaDesBesoins && (
        <p className="text-sm text-gray-500">
          Vous avez déjà déclaré des besoins —{" "}
          <Link href="/planning" className="text-liams-navy underline">
            retourner directement à mon calendrier
          </Link>
          .
        </p>
      )}

      <NavigationBas />
    </div>
  );
}

function Choix({
  href,
  titre,
  description,
  principal = false,
}: {
  href: string;
  titre: string;
  description: string;
  principal?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col gap-2 rounded-xl border p-6 transition-colors ${
        principal
          ? "border-liams-teal bg-liams-teal/5 hover:border-liams-navy"
          : "border-gray-200 hover:border-liams-orange"
      }`}
    >
      <span className="text-lg font-semibold text-liams-navy">{titre}</span>
      <span className="text-sm text-gray-600">{description}</span>
    </Link>
  );
}
