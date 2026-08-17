"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { compteProfessionnelActif, requireUser } from "@/lib/auth";
import { notifierUtilisateur, lienVers } from "@/lib/notify";
import { journaliser } from "@/lib/journal";
import { geocodeAdresse } from "@/lib/geocoding";
import { computeRecurringDates, parseISODate } from "@/lib/calendar";

export type PlanningFormState =
  | { error?: string; success?: boolean; message?: string }
  | undefined;

export async function ajouterCreneau(
  _prevState: PlanningFormState,
  formData: FormData,
): Promise<PlanningFormState> {
  const { supabase, user } = await requireUser("professionnel");
  // Le calendrier appartient à la structure, pas à la personne qui le
  // remplit : un compte d'équipe ouvre les créneaux de sa crèche.
  const { comptePro } = await compteProfessionnelActif(supabase, user.id);

  const date = String(formData.get("date") ?? "");
  const heureDebut = String(formData.get("heure_debut") ?? "");
  const heureFin = String(formData.get("heure_fin") ?? "");
  const statut = String(formData.get("statut") ?? "libre");

  if (!date || !heureDebut || !heureFin) return { error: "Renseignez la date et les horaires." };

  // Un créneau isolé hérite des réglages du profil : poser trois questions de
  // plus pour ajouter un mardi découragerait l'usage. Le professionnel les
  // ajuste ensuite s'il le souhaite.
  const { data: profil } = await supabase
    .from("professional_profiles")
    .select("types_accueil, lieu_accueil")
    .eq("user_id", comptePro)
    .maybeSingle();

  const capaciteSaisie = Number(formData.get("capacite") ?? 0);
  const typesSaisis = formData.getAll("types_accueil").map(String);
  const lieuSaisi = String(formData.get("lieu_accueil") ?? "");

  const { error } = await supabase.from("availability_slots").insert({
    professional_id: comptePro,
    tranche_id: String(formData.get("tranche_id") ?? "") || null,
    date,
    heure_debut: heureDebut,
    heure_fin: heureFin,
    statut,
    capacite: capaciteSaisie >= 1 ? Math.min(20, capaciteSaisie) : 1,
    types_accueil:
      typesSaisis.length > 0 ? typesSaisis : (profil?.types_accueil ?? ["ponctuel"]),
    // « les_deux » au profil veut dire « je choisirai » : sans choix explicite,
    // on ne devine pas à sa place et on laisse le lieu indéterminé.
    lieu_accueil:
      lieuSaisi ||
      (profil?.lieu_accueil && profil.lieu_accueil !== "les_deux"
        ? profil.lieu_accueil
        : null),
  });

  if (error) return { error: error.message };

  revalidatePath("/planning");
  return { success: true };
}

const DUREE_MAX_RECURRENCE_JOURS = 183; // ~6 mois

type ChampsRecurrence = {
  heureDebut: string;
  heureFin: string;
  statut: string;
  dateDebut: string;
  dateFin: string;
  jours: number[];
  dates: string[];
  capacite: number;
  typesAccueil: string[];
  lieuAccueil: string | null;
  trancheId: string | null;
  /** Côté parent seulement : les enfants que ce besoin concerne. */
  enfantIds: string[];
};

function lireChampsRecurrence(
  formData: FormData,
): { error: string } | { champs: ChampsRecurrence } {
  const heureDebut = String(formData.get("heure_debut") ?? "");
  const heureFin = String(formData.get("heure_fin") ?? "");
  const statut = String(formData.get("statut") ?? "libre");
  const dateDebut = String(formData.get("date_debut") ?? "");
  const dateFin = String(formData.get("date_fin") ?? "");
  const jours = formData.getAll("jours").map((j) => Number(j));

  const capacite = Math.min(20, Math.max(1, Number(formData.get("capacite") ?? 1) || 1));
  const typesSaisis = formData.getAll("types_accueil").map(String);
  // Une série sans type d'accueil ne serait proposée à personne.
  const typesAccueil = typesSaisis.length > 0 ? typesSaisis : ["ponctuel"];
  const lieuAccueil = String(formData.get("lieu_accueil") ?? "") || null;
  const trancheId = String(formData.get("tranche_id") ?? "") || null;
  const enfantIds = formData.getAll("enfant_ids").map(String).filter(Boolean);

  if (!heureDebut || !heureFin || !dateDebut || !dateFin || jours.length === 0) {
    return { error: "Choisissez au moins un jour, un horaire et une période." };
  }
  if (heureFin <= heureDebut) {
    return { error: "L'heure de fin doit être après l'heure de début." };
  }
  if (dateFin < dateDebut) {
    return { error: "La date de fin doit être après la date de début." };
  }

  const nbJours =
    (parseISODate(dateFin).getTime() - parseISODate(dateDebut).getTime()) / 86_400_000;
  if (nbJours > DUREE_MAX_RECURRENCE_JOURS) {
    return { error: "La période ne peut pas dépasser 6 mois." };
  }

  const dates = computeRecurringDates(dateDebut, dateFin, jours);
  if (dates.length === 0) {
    return { error: "Aucune date ne correspond à ces critères." };
  }

  return {
    champs: {
      heureDebut,
      heureFin,
      statut,
      dateDebut,
      dateFin,
      jours,
      dates,
      capacite,
      typesAccueil,
      lieuAccueil,
      trancheId,
      enfantIds,
    },
  };
}

