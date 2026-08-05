"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { notifierUtilisateur, lienVers } from "@/lib/notify";

export async function validerDocument(formData: FormData) {
  const { supabase } = await requireAdmin();

  const documentId = String(formData.get("document_id") ?? "");
  const professionalId = String(formData.get("professional_id") ?? "");
  const statut = String(formData.get("statut") ?? "");
  const type = String(formData.get("type") ?? "");

  await supabase.from("professional_documents").update({ statut }).eq("id", documentId);

  if (type === "casier") {
    await supabase
      .from("professional_profiles")
      .update({ statut_verification_casier: statut })
      .eq("user_id", professionalId);
  }

  revalidatePath(`/admin/professionnels/${professionalId}`);
}

export async function validerQualificationXtra(formData: FormData) {
  const { supabase } = await requireAdmin();

  const professionalId = String(formData.get("professional_id") ?? "");
  const statut = String(formData.get("statut") ?? "");

  await supabase
    .from("professional_qualification_xtra")
    .update({ statut })
    .eq("professional_id", professionalId);

  revalidatePath(`/admin/professionnels/${professionalId}`);
}

/** Suite au contrôle des justificatifs : le badge demandé devient visible des
 * parents, ou la demande est retirée. */
export async function traiterDemandeBadge(formData: FormData) {
  const { supabase, user } = await requireAdmin();

  const professionalId = String(formData.get("professional_id") ?? "");
  const badgeCode = String(formData.get("badge_code") ?? "");
  const decision = String(formData.get("decision") ?? "");

  const { data: badge } = await supabase
    .from("badges")
    .select("label")
    .eq("code", badgeCode)
    .maybeSingle();
  const libelle = badge?.label ?? badgeCode;

  if (decision === "valider") {
    await supabase
      .from("professional_badges")
      .update({
        statut: "valide",
        validee_le: new Date().toISOString(),
        validee_par: user.id,
      })
      .eq("professional_id", professionalId)
      .eq("badge_code", badgeCode);

    // Sans retour, le professionnel a coché une case et n'a plus jamais eu de
    // nouvelle — alors que son badge est désormais visible des parents.
    await notifierUtilisateur(
      supabase,
      professionalId,
      `Votre spécialité « ${libelle} » est validée`,
      `<p>Après contrôle de vos justificatifs, le badge
       <strong>${libelle}</strong> est désormais affiché sur votre fiche.
       Les parents qui recherchent cet accompagnement pourront vous trouver.</p>
       ${lienVers("/profil/professionnel", "Voir mon profil")}`,
    );
  } else if (decision === "refuser") {
    await supabase
      .from("professional_badges")
      .delete()
      .eq("professional_id", professionalId)
      .eq("badge_code", badgeCode);

    await notifierUtilisateur(
      supabase,
      professionalId,
      `Votre spécialité « ${libelle} » n'a pas pu être validée`,
      `<p>Les justificatifs déposés ne nous ont pas permis de valider le badge
       <strong>${libelle}</strong>.</p>
       <p>Vous pouvez déposer une nouvelle pièce — attestation de contrat,
       certificat de formation, attestation d'employeur — puis redemander ce
       badge depuis votre profil.</p>
       ${lienVers("/profil/professionnel", "Déposer un justificatif")}`,
    );
  }

  revalidatePath(`/admin/professionnels/${professionalId}`);
  revalidatePath("/admin");
}

export async function toggleBadge(formData: FormData) {
  const { supabase, user } = await requireAdmin();

  const professionalId = String(formData.get("professional_id") ?? "");
  const badgeCode = String(formData.get("badge_code") ?? "");
  const coche = formData.get("coche") === "true";

  if (coche) {
    await supabase.from("professional_badges").insert({
      professional_id: professionalId,
      badge_code: badgeCode,
      attribue_par: user.id,
    });
  } else {
    await supabase
      .from("professional_badges")
      .delete()
      .eq("professional_id", professionalId)
      .eq("badge_code", badgeCode);
  }

  revalidatePath(`/admin/professionnels/${professionalId}`);
}
