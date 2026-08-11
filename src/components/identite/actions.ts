"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { utilisateurDeLaSession } from "@/lib/auth";

const RESEAU_INJOIGNABLE =
  "Impossible de joindre le service pour l'instant. Vos informations n'ont pas été perdues : réessayez dans un instant.";

export type IdentiteFormState = { error?: string; success?: boolean } | undefined;

export async function enregistrerIdentite(
  _prevState: IdentiteFormState,
  formData: FormData,
): Promise<IdentiteFormState> {
  const supabase = await createClient();
  // Une coupure réseau ne vaut pas une session perdue : la dire « expirée »
  // enverrait se reconnecter quelqu'un qui l'est déjà, en lui faisant perdre
  // ce qu'il vient de saisir.
  const user = await utilisateurDeLaSession(supabase).catch(() => undefined);
  if (user === undefined) return { error: RESEAU_INJOIGNABLE };
  if (!user) return { error: "Session expirée." };

  const prenom = String(formData.get("prenom") ?? "").trim();
  const nom = String(formData.get("nom") ?? "").trim();
  const telephoneSaisi = String(formData.get("telephone") ?? "").trim();

  // Un établissement n'a qu'un nom — sa raison sociale. Le drapeau posé à
  // l'inscription répond avant que la fiche existe ; la fiche répond ensuite,
  // y compris pour un compte qui serait devenu un établissement après coup.
  const { data: fiche } = await supabase
    .from("etablissements")
    .select("professional_id")
    .eq("professional_id", user.id)
    .maybeSingle();
  const estEtablissement =
    Boolean(user.user_metadata?.est_etablissement) || fiche !== null;

  if (!nom) {
    return {
      error: estEtablissement
        ? "Le nom de l'établissement est requis."
        : "Prénom et nom requis.",
    };
  }
  if (!estEtablissement && !prenom) {
    return { error: "Prénom et nom requis." };
  }

  // Espaces, points et tirets sont des habitudes d'écriture, pas des erreurs.
  const telephone = telephoneSaisi.replace(/[\s.\-]/g, "");
  if (!telephone) {
    return {
      error: "Téléphone requis : il doit être possible de vous joindre en cas d'urgence.",
    };
  }
  if (!/^(?:\+\d{6,14}|0\d{9})$/.test(telephone)) {
    return {
      error:
        "Numéro invalide : 10 chiffres commençant par 0, ou format international (+33...).",
    };
  }

  const { error } = await supabase
    .from("identites")
    .upsert({ user_id: user.id, prenom: prenom || null, nom }, { onConflict: "user_id" });

  if (error) return { error: error.message };

  const { error: erreurTelephone } = await supabase
    .from("coordonnees")
    .upsert({ user_id: user.id, telephone }, { onConflict: "user_id" });

  if (erreurTelephone) return { error: erreurTelephone.message };

  // Le prénom s'affiche sur le tableau de bord : il doit y être à jour.
  revalidatePath("/tableau-de-bord");
  revalidatePath("/profil/parent");
  revalidatePath("/profil/professionnel");
  return { success: true };
}

export type DonneesContractuellesFormState =
  | { error?: string; success?: boolean }
  | undefined;

export async function enregistrerDonneesContractuelles(
  _prevState: DonneesContractuellesFormState,
  formData: FormData,
): Promise<DonneesContractuellesFormState> {
  const supabase = await createClient();
  const user = await utilisateurDeLaSession(supabase).catch(() => undefined);
  if (user === undefined) return { error: RESEAU_INJOIGNABLE };
  if (!user) return { error: "Session expirée." };

  const texte = (champ: string) => {
    const valeur = String(formData.get(champ) ?? "").trim();
    return valeur === "" ? null : valeur;
  };

  const siret = texte("siret")?.replace(/\s/g, "") ?? null;
  if (siret && !/^\d{14}$/.test(siret)) {
    return { error: "Le SIRET doit comporter 14 chiffres." };
  }

  const { error } = await supabase.from("donnees_contractuelles").upsert(
    {
      user_id: user.id,
      date_naissance: texte("date_naissance"),
      lieu_naissance: texte("lieu_naissance"),
      statut_juridique: texte("statut_juridique"),
      siret,
      assurance_rc_assureur: texte("assurance_rc_assureur"),
      assurance_rc_numero: texte("assurance_rc_numero"),
      assurance_rc_expiration: texte("assurance_rc_expiration"),
    },
    { onConflict: "user_id" },
  );

  if (error) return { error: error.message };

  revalidatePath("/profil/professionnel");
  return { success: true };
}
