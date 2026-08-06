import type { SupabaseClient } from "@supabase/supabase-js";

/** Étapes consignées au journal des réservations.
 *
 * Nommées du point de vue de ce qui s'est passé, non de la table touchée : un
 * litige se raconte en actes, pas en écritures. */
export type EtapeReservation =
  | "demande_creneaux"
  | "demande_urgence"
  | "demande_recurrente"
  | "creneaux_valides"
  | "urgence_confirmee"
  | "urgence_refusee"
  | "recurrente_validee"
  | "recurrente_refusee"
  | "annulation_parent"
  | "retrait_enfant"
  | "annulation_pro_creneau"
  | "annulation_pro_serie";

/** Consigne une étape. N'échoue jamais bruyamment : un journal qui empêcherait
 * une garde d'être réservée serait pire que pas de journal du tout. */
export async function journaliser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  etape: {
    type: EtapeReservation;
    acteurId: string;
    parentId?: string | null;
    professionalId?: string | null;
    detail?: Record<string, unknown>;
  },
) {
  const { error } = await supabase.from("evenements_reservation").insert({
    type: etape.type,
    acteur_id: etape.acteurId,
    parent_id: etape.parentId ?? null,
    professional_id: etape.professionalId ?? null,
    detail: etape.detail ?? {},
  });

  if (error) {
    console.error(`[journal] étape « ${etape.type} » non consignée :`, error.message);
  }
}
