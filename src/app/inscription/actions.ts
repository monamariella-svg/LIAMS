"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = { error?: string } | undefined;

export async function signUp(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const profil = String(formData.get("role") ?? "");
  const cguAcceptees = formData.get("cgu") === "on";

  if (!email || !password) {
    return { error: "Email et mot de passe requis." };
  }
  if (profil !== "parent" && profil !== "professionnel" && profil !== "etablissement") {
    return { error: "Choisissez un profil." };
  }

  // Une crèche n'a ni prénom ni nom : elle a une raison sociale. Lui réclamer
  // un prénom obligerait à inventer quelque chose, et cette invention
  // s'afficherait ensuite aux familles.
  //
  // Le rôle en base reste `professionnel` : un établissement est réservable
  // comme les autres, et tous les écrans professionnels le concernent. C'est
  // la présence d'une ligne dans `etablissements` qui en fait une structure,
  // pas une nature à part.
  const estEtablissement = profil === "etablissement";
  const role = estEtablissement ? "professionnel" : profil;

  const prenom = estEtablissement ? "" : String(formData.get("prenom") ?? "").trim();
  const nom = estEtablissement
    ? String(formData.get("nom_etablissement") ?? "").trim()
    : String(formData.get("nom") ?? "").trim();

  if (estEtablissement && !nom) {
    return { error: "Indiquez le nom de l'établissement." };
  }
  if (!estEtablissement && (!prenom || !nom)) {
    return { error: "Prénom et nom requis." };
  }
  if (!cguAcceptees) {
    return {
      error:
        "Vous devez accepter les CGU et la politique de confidentialité pour créer un compte.",
    };
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // `est_etablissement` sert avant que la fiche existe : à l'inscription,
      // aucune ligne `etablissements` ne peut encore être créée — elle
      // s'accroche au profil professionnel, qui n'est pas rempli. Ce drapeau
      // permet aux écrans de savoir à qui ils parlent entre-temps.
      data: { role, cgu_acceptees: true, prenom, nom, est_etablissement: estEtablissement },
      emailRedirectTo: `${siteUrl}/connexion`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (!data.session) {
    redirect("/inscription/confirmez-votre-email");
  }

  redirect("/tableau-de-bord");
}
