"use server";

import { revalidatePath } from "next/cache";
import { foyerParent, requireUser } from "@/lib/auth";
import { geocodeAdresse } from "@/lib/geocoding";
import { notifierUtilisateur, lienVers } from "@/lib/notify";

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
  const { compteFoyer } = await foyerParent(supabase, user.id);

  const lu = lireChampsEnfant(formData);
  if ("error" in lu) return { error: lu.error };
  const { prenom, dateNaissance, besoinsLibre, tags } = lu.champs;

  const { error } = await supabase.from("enfants").insert({
    parent_id: compteFoyer,
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
  const { compteFoyer } = await foyerParent(supabase, user.id);

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
    // Le parent ne corrige que ceux de son foyer. La règle en base le
    // refuserait de toute façon ; la doubler ici évite un refus de policy.
    .eq("parent_id", compteFoyer);

  if (error) return { error: error.message };

  revalidatePath("/profil/parent");
  // L'âge décide des créneaux proposés : le calendrier doit repartir du bon.
  revalidatePath("/planning");
  return { success: true, message: "Enfant mis à jour." };
}

export async function supprimerEnfant(formData: FormData) {
  const { supabase, user } = await requireUser("parent");
  const { compteFoyer } = await foyerParent(supabase, user.id);
  const enfantId = String(formData.get("enfant_id") ?? "");
  await supabase.from("enfants").delete().eq("id", enfantId).eq("parent_id", compteFoyer);
  revalidatePath("/profil/parent");
}

export async function updateFicheSante(
  _prevState: ProfilFormState,
  formData: FormData,
): Promise<ProfilFormState> {
  const { supabase, user } = await requireUser("parent");
  const { compteFoyer } = await foyerParent(supabase, user.id);

  const enfantId = String(formData.get("enfant_id") ?? "");
  if (!enfantId) return { error: "Enfant introuvable." };

  const { data: enfant } = await supabase
    .from("enfants")
    .select("id")
    .eq("id", enfantId)
    .eq("parent_id", compteFoyer)
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
  const { compteFoyer } = await foyerParent(supabase, user.id);

  const enfantId = String(formData.get("enfant_id") ?? "");
  if (!enfantId) return { error: "Enfant introuvable." };

  const { data: enfant } = await supabase
    .from("enfants")
    .select("id")
    .eq("id", enfantId)
    .eq("parent_id", compteFoyer)
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

// Les codes que renvoie `attacher_second_parent()`. Traduits ici plutôt qu'en
// base, comme pour les comptes d'établissement : la fonction SQL dit ce qui
// s'est passé, l'application décide comment le formuler.
const MESSAGES_SECOND_PARENT: Record<string, string> = {
  compte_introuvable:
    "Aucun compte Liams à cette adresse. L'autre parent doit d'abord s'inscrire lui-même, avec cette adresse exactement.",
  soi_meme: "C'est votre propre adresse.",
  pas_parent:
    "Ce compte est inscrit du côté professionnel. Pour être rattaché comme second parent, il doit être inscrit du côté famille.",
  deja_un_second:
    "Vous avez déjà invité un second parent. Retirez l'invitation avant d'en envoyer une autre.",
  deja_ailleurs: "Ce compte est déjà rattaché à un autre foyer.",
};

/** Inviter l'autre parent de l'enfant.
 *
 * On ne crée pas son compte : il s'inscrit lui-même, avec son mot de passe. Ce
 * que l'on invite est une adresse déjà inscrite — sans quoi le dossier d'un
 * enfant s'ouvrirait à une adresse email que personne n'a jamais confirmée.
 *
 * Et on invite, on ne rattache pas : l'accès au dossier d'un enfant ne se
 * donne pas à quelqu'un qui l'apprendrait en se connectant. Il reçoit un
 * message, et il répond — comme un professionnel répond à une demande de
 * réseau.
 */
export async function attacherSecondParent(
  _prevState: ProfilFormState,
  formData: FormData,
): Promise<ProfilFormState> {
  const { supabase, user } = await requireUser("parent");

  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Indiquez l'adresse email de l'autre parent." };

  const { data, error } = await supabase.rpc("attacher_second_parent", { p_email: email });

  if (error) return { error: error.message };
  if (data !== "ok") {
    return { error: MESSAGES_SECOND_PARENT[data as string] ?? "L'invitation a échoué." };
  }

  // Qui invite, sans quoi le message demanderait d'accepter on ne sait quoi.
  const { data: moi } = await supabase
    .from("identites")
    .select("prenom, nom")
    .eq("user_id", user.id)
    .maybeSingle();
  const monNom = [moi?.prenom, moi?.nom].filter(Boolean).join(" ");

  const { data: invite } = await supabase
    .from("users")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (invite?.id) {
    await notifierUtilisateur(
      supabase,
      invite.id,
      "Vous êtes invité comme second parent sur Liams",
      `<p>${monNom || "Un parent"} vous propose de vous rattacher au dossier de
        votre enfant sur Liams.</p>
       <p>Accepter vous donnera votre propre accès à l'enfant, à sa fiche santé
        et à ses besoins particuliers, avec votre mot de passe. Les gardes que
        chacun organise ne se montrent que si vous le décidez, chacun de votre
        côté.</p>
       <p>Tant que vous n'avez pas répondu, rien n'est ouvert.</p>
       ${lienVers("/profil/parent", "Répondre à l'invitation")}`,
    );
  }

  revalidatePath("/profil/parent");
  revalidatePath("/planning");
  return {
    success: true,
    message: "Invitation envoyée. Le rattachement prendra effet quand l'autre parent l'aura acceptée.",
  };
}

// Les codes que renvoie `repondre_rattachement()`.
const MESSAGES_REPONSE: Record<string, string> = {
  aucune_invitation: "Cette invitation n'existe plus.",
  deja_ailleurs:
    "Vous avez déjà rattaché un second parent à votre propre foyer. Retirez-le avant d'accepter celui-ci.",
};

/** Répondre à l'invitation reçue — et, plus tard, s'en retirer.
 *
 * Le même geste sert aux deux : refuser efface le lien, se retirer aussi. Rien
 * n'enregistre le refus, et c'est voulu — une ligne refusée tiendrait le compte
 * prisonnier, puisque seul le principal supprime (voir la 0047). L'autre parent
 * pourra réinviter.
 *
 * Qu'une acceptation se reprenne n'est pas un détail : une séparation qui
 * tourne mal est précisément le moment où l'on veut sortir sans demander la
 * permission de l'autre.
 */
export async function repondreRattachement(
  _prevState: ProfilFormState,
  formData: FormData,
): Promise<ProfilFormState> {
  const { supabase, user } = await requireUser("parent");

  const accepter = formData.get("reponse") === "accepter";

  // Le destinataire est lu avant la réponse : refuser efface la ligne, et
  // l'on ne saurait plus qui prévenir. Son état d'avant sert aussi à
  // distinguer les deux refus possibles — décliner une invitation, ou quitter
  // un rattachement qu'on avait accepté.
  const { autreParent, statut } = await foyerParent(supabase, user.id);
  const etaitAccepte = statut === "accepte";

  const { data, error } = await supabase.rpc("repondre_rattachement", {
    p_accepter: accepter,
  });

  if (error) return { error: error.message };
  if (data !== "ok") {
    return { error: MESSAGES_REPONSE[data as string] ?? "La réponse n'a pas pu être enregistrée." };
  }

  if (autreParent) {
    await notifierUtilisateur(
      supabase,
      autreParent,
      accepter
        ? "Votre invitation a été acceptée"
        : etaitAccepte
          ? "L'autre parent s'est retiré du dossier"
          : "Votre invitation n'a pas été acceptée",
      accepter
        ? `<p>L'autre parent a accepté le rattachement. Vous suivez désormais le
            même enfant à deux.</p>
           ${lienVers("/profil/parent", "Voir le profil")}`
        : etaitAccepte
          ? `<p>L'autre parent s'est retiré du dossier de votre enfant. Il n'y a
              plus accès.</p>
             <p>Ce qu'il avait organisé pendant le rattachement reste : les
              gardes qu'il a réservées sont les siennes, et l'enfant garde son
              dossier.</p>
             ${lienVers("/profil/parent", "Voir le profil")}`
          : `<p>L'autre parent n'a pas accepté le rattachement.</p>
             <p>L'invitation a été retirée. Vous pouvez en envoyer une nouvelle
              depuis votre profil.</p>
             ${lienVers("/profil/parent", "Voir le profil")}`,
    );
  }

  revalidatePath("/profil/parent");
  revalidatePath("/planning");
  revalidatePath("/tableau-de-bord");
  return {
    success: true,
    message: accepter
      ? "Rattachement accepté."
      : etaitAccepte
        ? "Vous vous êtes retiré du dossier."
        : "Invitation refusée.",
  };
}

/** Retirer le rattachement.
 *
 * Le compte principal seul le fait — c'est la règle posée en base. Ce qui a
 * été organisé pendant le rattachement n'est pas défait pour autant : les
 * gardes réservées par l'autre parent restent les siennes, et l'enfant garde
 * son dossier. On coupe l'accès, on ne réécrit pas le passé.
 */
export async function detacherSecondParent(): Promise<ProfilFormState> {
  const { supabase, user } = await requireUser("parent");

  const { error } = await supabase
    .from("co_parents")
    .delete()
    .eq("parent_principal_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/profil/parent");
  revalidatePath("/planning");
  return { success: true, message: "Rattachement retiré." };
}

/** Montrer ou non ses gardes à l'autre parent.
 *
 * Chacun règle le sien, dans un sens seulement : l'un peut montrer sans que
 * l'autre montre. La colonne dépend donc de qui parle, et le trigger de la
 * 0047 refuse au second parent de toucher à celle du principal.
 */
export async function reglerPartagePlanning(
  _prevState: ProfilFormState,
  formData: FormData,
): Promise<ProfilFormState> {
  const { supabase, user } = await requireUser("parent");
  const { estPrincipal, autreParent, statut } = await foyerParent(supabase, user.id);

  // Un rattachement demandé mais pas encore accepté ne règle rien : il n'y a
  // pas encore deux plannings à séparer.
  if (!autreParent || statut !== "accepte") {
    return { error: "Aucun second parent rattaché." };
  }

  const partage = formData.get("partage") === "1";
  const colonne = estPrincipal ? "principal_partage_planning" : "secondaire_partage_planning";

  const { error } = await supabase
    .from("co_parents")
    .update({ [colonne]: partage })
    .eq(estPrincipal ? "parent_principal_id" : "parent_secondaire_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/profil/parent");
  revalidatePath("/planning");
  return {
    success: true,
    message: partage
      ? "L'autre parent voit vos gardes."
      : "Vos gardes ne sont plus visibles de l'autre parent.",
  };
}

/** Qui a l'enfant les semaines paires, quand la garde alterne.
 *
 * Facultatif : rien n'oblige deux parents à se partager les semaines, et
 * beaucoup s'organisent autrement. Le renseigner sert à ce que le calendrier
 * rappelle de qui est la semaine, non à interdire quoi que ce soit — un parent
 * peut parfaitement organiser une garde pendant la semaine de l'autre, un
 * rendez-vous médical ne demande pas la permission du calendrier.
 */
export async function reglerGardeAlternee(
  _prevState: ProfilFormState,
  formData: FormData,
): Promise<ProfilFormState> {
  const { supabase, user } = await requireUser("parent");
  const { estPrincipal, autreParent, statut } = await foyerParent(supabase, user.id);

  // Un rattachement demandé mais pas encore accepté ne règle rien : il n'y a
  // pas encore deux plannings à séparer.
  if (!autreParent || statut !== "accepte") {
    return { error: "Aucun second parent rattaché." };
  }
  if (!estPrincipal) {
    return { error: "Seul le compte principal règle l'alternance des semaines." };
  }

  const choix = String(formData.get("garde_semaines_paires") ?? "");
  const valeur = choix === "moi" ? user.id : choix === "autre" ? autreParent : null;

  const { error } = await supabase
    .from("co_parents")
    .update({ garde_semaines_paires: valeur })
    .eq("parent_principal_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/profil/parent");
  revalidatePath("/planning");
  return { success: true, message: "Alternance enregistrée." };
}
