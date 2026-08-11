import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** L'utilisateur de la session, ou `null` s'il n'y en a pas.
 *
 * `getUser()` répond `user: null` dans deux situations que l'appelant ne
 * distingue pas : personne n'est connecté, et l'appel n'a pas abouti. Les
 * confondre revient à déconnecter quelqu'un parce que le réseau a hoqueté —
 * sur un téléphone, cela arrive au milieu d'une saisie, et la personne se
 * retrouve devant un écran de connexion sans comprendre pourquoi.
 *
 * Une panne de transport lève donc une erreur, plutôt que de renvoyer `null` :
 * la session reste valide et la page se retrouve en réessayant. « Je n'ai pas
 * pu vérifier » n'est pas « vous n'êtes pas connectée ».
 */
export async function utilisateurDeLaSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const premier = await supabase.auth.getUser();
  if (!premier.error) return premier.data.user;

  // Supabase répond 400 quand il n'y a simplement pas de session, et 401/403
  // quand le jeton est refusé : ce sont de vraies réponses, qui veulent bien
  // dire « pas connecté ». L'échec de transport, lui, ne porte pas de statut —
  // ou en porte un de la famille 5xx.
  const { name, status } = premier.error;
  const transport =
    name === "AuthRetryableFetchError" || status === undefined || status === 0 || status >= 500;

  if (!transport) return null;

  // Un seul essai de plus. Les coupures observées sont brèves, et une boucle
  // ferait patienter devant une page qui ne s'affiche pas.
  const second = await supabase.auth.getUser();
  if (!second.error) return second.data.user;

  throw new Error("Le service d'authentification est injoignable.", {
    cause: second.error,
  });
}

export async function requireUser(role: "parent" | "professionnel" | "admin") {
  const supabase = await createClient();
  const user = await utilisateurDeLaSession(supabase);

  if (!user) {
    redirect("/connexion");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== role) {
    redirect("/tableau-de-bord");
  }

  return { supabase, user };
}

export async function requireAdmin() {
  return requireUser("admin");
}

/** Le compte professionnel au nom duquel une session travaille.
 *
 * Depuis les établissements, « qui est connecté » et « au nom de qui il
 * travaille » ne sont plus la même chose : une salariée de crèche tient le
 * calendrier de la structure, pas le sien. Tout ce qui désigne le
 * professionnel — `professional_id`, `user_id` d'un profil — doit donc viser
 * `comptePro`, tandis que ce qui désigne la personne — l'acteur d'une entrée
 * de journal, la confirmation de lecture d'une fiche sanitaire — reste sur
 * `user.id`. C'est la ligne que les migrations 0029 et 0030 ont posée en base ;
 * la confondre ici la referait disparaître.
 */
export type CompteProfessionnel = {
  /** Le compte porteur du profil : l'établissement, ou l'utilisateur lui-même. */
  comptePro: string;
  /** Faux pour un compte secondaire. Ce qui engage l'entreprise — tarif,
   *  agrément, documents, badges — lui est fermé, en base comme à l'écran. */
  estTitulaire: boolean;
  /** Agrément dépassé : accueillir sans autorisation du département est
   *  illégal, le compte n'a donc plus accès qu'à sa mise à jour.
   *
   *  Un agrément simplement pas encore renseigné ne verrouille rien. Une
   *  crèche qui vient de s'inscrire doit pouvoir remplir son profil, dont sa
   *  fiche dépend — l'enfermer avant qu'elle ait commencé la laisserait sans
   *  issue. Ce cas-là est tenu par le trigger de la 0033, qui refuse d'ouvrir
   *  le moindre créneau tant que l'agrément manque. */
  agrementExpire: boolean;
  /** La date de fin, pour pouvoir la dire plutôt que de la faire deviner. */
  agrementFin: string | null;
};

export async function compteProfessionnelActif(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<CompteProfessionnel> {
  // `comptes_pilotes()` répond déjà exactement à cette question côté base : on
  // l'interroge plutôt que de rejouer la jointure ici, pour qu'il n'existe
  // qu'une seule définition de « pour qui j'agis » à maintenir.
  const { data } = await supabase.rpc("comptes_pilotes");

  // Une fonction `setof uuid` se sérialise en tableau de chaînes, mais cette
  // lecture décide au nom de quel compte quelqu'un travaille : si la forme
  // était celle d'un tableau d'objets, la comparaison échouerait en silence et
  // désignerait le mauvais compte. On accepte les deux plutôt que de parier.
  const comptes = ((data ?? []) as unknown[])
    .map((ligne) =>
      typeof ligne === "string"
        ? ligne
        : ((ligne as Record<string, unknown>)?.comptes_pilotes as string | undefined),
    )
    .filter((id): id is string => typeof id === "string");

  const etablissement = comptes.find((id) => id !== userId);
  const comptePro = etablissement ?? userId;

  const { data: fiche } = await supabase
    .from("etablissements")
    .select("agrement_fin")
    .eq("professional_id", comptePro)
    .maybeSingle();

  // Comparaison en dates civiles et non en horodatages : l'agrément court
  // jusqu'au soir de son dernier jour, et le verrou tombe le lendemain.
  const aujourdhui = new Date().toISOString().slice(0, 10);

  return {
    comptePro,
    estTitulaire: etablissement === undefined,
    agrementExpire: Boolean(fiche?.agrement_fin) && fiche!.agrement_fin < aujourdhui,
    agrementFin: fiche?.agrement_fin ?? null,
  };
}

/** Le verrou d'agrément, posé sur les écrans professionnels.
 *
 * Accueillir sans autorisation du département est illégal : l'établissement
 * ne garde donc que de quoi remettre son agrément à jour et joindre ses
 * justificatifs. Le refus est doublé en base — les triggers de la 0033
 * refusent tout créneau au-delà de l'échéance — parce qu'un écran qu'on ne
 * voit plus n'empêche pas une requête forgée. */
export async function refuserSiAgrementExpire(compte: CompteProfessionnel) {
  if (compte.agrementExpire) {
    redirect("/profil/etablissement?agrement=expire");
  }
}

/** Comme requireUser, mais accepte plusieurs rôles et renvoie celui de
 * l'utilisateur — pour les pages partagées entre parents et professionnels. */
export async function requireUserParmi(roles: Array<"parent" | "professionnel" | "admin">) {
  const supabase = await createClient();
  const user = await utilisateurDeLaSession(supabase);

  if (!user) {
    redirect("/connexion");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = roles.find((r) => r === profile?.role);
  if (!role) {
    redirect("/tableau-de-bord");
  }

  return { supabase, user, role };
}