async function genererCreneaux(
  supabase: Awaited<ReturnType<typeof createClient>>,
  professionalId: string,
  recurrenceId: string,
  champs: ChampsRecurrence,
) {
  // Chaque créneau généré porte les réglages de sa série : capacité, types
  // d'accueil et lieu s'appliquent à toutes les dates d'un coup.
  const rows = champs.dates.map((date) => ({
    professional_id: professionalId,
    date,
    heure_debut: champs.heureDebut,
    heure_fin: champs.heureFin,
    statut: champs.statut,
    recurrence_id: recurrenceId,
    capacite: champs.capacite,
    types_accueil: champs.typesAccueil,
    lieu_accueil: champs.lieuAccueil,
    // Toute la série ouvre pour la même section : c'est ce qui distingue deux
    // séries aux mêmes horaires dans une crèche qui ouvre plusieurs sections.
    tranche_id: champs.trancheId,
  }));

  // ignoreDuplicates laisse passer sans bruit les créneaux déjà présents à la
  // même date et heure. C'est voulu — modifier une série ne doit pas écraser
  // ce qui existe — mais il faut savoir combien ont réellement été créés,
  // faute de quoi une série entièrement en collision s'annonce réussie sans
  // que rien n'apparaisse au calendrier.
  const { data, error } = await supabase
    .from("availability_slots")
    // La section fait partie de la clé depuis la 0041 : une crèche ouvre
    // plusieurs sections au même horaire, et deux séries pour deux sections ne
    // sont pas des doublons l'une de l'autre.
    .upsert(rows, {
      onConflict: "professional_id,date,heure_debut,tranche_id",
      ignoreDuplicates: true,
    })
    .select("id");

  return { error, crees: data?.length ?? 0, demandes: rows.length };
}

export async function ajouterCreneauxRecurrents(
  _prevState: PlanningFormState,
  formData: FormData,
): Promise<PlanningFormState> {
  const { supabase, user } = await requireUser("professionnel");
  const { comptePro } = await compteProfessionnelActif(supabase, user.id);

  const lu = lireChampsRecurrence(formData);
  if ("error" in lu) return { error: lu.error };
  const { champs } = lu;

  const { data: recurrence, error: erreurSerie } = await supabase
    .from("slot_recurrences")
    .insert({
      professional_id: comptePro,
      jours: champs.jours,
      heure_debut: champs.heureDebut,
      heure_fin: champs.heureFin,
      statut: champs.statut,
      date_debut: champs.dateDebut,
      date_fin: champs.dateFin,
      capacite: champs.capacite,
      types_accueil: champs.typesAccueil,
      lieu_accueil: champs.lieuAccueil,
      tranche_id: champs.trancheId,
    })
    .select("id")
    .single();

  if (erreurSerie) return { error: erreurSerie.message };

  const { error, crees, demandes } = await genererCreneaux(
    supabase,
    comptePro,
    recurrence.id,
    champs,
  );
  if (error) return { error: error.message };

  // Aucun créneau créé : tous existaient déjà. Annoncer une réussite laisserait
  // le professionnel chercher au calendrier quelque chose qui n'y est pas.
  if (crees === 0) {
    await supabase.from("slot_recurrences").delete().eq("id", recurrence.id);
    return {
      error:
        "Ces créneaux figurent déjà dans votre calendrier. Vérifiez vos disponibilités avant d'ajouter cette récurrence.",
    };
  }

  revalidatePath("/planning");
  return {
    success: true,
    message:
      crees < demandes
        ? `${crees} créneau(x) ajouté(s) — ${demandes - crees} figuraient déjà dans votre calendrier.`
        : undefined,
  };
}

export async function modifierCreneauxRecurrents(
  _prevState: PlanningFormState,
  formData: FormData,
): Promise<PlanningFormState> {
  const { supabase, user } = await requireUser("professionnel");
  const { comptePro } = await compteProfessionnelActif(supabase, user.id);

  const recurrenceId = String(formData.get("recurrence_id") ?? "");
  if (!recurrenceId) return { error: "Récurrence introuvable." };

  const lu = lireChampsRecurrence(formData);
  if ("error" in lu) return { error: lu.error };
  const { champs } = lu;

  const { data: recurrence, error: erreurSerie } = await supabase
    .from("slot_recurrences")
    .update({
      jours: champs.jours,
      heure_debut: champs.heureDebut,
      heure_fin: champs.heureFin,
      statut: champs.statut,
      date_debut: champs.dateDebut,
      date_fin: champs.dateFin,
      capacite: champs.capacite,
      types_accueil: champs.typesAccueil,
      lieu_accueil: champs.lieuAccueil,
      tranche_id: champs.trancheId,
    })
    .eq("id", recurrenceId)
    .eq("professional_id", comptePro)
    .select("id")
    .single();

  if (erreurSerie || !recurrence) return { error: "Récurrence introuvable." };

  // On régénère la série : les créneaux libres sont remplacés, les créneaux
  // déjà réservés (occupés) sont toujours conservés tels quels.
  await supabase
    .from("availability_slots")
    .delete()
    .eq("recurrence_id", recurrenceId)
    .eq("professional_id", comptePro)
    .neq("statut", "occupe");

  const { error } = await genererCreneaux(supabase, comptePro, recurrenceId, champs);
  if (error) return { error: error.message };

  revalidatePath("/planning");
  return { success: true };
}

/** Retrait d'une série entière, réservations comprises.
 *
 * Ce n'est pas retirer un mardi : une série porte des semaines ou des mois de
 * garde, et les familles ont organisé leur vie autour. Le motif est donc exigé
 * ici, là où il reste facultatif sur un créneau isolé. */
