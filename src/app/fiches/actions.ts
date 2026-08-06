"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";

/** Confirmation de lecture d'une fiche sanitaire.
 *
 * La date est réécrite à chaque confirmation : c'est elle qui sera comparée à
 * la dernière mise à jour de la fiche pour savoir si la version lue est encore
 * la bonne. */
export async function confirmerLectureFiche(formData: FormData) {
  const { supabase, user } = await requireUser("professionnel");

  const enfantId = String(formData.get("enfant_id") ?? "");
  if (!enfantId) return;

  await supabase.from("lectures_fiches").upsert(
    {
      professional_id: user.id,
      enfant_id: enfantId,
      lu_le: new Date().toISOString(),
    },
    { onConflict: "professional_id,enfant_id" },
  );

  revalidatePath("/fiches");
}
