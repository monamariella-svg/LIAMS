"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { notifierUtilisateur } from "@/lib/notify";
import { disponibiliteCreneau } from "@/lib/urgence";

export type ReseauFormState = { error?: string; success?: boolean } | undefined;

export async function demanderReservationUrgente(formData: FormData) {
  const { supabase, user } = await requireUser("parent");

  const slotId = String(formData.get("slot_id") ?? "");
  const professionalId = String(formData.get("professional_id") ?? "");
  if (!slotId || !professionalId) return;

  await supabase.from("urgent_bookings").insert({
    parent_id: user.id,
    professional_id: professionalId,
    slot_id: slotId,
    statut: "en_attente",
  });

  await notifierUtilisateur(
    supabase,
    professionalId,
    "Nouvelle demande de garde d'urgence",
    "<p>Un parent de votre réseau demande une garde d'urgence sur l'un de vos créneaux Liams. Connectez-vous pour confirmer ou refuser.</p>",
  );

  revalidatePath(`/reseau/${professionalId}`);
}

/** Demande groupée : le parent coche plusieurs créneaux du planning du
 * professionnel et les demande d'un seul envoi. Le professionnel arbitre
 * ensuite créneau par créneau depuis son propre planning. */
export async function demanderCreneaux(
  _prevState: ReseauFormState,
  formData: FormData,
): Promise<ReseauFormState> {
  const { supabase, user } = await requireUser("parent");

  const professionalId = String(formData.get("professional_id") ?? "");
  const slotIds = formData.getAll("slot_ids").map((s) => String(s)).filter(Boolean);

  if (!professionalId) return { error: "Professionnel introuvable." };
  if (slotIds.length === 0) return { error: "Cochez au moins un créneau." };

  // On ne demande que des créneaux réellement encore libres...
  const { data: slotsLibres } = await supabase
    .from("availability_slots")
    .select("id, date, heure_debut, statut")
    .in("id", slotIds)
    .eq("professional_id", professionalId)
    .neq("statut", "occupe");

  // ...et dont la fenêtre de réservation est ouverte : la vérification de
  // l'interface ne suffit pas, une page laissée ouverte peut la franchir.
  const maintenant = new Date();
  const slotsValides = (slotsLibres ?? []).filter(
    (s) => disponibiliteCreneau(s, maintenant).demandable,
  );

  if (!slotsValides.length) {
    return {
      error:
        "Ces créneaux ne sont plus disponibles — un créneau d'urgence se demande entre 20 h et 2 h avant son début.",
    };
  }

  const { data: demande, error: erreurDemande } = await supabase
    .from("demandes_creneaux")
    .insert({ parent_id: user.id, professional_id: professionalId, statut: "en_attente" })
    .select("id")
    .single();

  if (erreurDemande) return { error: erreurDemande.message };

  const { error } = await supabase.from("demande_creneau_lignes").insert(
    slotsValides.map((s) => ({ demande_id: demande.id, slot_id: s.id, statut: "propose" })),
  );

  if (error) return { error: error.message };

  await notifierUtilisateur(
    supabase,
    professionalId,
    "Nouvelle demande de créneaux",
    `<p>Un parent vous demande ${slotsValides.length} créneau(x) sur Liams. Connectez-vous à votre planning pour choisir ceux que vous acceptez.</p>`,
  );

  revalidatePath(`/reseau/${professionalId}`);
  revalidatePath("/planning");
  return { success: true };
}

export async function demanderReservationRecurrente(
  _prevState: ReseauFormState,
  formData: FormData,
): Promise<ReseauFormState> {
  const { supabase, user } = await requireUser("parent");

  const professionalId = String(formData.get("professional_id") ?? "");
  const jourSemaine = Number(formData.get("jour_semaine") ?? -1);
  const heureDebut = String(formData.get("heure_debut") ?? "");
  const heureFin = String(formData.get("heure_fin") ?? "");

  if (jourSemaine < 0 || !heureDebut || !heureFin) {
    return { error: "Choisissez un jour et des horaires." };
  }

  const { error } = await supabase.from("recurring_bookings").insert({
    parent_id: user.id,
    professional_id: professionalId,
    jour_semaine: jourSemaine,
    heure_debut: heureDebut,
    heure_fin: heureFin,
    statut: "en_attente",
  });

  if (error) return { error: error.message };

  await notifierUtilisateur(
    supabase,
    professionalId,
    "Nouvelle demande de réservation récurrente",
    "<p>Un parent de votre réseau demande une réservation récurrente sur Liams. Connectez-vous pour la valider ou la refuser.</p>",
  );

  revalidatePath(`/reseau/${professionalId}`);
  return { success: true };
}

export async function annulerReservationRecurrente(formData: FormData) {
  const { supabase, user } = await requireUser("parent");

  const recurrenceId = String(formData.get("recurrence_id") ?? "");
  const professionalId = String(formData.get("professional_id") ?? "");
  if (!recurrenceId) return;

  const { data: reservation } = await supabase
    .from("recurring_bookings")
    .select("professional_id, statut")
    .eq("id", recurrenceId)
    .eq("parent_id", user.id)
    .single();

  await supabase
    .from("recurring_bookings")
    .update({ statut: "annule" })
    .eq("id", recurrenceId)
    .eq("parent_id", user.id);

  // Annuler une demande en attente est silencieux ; annuler une récurrence
  // déjà validée prévient le professionnel, qui avait réservé ce temps.
  if (reservation?.statut === "actif") {
    await notifierUtilisateur(
      supabase,
      reservation.professional_id,
      "Réservation récurrente annulée",
      "<p>Un parent a annulé sa réservation récurrente sur Liams. Le créneau hebdomadaire correspondant est de nouveau disponible.</p>",
    );
  }

  revalidatePath(`/reseau/${professionalId}`);
}

export async function modifierReservationRecurrente(
  _prevState: ReseauFormState,
  formData: FormData,
): Promise<ReseauFormState> {
  const { supabase, user } = await requireUser("parent");

  const recurrenceId = String(formData.get("recurrence_id") ?? "");
  const professionalId = String(formData.get("professional_id") ?? "");
  const jourSemaine = Number(formData.get("jour_semaine") ?? -1);
  const heureDebut = String(formData.get("heure_debut") ?? "");
  const heureFin = String(formData.get("heure_fin") ?? "");

  if (!recurrenceId) return { error: "Demande introuvable." };
  if (jourSemaine < 0 || !heureDebut || !heureFin) {
    return { error: "Choisissez un jour et des horaires." };
  }

  // Toute modification repasse par la validation du professionnel.
  const { data: reservation, error } = await supabase
    .from("recurring_bookings")
    .update({
      jour_semaine: jourSemaine,
      heure_debut: heureDebut,
      heure_fin: heureFin,
      statut: "en_attente",
    })
    .eq("id", recurrenceId)
    .eq("parent_id", user.id)
    .select("id")
    .single();

  if (error || !reservation) return { error: "Demande introuvable." };

  await notifierUtilisateur(
    supabase,
    professionalId,
    "Demande de réservation récurrente modifiée",
    "<p>Un parent a modifié sa demande de réservation récurrente sur Liams. Connectez-vous pour la valider ou la refuser.</p>",
  );

  revalidatePath(`/reseau/${professionalId}`);
  return { success: true };
}
