"use server";

import { revalidatePath } from "next/cache";
import { compteProfessionnelActif, requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/calendar";

export type EtablissementFormState =
  | { error?: string; success?: boolean; message?: string }
  | undefined;

export async function enregistrerEtablissement(
  _prevState: EtablissementFormState,
  formData: FormData,
): Promise<EtablissementFormState> {
  const { supabase, user } = await requireUser("professionnel");
  const { estTitulaire } = await compteProfessionnelActif(supabase, user.id);

  // La règle en base refuserait de toute façon ; la vérifier ici permet de le
  // dire en français plutôt que de renvoyer un refus de policy.
  if (!estTitulaire) {
    return { error: "Seul le compte principal peut modifier la fiche de l'établissement." };
  }

  const raisonSociale = String(formData.get("raison_sociale") ?? "").trim();
  if (!raisonSociale) {
    return { error: "La raison sociale est nécessaire." };
  }

  // La fiche s'accroche au profil professionnel : sans lui, la clé étrangère
  // refuserait l'insertion avec un message que personne ne peut interpréter.
  const { data: profil } = await supabase
    .from("professional_profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profil) {
    return {
      error:
        "Renseignez d'abord votre profil professionnel (adresse et tarif) : la fiche de l'établissement s'y rattache.",
    };
  }

  const texteOuNull = (champ: string) =>
    String(formData.get(champ) ?? "").trim() || null;

  const agrementDebut = texteOuNull("agrement_debut");
  const agrementFin = texteOuNull("agrement_fin");

  // Un agrément qui se termine avant d'avoir commencé est une faute de frappe,
  // et elle passerait inaperçue : les deux dates sont lues séparément partout
  // ailleurs.
  if (agrementDebut && agrementFin && agrementFin < agrementDebut) {
    return { error: "La fin de l'agrément doit être après son début." };
  }

  const { error } = await supabase.from("etablissements").upsert(
    {
      professional_id: user.id,
      raison_sociale: raisonSociale,
      siret: texteOuNull("siret"),
      forme_juridique: texteOuNull("forme_juridique"),
      adresse_siege: texteOuNull("adresse_siege"),
      // Deux personnes, et non deux façons de nommer la même : celle qui signe
      // pour la société, et celle qui tient ce compte. Voir la 0034.
      representant_prenom: texteOuNull("representant_prenom"),
      representant_nom: texteOuNull("representant_nom"),
      representant_fonction: texteOuNull("representant_fonction"),
      titulaire_prenom: texteOuNull("titulaire_prenom"),
      titulaire_nom: texteOuNull("titulaire_nom"),
      type_etablissement: String(formData.get("type_etablissement") ?? "creche_collective"),
      agrement_numero: texteOuNull("agrement_numero"),
      agrement_debut: agrementDebut,
      agrement_fin: agrementFin,
      assurance_assureur: texteOuNull("assurance_assureur"),
      assurance_numero: texteOuNull("assurance_numero"),
      assurance_expiration: texteOuNull("assurance_expiration"),
    },
    { onConflict: "professional_id" },
  );

  if (error) return { error: error.message };

  revalidatePath("/profil/etablissement");
  return { success: true, message: "Fiche enregistrée." };
}

/** L'identifiant de l'établissement de l'appelant, s'il en est le titulaire.
 *  Les règles de la 0032 refuseraient de toute façon une écriture par un
 *  compte secondaire ; on le vérifie ici pour pouvoir le dire en français. */
async function ficheDuTitulaire(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
) {
  const { data } = await supabase
    .from("etablissements")
    .select("id")
    .eq("professional_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

export async function ajouterTranche(
  _prevState: EtablissementFormState,
  formData: FormData,
): Promise<EtablissementFormState> {
  const { supabase, user } = await requireUser("professionnel");

  const etablissementId = await ficheDuTitulaire(supabase, user.id);
  if (!etablissementId) {
    return { error: "Enregistrez d'abord la fiche de l'établissement." };
  }

  const lu = lireChampsTranche(formData);
  if ("error" in lu) return { error: lu.error };
  const { champs } = lu;

  const { error } = await supabase.from("etablissement_tranches").insert({
    etablissement_id: etablissementId,
    libelle: champs.libelle,
    age_min_mois: champs.ageMin,
    age_max_mois: champs.ageMax,
    places_agreees: champs.agreees,
    places_ouvertes: champs.ouvertes,
    ordre: champs.ageMin,
  });

  if (error) return { error: error.message };

  revalidatePath("/profil/etablissement");
  return { success: true, message: "Tranche ajoutée." };
}

/** Les bornes et les places d'une section, relues d'un formulaire.
 *  Communes à la création et à la modification : deux jeux de règles pour la
 *  même chose finiraient par diverger. */
function lireChampsTranche(formData: FormData):
  | { error: string }
  | { champs: { libelle: string | null; ageMin: number; ageMax: number; agreees: number; ouvertes: number } } {
  const ageMin = Number(formData.get("age_min_mois") ?? NaN);
  const ageMax = Number(formData.get("age_max_mois") ?? NaN);
  const agreees = Number(formData.get("places_agreees") ?? NaN);
  const ouvertesSaisies = String(formData.get("places_ouvertes") ?? "").trim();

  if (!Number.isFinite(ageMin) || !Number.isFinite(ageMax) || ageMin < 0 || ageMax < 0) {
    return { error: "Indiquez les âges de la section, en mois." };
  }
  if (ageMax <= ageMin) {
    return { error: "L'âge maximum doit être supérieur à l'âge minimum." };
  }
  if (!Number.isFinite(agreees) || agreees < 1) {
    return { error: "Indiquez le nombre de places que votre agrément autorise pour cette section." };
  }

  // Laissé vide, on comprend « j'exploite tout ce qui m'est accordé » — le cas
  // ordinaire. C'est la section fermée qui est l'exception, et elle se dit.
  const ouvertes = ouvertesSaisies ? Number(ouvertesSaisies) : agreees;

  if (!Number.isFinite(ouvertes) || ouvertes < 1) {
    return { error: "Le nombre de places ouvertes doit être d'au moins une." };
  }
  if (ouvertes > agreees) {
    return {
      error: `Votre agrément autorise ${agreees} place(s) pour cette section : vous ne pouvez pas en ouvrir ${ouvertes}.`,
    };
  }

  return {
    champs: {
      libelle: String(formData.get("libelle") ?? "").trim() || null,
      ageMin,
      ageMax,
      agreees,
      ouvertes,
    },
  };
}

/** Modifier une section déjà déclarée.
 *
 * Sans cela, une section n'était que créable et supprimable — et la clé
 * étrangère refuse la suppression dès qu'un créneau s'y rattache. Un
 * établissement qui avait ouvert son planning ne pouvait donc plus rien
 * changer, alors qu'un agrément renouvelé accorde souvent d'autres places.
 *
 * Augmenter ne pose aucune question. Diminuer en pose une : les créneaux déjà
 * ouverts sur cette section peuvent proposer plus de places que le nouveau
 * chiffre, et des familles y ont peut-être réservé. On refuse alors, en disant
 * lequel bloque — plutôt que de réduire les créneaux d'autorité, ce qui
 * annulerait des gardes sans prévenir personne. */
export async function modifierTranche(
  _prevState: EtablissementFormState,
  formData: FormData,
): Promise<EtablissementFormState> {
  const { supabase, user } = await requireUser("professionnel");

  const etablissementId = await ficheDuTitulaire(supabase, user.id);
  if (!etablissementId) return { error: "Fiche introuvable." };

  const trancheId = String(formData.get("tranche_id") ?? "");
  if (!trancheId) return { error: "Section introuvable." };

  const lu = lireChampsTranche(formData);
  if ("error" in lu) return { error: lu.error };
  const { champs } = lu;

  // Les créneaux à venir seuls : ceux qui sont passés ne se rouvriront pas, et
  // les compter empêcherait de réduire une section à cause d'un mois de mars.
  const aujourdhui = todayISO();
  const { data: creneaux } = await supabase
    .from("availability_slots")
    .select("date, capacite")
    .eq("tranche_id", trancheId)
    .gte("date", aujourdhui);

  const plusChargé = (creneaux ?? []).reduce(
    (max, creneau) => Math.max(max, creneau.capacite ?? 1),
    0,
  );

  if (plusChargé > champs.ouvertes) {
    return {
      error: `Un créneau à venir propose déjà ${plusChargé} places sur cette section. Réduisez-le d'abord dans votre planning, ou gardez au moins ${plusChargé} places ouvertes.`,
    };
  }

  const { error } = await supabase
    .from("etablissement_tranches")
    .update({
      libelle: champs.libelle,
      age_min_mois: champs.ageMin,
      age_max_mois: champs.ageMax,
      places_agreees: champs.agreees,
      places_ouvertes: champs.ouvertes,
      ordre: champs.ageMin,
    })
    .eq("id", trancheId)
    .eq("etablissement_id", etablissementId);

  if (error) return { error: error.message };

  // Les âges d'un créneau sont ceux de sa section : le trigger les y recopie à
  // l'ouverture, mais il ne repasse pas sur ceux qui existent déjà. Sans cette
  // mise à jour, une section élargie laisserait derrière elle des créneaux
  // encore bornés à l'ancienne tranche.
  await supabase
    .from("availability_slots")
    .update({ age_min_mois: champs.ageMin, age_max_mois: champs.ageMax })
    .eq("tranche_id", trancheId)
    .gte("date", aujourdhui);

  revalidatePath("/profil/etablissement");
  revalidatePath("/planning");
  return { success: true, message: "Section mise à jour." };
}

export async function retirerTranche(
  _prevState: EtablissementFormState,
  formData: FormData,
): Promise<EtablissementFormState> {
  const { supabase, user } = await requireUser("professionnel");

  const etablissementId = await ficheDuTitulaire(supabase, user.id);
  if (!etablissementId) return { error: "Fiche introuvable." };

  const { error } = await supabase
    .from("etablissement_tranches")
    .delete()
    .eq("id", String(formData.get("tranche_id") ?? ""))
    .eq("etablissement_id", etablissementId);

  // La clé étrangère est en `restrict` : des créneaux pointent encore sur
  // cette section. Les laisser partir avec elle effacerait des gardes déjà
  // réservées sans que personne ne l'apprenne.
  if (error?.code === "23503") {
    return {
      error:
        "Des créneaux de votre planning sont ouverts sur cette section. Retirez-les d'abord, ou rattachez-les à une autre section.",
    };
  }
  if (error) return { error: error.message };

  revalidatePath("/profil/etablissement");
  return { success: true, message: "Tranche retirée." };
}

// Les codes que renvoie `attacher_membre_etablissement()`. Les traduire ici
// plutôt qu'en base : la fonction SQL dit ce qui s'est passé, l'application
// décide comment le formuler.
const MESSAGES_ATTACHEMENT: Record<string, string> = {
  non_autorise: "Seul le compte principal peut rattacher un compte.",
  compte_introuvable:
    "Aucun compte Liams à cette adresse. La personne doit d'abord s'inscrire comme professionnelle, avec cette adresse exactement.",
  soi_meme: "C'est votre propre adresse : votre compte est déjà le compte principal.",
  pas_professionnel:
    "Ce compte est inscrit du côté parent. Pour rejoindre un établissement, il doit être inscrit comme professionnel.",
  deja_membre: "Ce compte fait déjà partie de votre établissement.",
  deja_ailleurs: "Ce compte est déjà rattaché à un autre établissement.",
  trop_de_membres:
    "Votre établissement compte déjà cinq comptes. Retirez-en un avant d'en ajouter un autre.",
};

export async function attacherMembre(
  _prevState: EtablissementFormState,
  formData: FormData,
): Promise<EtablissementFormState> {
  const { supabase } = await requireUser("professionnel");

  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Indiquez l'adresse email du compte à rattacher." };

  const { data, error } = await supabase.rpc("attacher_membre_etablissement", {
    p_email: email,
    p_fonction: String(formData.get("fonction") ?? "").trim() || null,
  });

  if (error) return { error: error.message };
  if (data !== "ok") {
    return { error: MESSAGES_ATTACHEMENT[data as string] ?? "Le rattachement a échoué." };
  }

  revalidatePath("/profil/etablissement");
  return { success: true, message: "Compte rattaché." };
}

export async function detacherMembre(
  _prevState: EtablissementFormState,
  formData: FormData,
): Promise<EtablissementFormState> {
  const { supabase } = await requireUser("professionnel");

  const userId = String(formData.get("user_id") ?? "");
  if (!userId) return { error: "Compte introuvable." };

  const { data, error } = await supabase.rpc("detacher_membre_etablissement", {
    p_user_id: userId,
  });

  if (error) return { error: error.message };
  if (data === "non_autorise") {
    return { error: "Seul le compte principal peut retirer un compte." };
  }
  if (data === "pas_membre") {
    return { error: "Ce compte ne fait pas partie de votre établissement." };
  }

  revalidatePath("/profil/etablissement");
  return { success: true, message: "Compte retiré." };
}
