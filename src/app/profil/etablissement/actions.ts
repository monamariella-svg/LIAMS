"use server";

import { revalidatePath } from "next/cache";
import { compteProfessionnelActif, requireUser } from "@/lib/auth";

export type EtablissementFormState =
  | { error?: string; success?: boolean; message?: string }
  | undefined;

export async function enregistrerEtablissement(
  _prevState: EtablissementFormState,
  formData: FormData,
): Promise<EtablissementFormState> {
  const { supabase, user } = await requireUser("professionnel");
  const { estTitulaire } = await compteProfessionnelActif(supabase, user.id);

  // La règle en base refuserait de toute façon ; la vérifier ici permet de le
  // dire en français plutôt que de renvoyer un refus de policy.
  if (!estTitulaire) {
    return { error: "Seul le compte principal peut modifier la fiche de l'établissement." };
  }

  const raisonSociale = String(formData.get("raison_sociale") ?? "").trim();
  if (!raisonSociale) {
    return { error: "La raison sociale est nécessaire." };
  }

  // La fiche s'accroche au profil professionnel : sans lui, la clé étrangère
  // refuserait l'insertion avec un message que personne ne peut interpréter.
  const { data: profil } = await supabase
    .from("professional_profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profil) {
    return {
      error:
        "Renseignez d'abord votre profil professionnel (adresse et tarif) : la fiche de l'établissement s'y rattache.",
    };
  }

  const nombreOuNull = (champ: string) => {
    const brut = String(formData.get(champ) ?? "").trim();
    if (!brut) return null;
    const n = Number(brut);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const texteOuNull = (champ: string) =>
    String(formData.get(champ) ?? "").trim() || null;

  const { error } = await supabase.from("etablissements").upsert(
    {
      professional_id: user.id,
      raison_sociale: raisonSociale,
      siret: texteOuNull("siret"),
      forme_juridique: texteOuNull("forme_juridique"),
      adresse_siege: texteOuNull("adresse_siege"),
      representant_legal: texteOuNull("representant_legal"),
      type_etablissement: String(formData.get("type_etablissement") ?? "creche_collective"),
      agrement_numero: texteOuNull("agrement_numero"),
      agrement_date: texteOuNull("agrement_date"),
      agrement_places: nombreOuNull("agrement_places"),
    },
    { onConflict: "professional_id" },
  );

  if (error) return { error: error.message };

  revalidatePath("/profil/etablissement");
  return { success: true, message: "Fiche enregistrée." };
}

// Les codes que renvoie `attacher_membre_etablissement()`. Les traduire ici
// plutôt qu'en base : la fonction SQL dit ce qui s'est passé, l'application
// décide comment le formuler.
const MESSAGES_ATTACHEMENT: Record<string, string> = {
  non_autorise: "Seul le compte principal peut rattacher un compte.",
  compte_introuvable:
    "Aucun compte Liams à cette adresse. La personne doit d'abord s'inscrire comme professionnelle, avec cette adresse exactement.",
  soi_meme: "C'est votre propre adresse : votre compte est déjà le compte principal.",
  pas_professionnel:
    "Ce compte est inscrit du côté parent. Pour rejoindre un établissement, il doit être inscrit comme professionnel.",
  deja_membre: "Ce compte fait déjà partie de votre établissement.",
  deja_ailleurs: "Ce compte est déjà rattaché à un autre établissement.",
  trop_de_membres:
    "Votre établissement compte déjà cinq comptes. Retirez-en un avant d'en ajouter un autre.",
};

export async function attacherMembre(
  _prevState: EtablissementFormState,
  formData: FormData,
): Promise<EtablissementFormState> {
  const { supabase } = await requireUser("professionnel");

  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Indiquez l'adresse email du compte à rattacher." };

  const { data, error } = await supabase.rpc("attacher_membre_etablissement", {
    p_email: email,
    p_fonction: String(formData.get("fonction") ?? "").trim() || null,
  });

  if (error) return { error: error.message };
  if (data !== "ok") {
    return { error: MESSAGES_ATTACHEMENT[data as string] ?? "Le rattachement a échoué." };
  }

  revalidatePath("/profil/etablissement");
  return { success: true, message: "Compte rattaché." };
}

export async function detacherMembre(
  _prevState: EtablissementFormState,
  formData: FormData,
): Promise<EtablissementFormState> {
  const { supabase } = await requireUser("professionnel");

  const userId = String(formData.get("user_id") ?? "");
  if (!userId) return { error: "Compte introuvable." };

  const { data, error } = await supabase.rpc("detacher_membre_etablissement", {
    p_user_id: userId,
  });

  if (error) return { error: error.message };
  if (data === "non_autorise") {
    return { error: "Seul le compte principal peut retirer un compte." };
  }
  if (data === "pas_membre") {
    return { error: "Ce compte ne fait pas partie de votre établissement." };
  }

  revalidatePath("/profil/etablissement");
  return { success: true, message: "Compte retiré." };
}
