import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { lienVers } from "@/lib/notify";

// Échéance des agréments PMI.
//
// Un établissement d'accueil du jeune enfant ne peut pas accueillir sans
// l'autorisation du conseil départemental. Quand elle arrive à son terme, deux
// choses doivent se produire, et dans cet ordre : la structure est prévenue
// assez tôt pour renouveler, et les familles qui avaient réservé au-delà de
// l'échéance sont prévenues assez tôt pour se retourner.
//
// Une semaine n'est pas beaucoup pour retrouver un mode de garde. C'est
// pourtant plus honnête que de laisser une réservation debout jusqu'au matin
// où l'établissement n'a plus le droit d'ouvrir.
//
// Déclenché quotidiennement par Vercel Cron (voir vercel.json), protégé par
// CRON_SECRET. La table etablissement_relances_agrement retient ce qui est
// déjà parti, pour que le rappel mensuel ne devienne pas un rappel nocturne.
//
// Les emails partent avec la clé de service et non par notifierUtilisateur() :
// cette fonction vérifie qu'il existe une relation entre l'appelant et le
// destinataire, ce qu'une tâche planifiée sans utilisateur ne peut pas
// présenter.

const PALIERS_MOIS = [4, 3, 2, 1] as const;
const JOURS_AVANT_ANNULATION = 7;

/** Décalages en jours de calendrier, sans dépendance : un agrément se compte
 *  en dates civiles, jamais en millisecondes. */
function moisAvant(dateISO: string, mois: number): string {
  const [annee, m, jour] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(annee, m - 1 - mois, jour)).toISOString().slice(0, 10);
}

function joursAvant(dateISO: string, jours: number): string {
  const [annee, m, jour] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(annee, m - 1, jour - jours)).toISOString().slice(0, 10);
}

function enFrancais(dateISO: string): string {
  const [annee, mois, jour] = dateISO.split("-");
  return `${jour}/${mois}/${annee}`;
}

type Supabase = ReturnType<typeof createAdminClient>;

async function emailDe(supabase: Supabase, userId: string): Promise<string | null> {
  const { data } = await supabase.from("users").select("email").eq("id", userId).maybeSingle();
  return data?.email ?? null;
}

/** Annule tout ce qui était réservé au-delà de l'échéance, et prévient les
 *  familles. Renvoie le nombre de familles prévenues. */
