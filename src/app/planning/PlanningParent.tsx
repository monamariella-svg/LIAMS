import Link from "next/link";
import type { ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeRecurringDates, formatDateLabel, getWeekDates, isoWeekday, todayISO } from "@/lib/calendar";
import { JOURS_SEMAINE } from "@/lib/disponibilites";
import {
  proposerPourBesoin,
  matchProfessionnels,
  type ProfessionalCandidat,
  type PropositionPro,
  type CreneauCalendrier,
  type CritereRecherche,
} from "@/lib/matching";
import { WeekCalendar, type CalendarSlot } from "@/components/WeekCalendar";
import { PhotoProfil } from "@/components/PhotoProfil";
import { BadgeIcone } from "@/components/BadgeIcone";
import { demanderAjoutReseau } from "@/app/reseau/actions";
import { CreneauRecurrentForm, type RecurrenceExistante } from "./CreneauRecurrentForm";
import { RecurrencesList } from "./RecurrencesList";
import { CriteresForm, type CriteresParent, type BadgeOption } from "./CriteresForm";
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
  const [
    { data: besoins },
    { data: besoinRecurrences },
    { data: bookings },
    { data: recurringBookings },
    { data: parentProfile },
    { data: professionnels },
    { data: tousCreneaux },
    { data: reseau },
    { data: badgesCatalogue },
    { data: photos },
    { data: demandes },
  ] = await Promise.all([
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
    supabase.from("parent_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("professional_profiles").select("*, professional_badges(badge_code)"),
    supabase
      .from("availability_slots")
      .select("id, professional_id, date, heure_debut, heure_fin, statut")
      .gte("date", todayISO()),
    supabase.from("parent_networks").select("professional_id, statut").eq("parent_id", userId),
    // Tous les badges : les manuels alimentent les filtres, mais il faut
    // aussi le libellé de l'automatique (coup de cœur) pour l'afficher.
    supabase.from("badges").select("code, label, source").order("code"),
    supabase.from("professional_photos").select("professional_id, fichier_url").order("ordre"),
    supabase
      .from("demandes_creneaux")
      .select("id, professional_id, statut")
      .eq("parent_id", userId)
      .in("statut", ["en_attente", "traitee"]),
  ]);

  // Créneaux issus des demandes groupées : proposés (en attente) ou acceptés.
  // Requête séparée plutôt qu'un filtre sur table jointe, plus lisible côté
  // PostgREST et plus simple à faire évoluer.
  const { data: lignesDemandes } = (demandes ?? []).length
    ? await supabase
        .from("demande_creneau_lignes")
        .select("demande_id, statut, slot:availability_slots(id, date, heure_debut, heure_fin)")
        .in("demande_id", (demandes ?? []).map((d) => d.id))
        .in("statut", ["propose", "accepte"])
    : { data: [] };

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

  // 1 bis. Créneaux demandés en groupe : acceptés par le professionnel
  //    (confirmés) ou encore proposés (en attente de sa validation).
  const demandeParId = new Map((demandes ?? []).map((d) => [d.id, d]));
  for (const ligne of lignesDemandes ?? []) {
    const slot = ligne.slot as unknown as SlotJoint | null;
    if (!slot || reservationsParSlot.has(slot.id)) continue;
    const professionalId = demandeParId.get(ligne.demande_id)?.professional_id;
    slots.push({
      id: slot.id,
      date: slot.date,
      heure_debut: slot.heure_debut,
      heure_fin: slot.heure_fin,
      statut: ligne.statut === "accepte" ? "libre" : "libre_urgence",
    });
    if (professionalId) {
      footers[slot.id] = (
        <Link
          href={`/reseau/${professionalId}`}
          className="text-[10px] underline opacity-70 hover:opacity-100"
        >
          Voir le pro
        </Link>
      );
    }
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
  const creneauxEngages: SlotJoint[] = [
    ...[...reservationsParSlot.values()].map((r) => r.slot),
    ...(lignesDemandes ?? [])
      .map((l) => l.slot as unknown as SlotJoint | null)
      .filter((s): s is SlotJoint => s !== null),
  ];

  const estCouvert = (besoin: { date: string; heure_debut: string; heure_fin: string }) => {
    for (const slot of creneauxEngages) {
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
        <form action={supprimerBesoin}>
          <input type="hidden" name="besoin_id" value={besoin.id} />
          <button type="submit" className="text-[10px] underline opacity-70 hover:opacity-100">
            Retirer
          </button>
        </form>
      </span>
    );
  }

  // ---- Propositions de profils, calculées par besoin (matching proactif) ----
  const today = todayISO();

  const creneauxParPro = new Map<string, CreneauCalendrier[]>();
  for (const creneau of tousCreneaux ?? []) {
    const liste = creneauxParPro.get(creneau.professional_id) ?? [];
    liste.push(creneau);
    creneauxParPro.set(creneau.professional_id, liste);
  }
  const candidats: ProfessionalCandidat[] = (professionnels ?? []).map((p) => ({
    user_id: p.user_id,
    slots: creneauxParPro.get(p.user_id) ?? [],
    latitude: p.latitude,
    longitude: p.longitude,
    rayon_km: p.rayon_km,
    specialisations: p.specialisations ?? [],
    note_moyenne: p.note_moyenne,
    badges: (p.professional_badges ?? []).map((b: { badge_code: string }) => b.badge_code),
  }));
  const profilsParId = new Map((professionnels ?? []).map((p) => [p.user_id, p]));
  const labelsBadges = new Map<string, string>(
    (badgesCatalogue ?? []).map((b) => [b.code, b.label]),
  );
  const reseauStatuts = new Map<string, string>(
    (reseau ?? []).map((r) => [r.professional_id, r.statut]),
  );
  // Première photo de chaque pro : la requête est triée par ordre, donc la
  // première rencontrée pour un professionnel est la bonne.
  const photoParPro = new Map<string, string>();
  for (const photo of photos ?? []) {
    if (!photoParPro.has(photo.professional_id)) {
      photoParPro.set(photo.professional_id, photo.fichier_url);
    }
  }
  // Critères stables du parent, saisis une fois et appliqués à toutes les
  // propositions. La zone est soit une ville, soit un trajet — dans les deux
  // cas le rayon saisi donne la distance d'éloignement acceptée.
  const rayonKm = parentProfile?.rayon_km ?? undefined;
  const modeTrajet =
    parentProfile?.mode_zone === "trajet" &&
    parentProfile?.trajet_depart_latitude != null &&
    parentProfile?.trajet_arrivee_latitude != null;

  const criteresParent: CritereRecherche = modeTrajet
    ? {
        trajetDepart: {
          latitude: parentProfile!.trajet_depart_latitude,
          longitude: parentProfile!.trajet_depart_longitude,
        },
        trajetArrivee: {
          latitude: parentProfile!.trajet_arrivee_latitude,
          longitude: parentProfile!.trajet_arrivee_longitude,
        },
        couloirTrajetKm: rayonKm,
        badgesRequis: parentProfile?.badges_souhaites ?? [],
      }
    : {
        // À défaut de ville renseignée, on retombe sur l'adresse du profil.
        origine:
          parentProfile?.ville_latitude != null && parentProfile?.ville_longitude != null
            ? { latitude: parentProfile.ville_latitude, longitude: parentProfile.ville_longitude }
            : parentProfile?.latitude != null && parentProfile?.longitude != null
              ? { latitude: parentProfile.latitude, longitude: parentProfile.longitude }
              : undefined,
        rayonKm,
        badgesRequis: parentProfile?.badges_souhaites ?? [],
      };

  // Les pros du réseau passent devant, sans jamais exclure les autres profils.
  const prioriserReseau = (propositions: PropositionPro[]) => {
    const duReseau = propositions.filter((p) => reseauStatuts.get(p.candidat.user_id) === "accepte");
    const horsReseau = propositions.filter((p) => reseauStatuts.get(p.candidat.user_id) !== "accepte");
    return [...duReseau, ...horsReseau].slice(0, 4);
  };

  type GroupePropositions = { cle: string; titre: string; propositions: PropositionPro[] };
  const groupesPropositions: GroupePropositions[] = [];

  for (const rec of besoinRecurrences ?? []) {
    const debut = rec.date_debut > today ? rec.date_debut : today;
    const dates = computeRecurringDates(debut, rec.date_fin, rec.jours);
    if (dates.length === 0) continue;
    groupesPropositions.push({
      cle: `serie-${rec.id}`,
      titre: `Tous les ${rec.jours.map((j: number) => JOURS_SEMAINE[j]).join(", ")} ${rec.heure_debut.slice(0, 5)}–${rec.heure_fin.slice(0, 5)}`,
      propositions: prioriserReseau(
        proposerPourBesoin(candidats, dates, rec.heure_debut, rec.heure_fin, criteresParent),
      ),
    });
  }

  const ponctuelsNonCouverts = (besoins ?? []).filter(
    (b) => !b.recurrence_id && b.date >= today && !estCouvert(b),
  );
  for (const besoin of ponctuelsNonCouverts.slice(0, 6)) {
    groupesPropositions.push({
      cle: `besoin-${besoin.id}`,
      titre: `${JOURS_SEMAINE[isoWeekday(besoin.date)]} ${formatDateLabel(besoin.date)} ${besoin.heure_debut.slice(0, 5)}–${besoin.heure_fin.slice(0, 5)}`,
      propositions: prioriserReseau(
        proposerPourBesoin(candidats, [besoin.date], besoin.heure_debut, besoin.heure_fin, criteresParent),
      ),
    });
  }

  // Catalogue complet filtré par les seuls critères du parent (sans contrainte
  // de date) : permet d'explorer les profils même sans besoin déclaré.
  const catalogue = matchProfessionnels(candidats, criteresParent);
  const catalogueTrie = [
    ...catalogue.filter((m) => reseauStatuts.get(m.candidat.user_id) === "accepte"),
    ...catalogue.filter((m) => reseauStatuts.get(m.candidat.user_id) !== "accepte"),
  ];

  const aucunBesoin = (besoins ?? []).length === 0 && (besoinRecurrences ?? []).length === 0;

  // Une carte de professionnel, partagée par les propositions et le catalogue.
  const carteProfessionnel = (
    professionalId: string,
    distanceKm: number | null,
    noteMoyenne: number | null,
    couverture?: { datesCouvertes: number; totalDates: number },
    cle?: string,
  ) => {
    const profil = profilsParId.get(professionalId);
    const statutReseau = reseauStatuts.get(professionalId);
    return (
      <div key={cle ?? professionalId} className="rounded-lg border border-gray-100 px-4 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="flex flex-wrap items-center gap-2">
          <PhotoProfil fichierUrl={photoParPro.get(professionalId)} taille={40} />
          {statutReseau === "accepte" && (
            <span className="rounded-full bg-liams-teal/10 px-2 py-0.5 text-xs font-medium text-liams-teal">
              Votre réseau
            </span>
          )}
          <span className="font-medium text-liams-navy">
            {profil?.tarif_horaire ? `${profil.tarif_horaire} €/h` : "Tarif non renseigné"}
            {distanceKm !== null && ` — ${distanceKm.toFixed(1)} km`}
          </span>
          {profil?.tarif_horaire_urgence && (
            <span className="rounded-full bg-liams-orange/10 px-2 py-0.5 text-xs text-liams-orange">
              {profil.tarif_horaire_urgence} €/h en urgence
            </span>
          )}
          <span className="flex items-center gap-1">
            {(profil?.professional_badges ?? []).map((b: { badge_code: string }) => (
              <BadgeIcone
                key={b.badge_code}
                code={b.badge_code}
                label={labelsBadges.get(b.badge_code) ?? b.badge_code}
                compact
                taille={26}
              />
            ))}
          </span>
          {noteMoyenne && <span className="text-xs text-liams-orange">★ {noteMoyenne}</span>}
          {couverture && couverture.totalDates > 1 && (
            <span className="text-xs text-gray-500">
              couvre {couverture.datesCouvertes}/{couverture.totalDates} dates
            </span>
          )}
        </span>
        <span className="flex items-center gap-2">
          <Link
            href={`/professionnels/${professionalId}`}
            className="text-xs text-liams-navy underline"
          >
            Voir le profil
          </Link>
          {statutReseau === "accepte" ? (
            <Link
              href={`/reseau/${professionalId}`}
              className="rounded-full bg-liams-teal px-3 py-1 text-xs font-medium text-white hover:opacity-90"
            >
              Réserver ses créneaux
            </Link>
          ) : statutReseau === "en_attente" ? (
            <span className="text-xs text-gray-400">Demande de réseau envoyée</span>
          ) : (
            <form action={demanderAjoutReseau}>
              <input type="hidden" name="professional_id" value={professionalId} />
              <button
                type="submit"
                className="rounded-full bg-liams-orange px-3 py-1 text-xs font-medium text-white hover:opacity-90"
              >
                Ajouter à mon réseau
              </button>
            </form>
          )}
        </span>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-12">
      <Link href="/tableau-de-bord" className="self-start text-sm text-liams-navy underline">
        ← Retour au tableau de bord
      </Link>
      <h1 className="text-2xl font-semibold text-liams-navy">Mes besoins de garde</h1>

      <CriteresForm
        criteres={(parentProfile ?? null) as CriteresParent | null}
        badgesCatalogue={
          (badgesCatalogue ?? []).filter((b) => b.source === "manuel") as BadgeOption[]
        }
        ouvertParDefaut={aucunBesoin}
      />

      {aucunBesoin && (
        <p className="rounded-xl bg-liams-teal/5 px-6 py-4 text-sm text-liams-navy">
          Commencez par indiquer quand vous avez besoin d&apos;une garde : cliquez sur
          « + Ajouter » dans le calendrier ci-dessous pour un besoin ponctuel, ou
          utilisez le formulaire « Besoins récurrents » si c&apos;est chaque semaine.
          Les professionnels disponibles vous seront alors proposés automatiquement.
        </p>
      )}

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

      {groupesPropositions.length > 0 && (
        <section className="rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-liams-navy">
            Profils proposés pour vos besoins
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Les professionnels de votre réseau apparaissent en premier. Pour un nouveau
            profil, ajoutez-le à votre réseau : s&apos;il accepte, vous verrez son planning
            et pourrez réserver directement.
          </p>
          <div className="mt-4 flex flex-col gap-5">
            {groupesPropositions.map((groupe) => (
              <div key={groupe.cle}>
                <h3 className="text-sm font-semibold text-liams-navy">{groupe.titre}</h3>
                {groupe.propositions.length === 0 ? (
                  <p className="mt-1 text-xs text-gray-500">
                    Aucun professionnel disponible pour l&apos;instant — élargissez vos
                    critères ci-dessus, ou parcourez tous les profils en bas de page.
                  </p>
                ) : (
                  <div className="mt-2 flex flex-col gap-2">
                    {groupe.propositions.map((prop) =>
                      carteProfessionnel(
                        prop.candidat.user_id,
                        prop.distanceKm,
                        prop.candidat.note_moyenne,
                        { datesCouvertes: prop.datesCouvertes, totalDates: prop.totalDates },
                        `${groupe.cle}-${prop.candidat.user_id}`,
                      ),
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <RecurrencesList
        recurrences={(besoinRecurrences ?? []) as RecurrenceExistante[]}
        variante="besoins"
      />

      <CreneauRecurrentForm variante="besoins" />

      <details className="rounded-xl border border-gray-200 p-6 [&[open]>summary]:mb-4">
        <summary className="cursor-pointer text-base font-semibold text-liams-navy">
          Tous les professionnels
          <span className="ml-2 text-xs font-normal text-gray-500">
            ({catalogueTrie.length} correspondant à vos critères)
          </span>
        </summary>
        {catalogueTrie.length === 0 ? (
          <p className="text-sm text-gray-500">
            Aucun professionnel ne correspond à vos critères — essayez d&apos;élargir la
            distance ou de retirer un accompagnement souhaité.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {catalogueTrie.map((m) =>
              carteProfessionnel(m.candidat.user_id, m.distanceKm, m.candidat.note_moyenne),
            )}
          </div>
        )}
      </details>
    </div>
  );
}
