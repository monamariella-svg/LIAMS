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
  const role = String(formData.get("role") ?? "");
  const cguAcceptees = formData.get("cgu") === "on";

  if (!email || !password) {
    return { error: "Email et mot de passe requis." };
  }
  if (role !== "parent" && role !== "professionnel") {
    return { error: "Choisis un profil (parent ou professionnel)." };
  }
  if (!cguAcceptees) {
    return {
      error:
        "Tu dois accepter les CGU et la politique de confidentialité pour créer un compte.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { role, cgu_acceptees: true } },
  });

  if (error) {
    return { error: error.message };
  }

  if (!data.session) {
    redirect("/inscription/confirmez-votre-email");
  }

  redirect("/tableau-de-bord");
}
