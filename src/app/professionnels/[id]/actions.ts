"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SignalementFormState =
  | { error?: string; success?: boolean; message?: string }
  | undefined;

const MOTIFS = [
  "securite_enfant",
  "contenu_inapproprie",
  "informations_fausses",
  "usurpation_identite",
  "autre",
] as const;

/** Signaler un profil jugé inadapté.
 *
 * Rien n'étant contrôlé avant publication, c'est le seul recours d'une famille
 * devant une fiche qui n'a rien à y faire. Il ne masque rien de lui-même : la
 * fiche reste visible jusqu'à une décision humaine, faute de quoi trois
 * signalements complices suffiraient à faire disparaître une concurrente. */
export async function signalerProfil(
  _prevState: SignalementFormState,
  formData: FormData,
): Promise<SignalementFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Connectez-vous pour signaler un profil." };

  const cibleId = String(formData.get("cible_id") ?? "");
  if (!cibleId) return { error: "Profil introuvable." };
  if (cibleId === user.id) return { error: "Vous ne pouvez pas signaler votre propre profil." };

  const motifSaisi = String(formData.get("motif") ?? "");
  const motif = (MOTIFS as readonly string[]).includes(motifSaisi) ? motifSaisi : null;
  if (!motif) return { error: "Choisissez un motif." };

  const commentaire = String(formData.get("commentaire") ?? "").trim() || null;

  const { error } = await supabase.from("signalements").insert({
    cible_id: cibleId,
    auteur_id: user.id,
    motif,
    commentaire,
  });

  // Le même reproche, deux fois, par la même personne : la contrainte
  // d'unicité le refuse. Ce n'est pas une erreur à afficher — le signalement
  // est bien parti, la première fois.
  if (error?.code === "23505") {
    return { success: true, message: "Vous avez déjà signalé ce profil pour ce motif." };
  }
  if (error) return { error: error.message };

  revalidatePath(`/professionnels/${cibleId}`);
  return {
    success: true,
    message:
      "Merci, votre signalement est transmis. Nous l'examinons et revenons vers vous si nécessaire.",
  };
}
