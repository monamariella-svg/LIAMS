"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { notifierUtilisateur } from "@/lib/notify";
import { geocodeAdresse } from "@/lib/geocoding";
import { computeRecurringDates, parseISODate } from "@/lib/calendar";

export type PlanningFormState =
  | { error?: string; success?: boolean; message?: string }
  | undefined;

export async function ajouterCreneau(
  _prevState: PlanningFormState,
  formData: FormData,
): Promise<PlanningFormState> {
  const { supabase, user } = await requireUser("professionnel");

  const date = String(formData.get("date") ?? "");
  const heureDebut = String(formData.get("heure_debut") ?? "");
  const heureFin = String(formData.get("heure_fin") ?? "");
  const statut = String(formData.get("statut") ?? "libre");

  if (!date || !heureDebut || !heureFin) return { error: "Renseignez la date et les horaires." };

  // Un créneau isolé hérite des réglages du profil : poser trois questions de
  // plus pour ajouter un mardi découragerait l'usage. Le professionnel les
  // ajuste ensuite s'il le souhaite.
  const { data: profil } = await supabase
    .from("professional_profiles")
    .select("types_accueil, lieu_accueil")
    .eq("user_id", user.id)
    .maybeSingle();

  const capaciteSaisie = Number(formData.get("capacite") ?? 0);
  const typesSaisis = formData.getAll("types_accueil").map(String);
  const lieuSaisi = String(formData.get("lieu_accueil") ?? "");

  const { error } = await supabase.from("availability_slots").insert({
    professional_id: user.id,
    date,
    heure_debut: heureDebut,
    heure_fin: heureFin,
    statut,
    capacite: capaciteSaisie >= 1 ? Math.min(20, capaciteSaisie) : 1,
    types_accueil:
      typesSaisis.length > 0 ? typesSaisis : (profil?.types_accueil ?? ["ponctuel"]),
    // « les_deux » au profil veut dire « je choisirai » : sans choix explicite,
    // on ne devine pas à sa place et on laisse le lieu indéterminé.
    lieu_accueil:
      lieuSaisi ||
      (profil?.lieu_accueil && profil.lieu_accueil !== "les_deux"
        ? profil.lieu_accueil
        : null),
  });

  if (error) return { error: error.message };

  revalidatePath("/planning");
  return { success: true };
}

const DUREE_MAX_RECURRENCE_JOURS = 183; // ~6 mois

type ChampsRecurrence = {
  heureDebut: string;
  heureFin: string;
  statut: string;
  dateDebut: string;
  dateFin: string;
  jours: number[];
  dates: string[];
  capacite: number;
  typesAccueil: string[];
  lieuAccueil: string | null;
};

function lireChampsRecurrence(
  formData: FormData,
): { error: string } | { champs: ChampsRecurrence } {
  const heureDebut = String(formData.get("heure_debut") ?? "");
  const heureFin = String(formData.get("heure_fin") ?? "");
  const statut = String(formData.get("statut") ?? "libre");
  const dateDebut = String(formData.get("date_debut") ?? "");
  const dateFin = String(formData.get("date_fin") ?? "");
  const jours = formData.getAll("jours").map((j) => Number(j));

  const capacite = Math.min(20, Math.max(1, Number(formData.get("capacite") ?? 1) || 1));
  const typesSaisis = formData.getAll("types_accueil").map(String);
  // Une série sans type d'accueil ne serait proposée à personne.
  const typesAccueil = typesSaisis.length > 0 ? typesSaisis : ["ponctuel"];
  const lieuAccueil = String(formData.get("lieu_accueil") ?? "") || null;

  if (!heureDebut || !heureFin || !dateDebut || !dateFin || jours.length === 0) {
    return { error: "Choisissez au moins un jour, un horaire et une période." };
  }
  if (heureFin <= heureDebut) {
    return { error: "L'heure de fin doit être après l'heure de début." };
  }
  if (dateFin < dateDebut) {
    return { error: "La date de fin doit être après la date de début." };
  }

  const nbJours =
    (parseISODate(dateFin).getTime() - parseISODate(dateDebut).getTime()) / 86_400_000;
  if (nbJours > DUREE_MAX_RECURRENCE_JOURS) {
    return { error: "La période ne peut pas dépasser 6 mois." };
  }

  const dates = computeRecurringDates(dateDebut, dateFin, jours);
  if (dates.length === 0) {
    return { error: "Aucune date ne correspond à ces critères." };
  }

  return {
    champs: {
      heureDebut,
      heureFin,
      statut,
      dateDebut,
      dateFin,
      jours,
      dates,
      capacite,
      typesAccueil,
      lieuAccueil,
    },
  };
}