export async function supprimerRecurrence(formData: FormData) {
  const { supabase, user } = await requireUser("professionnel");
  // La série appartient à la structure ; c'est une personne qui la retire.
  // Les deux se disent séparément : `comptePro` pour ce qui est supprimé et
  // pour le nom que lisent les familles, `user.id` pour l'acteur au journal.
  const { comptePro } = await compteProfessionnelActif(supabase, user.id);
  const recurrenceId = String(formData.get("recurrence_id") ?? "");
  const motif = String(formData.get("motif") ?? "").trim();
  if (!recurrenceId) return;
  if (!motif) redirect("/planning?annule=motif_manquant");

  // « tout » annule aussi les gardes réservées ; « libres » ne retire que les
  // créneaux que personne n'a pris, laissant les engagements en cours.
  const portee = String(formData.get("portee") ?? "tout");

  const { data: creneaux } = await supabase
    .from("availability_slots")
    .select("id, date, heure_debut")
    .eq("recurrence_id", recurrenceId)
    .eq("professional_id", comptePro);

  const idsCreneaux = (creneaux ?? []).map((c) => c.id);
  const dateParCreneau = new Map((creneaux ?? []).map((c) => [c.id, c.date]));

  // Les familles à prévenir, les enfants concernés, et les jours annulés pour
  // chacun : un email par créneau serait illisible sur une série de plusieurs
  // mois, un email sans les dates serait inutilisable.
  const parents = new Map<string, Map<string, Set<string>>>();
  const noter = (
    parentId: string,
    enfantIds: string[] | null,
    dates: string[],
  ) => {
    const parEnfant = parents.get(parentId) ?? new Map<string, Set<string>>();
    for (const enfantId of enfantIds ?? []) {
      const jours = parEnfant.get(enfantId) ?? new Set<string>();
      for (const d of dates) jours.add(d);
      parEnfant.set(enfantId, jours);
    }
    parents.set(parentId, parEnfant);
  };

  // Les créneaux que quelqu'un a pris : ils décident de ce qu'on supprime
  // lorsque le professionnel ne veut retirer que ses disponibilités libres.
  const creneauxPris = new Set<string>();

  const { data: urgences } = idsCreneaux.length
    ? await supabase
        .from("urgent_bookings")
        .select("id, parent_id, enfant_ids, slot_id")
        .in("slot_id", idsCreneaux)
        .in("statut", ["en_attente", "confirme"])
    : { data: [] };
  for (const u of urgences ?? []) creneauxPris.add(u.slot_id);

  const { data: lignes } = idsCreneaux.length
    ? await supabase
        .from("demande_creneau_lignes")
        .select("id, slot_id, demandes_creneaux(parent_id, enfant_ids)")
        .in("slot_id", idsCreneaux)
        .in("statut", ["propose", "accepte"])
    : { data: [] };
  for (const l of lignes ?? []) creneauxPris.add(l.slot_id);

  const { data: serie } = await supabase
    .from("slot_recurrences")
    .select("jours, heure_debut")
    .eq("id", recurrenceId)
    .eq("professional_id", comptePro)
    .maybeSingle();

  // Les réservations récurrentes ne visent aucun créneau : elles se
  // reconnaissent au jour et à l'horaire de la série.
  const { data: recurrentes } = serie
    ? await supabase
        .from("recurring_bookings")
        .select("id, parent_id, enfant_ids, jour_semaine")
        .eq("professional_id", comptePro)
        .eq("heure_debut", serie.heure_debut)
        .in("statut", ["en_attente", "actif"])
    : { data: [] };
  const recurrentesConcernees = (recurrentes ?? []).filter((r) =>
    (serie?.jours ?? []).includes(r.jour_semaine),
  );

  if (portee === "tout") {
    for (const u of urgences ?? []) {
      noter(u.parent_id, u.enfant_ids, [dateParCreneau.get(u.slot_id) ?? ""]);
    }
    if ((urgences ?? []).length > 0) {
      await supabase
        .from("urgent_bookings")
        .update({ statut: "annule" })
        .in("id", (urgences ?? []).map((u) => u.id));
    }

    for (const l of lignes ?? []) {
      const d = l.demandes_creneaux as unknown as {
        parent_id: string;
        enfant_ids: string[] | null;
      } | null;
      if (d?.parent_id) {
        noter(d.parent_id, d.enfant_ids, [dateParCreneau.get(l.slot_id) ?? ""]);
      }
    }
    if ((lignes ?? []).length > 0) {
      await supabase
        .from("demande_creneau_lignes")
        .update({ statut: "refuse" })
        .in("id", (lignes ?? []).map((l) => l.id));
    }

    // Une récurrence couvre toutes les dates de la série qui tombent son jour.
    for (const r of recurrentesConcernees) {
      const dates = (creneaux ?? [])
        .filter((c) => new Date(c.date).getDay() === (r.jour_semaine + 1) % 7)
        .map((c) => c.date);
      noter(r.parent_id, r.enfant_ids, dates);
    }
    if (recurrentesConcernees.length > 0) {
      await supabase
        .from("recurring_bookings")
        .update({ statut: "annule" })
        .in("id", recurrentesConcernees.map((r) => r.id));
    }
  }

  // « tout » efface la série entière ; « libres » épargne les créneaux pris,
  // qui se détachent de la série sans disparaître.
  const aSupprimer =
    portee === "tout" ? idsCreneaux : idsCreneaux.filter((id) => !creneauxPris.has(id));

  if (aSupprimer.length > 0) {
    await supabase
      .from("availability_slots")
      .delete()
      .in("id", aSupprimer)
      .eq("professional_id", comptePro);
  }

  await supabase
    .from("slot_recurrences")
    .delete()
    .eq("id", recurrenceId)
    .eq("professional_id", comptePro);

  // Le nom que lisent les familles est celui de qui les accueille, pas celui
  // de la salariée qui a cliqué : « Crèche les doudous annule », et non
  // « Marie Dupont annule », que personne ne reconnaîtrait.
  const { data: moi } = await supabase
    .from("identites")
    .select("prenom, nom")
    .eq("user_id", comptePro)
    .maybeSingle();
  const nomPro = [moi?.prenom, moi?.nom].filter(Boolean).join(" ") || "Le professionnel";

  const tousLesEnfants = [
    ...new Set([...parents.values()].flatMap((m) => [...m.keys()])),
  ];
  const { data: enfants } = tousLesEnfants.length
    ? await supabase.from("enfants").select("id, prenom").in("id", tousLesEnfants)
    : { data: [] };
  const prenomParId = new Map((enfants ?? []).map((e) => [e.id, e.prenom]));

  const enFrancais = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

  // Un seul email par famille, listant les jours annulés enfant par enfant :
  // une série de plusieurs mois produirait autrement des dizaines de messages
  // qu'on cesserait de lire au troisième.
  for (const [parentId, parEnfant] of parents) {
    await journaliser(supabase, {
      type: "annulation_pro_serie",
      acteurId: user.id,
      parentId,
      professionalId: comptePro,
      detail: {
        recurrence_id: recurrenceId,
        portee,
        motif,
        jours_annules: [...parEnfant.values()].flatMap((s) => [...s]).filter(Boolean),
        enfants: [...parEnfant.keys()],
      },
    });

    const blocs = [...parEnfant.entries()]
      .map(([enfantId, jours]) => {
        const prenom = prenomParId.get(enfantId);
        if (!prenom) return "";
        const dates = [...jours].filter(Boolean).sort();
        if (dates.length === 0) return `<li><strong>${prenom}</strong></li>`;
        return `<li><strong>${prenom}</strong><br />${dates
          .map(enFrancais)
          .join("<br />")}</li>`;
      })
      .filter(Boolean);

    await notifierUtilisateur(
      supabase,
      parentId,
      "Vos gardes régulières sont annulées",
      `<p><strong>${nomPro}</strong> a annulé la série de créneaux sur laquelle
        reposaient vos gardes régulières.</p>
       <p>Motif indiqué : <em>${motif.replace(/[<>]/g, "")}</em></p>
       ${blocs.length > 0 ? `<p>Gardes annulées :</p><ul>${blocs.join("")}</ul>` : ""}
       ${lienVers("/recherche", "Chercher une autre solution")}`,
    );
  }

  revalidatePath("/planning");
  redirect(
    parents.size > 0
      ? "/planning?annule=serie_avec_familles"
      : portee === "libres"
        ? "/planning?annule=serie_libres"
        : "/planning?annule=serie",
  );
}

