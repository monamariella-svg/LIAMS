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
  // La demande peut partir des propositions de profils du planning parent.
  revalidatePath("/planning");
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

  const urlRecherche = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://liams-liams-app.vercel.app"}/planning`;
  await notifierUtilisateur(
    supabase,
    parentId,
    accepter ? "Professionnel ajouté à votre réseau" : "Demande de réseau refusée",
    accepter
      ? "<p>Le professionnel a accepté de rejoindre votre réseau de confiance sur Liams. Vous pouvez maintenant consulter son planning et réserver.</p>"
      : `<p>Le professionnel n'a pas pu accepter votre demande de réseau sur Liams.</p><p><a href="${urlRecherche}">Voir les autres professionnels disponibles pour vos besoins</a></p>`,
  );

  revalidatePath("/reseau");
  revalidatePath("/planning");
}
