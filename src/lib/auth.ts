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

/** Le foyer au nom duquel une session parent travaille.
 *
 * Même partage que du côté professionnel, pour une autre raison : un enfant a
 * deux parents, et le modèle n'en connaissait qu'un. Ce qui désigne l'enfant —
 * `parent_id` sur `enfants`, et tout ce qui pend dessous — vise donc
 * `compteFoyer`, tandis que ce qui désigne la personne — une garde qu'elle
 * organise, un message qu'elle envoie — reste sur `user.id`.
 *
 * La différence avec un établissement tient là : deux salariées font le même
 * travail et voient le même calendrier ; deux parents séparés ne se doivent
 * pas cette transparence. D'où les deux drapeaux de partage, réglés chacun de
 * son côté. C'est la ligne posée par la 0047 en base.
 */
export type Foyer = {
  /** Le compte qui porte les enfants : le parent principal, ou soi-même. */
  compteFoyer: string;
  /** Faux pour un second parent rattaché. Rattacher et retirer lui sont
   *  fermés : une séparation se décide rarement à deux. */
  estPrincipal: boolean;
  /** L'autre parent, s'il y en a un. */
  autreParent: string | null;
  /** Où en est le rattachement. Un lien demandé n'ouvre rien : tant qu'il n'est
   *  pas accepté, `compteFoyer` reste soi-même et `autrePartage` reste faux. */
  statut: "en_attente" | "accepte" | null;
  /** Est-ce que je montre mes gardes à l'autre. */
  jePartage: boolean;
  /** Est-ce que l'autre me montre les siennes. */
  autrePartage: boolean;
  /** Qui a l'enfant les semaines paires (ISO), quand la garde alterne. */
  gardeSemainesPaires: string | null;
};

export async function foyerParent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<Foyer> {
  // Une seule ligne peut me concerner : `attacher_second_parent()` refuse un
  // compte déjà engagé ailleurs, dans un sens comme dans l'autre. On lit tout
  // de même en liste plutôt qu'en `maybeSingle()` : cette lecture décide de
  // quels enfants s'affichent, et la faire échouer sur une ligne en trop
  // fermerait le profil entier au lieu d'en montrer l'essentiel.
  const { data } = await supabase
    .from("co_parents")
    // Chaîne littérale d'un seul tenant : concaténée, PostgREST ne sait plus
    // en déduire le type des colonnes et rend un tableau d'erreurs.
    .select("parent_principal_id, parent_secondaire_id, statut, garde_semaines_paires, principal_partage_planning, secondaire_partage_planning")
    .or(`parent_principal_id.eq.${userId},parent_secondaire_id.eq.${userId}`)
    .order("created_at")
    .limit(1);

  const lien = data?.[0];

  if (!lien) {
    return {
      compteFoyer: userId,
      estPrincipal: true,
      autreParent: null,
      statut: null,
      jePartage: true,
      autrePartage: false,
      gardeSemainesPaires: null,
    };
  }

  const estPrincipal = lien.parent_principal_id === userId;
  const statut = lien.statut as "en_attente" | "accepte";
  const accepte = statut === "accepte";

  return {
    // Tant que l'autre n'a pas répondu, on travaille pour soi seul. C'est la
    // règle en base depuis la 0047 — `foyers_pilotes()` ignore une demande en
    // attente — et la redire ici évite d'afficher une fratrie que la requête
    // suivante refuserait de toute façon.
    compteFoyer: accepte ? lien.parent_principal_id : userId,
    estPrincipal,
    // L'autre partie du lien, quel que soit son état : l'écran doit pouvoir
    // dire « invitation envoyée » aussi bien que « rattaché ».
    autreParent: estPrincipal ? lien.parent_secondaire_id : lien.parent_principal_id,
    statut,
    jePartage: estPrincipal
      ? lien.principal_partage_planning
      : lien.secondaire_partage_planning,
    autrePartage:
      accepte &&
      (estPrincipal ? lien.secondaire_partage_planning : lien.principal_partage_planning),
    gardeSemainesPaires: lien.garde_semaines_paires,
  };
}