/** Modification d'un créneau isolé.
 *
 * Un créneau héritait des réglages du profil à sa création et n'était plus
 * modifiable ensuite : il fallait le supprimer et le refaire, ce qui annulait
 * au passage les gardes qu'il portait. */
export async function modifierCreneau(
  _prevState: PlanningFormState,
  formData: FormData,
): Promise<PlanningFormState> {
  const { supabase, user } = await requireUser("professionnel");
  const { comptePro } = await compteProfessionnelActif(supabase, user.id);

  const slotId = String(formData.get("slot_id") ?? "");
  if (!slotId) return { error: "Créneau introuvable." };

  const capacite = Math.min(20, Math.max(1, Number(formData.get("capacite") ?? 1) || 1));
  const typesSaisis = formData.getAll("types_accueil").map(String);
  const typesAccueil = typesSaisis.length > 0 ? typesSaisis : ["ponctuel"];
  const lieuAccueil = String(formData.get("lieu_accueil") ?? "") || null;
  const trancheId = String(formData.get("tranche_id") ?? "") || null;
  const heureDebut = String(formData.get("heure_debut") ?? "");
  const heureFin = String(formData.get("heure_fin") ?? "");

  if (!heureDebut || !heureFin) return { error: "Renseignez les horaires." };
  if (heureFin <= heureDebut) {
    return { error: "L'heure de fin doit être après l'heure de début." };
  }

  // Réduire la capacité en dessous des places déjà prises reviendrait à
  // déloger une famille sans le lui dire.
  const { data: restantes } = await supabase.rpc("places_restantes", {
    p_slot_id: slotId,
  });
  const { data: creneau } = await supabase
    .from("availability_slots")
    .select("capacite, date, heure_debut, heure_fin")
    .eq("id", slotId)
    .eq("professional_id", comptePro)
    .maybeSingle();

  if (!creneau) return { error: "Créneau introuvable." };

  const prises = (creneau.capacite ?? 1) - (restantes ?? 0);
  if (capacite < prises) {
    return {
      error: `${prises} place(s) sont déjà réservées sur ce créneau : la capacité ne peut pas descendre en dessous. Annulez d'abord la réservation concernée.`,
    };
  }

  // Rétrécir un créneau réservé laisserait une famille sans solution sur les
  // heures retirées, sans que rien ne le lui dise. Élargir n'enlève rien à
  // personne, et reste donc permis même quand une garde est prise.
  const retreci =
    heureDebut > creneau.heure_debut.slice(0, 5) ||
    heureFin < creneau.heure_fin.slice(0, 5);
  if (prises > 0 && retreci) {
    return {
      error: `Ce créneau porte ${prises} réservation(s) de ${creneau.heure_debut.slice(0, 5)} à ${creneau.heure_fin.slice(0, 5)} : vous pouvez l'élargir, pas le raccourcir. Annulez d'abord la garde concernée, ou prévenez la famille.`,
    };
  }

  // Un autre créneau de la même section au même horaire : la contrainte de la
  // 0041 le refuserait avec un message que personne ne peut interpréter.
  if (heureDebut !== creneau.heure_debut.slice(0, 5)) {
    const { data: collision } = await supabase
      .from("availability_slots")
      .select("id")
      .eq("professional_id", comptePro)
      .eq("date", creneau.date)
      .eq("heure_debut", heureDebut)
      .neq("id", slotId)
      .maybeSingle();

    if (collision) {
      return {
        error: "Vous avez déjà un créneau qui commence à cette heure-là ce jour-là.",
      };
    }
  }

  const { error } = await supabase
    .from("availability_slots")
    .update({
      capacite,
      types_accueil: typesAccueil,
      lieu_accueil: lieuAccueil,
      tranche_id: trancheId,
      heure_debut: heureDebut,
      heure_fin: heureFin,
    })
    .eq("id", slotId)
    .eq("professional_id", comptePro);

  if (error) return { error: error.message };

  revalidatePath("/planning");
  return { success: true };
}

