"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { geocodeAdresse } from "@/lib/geocoding";

export type ProfilFormState = { error?: string; success?: boolean } | undefined;

export async function updateParentProfile(
  _prevState: ProfilFormState,
  formData: FormData,
): Promise<ProfilFormState> {
  const { supabase, user } = await requireUser("parent");

  const adresse = String(formData.get("adresse") ?? "").trim();
  const coords = await geocodeAdresse(adresse);

  // Les besoins de garde vivent désormais dans besoins_garde (calendrier du
  // parent) : la colonne disponibilites du profil n'est plus alimentée.
  const { error } = await supabase.from("parent_profiles").upsert({
    user_id: user.id,
    adresse,
    ...(coords && { latitude: coords.latitude, longitude: coords.longitude }),
  });

  if (error) return { error: error.message };

  revalidatePath("/profil/parent");
  return { success: true };
}

export async function ajouterEnfant(
  _prevState: ProfilFormState,
  formData: FormData,
): Promise<ProfilFormState> {
  const { supabase, user } = await requireUser("parent");

  const prenom = String(formData.get("prenom") ?? "").trim();
  const dateNaissance = String(formData.get("date_naissance") ?? "") || null;
  const besoinsLibre = String(formData.get("besoins_particuliers_libre") ?? "").trim() || null;
  const tagsRaw = String(formData.get("besoins_particuliers_tags") ?? "");
  const tags = tagsRaw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (!prenom) return { error: "Le prénom de l'enfant est requis." };

  const { error } = await supabase.from("enfants").insert({
    parent_id: user.id,
    prenom,
    date_naissance: dateNaissance,
    besoins_particuliers_libre: besoinsLibre,
    besoins_particuliers_tags: tags,
  });

  if (error) return { error: error.message };

  revalidatePath("/profil/parent");
  return { success: true };
}

export async function supprimerEnfant(formData: FormData) {
  const { supabase, user } = await requireUser("parent");
  const enfantId = String(formData.get("enfant_id") ?? "");
  await supabase.from("enfants").delete().eq("id", enfantId).eq("parent_id", user.id);
  revalidatePath("/profil/parent");
}

export async function updateFicheSante(
  _prevState: ProfilFormState,
  formData: FormData,
): Promise<ProfilFormState> {
  const { supabase, user } = await requireUser("parent");

  const enfantId = String(formData.get("enfant_id") ?? "");
  if (!enfantId) return { error: "Enfant introuvable." };

  const { data: enfant } = await supabase
    .from("enfants")
    .select("id")
    .eq("id", enfantId)
    .eq("parent_id", user.id)
    .single();
  if (!enfant) return { error: "Enfant introuvable." };

  const { error } = await supabase.from("enfant_fiche_sante").upsert({
    enfant_id: enfantId,
    allergies: String(formData.get("allergies") ?? "").trim() || null,
    traitements_en_cours: String(formData.get("traitements_en_cours") ?? "").trim() || null,
    contact_medecin: String(formData.get("contact_medecin") ?? "").trim() || null,
    contact_urgence: String(formData.get("contact_urgence") ?? "").trim() || null,
  });

  if (error) return { error: error.message };

  revalidatePath("/profil/parent");
  return { success: true };
}

export async function updateProfilXtra(
  _prevState: ProfilFormState,
  formData: FormData,
): Promise<ProfilFormState> {
  const { supabase, user } = await requireUser("parent");

  const enfantId = String(formData.get("enfant_id") ?? "");
  if (!enfantId) return { error: "Enfant introuvable." };

  const { data: enfant } = await supabase
    .from("enfants")
    .select("id")
    .eq("id", enfantId)
    .eq("parent_id", user.id)
    .single();
  if (!enfant) return { error: "Enfant introuvable." };

  const { error } = await supabase.from("enfant_profil_xtra").upsert({
    enfant_id: enfantId,
    routines_apaisantes: String(formData.get("routines_apaisantes") ?? "").trim() || null,
    declencheurs_a_eviter: String(formData.get("declencheurs_a_eviter") ?? "").trim() || null,
    moyens_communication_preferes:
      String(formData.get("moyens_communication_preferes") ?? "").trim() || null,
  });

  if (error) return { error: error.message };

  revalidatePath("/profil/parent");
  return { success: true };
}
