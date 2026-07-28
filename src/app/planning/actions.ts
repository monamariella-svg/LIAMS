"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { notifierUtilisateur } from "@/lib/notify";
import { computeRecurringDates, parseISODate } from "@/lib/calendar";

export type PlanningFormState = { error?: string; success?: boolean } | undefined;

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

  const { error } = await supabase.from("availability_slots").insert({
    professional_id: user.id,
    date,
    heure_debut: heureDebut,
    heure_fin: heureFin,
    statut,
  });

  if (error) return { error: error.message };

  revalidatePath("/planning");
  return { success: true };
}

const DUREE_MAX_RECURRENCE_JOURS = 183; // ~6 mois

export async function ajouterCreneauxRecurrents(
  _prevState: PlanningFormState,
  formData: FormData,
): Promise<PlanningFormState> {
  const { supabase, user } = await requireUser("professionnel");

  const heureDebut = String(formData.get("heure_debut") ?? "");
  const heureFin = String(formData.get("heure_fin") ?? "");
  const statut = String(formData.get("statut") ?? "libre");
  const dateDebut = String(formData.get("date_debut") ?? "");
  const dateFin = String(formData.get("date_fin") ?? "");
  const jours = formData.getAll("jours").map((j) => Number(j));

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

  const rows = dates.map((date) => ({
    professional_id: user.id,
    date,
    heure_debut: heureDebut,
    heure_fin: heureFin,
    statut,
  }));

  const { error } = await supabase
    .from("availability_slots")
    .upsert(rows, { onConflict: "professional_id,date,heure_debut", ignoreDuplicates: true });

  if (error) return { error: error.message };

  revalidatePath("/planning");
  return { success: true };
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

  await supabase
    .from("urgent_bookings")
    .update({ statut: "refuse" })
    .eq("id", bookingId)
    .eq("professional_id", user.id);

  revalidatePath("/planning");
}

export async function validerRecurrence(formData: FormData) {
  const { supabase, user } = await requireUser("professionnel");
  const recurrenceId = String(formData.get("recurrence_id") ?? "");

  await supabase
    .from("recurring_bookings")
    .update({ statut: "actif" })
    .eq("id", recurrenceId)
    .eq("professional_id", user.id);

  revalidatePath("/planning");
}

export async function refuserRecurrence(formData: FormData) {
  const { supabase, user } = await requireUser("professionnel");
  const recurrenceId = String(formData.get("recurrence_id") ?? "");

  await supabase
    .from("recurring_bookings")
    .update({ statut: "annule" })
    .eq("id", recurrenceId)
    .eq("professional_id", user.id);

  revalidatePath("/planning");
}
