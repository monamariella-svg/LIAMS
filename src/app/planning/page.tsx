import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { JOURS_SEMAINE } from "@/lib/disponibilites";
import { startOfWeek, todayISO } from "@/lib/calendar";
import { WeekCalendar, type CalendarSlot } from "@/components/WeekCalendar";
import { CreneauRecurrentForm } from "./CreneauRecurrentForm";
import {
  ajouterCreneau,
  supprimerCreneau,
  confirmerReservationUrgente,
  refuserReservationUrgente,
  validerRecurrence,
  refuserRecurrence,
} from "./actions";

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { supabase, user } = await requireUser("professionnel");
  const { week } = await searchParams;
  const weekStart = startOfWeek(week || todayISO());

  const [{ data: slots }, { data: urgentBookings }, { data: recurringBookings }] = await Promise.all([
    supabase
      .from("availability_slots")
      .select("*")
      .eq("professional_id", user.id)
      .order("date")
      .order("heure_debut"),
    supabase
      .from("urgent_bookings")
      .select("*")
      .eq("professional_id", user.id)
      .eq("statut", "en_attente"),
    supabase
      .from("recurring_bookings")
      .select("*")
      .eq("professional_id", user.id)
      .eq("statut", "en_attente"),
  ]);

  const slotsParId = new Map((slots ?? []).map((s) => [s.id, s]));

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-12">
      <Link href="/tableau-de-bord" className="self-start text-sm text-liams-navy underline">
        ← Retour au tableau de bord
      </Link>
      <h1 className="text-2xl font-semibold text-liams-navy">Mon planning</h1>

      {(urgentBookings ?? []).length > 0 && (
        <section className="rounded-xl border-2 border-liams-orange/30 bg-liams-orange/5 p-6">
          <h2 className="text-base font-semibold text-liams-navy">Demandes de garde d&apos;urgence</h2>
          <div className="mt-3 flex flex-col gap-2">
            {(urgentBookings ?? []).map((booking) => {
              const slot = slotsParId.get(booking.slot_id);
              return (
                <div key={booking.id} className="flex items-center justify-between rounded-lg bg-white px-4 py-2 text-sm">
                  <span>
                    {slot ? `${slot.date} ${slot.heure_debut}–${slot.heure_fin}` : "Créneau"}
                  </span>
                  <div className="flex gap-2">
                    <form action={confirmerReservationUrgente}>
                      <input type="hidden" name="booking_id" value={booking.id} />
                      <button type="submit" className="rounded-full bg-liams-orange px-3 py-1 text-xs font-medium text-white">
                        Confirmer
                      </button>
                    </form>
                    <form action={refuserReservationUrgente}>
                      <input type="hidden" name="booking_id" value={booking.id} />
                      <button type="submit" className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-600">
                        Refuser
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {(recurringBookings ?? []).length > 0 && (
        <section className="rounded-xl border-2 border-liams-teal/30 bg-liams-teal/5 p-6">
          <h2 className="text-base font-semibold text-liams-navy">Demandes de réservation récurrente</h2>
          <div className="mt-3 flex flex-col gap-2">
            {(recurringBookings ?? []).map((rec) => (
              <div key={rec.id} className="flex items-center justify-between rounded-lg bg-white px-4 py-2 text-sm">
                <span>
                  Tous les {JOURS_SEMAINE[rec.jour_semaine]} {rec.heure_debut}–{rec.heure_fin}
                </span>
                <div className="flex gap-2">
                  <form action={validerRecurrence}>
                    <input type="hidden" name="recurrence_id" value={rec.id} />
                    <button type="submit" className="rounded-full bg-liams-teal px-3 py-1 text-xs font-medium text-white">
                      Valider
                    </button>
                  </form>
                  <form action={refuserRecurrence}>
                    <input type="hidden" name="recurrence_id" value={rec.id} />
                    <button type="submit" className="rounded-full border border-gray-300 px-3 py-1 text-xs text-gray-600">
                      Refuser
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold text-liams-navy">Mon calendrier</h2>
        <p className="mb-3 text-xs text-gray-500">
          <span className="mr-3 inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-liams-teal" /> Régulier
          </span>
          <span className="mr-3 inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-liams-orange" /> Urgence
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-400" /> Occupé
          </span>
        </p>
        <WeekCalendar
          weekStart={weekStart}
          basePath="/planning"
          slots={(slots ?? []) as CalendarSlot[]}
          editable
          addSlotAction={ajouterCreneau}
          renderSlotFooter={(slot) =>
            slot.statut !== "occupe" && (
              <form action={supprimerCreneau}>
                <input type="hidden" name="slot_id" value={slot.id} />
                <button type="submit" className="text-[10px] underline opacity-70 hover:opacity-100">
                  Retirer
                </button>
              </form>
            )
          }
        />
      </section>

      <CreneauRecurrentForm />
    </div>
  );
}