async function genererCreneaux(
  supabase: Awaited<ReturnType<typeof createClient>>,
  professionalId: string,
  recurrenceId: string,
  champs: ChampsRecurrence,
) {
  // Chaque créneau généré porte les réglages de sa série : capacité, types
  // d'accueil et lieu s'appliquent à toutes les dates d'un coup.
  const rows = champs.dates.map((date) => ({
    professional_id: professionalId,
    date,
    heure_debut: champs.heureDebut,
    heure_fin: champs.heureFin,
    statut: champs.statut,
    recurrence_id: recurrenceId,
    capacite: champs.capacite,
    types_accueil: champs.typesAccueil,
    lieu_accueil: champs.lieuAccueil,
  }));

  // ignoreDuplicates laisse passer sans bruit les créneaux déjà présents à la
  // même date et heure. C'est voulu — modifier une série ne doit pas écraser
  // ce qui existe — mais il faut savoir combien ont réellement été créés,
  // faute de quoi une série entièrement en collision s'annonce réussie sans
  // que rien n'apparaisse au calendrier.
  const { data, error } = await supabase
    .from("availability_slots")
    .upsert(rows, { onConflict: "professional_id,date,heure_debut", ignoreDuplicates: true })
    .select("id");

  return { error, crees: data?.length ?? 0, demandes: rows.length };
}

export async function ajouterCreneauxRecurrents(
  _prevState: PlanningFormState,
  formData: FormData,
): Promise<PlanningFormState> {
  const { supabase, user } = await requireUser("professionnel");

  const lu = lireChampsRecurrence(formData);
  if ("error" in lu) return { error: lu.error };
  const { champs } = lu;

  const { data: recurrence, error: erreurSerie } = await supabase
    .from("slot_recurrences")
    .insert({
      professional_id: user.id,
      jours: champs.jours,
      heure_debut: champs.heureDebut,
      heure_fin: champs.heureFin,
      statut: champs.statut,
      date_debut: champs.dateDebut,
      date_fin: champs.dateFin,
      capacite: champs.capacite,
      types_accueil: champs.typesAccueil,
      lieu_accueil: champs.lieuAccueil,
    })
    .select("id")
    .single();

  if (erreurSerie) return { error: erreurSerie.message };

  const { error, crees, demandes } = await genererCreneaux(
    supabase,
    user.id,
    recurrence.id,
    champs,
  );
  if (error) return { error: error.message };

  // Aucun créneau créé : tous existaient déjà. Annoncer une réussite laisserait
  // le professionnel chercher au calendrier quelque chose qui n'y est pas.
  if (crees === 0) {
    await supabase.from("slot_recurrences").delete().eq("id", recurrence.id);
    return {
      error:
        "Ces créneaux figurent déjà dans votre calendrier. Vérifiez vos disponibilités avant d'ajouter cette récurrence.",
    };
  }

  revalidatePath("/planning");
  return {
    success: true,
    message:
      crees < demandes
        ? `${crees} créneau(x) ajouté(s) — ${demandes - crees} figuraient déjà dans votre calendrier.`
        : undefined,
  };
}

