import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { JOURS_SEMAINE } from "@/lib/disponibilites";
import { WeekCalendar, type CalendarSlot } from "@/components/WeekCalendar";

const RECURRENCE_BADGES: Record<string, { label: string; className: string }> = {
  en_attente: { label: "En attente de validation", className: "bg-liams-orange/10 text-liams-orange" },
  actif: { label: "Validée", className: "bg-liams-teal/10 text-liams-teal" },
};

/** Le planning du parent : même calendrier hebdomadaire que le professionnel,
 * mais en lecture — il montre ses gardes d'urgence (confirmées ou en attente)
 * et récapitule ses réservations récurrentes, avec un lien vers le planning
 * de chaque professionnel pour agir dessus. */
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
  const [{ data: bookings }, { data: recurrences }] = await Promise.all([
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

  type SlotJoint = { id: string; date: string; heure_debut: string; heure_fin: string };

  // Un créneau réservé s'affiche en teal (confirmé) ou orange (en attente) ;
  // s'il porte les deux, la confirmation l'emporte.
  const slotsParId = new Map<string, { slot: CalendarSlot; professionalId: string }>();
  for (const booking of bookings ?? []) {
    // Jointure many-to-one : PostgREST renvoie un objet, mais sans types
    // générés le client suppose un tableau — d'où le cast.
    const slot = booking.slot as unknown as SlotJoint | null;
    if (!slot) continue;
    const statut = booking.statut === "confirme" ? "libre" : "libre_urgence";
    const existant = slotsParId.get(slot.id);
    if (existant && existant.slot.statut === "libre") continue;
    slotsParId.set(slot.id, {
      slot: {
        id: slot.id,
        date: slot.date,
        heure_debut: slot.heure_debut,
        heure_fin: slot.heure_fin,
        statut,
      },
      professionalId: booking.professional_id,
    });
  }
  const slots = [...slotsParId.values()];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-12">
      <Link href="/tableau-de-bord" className="self-start text-sm text-liams-navy underline">
        ← Retour au tableau de bord
      </Link>
      <h1 className="text-2xl font-semibold text-liams-navy">Mon planning</h1>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-liams-navy">Mes gardes</h2>
        <p className="mb-3 text-xs text-gray-500">
          <span className="mr-3 inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-liams-teal" /> Confirmée
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-liams-orange" /> En attente
          </span>
        </p>
        <WeekCalendar
          weekStart={weekStart}
          basePath="/planning"
          slots={slots.map((s) => s.slot)}
          statutLabels={{ libre: "Garde confirmée", libre_urgence: "En attente" }}
          slotFooters={Object.fromEntries(
            slots.map(({ slot, professionalId }) => [
              slot.id,
              <Link
                key={slot.id}
                href={`/reseau/${professionalId}`}
                className="text-[10px] underline opacity-70 hover:opacity-100"
              >
                Voir le pro
              </Link>,
            ]),
          )}
        />
        {slots.length === 0 && (
          <p className="mt-3 text-sm text-gray-500">
            Aucune garde réservée pour le moment — réservez un créneau depuis le planning
            d&apos;un professionnel de{" "}
            <Link href="/reseau" className="text-liams-navy underline">
              votre réseau
            </Link>
            .
          </p>
        )}
      </section>

      {(recurrences ?? []).length > 0 && (
        <section className="rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-liams-navy">Mes réservations récurrentes</h2>
          <div className="mt-3 flex flex-col gap-2">
            {(recurrences ?? []).map((rec) => {
              const badge = RECURRENCE_BADGES[rec.statut];
              return (
                <div
                  key={rec.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 px-4 py-2 text-sm"
                >
                  <span>
                    Tous les <strong>{JOURS_SEMAINE[rec.jour_semaine]}</strong>{" "}
                    {rec.heure_debut.slice(0, 5)}–{rec.heure_fin.slice(0, 5)}
                    {badge && (
                      <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${badge.className}`}>
                        {badge.label}
                      </span>
                    )}
                  </span>
                  <Link
                    href={`/reseau/${rec.professional_id}`}
                    className="rounded-full border border-liams-navy px-3 py-1 text-xs text-liams-navy hover:bg-liams-navy hover:text-white transition-colors"
                  >
                    Gérer
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
