"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";

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

  revalidatePath(`/reseau/${professionalId}`);
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

  revalidatePath(`/reseau/${professionalId}`);
  return { success: true };
}