export async function modifierCreneauxRecurrents(
  _prevState: PlanningFormState,
  formData: FormData,
): Promise<PlanningFormState> {
  const { supabase, user } = await requireUser("professionnel");

  const recurrenceId = String(formData.get("recurrence_id") ?? "");
  if (!recurrenceId) return { error: "Récurrence introuvable." };

  const lu = lireChampsRecurrence(formData);
  if ("error" in lu) return { error: lu.error };
  const { champs } = lu;

  const { data: recurrence, error: erreurSerie } = await supabase
    .from("slot_recurrences")
    .update({
      jours: champs.jours,
      heure_debut: champs.heureDebut,
      heure_fin: champs.heureFin,
      statut: champs.statut,
      date_debut: champs.dateDebut,
      date_fin: champs.dateFin,
      capacite: champs.capacite,
      types_accueil: champs.typesAccueil,
      lieu_accueil: champs.lieuAccueil,
    })
    .eq("id", recurrenceId)
    .eq("professional_id", user.id)
    .select("id")
    .single();

  if (erreurSerie || !recurrence) return { error: "Récurrence introuvable." };

  // On régénère la série : les créneaux libres sont remplacés, les créneaux
  // déjà réservés (occupés) sont toujours conservés tels quels.
  await supabase
    .from("availability_slots")
    .delete()
    .eq("recurrence_id", recurrenceId)
    .eq("professional_id", user.id)
    .neq("statut", "occupe");

  const { error } = await genererCreneaux(supabase, user.id, recurrenceId, champs);
  if (error) return { error: error.message };

  revalidatePath("/planning");
  return { success: true };
}

export async function supprimerRecurrence(formData: FormData) {
  const { supabase, user } = await requireUser("professionnel");
  const recurrenceId = String(formData.get("recurrence_id") ?? "");
  if (!recurrenceId) return;

  // Supprime les créneaux libres de la série ; les créneaux occupés restent
  // (une garde y est réservée) et sont détachés de la série par le
  // "on delete set null" du schéma.
  await supabase
    .from("availability_slots")
    .delete()
    .eq("recurrence_id", recurrenceId)
    .eq("professional_id", user.id)
    .neq("statut", "occupe");

  await supabase
    .from("slot_recurrences")
    .delete()
    .eq("id", recurrenceId)
    .eq("professional_id", user.id);

  revalidatePath("/planning");
}

export async function supprimerCreneau(formData: FormData) {
  const { supabase, user } = await requireUser("professionnel");
  const slotId = String(formData.get("slot_id") ?? "");
  await supabase
    .from("availability_slots")
    .delete()
    .eq("id", slotId)
    .eq("professional_id", user.id)
    .neq("statut", "occupe");
  revalidatePath("/planning");
}

// ------------------------------------------------------------------------
// Critères de recherche du parent — préférences stables (badges, rayon,
// trajet) appliquées à toutes les propositions de profils, par opposition au
// "quand" qui est porté par chaque besoin.
// ------------------------------------------------------------------------

