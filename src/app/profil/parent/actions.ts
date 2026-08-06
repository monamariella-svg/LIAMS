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

  const texte = (champ: string) => String(formData.get(champ) ?? "").trim() || null;

  /** Contacts saisis par rangs. Une ligne sans nom ni téléphone n'est pas un
   * contact : on ne conserve pas de coquilles vides qui feraient croire à un
   * recours inexistant. */
  const contacts = (prefixe: string) =>
    [0, 1]
      .map((rang) => ({
        nom: texte(`${prefixe}_nom_${rang}`),
        lien: texte(`${prefixe}_lien_${rang}`),
        telephone: texte(`${prefixe}_tel_${rang}`),
      }))
      .filter((c) => c.nom || c.telephone);

  const { error } = await supabase.from("enfant_fiche_sante").upsert({
    enfant_id: enfantId,
    // Champs d'origine conservés : d'anciennes fiches les portent encore.
    allergies: texte("allergies"),
    traitements_en_cours: texte("traitements_en_cours"),
    contact_medecin: texte("contact_medecin"),
    contact_urgence: texte("contact_urgence"),

    contacts_urgence: contacts("contact_urgence"),
    personnes_autorisees: contacts("autorisee"),
    medecin_nom: texte("medecin_nom"),
    medecin_telephone: texte("medecin_telephone"),

    allergies_alimentaires: texte("allergies_alimentaires"),
    allergies_medicamenteuses: texte("allergies_medicamenteuses"),
    allergies_autres: texte("allergies_autres"),
    conduite_a_tenir_allergie: texte("conduite_a_tenir_allergie"),
    antecedents_medicaux: texte("antecedents_medicaux"),
    regime_alimentaire: texte("regime_alimentaire"),
    appareillages: texte("appareillages"),
    vaccins_a_jour: formData.get("vaccins_a_jour") === "on",

    pai_existe: formData.get("pai_existe") === "on",
    pai_objet: texte("pai_objet"),
    pai_protocole_urgence: texte("pai_protocole_urgence"),

    autorisation_soins_urgence: formData.get("autorisation_soins_urgence") === "on",
    autorisation_soins_precisions: texte("autorisation_soins_precisions"),
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
