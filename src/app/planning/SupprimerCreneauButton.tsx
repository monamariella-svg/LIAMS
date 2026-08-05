"use client";

import { useRef } from "react";
import { supprimerCreneau } from "./actions";

/** Retrait d'un créneau, avec confirmation quand des familles en dépendent.
 *
 * La confirmation n'est demandée que si elle a lieu d'être : sur un créneau
 * que personne n'a réservé, l'exiger n'apprendrait rien et lasserait. Sur un
 * créneau réservé en revanche, le professionnel doit voir noir sur blanc ce
 * qu'il défait avant de le défaire. */
export function SupprimerCreneauButton({
  slotId,
  placesReservees,
}: {
  slotId: string;
  placesReservees: number;
}) {
  const champMotif = useRef<HTMLInputElement>(null);

  const confirmer = (evenement: React.FormEvent<HTMLFormElement>) => {
    if (placesReservees === 0) return;

    const message =
      placesReservees === 1
        ? "Une famille a réservé ce créneau. En l'annulant, sa réservation sera supprimée et elle en sera prévenue par email.\n\nConfirmer l'annulation ?"
        : `${placesReservees} familles ont réservé ce créneau. En l'annulant, leurs réservations seront supprimées et elles en seront prévenues par email.\n\nConfirmer l'annulation ?`;

    if (!window.confirm(message)) {
      evenement.preventDefault();
      return;
    }

    // Facultatif, et demandé après la confirmation : un professionnel qui
    // annule est souvent dans l'urgence. Renoncer à écrire un motif n'annule
    // pas la décision déjà prise.
    const motif = window.prompt(
      "Souhaitez-vous indiquer un motif à la famille ? (facultatif)",
      "",
    );
    if (champMotif.current) champMotif.current.value = motif ?? "";
  };

  return (
    <form action={supprimerCreneau} onSubmit={confirmer}>
      <input type="hidden" name="slot_id" value={slotId} />
      <input type="hidden" name="motif" ref={champMotif} />
      <button
        type="submit"
        className={`text-[10px] underline opacity-70 hover:opacity-100 ${
          placesReservees > 0 ? "text-red-600" : ""
        }`}
      >
        {placesReservees > 0 ? "Annuler" : "Retirer"}
      </button>
    </form>
  );
}
