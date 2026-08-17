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
  type EnfantConcerne,
  type CritereRecherche,
} from "@/lib/matching";
import { distanceKm } from "@/lib/geo";
import { WeekCalendar, type CalendarSlot } from "@/components/WeekCalendar";
import { PhotoProfil } from "@/components/PhotoProfil";
import { BadgeIcone } from "@/components/BadgeIcone";
import { NavigationBas } from "@/components/NavigationBas";
import { AnnulerReservationButton } from "./AnnulerReservationButton";
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
  enfantFiltre,
  typeAccueil,
  tri = "distance",
  depuisPro,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>;
  userId: string;
  weekStart: string;
  /** Identifiant de l'enfant dont on veut voir le seul planning. Absent : tous. */
  enfantFiltre?: string;
  /** Ce que le parent cherche, choisi à la page d'orientation. Filtre les
   * professionnels proposés et suivra la demande jusqu'au contrôle en base. */
  typeAccueil?: "longue_duree" | "ponctuel";
  /** Critère de classement du catalogue. Le réseau passe devant quoi qu'il en
   * soit. */
  tri?: "distance" | "prix" | "note" | "trajet";
  /** Professionnel déjà retenu pour un premier enfant : les autres sont alors
   * classés par leur distance à celui-là. */
  depuisPro?: string;
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
    { data: identitesPros },
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
        "id, statut, professional_id, enfant_ids, slot:availability_slots(id, date, heure_debut, heure_fin)",
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
      .select(
        "id, professional_id, date, heure_debut, heure_fin, statut, age_min_mois, age_max_mois, capacite",
      )
      .gte("date", todayISO()),
    supabase.from("parent_networks").select("professional_id, statut").eq("parent_id", userId),
    // Tous les badges : les manuels alimentent les filtres, mais il faut
    // aussi le libellé de l'automatique (coup de cœur) pour l'afficher.
    supabase.from("badges").select("code, label, source, pour_etablissement").order("code"),
    supabase.from("professional_photos").select("professional_id, fichier_url").order("ordre"),
    supabase
      .from("demandes_creneaux")
      .select("id, professional_id, statut, enfant_ids")
      .eq("parent_id", userId)
      .in("statut", ["en_attente", "traitee"]),
    supabase.from("identites").select("user_id, prenom, nom"),
  ]);

  // Les cartes n'affichaient que le tarif et la distance : un parent comparait
  // des inconnus. L'identité d'un professionnel est lisible de tout compte
  // connecté, il n'y a aucune raison de la taire ici.
  const nomParPro = new Map(
    (identitesPros ?? []).map((i) => [
      i.user_id,
      [i.prenom, i.nom].filter(Boolean).join(" ") || "Professionnel",
    ]),
  );

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
  const reservationsParSlot = new Map<
    string,
    {
      slot: SlotJoint;
      statut: string;
      professionalId: string;
      bookingId: string;
      enfantIds: string[];
    }
  >();
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
      bookingId: booking.id,
      enfantIds: booking.enfant_ids ?? [],
    });
  }

  // Prénoms des enfants réservés, pour proposer de n'en retirer qu'un.
  const { data: mesEnfants } = await supabase
    .from("enfants")
    .select("id, prenom, date_naissance")
    .eq("parent_id", userId);
  const prenomParEnfant = new Map((mesEnfants ?? []).map((e) => [e.id, e.prenom]));

  /** Les enfants pour qui l'on cherche.
   *
   * Plusieurs, car une fratrie se place le plus souvent ensemble — et parce
   * qu'un établissement les répartira dans deux sections différentes, ce que
   * seule une recherche qui les connaît tous les deux peut annoncer.
   *
   * Un enfant unique se sélectionne tout seul : le filtre n'apparaît qu'à
   * partir de deux, et exiger un choix qu'on ne peut pas faire bloquerait la
   * recherche. */
  const enfantsDuParent = mesEnfants ?? [];
  const idsSelectionnes = new Set(
    (enfantFiltre ? enfantFiltre.split(",") : []).filter(Boolean),
  );
  const enfantsRetenus =
    idsSelectionnes.size > 0
      ? enfantsDuParent.filter((e) => idsSelectionnes.has(e.id))
      : enfantsDuParent.length === 1
        ? enfantsDuParent
        : [];

  const enfantsPourRecherche: EnfantConcerne[] = enfantsRetenus
    .filter((e) => e.date_naissance)
    .map((e) => ({ id: e.id, dateNaissance: e.date_naissance as string }));

  /** Le lien qui ajoute ou retire un enfant de la sélection, sans perdre les
   *  autres — cocher son cadet ne doit pas décocher son aîné. */
  const lienBascule = (id: string) => {
    const suivants = new Set(enfantsRetenus.map((e) => e.id));
    if (suivants.has(id)) suivants.delete(id);
    else suivants.add(id);
    const liste = [...suivants];
    return liste.length > 0 ? `/planning?enfant=${liste.join(",")}` : "/planning";
  };

  /** Une réservation concerne-t-elle l'enfant filtré ?
   *
   * Sans filtre, tout passe. Une réservation antérieure aux enfants sur les
   * réservations n'en déclare aucun : on la montre plutôt que de la cacher,
   * une garde oubliée du calendrier étant pire qu'une garde mal rangée. */
  const concerneEnfant = (ids: string[]) =>
    idsSelectionnes.size === 0 ||
    ids.length === 0 ||
    ids.some((id) => idsSelectionnes.has(id));

  const prenomsDe = (ids: string[]) =>
    ids.map((id) => prenomParEnfant.get(id)).filter(Boolean).join(", ");

  for (const {
    slot,
    statut,
    professionalId,
    bookingId,
    enfantIds,
  } of reservationsParSlot.values()) {
    if (!concerneEnfant(enfantIds)) continue;

    slots.push({
      id: slot.id,
      date: slot.date,
      heure_debut: slot.heure_debut,
      heure_fin: slot.heure_fin,
      statut: statut === "confirme" ? "libre" : "libre_urgence",
    });
    footers[slot.id] = (
      <div className="flex flex-col gap-0.5">
        {/* Le prénom sur la réservation : sans lui, la vue d'ensemble d'un
            parent de deux enfants est illisible. */}
        {prenomsDe(enfantIds) && (
          <span className="text-[10px] font-medium text-liams-navy">
            {prenomsDe(enfantIds)}
          </span>
        )}
        <Link
          href={`/reseau/${professionalId}`}
          className="text-[10px] underline opacity-70 hover:opacity-100"
        >
          Voir le pro
        </Link>
        <AnnulerReservationButton
          type="urgente"
          reservationId={bookingId}
          enfants={enfantIds
            .map((id) => ({ id, prenom: prenomParEnfant.get(id) ?? "" }))
            .filter((e) => e.prenom)}
        />
      </div>
    );
  }

  // 1 bis. Créneaux demandés en groupe : acceptés par le professionnel
  //    (confirmés) ou encore proposés (en attente de sa validation).
  const demandeParId = new Map((demandes ?? []).map((d) => [d.id, d]));
  for (const ligne of lignesDemandes ?? []) {
    const slot = ligne.slot as unknown as SlotJoint | null;
    if (!slot || reservationsParSlot.has(slot.id)) continue;
    const demande = demandeParId.get(ligne.demande_id);
    const enfantsDemande = (demande?.enfant_ids ?? []) as string[];
    if (!concerneEnfant(enfantsDemande)) continue;

    slots.push({
      id: slot.id,
      date: slot.date,
      heure_debut: slot.heure_debut,
      heure_fin: slot.heure_fin,
      statut: ligne.statut === "accepte" ? "libre" : "libre_urgence",
    });
    if (demande?.professional_id) {
      footers[slot.id] = (
        <div className="flex flex-col gap-0.5">
          {prenomsDe(enfantsDemande) && (
            <span className="text-[10px] font-medium text-liams-navy">
              {prenomsDe(enfantsDemande)}
            </span>
          )}
          <Link
            href={`/reseau/${demande.professional_id}`}
            className="text-[10px] underline opacity-70 hover:opacity-100"
          >
            Voir le pro
          </Link>
        </div>
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

  // Les places encore libres, réservations décomptées. Le statut d'un créneau
  // ne fait plus autorité depuis la 0021 : un créneau complet reste « libre »
  // en base, et la recherche le proposait donc jusqu'ici — la demande partait,
  // puis se faisait refuser faute de place.
  const idsCreneaux = (tousCreneaux ?? []).map((c) => c.id as string);
  const { data: restantes } = idsCreneaux.length
    ? await supabase.rpc("places_restantes_creneaux", { p_slot_ids: idsCreneaux })
    : { data: [] };
  const restantesParSlot = new Map<string, number>(
    ((restantes ?? []) as { slot_id: string; restantes: number }[]).map((r) => [
      r.slot_id,
      r.restantes,
    ]),
  );

  const creneauxParPro = new Map<string, CreneauCalendrier[]>();
  for (const creneau of tousCreneaux ?? []) {
    const liste = creneauxParPro.get(creneau.professional_id) ?? [];
    liste.push({ ...creneau, placesRestantes: restantesParSlot.get(creneau.id) ?? null });
    creneauxParPro.set(creneau.professional_id, liste);
  }
  // Un professionnel qui n'accepte pas ce type d'accueil n'a pas à être
  // proposé : sa demande serait de toute façon refusée en base, et il aurait
  // fallu la décliner à la main.
  const professionnelsRetenus = (professionnels ?? []).filter(
    (p) =>
      !typeAccueil || (p.types_accueil ?? ["ponctuel"]).includes(typeAccueil),
  );

  // Quels professionnels sont des structures. La fiche d'établissement est
  // publique depuis la 0028, et c'est elle qui fait foi — un compte peut le
  // devenir après son inscription.
  const { data: fichesEtablissements } = await supabase
    .from("etablissements")
    .select("professional_id");
  const estEtablissement = new Set(
    (fichesEtablissements ?? []).map((e) => e.professional_id as string),
  );

  const candidats: ProfessionalCandidat[] = professionnelsRetenus.map((p) => ({
    user_id: p.user_id,
    slots: creneauxParPro.get(p.user_id) ?? [],
    latitude: p.latitude,
    longitude: p.longitude,
    rayon_km: p.rayon_km,
    specialisations: p.specialisations ?? [],
    note_moyenne: p.note_moyenne,
    badges: (p.professional_badges ?? []).map((b: { badge_code: string }) => b.badge_code),
    est_etablissement: estEtablissement.has(p.user_id),
  }));

  // Les badges qu'une structure ne peut pas cocher, et qu'elle satisfait donc
  // d'office quand un parent les demande.
  const badgesSansObjetPourEtablissement = (badgesCatalogue ?? [])
    .filter((b) => b.pour_etablissement === false)
    .map((b) => b.code as string);
  const profilsParId = new Map(professionnelsRetenus.map((p) => [p.user_id, p]));
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
        badgesSansObjetPourEtablissement,
        enfants: enfantsPourRecherche,
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
        badgesSansObjetPourEtablissement,
        enfants: enfantsPourRecherche,
      };

  // Les pros du réseau passent devant, sans jamais exclure les autres profils.
  const prioriserReseau = (propositions: PropositionPro[]) => {
    const duReseau = propositions.filter((p) => reseauStatuts.get(p.candidat.user_id) === "accepte");
    const horsReseau = propositions.filter((p) => reseauStatuts.get(p.candidat.user_id) !== "accepte");
    return [...duReseau, ...horsReseau].slice(0, 4);
  };

  type GroupePropositions = {
    cle: string;
    titre: string;
    propositions: PropositionPro[];
    enfants: EnfantConcerne[];
  };
  const groupesPropositions: GroupePropositions[] = [];

  /** Les enfants d'un besoin donné.
   *
   * Le besoin le dit lui-même depuis la 0039, et c'est lui qui fait foi : « les
   * mardis pour Léa » n'est pas la même demande que « les mardis pour les
   * deux ». Les besoins déclarés avant n'en nomment aucun ; pour ceux-là
   * seulement, on retombe sur les enfants cochés à l'écran, faute de mieux. */
  const enfantsDuBesoin = (ids: string[] | null | undefined): EnfantConcerne[] => {
    const retenus = (ids ?? []).length > 0 ? new Set(ids) : null;
    return enfantsDuParent
      .filter((e) => (retenus ? retenus.has(e.id) : enfantsRetenus.some((r) => r.id === e.id)))
      .filter((e) => e.date_naissance)
      .map((e) => ({ id: e.id, dateNaissance: e.date_naissance as string }));
  };

  for (const rec of besoinRecurrences ?? []) {
    const debut = rec.date_debut > today ? rec.date_debut : today;
    const dates = computeRecurringDates(debut, rec.date_fin, rec.jours);
    if (dates.length === 0) continue;
    const enfantsDeLaSerie = enfantsDuBesoin(rec.enfant_ids);
    groupesPropositions.push({
      cle: `serie-${rec.id}`,
      titre: `Tous les ${rec.jours.map((j: number) => JOURS_SEMAINE[j]).join(", ")} ${rec.heure_debut.slice(0, 5)}–${rec.heure_fin.slice(0, 5)}`,
      enfants: enfantsDeLaSerie,
      propositions: prioriserReseau(
        proposerPourBesoin(candidats, dates, rec.heure_debut, rec.heure_fin, {
          ...criteresParent,
          enfants: enfantsDeLaSerie,
        }),
      ),
    });
  }

  const ponctuelsNonCouverts = (besoins ?? []).filter(
    (b) => !b.recurrence_id && b.date >= today && !estCouvert(b),
  );
  for (const besoin of ponctuelsNonCouverts.slice(0, 6)) {
    const enfantsDuPonctuel = enfantsDuBesoin(besoin.enfant_ids);
    groupesPropositions.push({
      cle: `besoin-${besoin.id}`,
      titre: `${JOURS_SEMAINE[isoWeekday(besoin.date)]} ${formatDateLabel(besoin.date)} ${besoin.heure_debut.slice(0, 5)}–${besoin.heure_fin.slice(0, 5)}`,
      enfants: enfantsDuPonctuel,
      propositions: prioriserReseau(
        proposerPourBesoin(candidats, [besoin.date], besoin.heure_debut, besoin.heure_fin, {
          ...criteresParent,
          enfants: enfantsDuPonctuel,
        }),
      ),
    });
  }

  // Catalogue complet filtré par les seuls critères du parent (sans contrainte
  // de date) : permet d'explorer les profils même sans besoin déclaré.
  const catalogue = matchProfessionnels(candidats, criteresParent);

  /** Distance depuis un professionnel déjà retenu, plutôt que depuis le
   * domicile.
   *
   * Un parent qui place deux enfants chez deux personnes ne se soucie pas
   * d'abord de leur distance à chez lui : c'est lui qui fera le trajet de
   * l'une à l'autre, deux fois par jour. */
  const profilDepuis = depuisPro ? profilsParId.get(depuisPro) : null;
  const origineDepuis =
    profilDepuis?.latitude != null && profilDepuis?.longitude != null
      ? { latitude: profilDepuis.latitude, longitude: profilDepuis.longitude }
      : null;

  const distanceDepuis = (userId: string): number | null => {
    if (!origineDepuis) return null;
    const p = profilsParId.get(userId);
    if (p?.latitude == null || p?.longitude == null) return null;
    return Math.round(distanceKm(origineDepuis, { latitude: p.latitude, longitude: p.longitude }) * 10) / 10;
  };

  const valeurTri = (m: (typeof catalogue)[number]): number => {
    const p = profilsParId.get(m.candidat.user_id);
    switch (tri) {
      case "prix":
        // Sans tarif déclaré, on renvoie en fin de liste plutôt qu'en tête :
        // un profil incomplet ne doit pas paraître le moins cher.
        return p?.tarif_horaire ?? Number.POSITIVE_INFINITY;
      case "note":
        return -(m.candidat.note_moyenne ?? -1);
      case "trajet":
        return distanceDepuis(m.candidat.user_id) ?? Number.POSITIVE_INFINITY;
      default:
        return m.distanceKm ?? Number.POSITIVE_INFINITY;
    }
  };

  // Le réseau reste en tête quel que soit le tri : un professionnel qu'on
  // connaît déjà passe avant un inconnu moins cher.
  const parReseau = (m: (typeof catalogue)[number]) =>
    reseauStatuts.get(m.candidat.user_id) === "accepte" ? 0 : 1;

  const catalogueTrie = [...catalogue].sort(
    (a, b) => parReseau(a) - parReseau(b) || valeurTri(a) - valeurTri(b),
  );

  /** Lien de tri conservant les autres filtres : changer le classement ne doit
   * pas faire perdre l'enfant sélectionné ni le type d'accueil cherché. */
  const lienTri = (nouveauTri: string, depuis: string | null = depuisPro ?? null) => {
    const params = new URLSearchParams();
    if (nouveauTri !== "distance") params.set("tri", nouveauTri);
    if (depuis) params.set("depuis", depuis);
    if (enfantFiltre) params.set("enfant", enfantFiltre);
    if (typeAccueil) params.set("type", typeAccueil);
    const suite = params.toString();
    return suite ? `/planning?${suite}` : "/planning";
  };

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
            {nomParPro.get(professionalId) ?? "Professionnel"}
          </span>
          <span className="text-sm text-gray-600">
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
              // Le type suit le parent jusqu'à la demande : c'est lui qui sera
              // confronté aux types du créneau au moment d'enregistrer.
              href={`/reseau/${professionalId}${typeAccueil ? `?type=${typeAccueil}` : ""}`}
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

        {/* Un parent de deux enfants lit un calendrier où tout se mélange :
            l'un chez une assistante maternelle le matin, l'autre récupéré le
            soir. Le filtre rend chaque planning lisible séparément. */}
        {enfantsDuParent.length > 1 && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {/* Plusieurs enfants se cochent ensemble : une fratrie se place le
                plus souvent au même endroit, et c'est précisément ce qu'il faut
                savoir pour lui chercher deux places. */}
            {enfantsDuParent.map((enfant) => (
              <Link
                key={enfant.id}
                href={lienBascule(enfant.id)}
                className={`rounded-full px-3 py-1 text-xs ${
                  idsSelectionnes.has(enfant.id)
                    ? "bg-liams-navy text-white"
                    : "border border-gray-300 text-gray-600 hover:border-liams-navy"
                }`}
              >
                {enfant.prenom}
              </Link>
            ))}
            {idsSelectionnes.size > 0 && (
              <Link href="/planning" className="text-xs text-gray-500 underline">
                Tout afficher
              </Link>
            )}
          </div>
        )}
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
          enfants={enfantsDuParent.map((e) => ({ id: e.id, prenom: e.prenom }))}
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

      {/* Sans savoir pour qui, on ne peut pas proposer : les créneaux d'un
          établissement sont ouverts par section, et l'âge décide. Mieux vaut le
          dire que présenter une liste fausse dont rien n'indiquerait qu'elle
          l'est. */}
      {/* Plus de « pour qui cherchez-vous ? » : depuis la 0039 le besoin le dit
          lui-même, et le filtre du haut est redevenu ce qu'il aurait toujours
          dû être — un moyen de lire son calendrier, pas de déclarer une
          intention. */}
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
                <h3 className="text-sm font-semibold text-liams-navy">
                  {groupe.titre}
                  {groupe.enfants.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-gray-500">
                      pour{" "}
                      {groupe.enfants
                        .map((e) => prenomParEnfant.get(e.id) ?? "cet enfant")
                        .join(" et ")}
                    </span>
                  )}
                </h3>
                {groupe.propositions.length === 0 ? (
                  <p className="mt-1 text-xs text-gray-500">
                    Aucun professionnel disponible pour l&apos;instant — élargissez vos
                    critères ci-dessus, ou parcourez tous les profils en bas de page.
                  </p>
                ) : (
                  <div className="mt-2 flex flex-col gap-2">
                    {groupe.propositions.map((prop) => {
                      const eligibles = prop.couvertures.map(
                        (c) => prenomParEnfant.get(c.enfantId) ?? "cet enfant",
                      );
                      // Aucune section à leur âge : ce n'est pas une question
                      // de place, et aucune décision du parent n'y changera
                      // rien.
                      const horsAge = prop.enfantsNonCouverts.map(
                        (id) => prenomParEnfant.get(id) ?? "cet enfant",
                      );
                      // Les jours où tout le monde ne tient pas. Détaillés
                      // plutôt que résumés : renoncer à un professionnel qui
                      // convient neuf mardis sur dix à cause du dixième serait
                      // perdre une solution pour presque rien.
                      const joursIncomplets = prop.placesParDate.filter(
                        (d) => d.places < eligibles.length,
                      );
                      const joursComplets =
                        prop.placesParDate.length - joursIncomplets.length;
                      // Chacun sa section : leurs créneaux possibles ne se
                      // recoupent pas du tout.
                      const separes =
                        prop.couvertures.length > 1 &&
                        prop.couvertures.every(
                          (c, _, toutes) =>
                            !toutes.some(
                              (autre) =>
                                autre.enfantId !== c.enfantId &&
                                autre.creneaux.some((x) =>
                                  c.creneaux.some((y) => y.id === x.id),
                                ),
                            ),
                        );

                      return (
                        <div key={`${groupe.cle}-${prop.candidat.user_id}`}>
                          {carteProfessionnel(
                            prop.candidat.user_id,
                            prop.distanceKm,
                            prop.candidat.note_moyenne,
                            { datesCouvertes: prop.datesCouvertes, totalDates: prop.totalDates },
                            `carte-${groupe.cle}-${prop.candidat.user_id}`,
                          )}
                          {groupe.enfants.length > 1 && (
                            <p className="mt-1 flex flex-col gap-0.5 pl-1 text-xs">
                              {eligibles.length > 0 && joursComplets > 0 && (
                                <span className="text-liams-teal">
                                  {eligibles.join(" et ")}
                                  {separes ? " — chacun dans sa section" : " — ensemble"}
                                  {joursIncomplets.length > 0 &&
                                    ` · ${joursComplets} date${joursComplets > 1 ? "s" : ""} sur ${prop.placesParDate.length}`}
                                </span>
                              )}
                              {joursIncomplets.length > 0 && (
                                <span className="font-medium text-red-600">
                                  {joursIncomplets.length === prop.placesParDate.length
                                    ? "Aucune place sur les créneaux souhaités pour tous vos enfants : "
                                    : `${joursIncomplets.length} date${joursIncomplets.length > 1 ? "s" : ""} sans place pour tous — `}
                                  {joursIncomplets
                                    .slice(0, 3)
                                    .map(
                                      (d) =>
                                        `${formatDateLabel(d.date)} (${d.places} place${d.places > 1 ? "s" : ""})`,
                                    )
                                    .join(", ")}
                                  {joursIncomplets.length > 3 &&
                                    `, et ${joursIncomplets.length - 3} autre${joursIncomplets.length - 3 > 1 ? "s" : ""}`}
                                  . À vous de désigner qui la prend.
                                </span>
                              )}
                              {horsAge.length > 0 && (
                                <span className="text-red-600">
                                  Aucune section à l&apos;âge de{" "}
                                  {horsAge.join(" ni de ")}.
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                      );
                    })}
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

      <CreneauRecurrentForm
        variante="besoins"
        enfants={enfantsDuParent.map((e) => ({ id: e.id, prenom: e.prenom }))}
      />

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
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500">Classer par</span>
              {[
                { cle: "distance", label: "Distance de chez moi" },
                { cle: "prix", label: "Prix" },
                { cle: "note", label: "Note" },
              ].map((option) => (
                <Link
                  key={option.cle}
                  href={lienTri(option.cle)}
                  className={`rounded-full px-3 py-1 text-xs ${
                    tri === option.cle
                      ? "bg-liams-navy text-white"
                      : "border border-gray-300 text-gray-600 hover:border-liams-navy"
                  }`}
                >
                  {option.label}
                </Link>
              ))}
            </div>

            {/* Le tri par trajet n'a de sens qu'une fois un premier
                professionnel retenu : c'est de lui qu'on mesure la distance. */}
            {depuisPro && (
              <p className="mb-3 rounded-lg bg-liams-teal/5 px-3 py-2 text-xs text-liams-navy">
                Distances mesurées depuis{" "}
                <strong>{nomParPro.get(depuisPro) ?? "le professionnel retenu"}</strong>{" "}
                — pratique si vous placez un second enfant ailleurs.{" "}
                <Link href={lienTri(tri, null)} className="underline">
                  revenir aux distances depuis chez moi
                </Link>
              </p>
            )}

            <div className="flex flex-col gap-2">
              {catalogueTrie.map((m) =>
                carteProfessionnel(
                  m.candidat.user_id,
                  depuisPro ? distanceDepuis(m.candidat.user_id) : m.distanceKm,
                  m.candidat.note_moyenne,
                ),
              )}
            </div>
          </>
        )}
      </details>

      <NavigationBas />
    </div>
  );
}
