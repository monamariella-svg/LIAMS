import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { startOfWeek, todayISO } from "@/lib/calendar";
import { WeekCalendar, type CalendarSlot } from "@/components/WeekCalendar";
import { demanderReservationUrgente } from "./actions";
import { RecurrenceForm } from "./RecurrenceForm";

export default async function PlanningProfessionnelPage({
  params,
  searchParams,
}: {
  params: Promise<{ professionalId: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { professionalId } = await params;
  const { week } = await searchParams;
  const { supabase, user } = await requireUser("parent");
  const weekStart = startOfWeek(week || todayISO());

  const { data: reseau } = await supabase
    .from("parent_networks")
    .select("statut")
    .eq("parent_id", user.id)
    .eq("professional_id", professionalId)
    .maybeSingle();

  if (!reseau || reseau.statut !== "accepte") redirect("/reseau");

  const [{ data: slots }, { data: mesReservations }] = await Promise.all([
    supabase
      .from("availability_slots")
      .select("*")
      .eq("professional_id", professionalId)
      .order("date")
      .order("heure_debut"),
    supabase
      .from("urgent_bookings")
      .select("slot_id")
      .eq("professional_id", professionalId)
      .eq("parent_id", user.id)
      .eq("statut", "confirme"),
  ]);

  if (!slots) notFound();

  const mesSlotIds = new Set((mesReservations ?? []).map((r) => r.slot_id));

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-12">
      <Link href="/reseau" className="self-start text-sm text-liams-navy underline">
        ← Retour à mon réseau
      </Link>
      <h1 className="text-2xl font-semibold text-liams-navy">Planning du professionnel</h1>

      <p className="text-xs text-gray-500">
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
        basePath={`/reseau/${professionalId}`}
        slots={slots as CalendarSlot[]}
        mesReservationIds={[...mesSlotIds]}
        slotFooters={Object.fromEntries(
          slots
            .filter((slot) => slot.statut === "libre_urgence")
            .map((slot) => [
              slot.id,
              <form key={slot.id} action={demanderReservationUrgente}>
                <input type="hidden" name="slot_id" value={slot.id} />
                <input type="hidden" name="professional_id" value={professionalId} />
                <button
                  type="submit"
                  className="rounded-full bg-liams-orange px-2 py-0.5 text-[10px] font-medium text-white hover:opacity-90"
                >
                  Réserver
                </button>
              </form>,
            ]),
        )}
      />

      <RecurrenceForm professionalId={professionalId} />
    </div>
  );
}
