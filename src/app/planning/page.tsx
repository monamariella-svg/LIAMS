import { requireUserParmi } from "@/lib/auth";
import { NavigationBas } from "@/components/NavigationBas";
import { JOURS_SEMAINE } from "@/lib/disponibilites";
import { startOfWeek, todayISO } from "@/lib/calendar";
import { WeekCalendar, type CalendarSlot } from "@/components/WeekCalendar";
import { CreneauRecurrentForm, type RecurrenceExistante } from "./CreneauRecurrentForm";
import { RecurrencesList } from "./RecurrencesList";
import { SupprimerCreneauButton } from "./SupprimerCreneauButton";
import { CreneauxAVenir } from "./CreneauxAVenir";
import { PlanningParent } from "./PlanningParent";
import { DemandesRecues, type DemandeRecue } from "./DemandesRecues";
import {
  ajouterCreneau,
  confirmerReservationUrgente,
  refuserReservationUrgente,
  validerRecurrence,
  refuserRecurrence,
} from "./actions";

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{
    week?: string;
    annule?: string;
    enfant?: string;
    type?: string;
    tri?: string;
    depuis?: string;
  }>;
}) {
  const { supabase, user, role } = await requireUserParmi(["professionnel", "parent"]);
  const { week, annule, enfant, type, tri, depuis } = await searchParams;
  const weekStart = startOfWeek(week || todayISO());

  if (role === "parent") {
    return (
      <PlanningParent
        supabase={supabase}
        userId={user.id}
        weekStart={weekStart}
        enfantFiltre={enfant}
        typeAccueil={type === "longue_duree" || type === "ponctuel" ? type : undefined}
        tri={
          tri === "prix" || tri === "note" || tri === "trajet" ? tri : "distance"
        }
        depuisPro={depuis}
      />
    );
  }

  const [
    { data: slots },
    { data: urgentBookings },
    { data: recurringBookings },
    { data: recurrences },
    { data: demandes },
    { data: profilPro },
  ] = await Promise.all([
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
      .in("statut", ["en_attente", "actif"]),
    supabase
      .from("slot_recurrences")
      .select("*")
      .eq("professional_id", user.id)
      .order("created_at"),
    supabase
      .from("demandes_creneaux")
      .select("id")
      .eq("professional_id", user.id)
      .eq("statut", "en_attente")
      .order("created_at"),
    supabase
      .from("professional_profiles")
      .select("lieu_accueil")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const slotsParId = new Map((slots ?? []).map((s) => [s.id, s]));

  // Une demande de garde sans nom ni prénom d'enfant ne se décide pas : le
  // professionnel doit savoir qui il accueillerait avant d'accepter.
  const idsParents = [...new Set((urgentBookings ?? []).map((b) => b.parent_id))];
  const idsEnfantsDemandes = [
    ...new Set((urgentBookings ?? []).flatMap((b) => (b.enfant_ids ?? []) as string[])),
  ];

  const [{ data: identitesParents }, { data: enfantsDemandes }] = await Promise.all([
    idsParents.length
      ? supabase.from("identites").select("user_id, prenom, nom").in("user_id", idsParents)
      : Promise.resolve({ data: [] }),
    idsEnfantsDemandes.length
      ? supabase.from("enfants").select("id, prenom").in("id", idsEnfantsDemandes)
      : Promise.resolve({ data: [] }),
  ]);

  const nomParParent = new Map(
    (identitesParents ?? []).map((i) => [
      i.user_id,
      [i.prenom, i.nom].filter(Boolean).join(" ") || "Parent",
    ]),
  );
  const prenomParEnfant = new Map(
    (enfantsDemandes ?? []).map((e) => [e.id, e.prenom]),
  );

  // Le professionnel doit voir ce qu'il lui reste, pas seulement s'il est pris :
  // un créneau de deux places dont une est réservée reste ouvert, et il doit le
  // savoir aussi bien que le parent.
  const { data: restantesPro } = (slots ?? []).length
    ? await supabase.rpc("places_restantes_creneaux", {
        p_slot_ids: (slots ?? []).map((s) => s.id),
      })
    : { data: [] };
  const restantesParSlot = new Map<string, number>(
    ((restantesPro ?? []) as { slot_id: string; restantes: number }[]).map((r) => [
      r.slot_id,
      r.restantes,
    ]),
  );

  // Lignes des demandes groupées en attente, avec le détail de chaque créneau.
  const { data: lignesDemandes } = (demandes ?? []).length
    ? await supabase
        .from("demande_creneau_lignes")
        .select("demande_id, slot:availability_slots(id, date, heure_debut, heure_fin)")
        .in("demande_id", (demandes ?? []).map((d) => d.id))
        .eq("statut", "propose")
    : { data: [] };

  type CreneauDemande = { id: string; date: string; heure_debut: string; heure_fin: string };
  const creneauxParDemande = new Map<string, CreneauDemande[]>();
  for (const ligne of lignesDemandes ?? []) {
    const slot = ligne.slot as unknown as CreneauDemande | null;
    if (!slot) continue;
    const liste = creneauxParDemande.get(ligne.demande_id) ?? [];
    liste.push(slot);
    creneauxParDemande.set(ligne.demande_id, liste);
  }
  const demandesRecues: DemandeRecue[] = (demandes ?? [])
    .map((d) => ({
      id: d.id,
      creneaux: (creneauxParDemande.get(d.id) ?? []).sort(
        (a, b) => a.date.localeCompare(b.date) || a.heure_debut.localeCompare(b.heure_debut),
      ),
    }))
    .filter((d) => d.creneaux.length > 0);
  const demandesRecurrentes = (recurringBookings ?? []).filter((r) => r.statut === "en_attente");
  const recurrencesActives = (recurringBookings ?? []).filter((r) => r.statut === "actif");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-12">
      <h1 className="text-2xl font-semibold text-liams-navy">Mon planning</h1>

      <DemandesRecues demandes={demandesRecues} />

      {(urgentBookings ?? []).length > 0 && (
        <section className="rounded-xl border-2 border-liams-orange/30 bg-liams-orange/5 p-6">
          <h2 className="text-base font-semibold text-liams-navy">Demandes de garde d&apos;urgence</h2>
          <div className="mt-3 flex flex-col gap-2">
            {(urgentBookings ?? []).map((booking) => {
              const slot = slotsParId.get(booking.slot_id);
              return (
                <div key={booking.id} className="flex items-center justify-between rounded-lg bg-white px-4 py-2 text-sm">
                  <span className="flex flex-col">
                    <span className="font-medium text-liams-navy">
                      {nomParParent.get(booking.parent_id) ?? "Parent"}
                      {((booking.enfant_ids ?? []) as string[]).length > 0 && (
                        <span className="ml-2 font-normal text-gray-600">
                          pour{" "}
                          {((booking.enfant_ids ?? []) as string[])
                            .map((id) => prenomParEnfant.get(id))
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-gray-500">
                      {slot ? `${slot.date} ${slot.heure_debut}–${slot.heure_fin}` : "Créneau"}
                    </span>
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

      {demandesRecurrentes.length > 0 && (
        <section className="rounded-xl border-2 border-liams-teal/30 bg-liams-teal/5 p-6">
          <h2 className="text-base font-semibold text-liams-navy">Demandes de réservation récurrente</h2>
          <div className="mt-3 flex flex-col gap-2">
            {demandesRecurrentes.map((rec) => (
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

      {recurrencesActives.length > 0 && (
        <section className="rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-liams-navy">Réservations récurrentes validées</h2>
          <div className="mt-3 flex flex-col gap-2">
            {recurrencesActives.map((rec) => (
              <div key={rec.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2 text-sm">
                <span>
                  Tous les {JOURS_SEMAINE[rec.jour_semaine]} {rec.heure_debut}–{rec.heure_fin}
                </span>
                <form action={refuserRecurrence}>
                  <input type="hidden" name="recurrence_id" value={rec.id} />
                  <button
                    type="submit"
                    className="rounded-full border border-red-300 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    Annuler la récurrence
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Annuler sans retour laisse douter que quelque chose se soit passé —
          d'autant que le créneau disparaît, ce qui ressemble à un écran qui
          n'aurait pas répondu. */}
      {annule === "avec_reservations" && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Créneau annulé. Les familles concernées ont été prévenues par email.
        </p>
      )}
      {annule === "1" && (
        <p className="rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-700">
          Créneau retiré de votre calendrier.
        </p>
      )}
      {annule === "serie_avec_familles" && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Série supprimée. Les familles concernées ont reçu votre explication par
          email et leurs gardes ont été annulées.
        </p>
      )}
      {annule === "serie" && (
        <p className="rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-700">
          Série supprimée. Aucune famille n&apos;y avait réservé.
        </p>
      )}
      {annule === "serie_libres" && (
        <p className="rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-700">
          Créneaux libres retirés. Les gardes déjà réservées sont conservées et
          restent à votre calendrier.
        </p>
      )}
      {annule === "motif_manquant" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Suppression annulée : une explication est nécessaire lorsque des
          familles peuvent être concernées.
        </p>
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
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-400" /> Complet
          </span>
          <span className="ml-3 text-gray-400">
            Les places libres s&apos;affichent sur les créneaux qui en accueillent
            plusieurs.
          </span>
        </p>
        <WeekCalendar
          weekStart={weekStart}
          basePath="/planning"
          slots={(slots ?? []) as CalendarSlot[]}
          editable
          addSlotAction={ajouterCreneau}
          slotFooters={Object.fromEntries(
            (slots ?? []).map((slot) => {
              const restantes = restantesParSlot.get(slot.id) ?? slot.capacite ?? 1;
              const capacite = slot.capacite ?? 1;
              const complet = restantes === 0;

              return [
                slot.id,
                <div key={slot.id} className="flex flex-col gap-0.5">
                  {/* On ne mentionne les places que lorsqu'elles disent quelque
                      chose : sur un créneau d'une place encore libre, c'est du
                      bruit. */}
                  {(capacite > 1 || complet) && (
                    <span
                      className={`text-[10px] ${complet ? "text-gray-500" : "text-liams-teal"}`}
                    >
                      {complet
                        ? "Complet"
                        : `${restantes}/${capacite} place${restantes > 1 ? "s" : ""} libre${restantes > 1 ? "s" : ""}`}
                    </span>
                  )}
                  <SupprimerCreneauButton
                    slotId={slot.id}
                    placesReservees={capacite - restantes}
                  />
                </div>,
              ];
            }),
          )}
        />
      </section>

      {/* Les créneaux passés ne se règlent plus : seuls ceux à venir sont
          listés, et bornés à deux mois pour que la liste reste lisible. */}
      <CreneauxAVenir
        lieuAccueilProfil={profilPro?.lieu_accueil}
        creneaux={(slots ?? [])
          .filter((s) => s.date >= todayISO())
          .slice(0, 60)
          .map((s) => ({
            id: s.id,
            date: s.date,
            heure_debut: s.heure_debut,
            heure_fin: s.heure_fin,
            capacite: s.capacite ?? 1,
            types_accueil: s.types_accueil ?? ["ponctuel"],
            lieu_accueil: s.lieu_accueil ?? null,
            placesRestantes: restantesParSlot.get(s.id) ?? s.capacite ?? 1,
          }))}
      />

      <RecurrencesList
        recurrences={
          (recurrences ?? []).map((rec) => ({
            ...rec,
            // Combien de créneaux de cette série une famille a-t-elle pris :
            // c'est ce qui décide si la suppression doit poser une question.
            reservations: (slots ?? []).filter(
              (s) =>
                s.recurrence_id === rec.id &&
                (restantesParSlot.get(s.id) ?? s.capacite ?? 1) < (s.capacite ?? 1),
            ).length,
          })) as RecurrenceExistante[]
        }
      />

      <CreneauRecurrentForm lieuAccueilProfil={profilPro?.lieu_accueil} />

      <NavigationBas />
    </div>
  );
}
