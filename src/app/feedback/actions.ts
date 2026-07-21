"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type FeedbackFormState = { error?: string; success?: boolean } | undefined;

export async function repondreFeedback(
  _prevState: FeedbackFormState,
  formData: FormData,
): Promise<FeedbackFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const feedbackId = String(formData.get("feedback_id") ?? "");
  const scoreNps = Number(formData.get("score_nps") ?? -1);

  if (scoreNps < 0 || scoreNps > 10) return { error: "Choisis une note entre 0 et 10." };

  const reponsesComplementaires = {
    facilite_matching: String(formData.get("facilite_matching") ?? ""),
    confiance_ressentie: String(formData.get("confiance_ressentie") ?? ""),
    fonctionnalite_preferee: String(formData.get("fonctionnalite_preferee") ?? ""),
  };

  const { error } = await supabase
    .from("feedback_pilote")
    .update({
      score_nps: scoreNps,
      reponses_complementaires: reponsesComplementaires,
      date_reponse: new Date().toISOString(),
    })
    .eq("id", feedbackId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/feedback");
  return { success: true };
}
