import Link from "next/link";
import type { ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getWeekDates, isoWeekday } from "@/lib/calendar";
import { WeekCalendar, type CalendarSlot } from "@/components/WeekCalendar";
import { CreneauRecurrentForm, type RecurrenceExistante } from "./CreneauRecurrentForm";
import { RecurrencesList } from "./RecurrencesList";
import { ajouterBesoin, supprimerBesoin } from "./actions";

type SlotJoint = { id: string; date: string; heure_debut: string; heure_fin: string };

// Chevauchement de deux plages horaires "HH:MM(:SS)" (comparaison lexicale).
function chevauche(aDebut: string, aFin: string, bDebut: string, bFin: string) {
  return aDebut < bFin && bDebut < aFin;
}

/** Le planning du parent : le même calendrier hebdomadaire que le
 * professionnel, mais pour saisir ses besoins de garde (ponctuels ou
 * récurrents). Trois statuts y cohabitent : garde confirmée par un
 * professionnel (teal), demande en attente de validation (orange), et besoin
 * pour lequel aucun professionnel n'est encore trouvé (gris). */
export async function PlanningParent({
  supabase,
  userId,
  weekStart,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>;
  userId: string;
  weekStart: string;
}) {
  const [{ data: besoins }, { data: besoinRecurrences }, { data: bookings }, { data: recurringBookings }] =
    await Promise.all([
      supabase
        .from("besoins_garde")
        .select("*")
        .eq("parent_id", userId)
        .order("date")
        .order("heure_debut"),
      supabase
        .from("besoin_recurrences")
        .select("*")
        .eq("parent_id", userId)
        .order("created_at"),
      supabase
        .from("urgent_bookings")
        .select(
          "id, statut, professional_id, slot:availability_slots(id, date, heure_debut, heure_fin)",
        )
        .eq("parent_id", userId)
        .in("statut", ["en_attente", "confirme"]),
      supabase
        .from("recurring_bookings")
        .select("*")
        .eq("parent_id", userId)
        .in("statut", ["en_attente", "actif"])
        .order("created_at"),
    ]);

  const slots: CalendarSlot[] = [];
  const footers: Record<string, ReactNode> = {};

  // 1. Gardes d'urgence réservées (datées) — confirmées ou en attente.
  //    Si un même créneau porte les deux, la confirmation l'emporte.
  const reservationsParSlot = new Map<string, { slot: SlotJoint; statut: string; professionalId: string }>();
  for (const booking of bookings ?? []) {
    // Jointure many-to-one : PostgREST renvoie un objet, mais sans types
    // générés le client suppose un tableau — d'où le cast.
    const slot = booking.slot as unknown as SlotJoint | null;
    if (!slot) continue;
    const existant = reservationsParSlot.get(slot.id);
    if (existant && existant.statut === "confirme") continue;
    reservationsParSlot.set(slot.id, {
      slot,
      statut: booking.statut,
      professionalId: booking.professional_id,
    });
  }
  for (const { slot, statut, professionalId } of reservationsParSlot.values()) {
    slots.push({
      id: slot.id,
      date: slot.date,
      heure_debut: slot.heure_debut,
      heure_fin: slot.heure_fin,
      statut: statut === "confirme" ? "libre" : "libre_urgence",
    });
    footers[slot.id] = (
      <Link
        href={`/reseau/${professionalId}`}
        className="text-[10px] underline opacity-70 hover:opacity-100"
      >
        Voir le pro
      </Link>
    );
  }

  // 2. Réservations récurrentes projetées sur la semaine affichée (elles
  //    n'ont pas de dates propres : "tous les mardis" devient le mardi de
  //    cette semaine).
  const weekDates = getWeekDates(weekStart);
  for (const rec of recurringBookings ?? []) {
    const date = weekDates[rec.jour_semaine];
    if (!date) continue;
    const id = `${rec.id}-${date}`;
    slots.push({
      id,
      date,
      heure_debut: rec.heure_debut,
      heure_fin: rec.heure_fin,
      statut: rec.statut === "actif" ? "libre" : "libre_urgence",
    });
    footers[id] = (
      <Link
        href={`/reseau/${rec.professional_id}`}
        className="text-[10px] underline opacity-70 hover:opacity-100"
      >
        Gérer
      </Link>
    );
  }

  // 3. Besoins déclarés : un besoin couvert par une réservation (datée ou
  //    récurrente) sur la même plage disparaît au profit de celle-ci ; les
  //    autres s'affichent en "Sans professionnel".
  const estCouvert = (besoin: { date: string; heure_debut: string; heure_fin: string }) => {
    for (const { slot } of reservationsParSlot.values()) {
      if (slot.date === besoin.date && chevauche(slot.heure_debut, slot.heure_fin, besoin.heure_debut, besoin.heure_fin)) {
        return true;
      }
    }
    const jour = isoWeekday(besoin.date);
    return (recurringBookings ?? []).some(
      (rec) =>
        rec.jour_semaine === jour &&
        chevauche(rec.heure_debut, rec.heure_fin, besoin.heure_debut, besoin.heure_fin),
    );
  };

  for (const besoin of besoins ?? []) {
    if (estCouvert(besoin)) continue;
    slots.push({
      id: besoin.id,
      date: besoin.date,
      heure_debut: besoin.heure_debut,
      heure_fin: besoin.heure_fin,
      statut: "occupe",
    });
    footers[besoin.id] = (
      <span className="flex items-center gap-2">
        <Link href="/recherche" className="text-[10px] underline opacity-70 hover:opacity-100">
          Trouver un pro
        </Link>
        <form action={supprimerBesoin}>
          <input type="hidden" name="besoin_id" value={besoin.id} />
          <button type="submit" className="text-[10px] underline opacity-70 hover:opacity-100">
            Retirer
          </button>
        </form>
      </span>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-12">
      <Link href="/tableau-de-bord" className="self-start text-sm text-liams-navy underline">
        ← Retour au tableau de bord
      </Link>
      <h1 className="text-2xl font-semibold text-liams-navy">Mon planning</h1>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-liams-navy">Mes besoins de garde</h2>
        <p className="mb-3 text-xs text-gray-500">
          <span className="mr-3 inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-liams-teal" /> Confirmée
          </span>
          <span className="mr-3 inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-liams-orange" /> En attente
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-400" /> Sans professionnel
          </span>
        </p>
        <WeekCalendar
          weekStart={weekStart}
          basePath="/planning"
          slots={slots}
          editable
          addSlotAction={ajouterBesoin}
          typesCreneau={[{ value: "besoin", label: "Besoin de garde" }]}
          statutLabels={{
            libre: "Confirmée",
            libre_urgence: "En attente",
            occupe: "Sans professionnel",
          }}
          slotFooters={footers}
        />
        <p className="mt-3 text-xs text-gray-500">
          Ajoutez vos besoins ponctuels directement dans le calendrier avec « + Ajouter »,
          ou déclarez un besoin qui se répète chaque semaine avec le formulaire ci-dessous.
        </p>
      </section>

      <RecurrencesList
        recurrences={(besoinRecurrences ?? []) as RecurrenceExistante[]}
        variante="besoins"
      />

      <CreneauRecurrentForm variante="besoins" />
    </div>
  );
}
