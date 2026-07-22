"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { parseDisponibilitesFromFormData } from "@/lib/disponibilites";
import { geocodeAdresse } from "@/lib/geocoding";

export type ProfilFormState =
  | { error?: string; success?: boolean; dossierComplet?: boolean }
  | undefined;

async function documentsManquants(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  professionalId: string,
) {
  const [{ data: documents }, { data: qualification }] = await Promise.all([
    supabase.from("professional_documents").select("type").eq("professional_id", professionalId),
    supabase
      .from("professional_qualification_xtra")
      .select("declare_qualifie, fichier_url")
      .eq("professional_id", professionalId)
      .maybeSingle(),
  ]);

  const typesDeposes = new Set((documents ?? []).map((d) => d.type));
  const manquants: string[] = [];

  if (!typesDeposes.has("casier")) manquants.push("le bulletin n°3 du casier judiciaire");
  if (!typesDeposes.has("cv")) manquants.push("le CV");
  if (qualification?.declare_qualifie && !qualification.fichier_url) {
    manquants.push("le justificatif Xtras");
  }

  return manquants;
}

export async function updateProfessionalProfile(
  _prevState: ProfilFormState,
  formData: FormData,
): Promise<ProfilFormState> {
  const { supabase, user } = await requireUser("professionnel");

  const tarifHoraire = Number(formData.get("tarif_horaire") ?? 0) || null;
  const adresse = String(formData.get("adresse") ?? "").trim();
  const rayonKm = Number(formData.get("rayon_km") ?? 15) || 15;
  const accueilADomicile = formData.get("accueil_a_domicile") === "on";
  const specialisationsRaw = String(formData.get("specialisations") ?? "");
  const specialisations = specialisationsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const disponibilites = parseDisponibilitesFromFormData(formData);
  const coords = await geocodeAdresse(adresse);

  const { error } = await supabase.from("professional_profiles").upsert({
    user_id: user.id,
    tarif_horaire: tarifHoraire,
    adresse,
    rayon_km: rayonKm,
    accueil_a_domicile: accueilADomicile,
    specialisations,
    disponibilites,
    ...(coords && { latitude: coords.latitude, longitude: coords.longitude }),
  });

  if (error) return { error: error.message };

  revalidatePath("/profil/professionnel");
  return { success: true };
}

export async function soumettreDossier(
  _prevState: ProfilFormState,
  _formData: FormData,
): Promise<ProfilFormState> {
  const { supabase, user } = await requireUser("professionnel");

  const manquants = await documentsManquants(supabase, user.id);
  if (manquants.length > 0) {
    return {
      error: `Ton dossier n'est pas encore complet : il manque ${manquants.join(", ")}.`,
    };
  }

  return { success: true, dossierComplet: true };
}

