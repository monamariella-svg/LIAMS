"use server";

import { revalidatePath } from "next/cache";
import { compteProfessionnelActif, requireUser } from "@/lib/auth";
import { geocodeAdresse } from "@/lib/geocoding";
import { sendEmail } from "@/lib/email";
import { lienVers } from "@/lib/notify";

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
  const tarifHoraireUrgence = Number(formData.get("tarif_horaire_urgence") ?? 0) || null;
  const adresse = String(formData.get("adresse") ?? "").trim();
  const rayonKm = Number(formData.get("rayon_km") ?? 15) || 15;
  const accueilADomicile = formData.get("accueil_a_domicile") === "on";
  const typeProfessionnel = String(formData.get("type_professionnel") ?? "") || null;
  const cadreExercice = String(formData.get("cadre_exercice") ?? "") || null;
  const lieuAccueil = String(formData.get("lieu_accueil") ?? "") || "chez_le_pro";

  // Un professionnel qui n'accepte aucun type d'accueil n'apparaîtrait dans
  // aucune recherche : on retombe sur le ponctuel plutôt que de le rendre
  // invisible sans qu'il comprenne pourquoi.
  const typesAccueil = formData.getAll("types_accueil").map(String);
  const typesAccueilRetenus = typesAccueil.length > 0 ? typesAccueil : ["ponctuel"];

  const coords = await geocodeAdresse(adresse);

  // Les compétences ne se saisissent plus ici : elles sont devenues des badges
  // à cocher, seuls exploitables par la mise en relation.
  const { error } = await supabase.from("professional_profiles").upsert({
    user_id: user.id,
    tarif_horaire: tarifHoraire,
    tarif_horaire_urgence: tarifHoraireUrgence,
    adresse,
    rayon_km: rayonKm,
    accueil_a_domicile: accueilADomicile,
    type_professionnel: typeProfessionnel,
    cadre_exercice: cadreExercice,
    lieu_accueil: lieuAccueil,
    types_accueil: typesAccueilRetenus,
    presentation: String(formData.get("presentation") ?? "").trim().slice(0, 400) || null,
    annees_experience: Number(formData.get("annees_experience") ?? NaN) >= 0
      ? Math.min(60, Number(formData.get("annees_experience")))
      : null,
    ...(coords && { latitude: coords.latitude, longitude: coords.longitude }),
  });

  if (error) return { error: error.message };

  revalidatePath("/profil/professionnel");
  // La présentation et l'expérience s'affichent sur la fiche publique.
  revalidatePath(`/professionnels/${user.id}`);
  return { success: true };
}

/** Le professionnel coche ou décoche une compétence.
 *
 * Le statut n'est pas laissé au formulaire : il découle du mode du badge, lu
 * en base. Une compétence sans enjeu s'affiche aussitôt, une spécialité part
 * en demande. La règle de sécurité vérifie de toute façon la même chose — ceci
 * n'est que la première barrière. */
export async function basculerBadge(formData: FormData) {
  const { supabase, user } = await requireUser("professionnel");

  const badgeCode = String(formData.get("badge_code") ?? "");
  const coche = formData.get("coche") === "true";

  const { data: badge } = await supabase
    .from("badges")
    .select("mode, label")
    .eq("code", badgeCode)
    .maybeSingle();

  if (!badge || (badge.mode !== "auto_declare" && badge.mode !== "sur_validation")) {
    return;
  }

  if (coche) {
    const { error } = await supabase.from("professional_badges").insert({
      professional_id: user.id,
      badge_code: badgeCode,
      statut: badge.mode === "auto_declare" ? "valide" : "en_attente",
      demande_le: new Date().toISOString(),
    });

    // Accompagner un enfant en situation de handicap est la raison d'être de
    // Liams : une demande de spécialité qui dort est un professionnel qu'un
    // parent ne trouvera pas. On prévient, sans jamais faire échouer la
    // demande si le mail ne part pas.
    if (!error && badge.mode === "sur_validation") {
      await sendEmail({
        to: process.env.CONTACT_EMAIL ?? "contact@liams.app",
        subject: `Spécialité à contrôler : ${badge.label}`,
        html: `
          <p>Un professionnel déclare la spécialité <strong>${badge.label}</strong>.</p>
          <p>Ce badge reste invisible des parents tant qu'il n'est pas validé.
          À contrôler au vu des justificatifs déposés sur son profil.</p>
          ${lienVers(`/admin/professionnels/${user.id}`, "Ouvrir le dossier")}
        `,
      });
    }
  } else {
    await supabase
      .from("professional_badges")
      .delete()
      .eq("professional_id", user.id)
      .eq("badge_code", badgeCode);
  }

  revalidatePath("/profil/professionnel");
}

export async function soumettreDossier(
  _prevState: ProfilFormState,
  _formData: FormData,
): Promise<ProfilFormState> {
  const { supabase, user } = await requireUser("professionnel");

  const manquants = await documentsManquants(supabase, user.id);
  if (manquants.length > 0) {
    return {
      error: `Votre dossier n'est pas encore complet : il manque ${manquants.join(", ")}.`,
    };
  }

  return { success: true, dossierComplet: true };
}

