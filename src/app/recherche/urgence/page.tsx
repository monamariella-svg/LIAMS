import { foyerParent, requireUser } from "@/lib/auth";
import { NavigationBas } from "@/components/NavigationBas";
import { distanceKm } from "@/lib/geo";
import { disponibiliteCreneau } from "@/lib/urgence";
import { RechercheUrgence, type ProfessionnelUrgence } from "./RechercheUrgence";

/** Badges qui suffisent à figurer dans les propositions hors réseau.
 *
 * Un parent en urgence n'a pas le temps d'enquêter. Hors de son réseau, seuls
 * les professionnels que Liams a contrôlés au-delà des pièces obligatoires
 * apparaissent — et l'avertissement au moment de cocher rappelle que le
 * contrôle ne remplace pas le sien. */
const BADGES_HORS_RESEAU = ["nounou_extra", "super_experience"];

export default async function RechercheUrgencePage() {
  const { supabase, user } = await requireUser("parent");

  const { compteFoyer } = await foyerParent(supabase, user.id);

  const maintenant = new Date();
  const aujourdHui = maintenant.toISOString().slice(0, 10);
  const demain = new Date(maintenant.getTime() + 86_400_000).toISOString().slice(0, 10);

  const [
    { data: enfants },
    { data: monProfil },
    { data: reseau },
    { data: creneaux },
  ] = await Promise.all([
    supabase
      .from("enfants")
      .select("id, prenom")
      .eq("parent_id", compteFoyer)
      .order("created_at"),
    supabase
      .from("parent_profiles")
      .select("adresse, latitude, longitude")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("parent_networks")
      .select("professional_id")
      .eq("parent_id", user.id)
      .eq("statut", "accepte"),
    // Une urgence se demande entre 20 h et 2 h avant : elle ne peut porter que
    // sur aujourd'hui ou demain.
    supabase
      .from("availability_slots")
      .select("id, professional_id, date, heure_debut, heure_fin, capacite, types_accueil, lieu_accueil")
      .gte("date", aujourdHui)
      .lte("date", demain)
      .contains("types_accueil", ["urgence"])
      .order("date")
      .order("heure_debut"),
  ]);

  const dansMonReseau = new Set((reseau ?? []).map((r) => r.professional_id));

  // Seuls les créneaux réellement demandables maintenant : afficher les autres
  // ferait perdre du temps à quelqu'un qui n'en a pas.
  const ouverts = (creneaux ?? []).filter(
    (s) => disponibiliteCreneau({ ...s, statut: "libre_urgence" }, maintenant).demandable,
  );

  const { data: restantes } = ouverts.length
    ? await supabase.rpc("places_restantes_creneaux", {
        p_slot_ids: ouverts.map((s) => s.id),
      })
    : { data: [] };
  const restantesParSlot = new Map(
    ((restantes ?? []) as { slot_id: string; restantes: number }[]).map((r) => [
      r.slot_id,
      r.restantes,
    ]),
  );

  const disponibles = ouverts.filter((s) => (restantesParSlot.get(s.id) ?? 0) > 0);

  // Demandes d'autres familles déjà en attente : la seconde doit le savoir
  // avant de demander, plutôt que de découvrir un refus le soir même.
  const { data: enAttente } = disponibles.length
    ? await supabase.rpc("demandes_en_attente_creneaux", {
        p_slot_ids: disponibles.map((s) => s.id),
      })
    : { data: [] };
  const enAttenteParSlot = new Map(
    ((enAttente ?? []) as { slot_id: string; en_attente: number }[]).map((r) => [
      r.slot_id,
      r.en_attente,
    ]),
  );
  const idsPros = [...new Set(disponibles.map((s) => s.professional_id))];

  const [{ data: profils }, { data: identites }] = await Promise.all([
    idsPros.length
      ? supabase
          .from("professional_profiles")
          .select(
            "user_id, tarif_horaire, tarif_horaire_urgence, adresse, latitude, longitude, type_professionnel, note_moyenne, nombre_avis, professional_badges(badge_code, statut)",
          )
          .in("user_id", idsPros)
          // Une fiche masquée ne se propose plus, y compris dans l'urgence —
          // c'est même là qu'un profil douteux serait le plus dommageable, une
          // famille pressée n'ayant pas le loisir de vérifier.
          .eq("masque", false)
      : Promise.resolve({ data: [] }),
    idsPros.length
      ? supabase.from("identites").select("user_id, prenom, nom").in("user_id", idsPros)
      : Promise.resolve({ data: [] }),
  ]);

  const nomParId = new Map(
    (identites ?? []).map((i) => [
      i.user_id,
      [i.prenom, i.nom].filter(Boolean).join(" ") || "Professionnel",
    ]),
  );

  const origine =
    monProfil?.latitude != null && monProfil?.longitude != null
      ? { latitude: monProfil.latitude, longitude: monProfil.longitude }
      : null;

  const professionnels: ProfessionnelUrgence[] = (profils ?? [])
    .map((p) => {
      const badges = ((p.professional_badges ?? []) as { badge_code: string; statut: string }[])
        .filter((b) => b.statut === "valide")
        .map((b) => b.badge_code);

      const duReseau = dansMonReseau.has(p.user_id);
      // Hors réseau, la barre est plus haute : c'est le seul filtre qui
      // protège un parent qui doit décider en quelques minutes.
      //
      // À COMPLÉTER AU LOT 5 : les établissements y figureront d'office, sans
      // passer par les badges. Un agrément PMI, des inspections et une équipe
      // salariée offrent des garanties qu'un particulier ne donne pas seul —
      // exiger d'eux un badge attribué à la main n'aurait pas de sens.
      const eligible =
        duReseau || badges.some((b) => BADGES_HORS_RESEAU.includes(b));
      if (!eligible) return null;

      const distance =
        origine && p.latitude != null && p.longitude != null
          ? Math.round(
              distanceKm(origine, { latitude: p.latitude, longitude: p.longitude }) * 10,
            ) / 10
          : null;

      return {
        userId: p.user_id,
        nom: nomParId.get(p.user_id) ?? "Professionnel",
        duReseau,
        badges,
        typeProfessionnel: p.type_professionnel ?? null,
        tarif: p.tarif_horaire_urgence ?? p.tarif_horaire ?? null,
        noteMoyenne: p.note_moyenne ?? null,
        nombreAvis: p.nombre_avis ?? 0,
        distanceKm: distance,
        creneaux: disponibles
          .filter((s) => s.professional_id === p.user_id)
          .map((s) => ({
            id: s.id,
            date: s.date,
            heure_debut: s.heure_debut,
            heure_fin: s.heure_fin,
            lieu_accueil: s.lieu_accueil ?? null,
            placesRestantes: restantesParSlot.get(s.id) ?? 0,
            demandesEnAttente: enAttenteParSlot.get(s.id) ?? 0,
          })),
      };
    })
    .filter((p): p is ProfessionnelUrgence => p !== null)
    // Le réseau d'abord, puis le plus proche : ce sont les deux critères qui
    // comptent quand il faut trouver quelqu'un dans l'heure.
    .sort((a, b) => {
      if (a.duReseau !== b.duReseau) return a.duReseau ? -1 : 1;
      if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm;
      return 0;
    });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold text-liams-navy">
          Trouver une garde en urgence
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Les professionnels dont un créneau d&apos;urgence est ouvert en ce
          moment. Une garde d&apos;urgence se demande entre 20 h et 2 h avant son
          début — au-delà, le professionnel n&apos;aurait pas le temps de
          s&apos;organiser.
        </p>
      </div>

      <RechercheUrgence
        professionnels={professionnels}
        enfants={enfants ?? []}
        aUnReseau={dansMonReseau.size > 0}
      />

      <NavigationBas href="/recherche" label="Retour au choix" />
    </div>
  );
}
