"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { notifierUtilisateur } from "@/lib/notify";

export type MessagesFormState = { error?: string; success?: boolean } | undefined;

export async function demanderMiseEnRelation(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const professionalId = String(formData.get("professional_id") ?? "");
  if (!professionalId) return;

  await supabase.from("matches").insert({
    parent_id: user!.id,
    professional_id: professionalId,
    statut: "en_attente",
  });

  await notifierUtilisateur(
    supabase,
    professionalId,
    "Nouvelle demande de mise en relation",
    "<p>Un parent souhaite entrer en contact avec vous sur Liams. Connectez-vous pour répondre.</p>",
  );

  revalidatePath(`/professionnels/${professionalId}`);
  revalidatePath("/messages");
}

export async function repondreMiseEnRelation(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const matchId = String(formData.get("match_id") ?? "");
  const accepter = formData.get("reponse") === "accepter";

  const { data: match } = await supabase
    .from("matches")
    .update({ statut: accepter ? "accepte" : "refuse" })
    .eq("id", matchId)
    .eq("professional_id", user!.id)
    .select()
    .maybeSingle();

  if (match) {
    await notifierUtilisateur(
      supabase,
      match.parent_id,
      accepter ? "Votre demande a été acceptée" : "Votre demande a été refusée",
      `<p>Le professionnel a ${accepter ? "accepté" : "refusé"} votre demande de mise en relation sur Liams.</p>`,
    );
  }

  revalidatePath("/messages");
}

export async function envoyerMessage(
  _prevState: MessagesFormState,
  formData: FormData,
): Promise<MessagesFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const matchId = String(formData.get("match_id") ?? "");
  const contenu = String(formData.get("contenu") ?? "").trim();
  if (!contenu) return { error: "Écrivez un message avant d'envoyer." };

  const { error } = await supabase.from("messages").insert({
    match_id: matchId,
    sender_id: user!.id,
    contenu,
  });

  if (error) return { error: error.message };

  const { data: match } = await supabase
    .from("matches")
    .select("parent_id, professional_id")
    .eq("id", matchId)
    .maybeSingle();
  if (match) {
    const destinataireId = match.parent_id === user!.id ? match.professional_id : match.parent_id;
    await notifierUtilisateur(
      supabase,
      destinataireId,
      "Nouveau message sur Liams",
      "<p>Vous avez reçu un nouveau message sur Liams. Connectez-vous pour le lire et y répondre.</p>",
    );
  }

  revalidatePath(`/messages/${matchId}`);
  return { success: true };
}

export async function laisserAvis(
  _prevState: MessagesFormState,
  formData: FormData,
): Promise<MessagesFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const matchId = String(formData.get("match_id") ?? "");
  const note = Number(formData.get("note") ?? 0);
  const commentaire = String(formData.get("commentaire") ?? "").trim() || null;

  if (note < 1 || note > 5) return { error: "Choisissez une note entre 1 et 5." };

  const { data: match } = await supabase.from("matches").select("*").eq("id", matchId).maybeSingle();
  if (!match) return { error: "Mise en relation introuvable." };

  const estParent = match.parent_id === user!.id;
  const cibleId = estParent ? match.professional_id : match.parent_id;

  const { error } = await supabase.from("avis").insert({
    match_id: matchId,
    auteur_id: user!.id,
    cible_id: cibleId,
    note,
    commentaire,
    visible_publiquement: estParent,
  });

  if (error) return { error: error.message };

  await notifierUtilisateur(
    supabase,
    cibleId,
    "Nouvel avis reçu",
    "<p>Vous avez reçu un nouvel avis sur Liams. Connectez-vous pour le consulter.</p>",
  );

  revalidatePath(`/messages/${matchId}`);
  return { success: true };
}