const DOCUMENT_TYPES = ["casier", "cv", "diplome", "certificat", "photo_logement"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export async function uploadDocument(
  _prevState: ProfilFormState,
  formData: FormData,
): Promise<ProfilFormState> {
  const { supabase, user } = await requireUser("professionnel");

  const type = String(formData.get("type") ?? "") as DocumentType;
  if (!DOCUMENT_TYPES.includes(type)) return { error: "Type de document invalide." };

  const file = formData.get("fichier") as File | null;
  if (!file || file.size === 0) return { error: "Choisis un fichier à téléverser." };

  const path = `${user.id}/${type}-${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("professional-documents")
    .upload(path, file);

  if (uploadError) return { error: uploadError.message };

  const { error: insertError } = await supabase.from("professional_documents").insert({
    professional_id: user.id,
    type,
    fichier_url: path,
  });

  if (insertError) return { error: insertError.message };

  revalidatePath("/profil/professionnel");
  return { success: true };
}

export async function supprimerDocument(formData: FormData) {
  const { supabase, user } = await requireUser("professionnel");
  const documentId = String(formData.get("document_id") ?? "");
  const path = String(formData.get("fichier_url") ?? "");

  await supabase
    .from("professional_documents")
    .delete()
    .eq("id", documentId)
    .eq("professional_id", user.id);
  if (path) {
    await supabase.storage.from("professional-documents").remove([path]);
  }

  revalidatePath("/profil/professionnel");
}

export async function updateQualificationXtra(
  _prevState: ProfilFormState,
  formData: FormData,
): Promise<ProfilFormState> {
  const { supabase, user } = await requireUser("professionnel");

  const declareQualifie = formData.get("declare_qualifie") === "oui";
  const typeJustificatif = String(formData.get("type_justificatif") ?? "") || null;
  const file = formData.get("fichier") as File | null;

  let fichierUrl: string | null = null;

  if (declareQualifie) {
    if (!typeJustificatif) {
      return { error: "Précise le type de justificatif." };
    }
    if (file && file.size > 0) {
      const path = `${user.id}/xtra-${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("professional-documents")
        .upload(path, file);
      if (uploadError) return { error: uploadError.message };
      fichierUrl = path;
    }
  }

  const { data: existing } = await supabase
    .from("professional_qualification_xtra")
    .select("fichier_url")
    .eq("professional_id", user.id)
    .maybeSingle();

  const { error } = await supabase.from("professional_qualification_xtra").upsert({
    professional_id: user.id,
    declare_qualifie: declareQualifie,
    type_justificatif: declareQualifie ? typeJustificatif : null,
    fichier_url: fichierUrl ?? (declareQualifie ? existing?.fichier_url ?? null : null),
    statut: "en_attente",
  });

  if (error) return { error: error.message };

  revalidatePath("/profil/professionnel");
  return { success: true };
}

export async function uploadPhoto(
  _prevState: ProfilFormState,
  formData: FormData,
): Promise<ProfilFormState> {
  const { supabase, user } = await requireUser("professionnel");

  const file = formData.get("fichier") as File | null;
  if (!file || file.size === 0) return { error: "Choisis une photo." };

  const { count } = await supabase
    .from("professional_photos")
    .select("id", { count: "exact", head: true })
    .eq("professional_id", user.id);

  const path = `${user.id}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("professional-photos")
    .upload(path, file);
  if (uploadError) return { error: uploadError.message };

  const { error } = await supabase.from("professional_photos").insert({
    professional_id: user.id,
    fichier_url: path,
    ordre: count ?? 0,
  });

  if (error) return { error: error.message };

  revalidatePath("/profil/professionnel");
  return { success: true };
}

export async function supprimerPhoto(formData: FormData) {
  const { supabase, user } = await requireUser("professionnel");
  const photoId = String(formData.get("photo_id") ?? "");
  const path = String(formData.get("fichier_url") ?? "");

  await supabase.from("professional_photos").delete().eq("id", photoId).eq("professional_id", user.id);
  if (path) {
    await supabase.storage.from("professional-photos").remove([path]);
  }

  revalidatePath("/profil/professionnel");
}

export async function upsertPrompt(
  _prevState: ProfilFormState,
  formData: FormData,
): Promise<ProfilFormState> {
  const { supabase, user } = await requireUser("professionnel");

  const promptId = String(formData.get("prompt_id") ?? "");
  const question = String(formData.get("question") ?? "").trim();
  const reponse = String(formData.get("reponse") ?? "").trim();

  if (!question || !reponse) return { error: "Choisis une question et rédige une réponse." };

  if (promptId) {
    const { error } = await supabase
      .from("professional_prompts")
      .update({ question, reponse })
      .eq("id", promptId)
      .eq("professional_id", user.id);
    if (error) return { error: error.message };
  } else {
    const { count } = await supabase
      .from("professional_prompts")
      .select("id", { count: "exact", head: true })
      .eq("professional_id", user.id);

    const { error } = await supabase.from("professional_prompts").insert({
      professional_id: user.id,
      question,
      reponse,
      ordre: count ?? 0,
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/profil/professionnel");
  return { success: true };
}

export async function supprimerPrompt(formData: FormData) {
  const { supabase, user } = await requireUser("professionnel");
  const promptId = String(formData.get("prompt_id") ?? "");
  await supabase.from("professional_prompts").delete().eq("id", promptId).eq("professional_id", user.id);
  revalidatePath("/profil/professionnel");
}
