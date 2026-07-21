"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { notifierUtilisateur } from "@/lib/notify";

export async function demanderAjoutReseau(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const professionalId = String(formData.get("professional_id") ?? "");
  if (!professionalId) return;

  await supabase.from("parent_networks").insert({
    parent_id: user!.id,
    professional_id: professionalId,
    statut: "en_attente",
  });

  await notifierUtilisateur(
    supabase,
    professionalId,
    "Nouvelle demande d'ajout à un réseau",
    "<p>Un parent souhaite vous ajouter à son réseau de confiance sur Liams.</p>",
  );

  revalidatePath("/reseau");
  revalidatePath(`/messages`);
}

export async function repondreReseau(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const parentId = String(formData.get("parent_id") ?? "");
  const accepter = formData.get("reponse") === "accepter";

  await supabase
    .from("parent_networks")
    .update({ statut: accepter ? "accepte" : "refuse" })
    .eq("parent_id", parentId)
    .eq("professional_id", user!.id);

  revalidatePath("/reseau");
}
