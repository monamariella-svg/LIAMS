import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { demanderReservationUrgente } from "./actions";
import { RecurrenceForm } from "./RecurrenceForm";

const STATUT_SLOT_LABELS: Record<string, string> = {
  libre: "Libre",
  libre_urgence: "Libre — garde d'urgence",
  occupe: "Occupé",
};

export default async function PlanningProfessionnelPage({
  params,
}: {
  params: Promise<{ professionalId: string }>;
}) {
  const { professionalId } = await params;
  const { supabase, user } = await requireUser("parent");

  const { data: reseau } = await supabase
    .from("parent_networks")
    .select("statut")
    .eq("parent_id", user.id)
    .eq("professional_id", professionalId)
    .maybeSingle();

  if (!reseau || reseau.statut !== "accepte") redirect("/reseau");

  const { data: slots } = await supabase
    .from("availability_slots")
    .select("*")
    .eq("professional_id", professionalId)
    .order("date")
    .order("heure_debut");

  if (!slots) notFound();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12">
      <h1 className="text-2xl font-semibold text-liams-navy">Planning du professionnel</h1>

      <section className="flex flex-col gap-2">
        {slots.length === 0 && <p className="text-sm text-gray-500">Aucun créneau déclaré.</p>}
        {slots.map((slot) => (
          <div key={slot.id} className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-2 text-sm">
            <span>
              {slot.date} · {slot.heure_debut}–{slot.heure_fin} ·{" "}
              <span className="text-gray-500">{STATUT_SLOT_LABELS[slot.statut] ?? slot.statut}</span>
            </span>
            {slot.statut === "libre_urgence" && (
              <form action={demanderReservationUrgente}>
                <input type="hidden" name="slot_id" value={slot.id} />
                <input type="hidden" name="professional_id" value={professionalId} />
                <button type="submit" className="rounded-full bg-liams-orange px-3 py-1 text-xs font-medium text-white hover:opacity-90">
                  Réserver en urgence
                </button>
              </form>
            )}
          </div>
        ))}
      </section>

      <RecurrenceForm professionalId={professionalId} />
    </div>
  );
}
