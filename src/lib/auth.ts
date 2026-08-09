import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireUser(role: "parent" | "professionnel" | "admin") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  return {
    comptePro: etablissement ?? userId,
    estTitulaire: etablissement === undefined,
  };
}

/** Comme requireUser, mais accepte plusieurs rôles et renvoie celui de
 * l'utilisateur — pour les pages partagées entre parents et professionnels. */
export async function requireUserParmi(roles: Array<"parent" | "professionnel" | "admin">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
