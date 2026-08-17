import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { NavigationBas } from "@/components/NavigationBas";
import { requireUser } from "@/lib/auth";
import { isoWeekday, startOfWeek, todayISO } from "@/lib/calendar";
import { disponibiliteCreneau } from "@/lib/urgence";
import { PlanningReservable, type CreneauReservable } from "./PlanningReservable";
import { RecurrenceForm } from "./RecurrenceForm";
import { MesRecurrences } from "./MesRecurrences";

export default async function PlanningProfessionnelPage({
  params,
  searchParams,
}: {
  params: Promise<{ professionalId: string }>;
  searchParams: Promise<{ week?: string; type?: string }>;
}) {
  const { professionalId } = await params;
  const { week, type } = await searchParams;
  const typeAccueil =
    type === "longue_duree" || type === "ponctuel" ? type : undefined;
  const { supabase, user } = await requireUser("parent");
  const weekStart = startOfWeek(week || todayISO());

  const { data: reseau } = await supabase
    .from("parent_networks")
    .select("statut")
    .eq("parent_id", user.id)
    .eq("professional_id", professionalId)
    .maybeSingle();

  if (!reseau || reseau.statut !== "accepte") redirect("/reseau");

  const [
    { data: slots },
    { data: mesReservations },
    { data: mesRecurrences },
    { data: besoins },
    { data: besoinRecurrences },
    { data: demandesEnCours },
    { data: enfants },
  ] = await Promise.all([
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
    supabase
      .from("recurring_bookings")
      .select("*")
      .eq("professional_id", professionalId)
      .eq("parent_id", user.id)
      .in("statut", ["en_attente", "actif"])
      .order("created_at"),
    supabase.from("besoins_garde").select("date, heure_debut, heure_fin").eq("parent_id", user.id),
    supabase
      .from("besoin_recurrences")
      .select("jours, heure_debut, heure_fin, date_debut, date_fin")
      .eq("parent_id", user.id),
    supabase
      .from("demandes_creneaux")
      .select("id")
      .eq("parent_id", user.id)
      .eq("professional_id", professionalId)
      .eq("statut", "en_attente"),
    supabase
      .from("enfants")
      .select("id, prenom")
      .eq("parent_id", user.id)
      .order("created_at"),
  ]);

  if (!slots) notFound();

  const mesSlotIds = new Set((mesReservations ?? []).map((r) => r.slot_id));

  // Créneaux déjà demandés : on ne les repropose pas à la sélection, la
  // demande précédente étant encore en attente chez le professionnel.
  const { data: lignesEnCours } = (demandesEnCours ?? []).length
    ? await supabase
        .from("demande_creneau_lignes")
        .select("slot_id")
        .in("demande_id", (demandesEnCours ?? []).map((d) => d.id))
        .eq("statut", "propose")
    : { data: [] };
  const slotsDejaDemandes = new Set((lignesEnCours ?? []).map((l) => l.slot_id));

  // Un créneau "correspond" à un besoin déclaré s'il tombe le même jour et
  // recoupe sa plage horaire — ceux-là sont pré-cochés.
  const chevauche = (aDebut: string, aFin: string, bDebut: string, bFin: string) =>
    aDebut < bFin && bDebut < aFin;

  const correspondAUnBesoin = (slot: { date: string; heure_debut: string; heure_fin: string }) => {
    const ponctuel = (besoins ?? []).some(
      (b) => b.date === slot.date && chevauche(b.heure_debut, b.heure_fin, slot.heure_debut, slot.heure_fin),
    );
    if (ponctuel) return true;

    const jour = isoWeekday(slot.date);
    return (besoinRecurrences ?? []).some(
      (rec) =>
        rec.jours.includes(jour) &&
        slot.date >= rec.date_debut &&
        slot.date <= rec.date_fin &&
        chevauche(rec.heure_debut, rec.heure_fin, slot.heure_debut, slot.heure_fin),
    );
  };

  const aujourdHui = todayISO();
  const maintenant = new Date();

  const candidats = (slots ?? []).filter(
    (slot) => slot.date >= aujourdHui && !slotsDejaDemandes.has(slot.id),
  );

  // Les places restantes se calculent en base pour toute la liste d'un coup :
  // un créneau plein n'est pas proposé, un créneau partiel affiche ce qui
  // reste — un parent de deux enfants peut vouloir en placer un ici.
  const { data: restantes } = candidats.length
    ? await supabase.rpc("places_restantes_creneaux", {
        p_slot_ids: candidats.map((s) => s.id),
      })
    : { data: [] };
  const restantesParSlot = new Map<string, number>(
    ((restantes ?? []) as { slot_id: string; restantes: number }[]).map((r) => [
      r.slot_id,
      r.restantes,
    ]),
  );

  const reservables: CreneauReservable[] = candidats
    .filter((slot) => (restantesParSlot.get(slot.id) ?? 0) > 0)
    // Le parent cherche un type précis : un créneau qui ne le propose pas
    // serait refusé en base, autant ne pas le montrer.
    .filter(
      (slot) =>
        !typeAccueil || (slot.types_accueil ?? ["ponctuel"]).includes(typeAccueil),
    )
    // On ne montre que ce qui est commandable maintenant : un créneau barré
    // d'un motif alourdit la liste sans rien apporter.
    //
    // La fenêtre d'urgence ne s'applique qu'aux créneaux réservés à l'urgence.
    // Un créneau qui sert aussi au ponctuel reste commandable à ce titre, quel
    // que soit le délai — d'où la lecture des types plutôt que du statut, ce
    // dernier étant hérité et trompeur sur les créneaux d'avant la capacité.
    .filter((slot) => {
      const types = (slot.types_accueil ?? ["ponctuel"]) as string[];
      const urgenceSeule = types.length === 1 && types[0] === "urgence";
      return disponibiliteCreneau(
        { ...slot, statut: urgenceSeule ? "libre_urgence" : "libre" },
        maintenant,
      ).demandable;
    })
    .map((slot) => {
      const { demandable, raison } = disponibiliteCreneau(slot, maintenant);
      return {
        id: slot.id,
        date: slot.date,
        heure_debut: slot.heure_debut,
        heure_fin: slot.heure_fin,
        statut: slot.statut,
        correspondBesoin: correspondAUnBesoin(slot),
        demandable,
        raison,
        placesRestantes: restantesParSlot.get(slot.id) ?? 0,
        capacite: slot.capacite ?? 1,
      };
    });
  const nbCorrespondants = reservables.filter((c) => c.demandable && c.correspondBesoin).length;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-12">
      <h1 className="text-2xl font-semibold text-liams-navy">Planning du professionnel</h1>

      <p className="text-xs text-gray-500">
        Cochez les créneaux qui vous conviennent, puis envoyez votre demande.
        {nbCorrespondants > 0 &&
          " Ceux qui correspondent à vos besoins déclarés sont déjà cochés."}{" "}
        Les créneaux d&apos;urgence ne se demandent qu&apos;entre 20 h et 2 h avant leur début.
      </p>
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

      <PlanningReservable
        professionalId={professionalId}
        weekStart={weekStart}
        slots={slots}
        mesReservationIds={[...mesSlotIds]}
        reservables={reservables}
        enfants={enfants ?? []}
        typeAccueil={typeAccueil}
      />

      <MesRecurrences
        professionalId={professionalId}
        reservations={mesRecurrences ?? []}
        enfants={enfants ?? []}
      />

      <RecurrenceForm professionalId={professionalId} enfants={enfants ?? []} />

      {/* Une demande envoyée appelle souvent la suivante — un autre enfant, un
          autre jour, une garde d'urgence. Repasser par le tableau de bord pour
          y revenir fait perdre le fil ; le choix du type d'accueil est à un
          clic. */}
      <Link
        href="/recherche"
        className="self-start rounded-full border border-liams-navy px-6 py-2.5 text-sm font-medium text-liams-navy transition-colors hover:bg-liams-navy hover:text-white"
      >
        Faire une nouvelle demande
      </Link>

      <NavigationBas />
    </div>
  );
}