export async function enregistrerCriteres(
  _prevState: PlanningFormState,
  formData: FormData,
): Promise<PlanningFormState> {
  const { supabase, user } = await requireUser("parent");

  const badges = formData.getAll("badges").map((b) => String(b));
  const rayonBrut = String(formData.get("rayon") ?? "").trim();
  const modeZone = String(formData.get("mode_zone") ?? "ville") === "trajet" ? "trajet" : "ville";
  const ville = String(formData.get("ville") ?? "").trim();
  const trajetDepart = String(formData.get("trajet_depart") ?? "").trim();
  const trajetArrivee = String(formData.get("trajet_arrivee") ?? "").trim();

  if (modeZone === "ville" && !ville) {
    return { error: "Indiquez la ville autour de laquelle chercher." };
  }
  if (modeZone === "trajet" && (!trajetDepart || !trajetArrivee)) {
    return { error: "Indiquez le point de départ et le point d'arrivée du trajet." };
  }

  // On ne géocode que les adresses qui ont changé, pour éviter un appel
  // réseau inutile à chaque enregistrement.
  const { data: profilActuel } = await supabase
    .from("parent_profiles")
    .select(
      "ville, ville_latitude, ville_longitude, trajet_depart, trajet_depart_latitude, trajet_depart_longitude, trajet_arrivee, trajet_arrivee_latitude, trajet_arrivee_longitude",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  type Coords = { latitude: number; longitude: number } | null;
  const resoudre = async (
    adresse: string,
    ancienneAdresse: string | null | undefined,
    ancienneLat: number | null | undefined,
    ancienneLng: number | null | undefined,
  ): Promise<Coords> => {
    if (!adresse) return null;
    if (adresse === ancienneAdresse && ancienneLat != null && ancienneLng != null) {
      return { latitude: ancienneLat, longitude: ancienneLng };
    }
    return geocodeAdresse(adresse);
  };

  const coordsVille = await resoudre(
    ville,
    profilActuel?.ville,
    profilActuel?.ville_latitude,
    profilActuel?.ville_longitude,
  );
  const coordsDepart = await resoudre(
    trajetDepart,
    profilActuel?.trajet_depart,
    profilActuel?.trajet_depart_latitude,
    profilActuel?.trajet_depart_longitude,
  );
  const coordsArrivee = await resoudre(
    trajetArrivee,
    profilActuel?.trajet_arrivee,
    profilActuel?.trajet_arrivee_latitude,
    profilActuel?.trajet_arrivee_longitude,
  );

  if (ville && !coordsVille) return { error: "Ville introuvable." };
  if (trajetDepart && !coordsDepart) return { error: "Adresse de départ introuvable." };
  if (trajetArrivee && !coordsArrivee) return { error: "Adresse d'arrivée introuvable." };

  const { error } = await supabase.from("parent_profiles").upsert({
    user_id: user.id,
    badges_souhaites: badges,
    rayon_km: rayonBrut ? Number(rayonBrut) : null,
    mode_zone: modeZone,
    ville: ville || null,
    ville_latitude: coordsVille?.latitude ?? null,
    ville_longitude: coordsVille?.longitude ?? null,
    trajet_depart: trajetDepart || null,
    trajet_depart_latitude: coordsDepart?.latitude ?? null,
    trajet_depart_longitude: coordsDepart?.longitude ?? null,
    trajet_arrivee: trajetArrivee || null,
    trajet_arrivee_latitude: coordsArrivee?.latitude ?? null,
    trajet_arrivee_longitude: coordsArrivee?.longitude ?? null,
  });

  if (error) return { error: error.message };

  revalidatePath("/planning");
  return { success: true };
}

// ------------------------------------------------------------------------
// Besoins de garde du parent — miroir des créneaux du professionnel : des
// besoins ponctuels ajoutés depuis le calendrier, et des séries récurrentes.
// ------------------------------------------------------------------------

export async function ajouterBesoin(
  _prevState: PlanningFormState,
  formData: FormData,
): Promise<PlanningFormState> {
  const { supabase, user } = await requireUser("parent");

  const date = String(formData.get("date") ?? "");
  const heureDebut = String(formData.get("heure_debut") ?? "");
  const heureFin = String(formData.get("heure_fin") ?? "");

  if (!date || !heureDebut || !heureFin) return { error: "Renseignez la date et les horaires." };
  if (heureFin <= heureDebut) {
    return { error: "L'heure de fin doit être après l'heure de début." };
  }

  const { error } = await supabase.from("besoins_garde").insert({
    parent_id: user.id,
    date,
    heure_debut: heureDebut,
    heure_fin: heureFin,
  });

  if (error) return { error: error.message };

  revalidatePath("/planning");
  return { success: true };
}

export async function supprimerBesoin(formData: FormData) {
  const { supabase, user } = await requireUser("parent");
  const besoinId = String(formData.get("besoin_id") ?? "");
  await supabase.from("besoins_garde").delete().eq("id", besoinId).eq("parent_id", user.id);
  revalidatePath("/planning");
}

async function genererBesoins(
  supabase: Awaited<ReturnType<typeof createClient>>,
  parentId: string,
  recurrenceId: string,
  champs: ChampsRecurrence,
) {
  const rows = champs.dates.map((date) => ({
    parent_id: parentId,
    date,
    heure_debut: champs.heureDebut,
    heure_fin: champs.heureFin,
    recurrence_id: recurrenceId,
  }));

  return supabase
    .from("besoins_garde")
    .upsert(rows, { onConflict: "parent_id,date,heure_debut", ignoreDuplicates: true });
}

export async function ajouterBesoinsRecurrents(
  _prevState: PlanningFormState,
  formData: FormData,
): Promise<PlanningFormState> {
  const { supabase, user } = await requireUser("parent");

  const lu = lireChampsRecurrence(formData);
  if ("error" in lu) return { error: lu.error };
  const { champs } = lu;

  const { data: recurrence, error: erreurSerie } = await supabase
    .from("besoin_recurrences")
    .insert({
      parent_id: user.id,
      jours: champs.jours,
      heure_debut: champs.heureDebut,
      heure_fin: champs.heureFin,
      date_debut: champs.dateDebut,
      date_fin: champs.dateFin,
    })
    .select("id")
    .single();

  if (erreurSerie) return { error: erreurSerie.message };

  const { error } = await genererBesoins(supabase, user.id, recurrence.id, champs);
  if (error) return { error: error.message };

  revalidatePath("/planning");
  return { success: true };
}

export async function modifierBesoinsRecurrents(
  _prevState: PlanningFormState,
  formData: FormData,
): Promise<PlanningFormState> {
  const { supabase, user } = await requireUser("parent");

  const recurrenceId = String(formData.get("recurrence_id") ?? "");
  if (!recurrenceId) return { error: "Récurrence introuvable." };

  const lu = lireChampsRecurrence(formData);
  if ("error" in lu) return { error: lu.error };
  const { champs } = lu;

  const { data: recurrence, error: erreurSerie } = await supabase
    .from("besoin_recurrences")
    .update({
      jours: champs.jours,
      heure_debut: champs.heureDebut,
      heure_fin: champs.heureFin,
      date_debut: champs.dateDebut,
      date_fin: champs.dateFin,
    })
    .eq("id", recurrenceId)
    .eq("parent_id", user.id)
    .select("id")
    .single();

  if (erreurSerie || !recurrence) return { error: "Récurrence introuvable." };

  await supabase
    .from("besoins_garde")
    .delete()
    .eq("recurrence_id", recurrenceId)
    .eq("parent_id", user.id);

  const { error } = await genererBesoins(supabase, user.id, recurrenceId, champs);
  if (error) return { error: error.message };

  revalidatePath("/planning");
  return { success: true };
}

export async function supprimerBesoinRecurrence(formData: FormData) {
  const { supabase, user } = await requireUser("parent");
  const recurrenceId = String(formData.get("recurrence_id") ?? "");
  if (!recurrenceId) return;

  await supabase
    .from("besoins_garde")
    .delete()
    .eq("recurrence_id", recurrenceId)
    .eq("parent_id", user.id);

  await supabase
    .from("besoin_recurrences")
    .delete()
    .eq("id", recurrenceId)
    .eq("parent_id", user.id);

  revalidatePath("/planning");
}

// ------------------------------------------------------------------------
// Demandes groupées de créneaux : le parent coche plusieurs créneaux d'un
// même professionnel et envoie le tout ; le professionnel décoche ce qui ne
// lui convient pas et valide le reste.
// ------------------------------------------------------------------------

export async function traiterDemandeCreneaux(formData: FormData) {
  const { supabase, user } = await requireUser("professionnel");

  const demandeId = String(formData.get("demande_id") ?? "");
  const acceptes = new Set(formData.getAll("slot_ids").map((s) => String(s)));
  if (!demandeId) return;

  const { data: demande } = await supabase
    .from("demandes_creneaux")
    .select("id, parent_id, enfant_ids")
    .eq("id", demandeId)
    .eq("professional_id", user.id)
    .maybeSingle();
  if (!demande) return;

  // Chaque enfant occupe une place. Une demande antérieure à la capacité n'en
  // déclare aucun : elle en vaut une, comme elle l'a toujours fait.
  const nbEnfants = Math.max(1, demande.enfant_ids?.length ?? 0);

  const { data: lignes } = await supabase
    .from("demande_creneau_lignes")
    .select("id, slot_id")
    .eq("demande_id", demandeId);

  let nbAcceptes = 0;
  for (const ligne of lignes ?? []) {
    if (!acceptes.has(ligne.slot_id)) {
      await supabase
        .from("demande_creneau_lignes")
        .update({ statut: "refuse" })
        .eq("id", ligne.id);
      continue;
    }

    // Un créneau n'est plus « occupé » ou « libre » : il a des places, dont
    // il reste un certain nombre. Accepter n'en bascule donc plus le statut —
    // c'est le décompte qui dira, la prochaine fois, s'il en reste.
    const { data: restantes } = await supabase.rpc("places_restantes", {
      p_slot_id: ligne.slot_id,
    });

    const placesNecessaires = Math.max(1, nbEnfants);
    const accepte = (restantes ?? 0) >= placesNecessaires;

    await supabase
      .from("demande_creneau_lignes")
      .update({ statut: accepte ? "accepte" : "refuse" })
      .eq("id", ligne.id);

    if (accepte) nbAcceptes++;
  }

  await supabase.from("demandes_creneaux").update({ statut: "traitee" }).eq("id", demandeId);

  await notifierUtilisateur(
    supabase,
    demande.parent_id,
    nbAcceptes > 0 ? "Créneaux de garde confirmés" : "Demande de créneaux refusée",
    nbAcceptes > 0
      ? `<p>Le professionnel a confirmé ${nbAcceptes} créneau(x) de votre demande sur Liams. Retrouvez-les dans votre planning.</p>`
      : "<p>Le professionnel n'a retenu aucun des créneaux demandés sur Liams. Connectez-vous pour en proposer d'autres.</p>",
  );

  revalidatePath("/planning");
}

export async function confirmerReservationUrgente(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const bookingId = String(formData.get("booking_id") ?? "");
  const { data: booking } = await supabase.rpc("confirm_urgent_booking", { p_booking_id: bookingId });

  if (booking) {
    await notifierUtilisateur(
      supabase,
      booking.parent_id,
      "Créneau de garde d'urgence confirmé",
      "<p>Le professionnel a confirmé votre créneau de garde d'urgence sur Liams.</p>",
    );
  }

  revalidatePath("/planning");
}

export async function refuserReservationUrgente(formData: FormData) {
  const { supabase, user } = await requireUser("professionnel");
  const bookingId = String(formData.get("booking_id") ?? "");

  const { data: booking } = await supabase
    .from("urgent_bookings")
    .update({ statut: "refuse" })
    .eq("id", bookingId)
    .eq("professional_id", user.id)
    .select("parent_id")
    .maybeSingle();

  if (booking) {
    await notifierUtilisateur(
      supabase,
      booking.parent_id,
      "Demande de garde d'urgence refusée",
      "<p>Le professionnel n'a pas pu accepter votre demande de garde d'urgence sur Liams. Connectez-vous pour chercher un autre créneau.</p>",
    );
  }

  revalidatePath("/planning");
}

export async function validerRecurrence(formData: FormData) {
  const { supabase, user } = await requireUser("professionnel");
  const recurrenceId = String(formData.get("recurrence_id") ?? "");

  const { data: reservation } = await supabase
    .from("recurring_bookings")
    .update({ statut: "actif" })
    .eq("id", recurrenceId)
    .eq("professional_id", user.id)
    .select("parent_id")
    .maybeSingle();

  if (reservation) {
    await notifierUtilisateur(
      supabase,
      reservation.parent_id,
      "Réservation récurrente validée",
      "<p>Le professionnel a validé votre réservation récurrente sur Liams.</p>",
    );
  }

  revalidatePath("/planning");
}

export async function refuserRecurrence(formData: FormData) {
  const { supabase, user } = await requireUser("professionnel");
  const recurrenceId = String(formData.get("recurrence_id") ?? "");

  const { data: reservation } = await supabase
    .from("recurring_bookings")
    .select("parent_id, statut")
    .eq("id", recurrenceId)
    .eq("professional_id", user.id)
    .single();

  await supabase
    .from("recurring_bookings")
    .update({ statut: "annule" })
    .eq("id", recurrenceId)
    .eq("professional_id", user.id);

  // Message différent selon qu'on refuse une demande en attente ou qu'on
  // annule une récurrence déjà validée sur laquelle le parent comptait.
  if (reservation?.statut === "actif") {
    await notifierUtilisateur(
      supabase,
      reservation.parent_id,
      "Réservation récurrente annulée",
      "<p>Le professionnel a annulé votre réservation récurrente sur Liams. Connectez-vous pour organiser une autre garde.</p>",
    );
  } else if (reservation?.statut === "en_attente") {
    await notifierUtilisateur(
      supabase,
      reservation.parent_id,
      "Demande de réservation récurrente refusée",
      "<p>Le professionnel n'a pas pu accepter votre demande de réservation récurrente sur Liams. Connectez-vous pour chercher une autre solution.</p>",
    );
  }

  revalidatePath("/planning");
}