async function annulerAuDela(
  supabase: Supabase,
  professionalId: string,
  raisonSociale: string,
  fin: string,
): Promise<number> {
  const { data: creneaux } = await supabase
    .from("availability_slots")
    .select("id")
    .eq("professional_id", professionalId)
    .gt("date", fin);

  const idsCreneaux = (creneaux ?? []).map((c) => c.id);
  const parents = new Set<string>();
  const creneauxAvecReservation = new Set<string>();

  if (idsCreneaux.length > 0) {
    const { data: urgences } = await supabase
      .from("urgent_bookings")
      .select("id, parent_id, slot_id")
      .in("slot_id", idsCreneaux)
      .in("statut", ["en_attente", "confirme"]);

    for (const reservation of urgences ?? []) {
      await supabase
        .from("urgent_bookings")
        .update({ statut: "annule" })
        .eq("id", reservation.id);
      parents.add(reservation.parent_id);
      creneauxAvecReservation.add(reservation.slot_id);
    }

    const { data: lignes } = await supabase
      .from("demande_creneau_lignes")
      .select("id, slot_id, demande:demandes_creneaux(parent_id)")
      .in("slot_id", idsCreneaux)
      .in("statut", ["propose", "accepte"]);

    for (const ligne of lignes ?? []) {
      await supabase
        .from("demande_creneau_lignes")
        .update({ statut: "refuse" })
        .eq("id", ligne.id);
      const demande = ligne.demande as unknown as { parent_id: string } | null;
      if (demande) parents.add(demande.parent_id);
      creneauxAvecReservation.add(ligne.slot_id);
    }
  }

  // Un accueil récurrent n'a pas de créneau à interroger : il court jusqu'à sa
  // propre fin, éventuellement indéterminée. Tout ce qui dépasse l'échéance
  // tombe.
  const { data: recurrents } = await supabase
    .from("recurring_bookings")
    .select("id, parent_id, date_fin")
    .eq("professional_id", professionalId)
    .eq("statut", "actif");

  for (const recurrent of recurrents ?? []) {
    if (recurrent.date_fin && recurrent.date_fin <= fin) continue;
    await supabase.from("recurring_bookings").update({ statut: "annule" }).eq("id", recurrent.id);
    parents.add(recurrent.parent_id);
  }

  // Les créneaux libres au-delà de l'échéance n'ont plus lieu d'être proposés.
  // On ne retire que ceux que personne n'avait pris : supprimer les autres
  // effacerait la réservation qu'on vient d'annuler, et avec elle la trace de
  // ce qui a été fait.
  const libres = idsCreneaux.filter((id) => !creneauxAvecReservation.has(id));
  if (libres.length > 0) {
    await supabase.from("availability_slots").delete().in("id", libres);
  }

  for (const parentId of parents) {
    const email = await emailDe(supabase, parentId);
    if (!email) continue;
    await sendEmail({
      to: email,
      subject: "Votre réservation est annulée",
      html: `
        <p>Votre réservation est annulée, veuillez contacter votre établissement.</p>
        <p>L'agrément de <strong>${raisonSociale}</strong> prend fin le
        ${enFrancais(fin)}. Un établissement ne peut pas accueillir d'enfants
        au-delà de cette date, et les réservations qui la dépassaient ont donc
        été annulées.</p>
        <p>Si l'établissement renouvelle son agrément, vous pourrez réserver à
        nouveau. En attendant, vous pouvez chercher une autre solution de garde
        sur Liams.</p>
        ${lienVers("/recherche", "Chercher un accueil")}`,
    });
  }

  return parents.size;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const aujourdhui = new Date().toISOString().slice(0, 10);

  const { data: etablissements } = await supabase
    .from("etablissements")
    .select("id, professional_id, raison_sociale, agrement_fin")
    .not("agrement_fin", "is", null);

  if (!etablissements?.length) {
    return NextResponse.json({ relances: 0, annulations: 0, familles: 0 });
  }

  const { data: relances } = await supabase
    .from("etablissement_relances_agrement")
    .select("etablissement_id, agrement_fin, palier")
    .in(
      "etablissement_id",
      etablissements.map((e) => e.id),
    );

  const dejaEnvoye = new Set(
    (relances ?? []).map((r) => `${r.etablissement_id}|${r.agrement_fin}|${r.palier}`),
  );

  let nbRelances = 0;
  let nbAnnulations = 0;
  let nbFamilles = 0;

  for (const etablissement of etablissements) {
    const fin = etablissement.agrement_fin as string;
    const cle = (palier: number) => `${etablissement.id}|${fin}|${palier}`;

    const enregistrer = (palier: number) =>
      supabase.from("etablissement_relances_agrement").insert({
        etablissement_id: etablissement.id,
        agrement_fin: fin,
        palier,
      });

    // ------------------------------------------------------------------
    // Les quatre relances : M-4, M-3, M-2, M-1
    // ------------------------------------------------------------------

    const dus = PALIERS_MOIS.filter(
      (mois) => aujourdhui >= moisAvant(fin, mois) && !dejaEnvoye.has(cle(mois)),
    );

    if (dus.length > 0) {
      // Un agrément renseigné tardivement franchit plusieurs paliers d'un coup.
      // Quatre courriers le même matin ne préviennent pas mieux : on n'envoie
      // que le plus urgent, et l'on marque les autres comme traités pour ne pas
      // les servir un par un les nuits suivantes.
      const palierUrgent = Math.min(...dus);
      const email = await emailDe(supabase, etablissement.professional_id);

      if (email) {
        await sendEmail({
          to: email,
          subject: "Votre agrément arrive à son terme",
          html: `
            <p>Votre agrément arrive à son terme, veuillez le mettre à jour.</p>
            <p>Il prend fin le <strong>${enFrancais(fin)}</strong>, soit dans
            ${palierUrgent} mois environ.</p>
            <p>Toutes les réservations au-delà de la date de fin d'agrément
            seront annulées une semaine avant l'échéance, le
            <strong>${enFrancais(joursAvant(fin, JOURS_AVANT_ANNULATION))}</strong>,
            et les familles concernées en seront informées.</p>
            <p>Passé la date de fin, votre compte n'aura plus accès qu'à la mise
            à jour de votre agrément.</p>
            ${lienVers("/profil/etablissement", "Mettre à jour mon agrément")}`,
        });
        nbRelances += 1;
      }

      for (const palier of dus) await enregistrer(palier);
    }

    // ------------------------------------------------------------------
    // L'annulation : une semaine avant l'échéance
    // ------------------------------------------------------------------

    if (
      aujourdhui >= joursAvant(fin, JOURS_AVANT_ANNULATION) &&
      !dejaEnvoye.has(cle(0))
    ) {
      nbFamilles += await annulerAuDela(
        supabase,
        etablissement.professional_id,
        etablissement.raison_sociale,
        fin,
      );
      await enregistrer(0);
      nbAnnulations += 1;
    }
  }

  return NextResponse.json({
    relances: nbRelances,
    annulations: nbAnnulations,
    familles: nbFamilles,
  });
}