// `agrement` et `assurance` sont les pièces d'un établissement : ce qui atteste
// son droit d'exercer, là où un indépendant produit un CV et des diplômes.
const DOCUMENT_TYPES = [
  "casier",
  "cv",
  "diplome",
  "certificat",
  "photo_logement",
  "agrement",
  "assurance",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export async function uploadDocument(
  _prevState: ProfilFormState,
  formData: FormData,
): Promise<ProfilFormState> {
  const { supabase, user } = await requireUser("professionnel");

  const type = String(formData.get("type") ?? "") as DocumentType;
  if (!DOCUMENT_TYPES.includes(type)) return { error: "Type de document invalide." };

  const file = formData.get("fichier") as File | null;
  if (!file || file.size === 0) return { error: "Choisissez un fichier à téléverser." };

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
      return { error: "Précisez le type de justificatif." };
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
  if (!file || file.size === 0) return { error: "Choisissez une photo." };

  const { count } = await supabase
    .from("professional_photos")
    .select("id", { count: "exact", head: true })
    .eq("professional_id", user.id);

  const path = `${user.id}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("professional-photos")
    .upload(path, file);
  if (uploadError) return { error: uploadError.message };

  // Ce que montre la photo. Sans cette précision, une fiche aligne six images
  // sans qu'on sache lesquelles montrent l'endroit où l'enfant passera ses
  // journées — la question que les familles posent en premier.
  const sujet = String(formData.get("sujet") ?? "portrait") === "lieu" ? "lieu" : "portrait";
  const legende = String(formData.get("legende") ?? "").trim() || null;

  const { error } = await supabase.from("professional_photos").insert({
    professional_id: user.id,
    fichier_url: path,
    ordre: count ?? 0,
    sujet,
    legende,
  });

  if (error) return { error: error.message };

  revalidatePath("/profil/professionnel");
  revalidatePath(`/professionnels/${user.id}`);
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
  const audio = formData.get("audio") as File | null;
  const dureeAudio = Number(formData.get("audio_duree") ?? 0) || 0;
  const audioARetirer = formData.get("audio_retirer") === "1";
  const aUnAudio = Boolean(audio && audio.size > 0);

  if (!question) return { error: "Choisissez une question." };

  // La carte doit dire quelque chose : un texte, une voix, ou les deux. Même
  // règle qu'en base depuis la 0046, énoncée ici en français — la contrainte
  // Postgres, elle, ne sait refuser qu'en anglais et en jargon.
  //
  // Ce qu'il faut peser est l'état d'après, non celui du formulaire : effacer
  // le texte d'une carte qui n'a que du texte doit être refusé, alors même
  // que rien n'est dit de l'audio. D'où la relecture de la ligne existante.
  let audioApres = aUnAudio;
  if (!aUnAudio && !audioARetirer && promptId) {
    const { data: existant } = await supabase
      .from("professional_prompts")
      .select("audio_url")
      .eq("id", promptId)
      .maybeSingle();
    audioApres = Boolean(existant?.audio_url);
  }
  if (!reponse && !audioApres) {
    return { error: "Répondez par écrit, ou enregistrez une réponse vocale." };
  }

  // Le compte de la structure, pas celui de la salariée : le dossier de
  // stockage porte l'identifiant du professionnel, et les règles de la 0046
  // le vérifient.
  const { comptePro } = await compteProfessionnelActif(supabase, user.id);

  let audioUrl: string | null | undefined;
  let audioDuree: number | null | undefined;

  if (aUnAudio) {
    // L'extension suit le type que le navigateur a produit : Safari
    // enregistre en mp4, Chrome en webm, et servir un fichier mal nommé le
    // rendrait illisible chez l'autre.
    const extension = (audio as File).type.includes("mp4") ? "m4a" : "webm";
    const chemin = `${comptePro}/${Date.now()}.${extension}`;
    const { error: erreurUpload } = await supabase.storage
      .from("professional-voix")
      .upload(chemin, audio as File, { contentType: (audio as File).type });
    if (erreurUpload) return { error: erreurUpload.message };
    audioUrl = chemin;
    audioDuree = Math.min(90, Math.max(1, Math.round(dureeAudio)));
  } else if (audioARetirer) {
    audioUrl = null;
    audioDuree = null;
  }

  if (promptId) {
    const { error } = await supabase
      .from("professional_prompts")
      .update({
        question,
        reponse: reponse || null,
        // `undefined` laisse la colonne tranquille : on ne touche a l audio
        // que si l on en a depose un, ou demande le retrait.
        ...(audioUrl !== undefined && { audio_url: audioUrl, audio_duree_s: audioDuree }),
      })
      .eq("id", promptId)
      .eq("professional_id", comptePro);
    if (error) return { error: error.message };
  } else {
    const { count } = await supabase
      .from("professional_prompts")
      .select("id", { count: "exact", head: true })
      .eq("professional_id", comptePro);

    const { error } = await supabase.from("professional_prompts").insert({
      professional_id: comptePro,
      question,
      reponse: reponse || null,
      audio_url: audioUrl ?? null,
      audio_duree_s: audioDuree ?? null,
      ordre: count ?? 0,
    });
    if (error) return { error: error.message };
  }

  revalidatePath(`/professionnels/${comptePro}`);

  revalidatePath("/profil/professionnel");
  return { success: true };
}

export async function supprimerPrompt(formData: FormData) {
  const { supabase, user } = await requireUser("professionnel");
  const promptId = String(formData.get("prompt_id") ?? "");
  await supabase.from("professional_prompts").delete().eq("id", promptId).eq("professional_id", user.id);
  revalidatePath("/profil/professionnel");
}
