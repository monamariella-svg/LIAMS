"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { geocodeAdresse } from "@/lib/geocoding";

export type ProfilFormState =
  | { error?: string; success?: boolean; message?: string }
  | undefined;

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

/** Les champs d'un enfant, relus et contrôlés.
 *
 * Partagés par l'ajout et la modification : deux jeux de règles pour la même
 * chose divergent, et c'est la date de naissance — celle qui décide des places
 * proposées — qui finirait par n'être vérifiée que d'un côté. */
function lireChampsEnfant(formData: FormData):
  | { error: string }
  | {
      champs: {
        prenom: string;
        dateNaissance: string;
        besoinsLibre: string | null;
        tags: string[];
      };
    } {
  const prenom = String(formData.get("prenom") ?? "").trim();
  const dateNaissance = String(formData.get("date_naissance") ?? "").trim();
  const besoinsLibre = String(formData.get("besoins_particuliers_libre") ?? "").trim() || null;
  const tags = String(formData.get("besoins_particuliers_tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (!prenom) return { error: "Le prénom de l'enfant est requis." };

  // L'âge n'est pas un renseignement d'appoint : il décide des créneaux
  // proposés, une section n'accueillant qu'une tranche donnée. Sans lui, on ne
  // sait pas quoi proposer, et proposer au hasard fait perdre un rendez-vous
  // aux deux parties.
  if (!dateNaissance) {
    return {
      error:
        "La date de naissance est requise : c'est elle qui détermine les places qui conviennent à votre enfant.",
    };
  }

  // Une date future, ou un enfant de plus d'un siècle, sont des fautes de
  // frappe qui fausseraient silencieusement toutes les propositions.
  if (dateNaissance > new Date().toISOString().slice(0, 10)) {
    return { error: "La date de naissance ne peut pas être dans le futur." };
  }
  if (dateNaissance < "1900-01-01") {
    return { error: "Vérifiez la date de naissance." };
  }

  return { champs: { prenom, dateNaissance, besoinsLibre, tags } };
}

export async function ajouterEnfant(
  _prevState: ProfilFormState,
  formData: FormData,
): Promise<ProfilFormState> {
  const { supabase, user } = await requireUser("parent");

  const lu = lireChampsEnfant(formData);
  if ("error" in lu) return { error: lu.error };
  const { prenom, dateNaissance, besoinsLibre, tags } = lu.champs;

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

/** Corriger un enfant déjà enregistré.
 *
 * Il n'existait que « ajouter » et « supprimer ». Une date de naissance fautive
 * d'un chiffre n'avait donc qu'une issue : supprimer l'enfant et le recréer —
 * ce qui emporte en cascade sa fiche santé, son profil Xtra, et la trace
 * nominative des lectures de fiche, que la 0030 tient précisément pour le jour
 * où un incident serait examiné. Perdre tout cela pour corriger un chiffre
 * était hors de proportion. */
export async function modifierEnfant(
  _prevState: ProfilFormState,
  formData: FormData,
): Promise<ProfilFormState> {
  const { supabase, user } = await requireUser("parent");

  const enfantId = String(formData.get("enfant_id") ?? "");
  if (!enfantId) return { error: "Enfant introuvable." };

  const lu = lireChampsEnfant(formData);
  if ("error" in lu) return { error: lu.error };
  const { prenom, dateNaissance, besoinsLibre, tags } = lu.champs;

  const { error } = await supabase
    .from("enfants")
    .update({
      prenom,
      date_naissance: dateNaissance,
      besoins_particuliers_libre: besoinsLibre,
      besoins_particuliers_tags: tags,
    })
    .eq("id", enfantId)
    // Le parent ne corrige que les siens. La règle en base le refuserait de
    // toute façon ; la doubler ici évite de renvoyer un refus de policy.
    .eq("parent_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/profil/parent");
  // L'âge décide des créneaux proposés : le calendrier doit repartir du bon.
  revalidatePath("/planning");
  return { success: true, message: "Enfant mis à jour." };
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
