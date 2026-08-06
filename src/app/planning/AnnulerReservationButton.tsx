"use client";

import { annulerReservation } from "@/app/reseau/[professionalId]/actions";

export type EnfantReserve = { id: string; prenom: string };

/** Annulation d'une réservation par le parent, enfant par enfant.
 *
 * Un lien par enfant quand il y en a plusieurs, plutôt qu'une fenêtre de choix :
 * l'espace est étroit sous un créneau, mais lire « Retirer Léo » demande moins
 * d'efforts que d'ouvrir un menu pour y trouver la même chose.
 *
 * La confirmation reste une fenêtre du navigateur : l'annulation prévient un
 * professionnel qui s'organise, elle ne doit pas partir sur un clic distrait. */
export function AnnulerReservationButton({
  type,
  reservationId,
  enfants,
}: {
  type: "urgente" | "recurrente";
  reservationId: string;
  enfants: EnfantReserve[];
}) {
  const confirmer = (message: string) => (evenement: React.FormEvent) => {
    if (!window.confirm(message)) evenement.preventDefault();
  };

  const champs = (enfantId?: string) => (
    <>
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="reservation_id" value={reservationId} />
      {enfantId && <input type="hidden" name="enfant_id" value={enfantId} />}
    </>
  );

  // Un seul enfant, ou aucun de connu : le retirer revient à tout annuler,
  // autant ne proposer qu'une seule action.
  if (enfants.length <= 1) {
    return (
      <form
        action={annulerReservation}
        onSubmit={confirmer(
          "Annuler cette réservation ? Le professionnel en sera prévenu.",
        )}
      >
        {champs()}
        <button
          type="submit"
          className="text-[10px] text-red-600 underline opacity-70 hover:opacity-100"
        >
          Annuler
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {enfants.map((enfant) => (
        <form
          key={enfant.id}
          action={annulerReservation}
          onSubmit={confirmer(
            `Retirer ${enfant.prenom} de cette réservation ? La place se libère, la garde des autres enfants continue.`,
          )}
        >
          {champs(enfant.id)}
          <button
            type="submit"
            className="text-[10px] underline opacity-70 hover:opacity-100"
          >
            Retirer {enfant.prenom}
          </button>
        </form>
      ))}
      <form
        action={annulerReservation}
        onSubmit={confirmer(
          "Annuler toute la réservation ? Le professionnel en sera prévenu.",
        )}
      >
        {champs()}
        <button
          type="submit"
          className="text-[10px] text-red-600 underline opacity-70 hover:opacity-100"
        >
          Tout annuler
        </button>
      </form>
    </div>
  );
}
