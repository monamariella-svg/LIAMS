"use server";

import { revalidatePath } from "next/cache";
import { foyerParent, requireUser } from "@/lib/auth";
import { notifierUtilisateur, lienVers } from "@/lib/notify";
import { disponibiliteCreneau } from "@/lib/urgence";

export type UrgenceFormState =
  | { error?: string; success?: boolean; message?: string }
  | undefined;

/** Demande de garde en urgence sur un ou plusieurs créneaux.
 *
 * Contrairement à la demande groupée ordinaire, elle peut viser des
 * professionnels hors réseau : c'est tout l'objet de ce parcours. Les
 * vérifications habituelles restent entières — fenêtre d'urgence, places
 * disponibles, enfants réellement au parent. */
export async function demanderGardeUrgente(
  _prevState: UrgenceFormState,
  formData: FormData,
): Promise<UrgenceFormState> {
  const { supabase, user } = await requireUser("parent");

  const slotIds = formData.getAll("slot_ids").map(String);
  if (slotIds.length === 0) {
    return { error: "Choisissez au moins un créneau." };
  }

  // Ceux du foyer, non les siens : un second parent réserve pour les mêmes
  // enfants, et la garde qu'il organise reste enregistrée à son nom.
  const { compteFoyer } = await foyerParent(supabase, user.id);

  const { data: mesEnfants } = await supabase
    .from("enfants")
    .select("id")
    .eq("parent_id", compteFoyer);
  const siens = new Set((mesEnfants ?? []).map((e) => e.id));
  const enfantsDemandes = formData
    .getAll("enfant_ids")
    .map(String)
    .filter((id) => siens.has(id));
  const enfants =
    enfantsDemandes.length > 0
      ? enfantsDemandes
      : siens.size === 1
        ? [...siens]
        : [];

  if (enfants.length === 0) {
    return { error: "Indiquez pour quel enfant vous demandez cette garde." };
  }

  const { data: creneaux } = await supabase
    .from("availability_slots")
    .select("id, professional_id, date, heure_debut, statut, types_accueil")
    .in("id", slotIds);

  const maintenant = new Date();
  const retenus = (creneaux ?? []).filter((slot) => {
    if (!(slot.types_accueil ?? []).includes("urgence")) return false;
    return disponibiliteCreneau(
      { ...slot, statut: "libre_urgence" },
      maintenant,
    ).demandable;
  });

  if (retenus.length === 0) {
    return {
      error:
        "Ces créneaux ne sont plus demandables — une garde d'urgence se demande entre 20 h et 2 h avant son début.",
    };
  }

  // Les places restantes se revérifient ici : la page a pu être affichée il y
  // a plusieurs minutes, et une place partir entre-temps.
  const { data: restantes } = await supabase.rpc("places_restantes_creneaux", {
    p_slot_ids: retenus.map((s) => s.id),
  });
  const restantesParSlot = new Map(
    ((restantes ?? []) as { slot_id: string; restantes: number }[]).map((r) => [
      r.slot_id,
      r.restantes,
    ]),
  );

  // Les places déjà demandées par cette famille et pas encore tranchées.
  //
  // Le décompte en base ne compte que les demandes confirmées — à raison : une
  // demande en attente ne doit pas bloquer une place pour les autres familles,
  // le professionnel pouvant la refuser. Mais elle doit bloquer celle-ci :
  // sans quoi un parent de deux enfants demande deux fois la même place, en
  // deux temps, et le professionnel reçoit deux demandes pour une place.
  const { data: enAttente } = await supabase
    .from("urgent_bookings")
    .select("slot_id, enfant_ids")
    .eq("parent_id", user.id)
    .in("slot_id", retenus.map((s) => s.id))
    .eq("statut", "en_attente");

  const dejaDemandeesParSlot = new Map<string, number>();
  for (const d of enAttente ?? []) {
    dejaDemandeesParSlot.set(
      d.slot_id,
      (dejaDemandeesParSlot.get(d.slot_id) ?? 0) +
        Math.max(1, d.enfant_ids?.length ?? 0),
    );
  }

  const possibles = retenus.filter((s) => {
    const restantes = restantesParSlot.get(s.id) ?? 0;
    const deja = dejaDemandeesParSlot.get(s.id) ?? 0;
    return restantes - deja >= enfants.length;
  });

  if (possibles.length === 0) {
    const dejaDemande = dejaDemandeesParSlot.size > 0;
    return {
      error: dejaDemande
        ? "Vous avez déjà demandé ces créneaux — attendez la réponse du professionnel avant d'en demander davantage."
        : "Il ne reste plus assez de places sur ces créneaux pour le nombre d'enfants choisi.",
    };
  }

  const parProfessionnel = new Map<string, string[]>();
  for (const slot of possibles) {
    parProfessionnel.set(slot.professional_id, [
      ...(parProfessionnel.get(slot.professional_id) ?? []),
      slot.id,
    ]);
  }

  for (const [professionalId, ids] of parProfessionnel) {
    await supabase.from("urgent_bookings").insert(
      ids.map((slotId) => ({
        parent_id: user.id,
        professional_id: professionalId,
        slot_id: slotId,
        statut: "en_attente",
        enfant_ids: enfants,
      })),
    );

    await notifierUtilisateur(
      supabase,
      professionalId,
      "Demande de garde en urgence",
      `<p>Une famille vous demande une garde en urgence sur
        ${ids.length > 1 ? `${ids.length} de vos créneaux` : "l'un de vos créneaux"}.</p>
       <p>Une réponse rapide est décisive : la demande porte sur les heures qui
        viennent.</p>
       ${lienVers("/planning", "Répondre à la demande")}`,
    );
  }

  revalidatePath("/planning");
  return {
    success: true,
    message: `Demande envoyée à ${parProfessionnel.size} professionnel(s). Vous serez prévenue dès qu'une réponse arrive.`,
  };
}
