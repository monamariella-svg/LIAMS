"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type IdentiteFormState = { error?: string; success?: boolean } | undefined;

export async function enregistrerIdentite(
  _prevState: IdentiteFormState,
  formData: FormData,
): Promise<IdentiteFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée." };

  const prenom = String(formData.get("prenom") ?? "").trim();
  const nom = String(formData.get("nom") ?? "").trim();

  if (!prenom || !nom) {
    return { error: "Prénom et nom requis." };
  }

  const { error } = await supabase
    .from("identites")
    .upsert({ user_id: user.id, prenom, nom }, { onConflict: "user_id" });

  if (error) return { error: error.message };

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
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