/** Retrait d'un créneau, réservations comprises.
 *
 * Un créneau réservé pouvait auparavant être retiré sans que personne ne le
 * sache : les familles concernées découvraient l'absence le jour venu. Les
 * réservations sont donc annulées explicitement et chaque parent prévenu.
 *
 * La confirmation est demandée côté navigateur — c'est là que le professionnel
 * voit ce qu'il s'apprête à défaire. */
export async function supprimerCreneau(formData: FormData) {
  const { supabase, user } = await requireUser("professionnel");
  const { comptePro } = await compteProfessionnelActif(supabase, user.id);
  const slotId = String(formData.get("slot_id") ?? "");
  if (!slotId) return;

  const { data: creneau } = await supabase
    .from("availability_slots")
    .select("id, date, heure_debut, heure_fin")
    .eq("id", slotId)
    .eq("professional_id", comptePro)
    .maybeSingle();
  if (!creneau) return;

  const quand = `${new Date(creneau.date).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })} de ${creneau.heure_debut.slice(0, 5)} à ${creneau.heure_fin.slice(0, 5)}`;

  // Les parents à prévenir, et pour quels enfants : « une garde a été
  // annulée » sans dire laquelle inquiète sans informer quand on a deux
  // enfants placés.
  const parents = new Map<string, Set<string>>();
  const noter = (parentId: string, enfantIds: string[] | null) => {
    const connus = parents.get(parentId) ?? new Set<string>();
    for (const id of enfantIds ?? []) connus.add(id);
    parents.set(parentId, connus);
  };

  const { data: urgences } = await supabase
    .from("urgent_bookings")
    .select("id, parent_id, enfant_ids")
    .eq("slot_id", slotId)
    .in("statut", ["en_attente", "confirme"]);

  for (const u of urgences ?? []) noter(u.parent_id, u.enfant_ids);

  if ((urgences ?? []).length > 0) {
    await supabase
      .from("urgent_bookings")
      .update({ statut: "annule" })
      .in("id", (urgences ?? []).map((u) => u.id));
  }

  const { data: lignes } = await supabase
    .from("demande_creneau_lignes")
    .select("id, demandes_creneaux(parent_id, enfant_ids)")
    .eq("slot_id", slotId)
    .in("statut", ["propose", "accepte"]);

  for (const l of lignes ?? []) {
    const demande = l.demandes_creneaux as unknown as {
      parent_id: string;
      enfant_ids: string[] | null;
    } | null;
    if (demande?.parent_id) noter(demande.parent_id, demande.enfant_ids);
  }

  if ((lignes ?? []).length > 0) {
    await supabase
      .from("demande_creneau_lignes")
      .update({ statut: "refuse" })
      .in("id", (lignes ?? []).map((l) => l.id));
  }

  await supabase
    .from("availability_slots")
    .delete()
    .eq("id", slotId)
    .eq("professional_id", comptePro);

  // Le motif est facultatif : on ne fabrique pas de phrase quand il est vide.
  const motif = String(formData.get("motif") ?? "").trim();
  const phraseMotif = motif
    ? `<p>Motif indiqué : <em>${motif.replace(/[<>]/g, "")}</em></p>`
    : "";

  // Celui de la structure, pas de la personne qui a cliqué.
  const { data: moi } = await supabase
    .from("identites")
    .select("prenom, nom")
    .eq("user_id", comptePro)
    .maybeSingle();
  const nomPro =
    [moi?.prenom, moi?.nom].filter(Boolean).join(" ") || "Le professionnel";

  // Prénoms des enfants concernés, pour que le parent sache lequel est touché.
  const tousLesEnfants = [...new Set([...parents.values()].flatMap((s) => [...s]))];
  const { data: enfants } = tousLesEnfants.length
    ? await supabase.from("enfants").select("id, prenom").in("id", tousLesEnfants)
    : { data: [] };
  const prenomParId = new Map((enfants ?? []).map((e) => [e.id, e.prenom]));

  for (const [parentId, enfantIds] of parents) {
    await journaliser(supabase, {
      type: "annulation_pro_creneau",
      acteurId: user.id,
      parentId,
      professionalId: comptePro,
      detail: {
        creneau: quand,
        slot_id: slotId,
        motif: motif || null,
        enfants: [...enfantIds],
      },
    });

    const prenoms = [...enfantIds]
      .map((id) => prenomParId.get(id))
      .filter(Boolean) as string[];

    // Silence plutôt qu'approximation : sans prénom lisible, on n'invente pas.
    const phraseEnfants =
      prenoms.length > 0
        ? `<p>Concerne ${prenoms.length > 1 ? "vos enfants" : "votre enfant"} :
           <strong>${prenoms.join(", ")}</strong>.</p>`
        : "";

    await notifierUtilisateur(
      supabase,
      parentId,
      "Une garde a été annulée",
      `<p><strong>${nomPro}</strong> a annulé le créneau du
        <strong>${quand}</strong>.</p>
       ${phraseEnfants}
       ${phraseMotif}
       <p>Vous pouvez chercher une autre solution pour cette date.</p>
       ${lienVers("/recherche", "Chercher une autre solution")}`,
    );
  }

  revalidatePath("/planning");
  redirect(parents.size > 0 ? "/planning?annule=avec_reservations" : "/planning?annule=1");
}

