"use server";

import { revalidatePath } from "next/cache";
import { foyerParent, requireUser } from "@/lib/auth";
import { notifierUtilisateur, lienVers } from "@/lib/notify";
import { journaliser } from "@/lib/journal";
import { disponibiliteCreneau } from "@/lib/urgence";

export type ReseauFormState = { error?: string; success?: boolean } | undefined;

/** Enfants concernés par une réservation.
 *
 * Le formulaire est vérifié plutôt que cru sur parole : rien n'empêche
 * d'envoyer l'identifiant de l'enfant d'autrui. On ne retient donc que ceux
 * qui appartiennent bien au parent qui réserve.
 *
 * Repli sur l'enfant unique quand la sélection est vide : un parent qui n'en a
 * qu'un n'a pas à cocher une case dont la réponse est évidente. */
async function enfantsRetenus(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  parentId: string,
  formData: FormData,
): Promise<string[]> {
  // Les enfants du foyer, non ceux du compte : depuis la 0047 un second parent
  // réserve pour la même fratrie, alors que la réservation reste à son nom.
  const { compteFoyer } = await foyerParent(supabase, parentId);

  const { data: enfants } = await supabase
    .from("enfants")
    .select("id")
    .eq("parent_id", compteFoyer);

  const siens = new Set((enfants ?? []).map((e) => e.id));
  const demandes = formData.getAll("enfant_ids").map(String).filter((id) => siens.has(id));

  if (demandes.length > 0) return demandes;
  return siens.size === 1 ? [...siens] : [];
}

/** Annulation par le parent, éventuellement pour un seul de ses enfants.
 *
 * Retirer un enfant d'une réservation qui en porte deux libère une place et
 * laisse l'autre en cours : une famille dont un aîné est malade n'a pas à
 * renoncer à la garde du second. La réservation n'est annulée entièrement que
 * lorsqu'il ne reste plus personne. */
export async function annulerReservation(formData: FormData) {
  const { supabase, user } = await requireUser("parent");

  const type = String(formData.get("type") ?? "");
  const reservationId = String(formData.get("reservation_id") ?? "");
  const enfantRetire = String(formData.get("enfant_id") ?? "");
  if (!reservationId) return;

  const table =
    type === "urgente"
      ? "urgent_bookings"
      : type === "recurrente"
        ? "recurring_bookings"
        : null;
  if (!table) return;

  const { data: reservation } = await supabase
    .from(table)
    .select("id, professional_id, enfant_ids")
    .eq("id", reservationId)
    .eq("parent_id", user.id)
    .maybeSingle();
  if (!reservation) return;

  const restants = enfantRetire
    ? (reservation.enfant_ids ?? []).filter((id: string) => id !== enfantRetire)
    : [];

  if (restants.length > 0) {
    await supabase.from(table).update({ enfant_ids: restants }).eq("id", reservationId);
  } else {
    await supabase.from(table).update({ statut: "annule" }).eq("id", reservationId);
  }

  await journaliser(supabase, {
    type: restants.length > 0 ? "retrait_enfant" : "annulation_parent",
    acteurId: user.id,
    parentId: user.id,
    professionalId: reservation.professional_id,
    detail: {
      reservation: type,
      reservation_id: reservationId,
      enfant_retire: enfantRetire || null,
      enfants_restants: restants,
    },
  });

  await notifierUtilisateur(
    supabase,
    reservation.professional_id,
    restants.length > 0 ? "Réservation modifiée" : "Réservation annulée",
    restants.length > 0
      ? `<p>Un parent a retiré un enfant d'une réservation. Une place se libère
          sur le créneau concerné.</p>
         ${lienVers("/planning", "Voir mon planning")}`
      : `<p>Un parent a annulé sa réservation. Le créneau concerné est de
          nouveau disponible.</p>
         ${lienVers("/planning", "Voir mon planning")}`,
  );

  revalidatePath("/planning");
  revalidatePath(`/reseau/${reservation.professional_id}`);
}

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
    enfant_ids: await enfantsRetenus(supabase, user.id, formData),
  });

  await notifierUtilisateur(
    supabase,
    professionalId,
    "Nouvelle demande de garde d'urgence",
    `<p>Un parent de votre réseau demande une garde d'urgence sur l'un de vos créneaux.</p>
     ${lienVers("/planning", "Confirmer ou refuser")}`,
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
    .insert({
      parent_id: user.id,
      professional_id: professionalId,
      statut: "en_attente",
      enfant_ids: await enfantsRetenus(supabase, user.id, formData),
      // Sans type déclaré, la demande vaut ponctuel : c'est le défaut de la
      // colonne, et le cas d'un parent arrivé sans passer par l'orientation.
      type_accueil: String(formData.get("type_accueil") ?? "") || "ponctuel",
    })
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
    `<p>Un parent vous demande ${slotsValides.length} créneau(x) sur Liams.</p>
     ${lienVers("/planning", "Choisir les créneaux que j'accepte")}`,
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

  const dateDebut = String(formData.get("date_debut") ?? "") || null;
  const dateFin = String(formData.get("date_fin") ?? "") || null;

  const { error } = await supabase.from("recurring_bookings").insert({
    parent_id: user.id,
    professional_id: professionalId,
    jour_semaine: jourSemaine,
    heure_debut: heureDebut,
    heure_fin: heureFin,
    statut: "en_attente",
    enfant_ids: await enfantsRetenus(supabase, user.id, formData),
    date_debut: dateDebut,
    date_fin: dateFin,
  });

  if (error) return { error: error.message };

  await notifierUtilisateur(
    supabase,
    professionalId,
    "Nouvelle demande de réservation récurrente",
    `<p>Un parent de votre réseau demande une réservation récurrente.</p>
     ${lienVers("/planning", "Valider ou refuser")}`,
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
      `<p>Un parent a annulé sa réservation récurrente. Le créneau hebdomadaire
        correspondant est de nouveau disponible.</p>
       ${lienVers("/planning", "Voir mon planning")}`,
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
    `<p>Un parent a modifié sa demande de réservation récurrente.</p>
     ${lienVers("/planning", "Valider ou refuser")}`,
  );

  revalidatePath(`/reseau/${professionalId}`);
  return { success: true };
}