// ------------------------------------------------------------------------
// Critères de recherche du parent — préférences stables (badges, rayon,
// trajet) appliquées à toutes les propositions de profils, par opposition au
// "quand" qui est porté par chaque besoin.
// ------------------------------------------------------------------------

export async function enregistrerCriteres(
  _prevState: PlanningFormState,
  formData: FormData,
): Promise<PlanningFormState> {
  const { supabase, user } = await requireUser("parent");

  const badges = formData.getAll("badges").map((b) => String(b));
  const rayonBrut = String(formData.get("rayon") ?? "").trim();
  const modeZone = String(formData.get("mode_zone") ?? "ville") === "trajet" ? "trajet" : "ville";
  const ville = String(formData.get("ville") ?? "").trim();
  const trajetDepart = String(formData.get("trajet_depart") ?? "").trim();
  const trajetArrivee = String(formData.get("trajet_arrivee") ?? "").trim();

  if (modeZone === "ville" && !ville) {
    return { error: "Indiquez la ville autour de laquelle chercher." };
  }
  if (modeZone === "trajet" && (!trajetDepart || !trajetArrivee)) {
    return { error: "Indiquez le point de départ et le point d'arrivée du trajet." };
  }

  // On ne géocode que les adresses qui ont changé, pour éviter un appel
  // réseau inutile à chaque enregistrement.
  const { data: profilActuel } = await supabase
    .from("parent_profiles")
    .select(
      "ville, ville_latitude, ville_longitude, trajet_depart, trajet_depart_latitude, trajet_depart_longitude, trajet_arrivee, trajet_arrivee_latitude, trajet_arrivee_longitude",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  type Coords = { latitude: number; longitude: number } | null;
  const resoudre = async (
    adresse: string,
    ancienneAdresse: string | null | undefined,
    ancienneLat: number | null | undefined,
    ancienneLng: number | null | undefined,
  ): Promise<Coords> => {
    if (!adresse) return null;
    if (adresse === ancienneAdresse && ancienneLat != null && ancienneLng != null) {
      return { latitude: ancienneLat, longitude: ancienneLng };
    }
    return geocodeAdresse(adresse);
  };

  const coordsVille = await resoudre(
    ville,
    profilActuel?.ville,
    profilActuel?.ville_latitude,
    profilActuel?.ville_longitude,
  );
  const coordsDepart = await resoudre(
    trajetDepart,
    profilActuel?.trajet_depart,
    profilActuel?.trajet_depart_latitude,
    profilActuel?.trajet_depart_longitude,
  );
  const coordsArrivee = await resoudre(
    trajetArrivee,
    profilActuel?.trajet_arrivee,
    profilActuel?.trajet_arrivee_latitude,
    profilActuel?.trajet_arrivee_longitude,
  );

  if (ville && !coordsVille) return { error: "Ville introuvable." };
  if (trajetDepart && !coordsDepart) return { error: "Adresse de départ introuvable." };
  if (trajetArrivee && !coordsArrivee) return { error: "Adresse d'arrivée introuvable." };

  const { error } = await supabase.from("parent_profiles").upsert({
    user_id: user.id,
    badges_souhaites: badges,
    rayon_km: rayonBrut ? Number(rayonBrut) : null,
    mode_zone: modeZone,
    ville: ville || null,
    ville_latitude: coordsVille?.latitude ?? null,
    ville_longitude: coordsVille?.longitude ?? null,
    trajet_depart: trajetDepart || null,
    trajet_depart_latitude: coordsDepart?.latitude ?? null,
    trajet_depart_longitude: coordsDepart?.longitude ?? null,
    trajet_arrivee: trajetArrivee || null,
    trajet_arrivee_latitude: coordsArrivee?.latitude ?? null,
    trajet_arrivee_longitude: coordsArrivee?.longitude ?? null,
  });

  if (error) return { error: error.message };

  revalidatePath("/planning");
  return { success: true };
}

// ------------------------------------------------------------------------
// Besoins de garde du parent — miroir des créneaux du professionnel : des
// besoins ponctuels ajoutés depuis le calendrier, et des séries récurrentes.
// ------------------------------------------------------------------------

export async function ajouterBesoin(
  _prevState: PlanningFormState,
  formData: FormData,
): Promise<PlanningFormState> {
  const { supabase, user } = await requireUser("parent");

  const date = String(formData.get("date") ?? "");
  const heureDebut = String(formData.get("heure_debut") ?? "");
  const heureFin = String(formData.get("heure_fin") ?? "");

  if (!date || !heureDebut || !heureFin) return { error: "Renseignez la date et les horaires." };
  if (heureFin <= heureDebut) {
    return { error: "L'heure de fin doit être après l'heure de début." };
  }

  // Pour qui : sans cela, on ne sait ni quel âge chercher — un établissement
  // accueille par sections — ni combien de places il faut trouver.
  const enfantIds = formData.getAll("enfant_ids").map(String).filter(Boolean);
  if (enfantIds.length === 0) {
    return { error: "Indiquez pour quel enfant vous cherchez une garde." };
  }

  const { error } = await supabase.from("besoins_garde").insert({
    parent_id: user.id,
    date,
    heure_debut: heureDebut,
    heure_fin: heureFin,
    enfant_ids: enfantIds,
  });

  if (error) return { error: error.message };

  revalidatePath("/planning");
  return { success: true };
}

export async function supprimerBesoin(formData: FormData) {
  const { supabase, user } = await requireUser("parent");
  const besoinId = String(formData.get("besoin_id") ?? "");
  await supabase.from("besoins_garde").delete().eq("id", besoinId).eq("parent_id", user.id);
  revalidatePath("/planning");
}

async function genererBesoins(
  supabase: Awaited<ReturnType<typeof createClient>>,
  parentId: string,
  recurrenceId: string,
  champs: ChampsRecurrence,
) {
  const rows = champs.dates.map((date) => ({
    parent_id: parentId,
    date,
    heure_debut: champs.heureDebut,
    heure_fin: champs.heureFin,
    recurrence_id: recurrenceId,
    // Recopiés sur chaque occurrence : les propositions se calculent besoin par
    // besoin, et remonter à la série pour savoir de qui il s'agit obligerait à
    // la joindre partout.
    enfant_ids: champs.enfantIds,
  }));

  return supabase
    .from("besoins_garde")
    .upsert(rows, { onConflict: "parent_id,date,heure_debut", ignoreDuplicates: true });
}

export async function ajouterBesoinsRecurrents(
  _prevState: PlanningFormState,
  formData: FormData,
): Promise<PlanningFormState> {
  const { supabase, user } = await requireUser("parent");

  const lu = lireChampsRecurrence(formData);
  if ("error" in lu) return { error: lu.error };
  const { champs } = lu;

  // Exigé du côté parent seulement : un créneau ouvert par un professionnel
  // n'a personne à nommer, un besoin de garde si.
  if (champs.enfantIds.length === 0) {
    return { error: "Indiquez pour quel enfant vous cherchez une garde." };
  }

  const { data: recurrence, error: erreurSerie } = await supabase
    .from("besoin_recurrences")
    .insert({
      parent_id: user.id,
      jours: champs.jours,
      heure_debut: champs.heureDebut,
      heure_fin: champs.heureFin,
      date_debut: champs.dateDebut,
      date_fin: champs.dateFin,
      enfant_ids: champs.enfantIds,
    })
    .select("id")
    .single();

  if (erreurSerie) return { error: erreurSerie.message };

  const { error } = await genererBesoins(supabase, user.id, recurrence.id, champs);
  if (error) return { error: error.message };

  revalidatePath("/planning");
  return { success: true };
}

export async function modifierBesoinsRecurrents(
  _prevState: PlanningFormState,
  formData: FormData,
): Promise<PlanningFormState> {
  const { supabase, user } = await requireUser("parent");

  const recurrenceId = String(formData.get("recurrence_id") ?? "");
  if (!recurrenceId) return { error: "Récurrence introuvable." };

  const lu = lireChampsRecurrence(formData);
  if ("error" in lu) return { error: lu.error };
  const { champs } = lu;

  if (champs.enfantIds.length === 0) {
    return { error: "Indiquez pour quel enfant vous cherchez une garde." };
  }

  const { data: recurrence, error: erreurSerie } = await supabase
    .from("besoin_recurrences")
    .update({
      jours: champs.jours,
      heure_debut: champs.heureDebut,
      heure_fin: champs.heureFin,
      date_debut: champs.dateDebut,
      date_fin: champs.dateFin,
      enfant_ids: champs.enfantIds,
    })
    .eq("id", recurrenceId)
    .eq("parent_id", user.id)
    .select("id")
    .single();

  if (erreurSerie || !recurrence) return { error: "Récurrence introuvable." };

  await supabase
    .from("besoins_garde")
    .delete()
    .eq("recurrence_id", recurrenceId)
    .eq("parent_id", user.id);

  const { error } = await genererBesoins(supabase, user.id, recurrenceId, champs);
  if (error) return { error: error.message };

  revalidatePath("/planning");
  return { success: true };
}

export async function supprimerBesoinRecurrence(formData: FormData) {
  const { supabase, user } = await requireUser("parent");
  const recurrenceId = String(formData.get("recurrence_id") ?? "");
  if (!recurrenceId) return;

  await supabase
    .from("besoins_garde")
    .delete()
    .eq("recurrence_id", recurrenceId)
    .eq("parent_id", user.id);

  await supabase
    .from("besoin_recurrences")
    .delete()
    .eq("id", recurrenceId)
    .eq("parent_id", user.id);

  revalidatePath("/planning");
}

// ------------------------------------------------------------------------
// Demandes groupées de créneaux : le parent coche plusieurs créneaux d'un
// même professionnel et envoie le tout ; le professionnel décoche ce qui ne
// lui convient pas et valide le reste.
// ------------------------------------------------------------------------

export async function traiterDemandeCreneaux(formData: FormData) {
  const { supabase, user } = await requireUser("professionnel");
  const { comptePro } = await compteProfessionnelActif(supabase, user.id);

  const demandeId = String(formData.get("demande_id") ?? "");
  const acceptes = new Set(formData.getAll("slot_ids").map((s) => String(s)));
  if (!demandeId) return;

  const { data: demande } = await supabase
    .from("demandes_creneaux")
    .select("id, parent_id, enfant_ids")
    .eq("id", demandeId)
    .eq("professional_id", comptePro)
    .maybeSingle();
  if (!demande) return;

  // Chaque enfant occupe une place. Une demande antérieure à la capacité n'en
  // déclare aucun : elle en vaut une, comme elle l'a toujours fait.
  const nbEnfants = Math.max(1, demande.enfant_ids?.length ?? 0);

  const { data: lignes } = await supabase
    .from("demande_creneau_lignes")
    .select("id, slot_id")
    .eq("demande_id", demandeId);

  let nbAcceptes = 0;
  for (const ligne of lignes ?? []) {
    if (!acceptes.has(ligne.slot_id)) {
      await supabase
        .from("demande_creneau_lignes")
        .update({ statut: "refuse" })
        .eq("id", ligne.id);
      continue;
    }

    // Un créneau n'est plus « occupé » ou « libre » : il a des places, dont
    // il reste un certain nombre. Accepter n'en bascule donc plus le statut —
    // c'est le décompte qui dira, la prochaine fois, s'il en reste.
    const { data: restantes } = await supabase.rpc("places_restantes", {
      p_slot_id: ligne.slot_id,
    });

    const placesNecessaires = Math.max(1, nbEnfants);
    const accepte = (restantes ?? 0) >= placesNecessaires;

    await supabase
      .from("demande_creneau_lignes")
      .update({ statut: accepte ? "accepte" : "refuse" })
      .eq("id", ligne.id);

    if (accepte) nbAcceptes++;
  }

  await supabase.from("demandes_creneaux").update({ statut: "traitee" }).eq("id", demandeId);

  await journaliser(supabase, {
    type: "creneaux_valides",
    acteurId: user.id,
    parentId: demande.parent_id,
    professionalId: comptePro,
    detail: {
      demande_id: demandeId,
      acceptes: nbAcceptes,
      proposes: (lignes ?? []).length,
      enfants: demande.enfant_ids ?? [],
    },
  });

  await notifierUtilisateur(
    supabase,
    demande.parent_id,
    nbAcceptes > 0 ? "Créneaux de garde confirmés" : "Demande de créneaux refusée",
    nbAcceptes > 0
      ? `<p>Le professionnel a confirmé ${nbAcceptes} créneau(x) de votre demande sur Liams. Retrouvez-les dans votre planning.</p>`
      : "<p>Le professionnel n'a retenu aucun des créneaux demandés sur Liams. Connectez-vous pour en proposer d'autres.</p>",
  );

  revalidatePath("/planning");
}

export async function confirmerReservationUrgente(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const bookingId = String(formData.get("booking_id") ?? "");
  const { data: booking } = await supabase.rpc("confirm_urgent_booking", { p_booking_id: bookingId });

  if (booking) {
    await notifierUtilisateur(
      supabase,
      booking.parent_id,
      "Créneau de garde d'urgence confirmé",
      `<p>Le professionnel a confirmé votre créneau de garde d'urgence.</p>
       ${lienVers("/planning", "Voir mon calendrier")}`,
    );
  }

  revalidatePath("/planning");
  // Une urgence se prépare dans l'heure qui suit : c'est maintenant qu'il faut
  // lire la fiche de l'enfant, pas le jour venu.
  redirect("/fiches?urgence_confirmee=1");
}

export async function refuserReservationUrgente(formData: FormData) {
  const { supabase, user } = await requireUser("professionnel");
  const { comptePro } = await compteProfessionnelActif(supabase, user.id);
  const bookingId = String(formData.get("booking_id") ?? "");

  const { data: booking } = await supabase
    .from("urgent_bookings")
    .update({ statut: "refuse" })
    .eq("id", bookingId)
    .eq("professional_id", comptePro)
    .select("parent_id")
    .maybeSingle();

  if (booking) {
    await notifierUtilisateur(
      supabase,
      booking.parent_id,
      "Demande de garde d'urgence refusée",
      "<p>Le professionnel n'a pas pu accepter votre demande de garde d'urgence sur Liams. Connectez-vous pour chercher un autre créneau.</p>",
    );
  }

  revalidatePath("/planning");
}

export async function validerRecurrence(formData: FormData) {
  const { supabase, user } = await requireUser("professionnel");
  const { comptePro } = await compteProfessionnelActif(supabase, user.id);
  const recurrenceId = String(formData.get("recurrence_id") ?? "");

  const { data: reservation } = await supabase
    .from("recurring_bookings")
    .update({ statut: "actif" })
    .eq("id", recurrenceId)
    .eq("professional_id", comptePro)
    .select("parent_id")
    .maybeSingle();

  if (reservation) {
    await notifierUtilisateur(
      supabase,
      reservation.parent_id,
      "Réservation récurrente validée",
      "<p>Le professionnel a validé votre réservation récurrente sur Liams.</p>",
    );
  }

  revalidatePath("/planning");
}

export async function refuserRecurrence(formData: FormData) {
  const { supabase, user } = await requireUser("professionnel");
  const { comptePro } = await compteProfessionnelActif(supabase, user.id);
  const recurrenceId = String(formData.get("recurrence_id") ?? "");

  const { data: reservation } = await supabase
    .from("recurring_bookings")
    .select("parent_id, statut")
    .eq("id", recurrenceId)
    .eq("professional_id", comptePro)
    .single();

  await supabase
    .from("recurring_bookings")
    .update({ statut: "annule" })
    .eq("id", recurrenceId)
    .eq("professional_id", comptePro);

  // Message différent selon qu'on refuse une demande en attente ou qu'on
  // annule une récurrence déjà validée sur laquelle le parent comptait.
  if (reservation?.statut === "actif") {
    await notifierUtilisateur(
      supabase,
      reservation.parent_id,
      "Réservation récurrente annulée",
      "<p>Le professionnel a annulé votre réservation récurrente sur Liams. Connectez-vous pour organiser une autre garde.</p>",
    );
  } else if (reservation?.statut === "en_attente") {
    await notifierUtilisateur(
      supabase,
      reservation.parent_id,
      "Demande de réservation récurrente refusée",
      "<p>Le professionnel n'a pas pu accepter votre demande de réservation récurrente sur Liams. Connectez-vous pour chercher une autre solution.</p>",
    );
  }

  revalidatePath("/planning");
}
