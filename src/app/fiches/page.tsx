import { requireUser } from "@/lib/auth";
import { NavigationBas } from "@/components/NavigationBas";
import { FicheEnfant, type EnfantAccueilli } from "./FicheEnfant";

/** Les fiches des enfants que le professionnel accueille.
 *
 * Les parents renseignaient allergies, traitements et besoins particuliers
 * depuis l'origine sans qu'aucun écran ne les montre à qui va garder l'enfant.
 * Le droit existait en base ; il lui manquait une porte.
 *
 * Ce que l'on voit ici est ce que la règle de sécurité laisse passer : on ne
 * filtre pas une seconde fois côté application, sous peine de faire diverger
 * deux définitions du même droit. */
export default async function FichesPage({
  searchParams,
}: {
  searchParams: Promise<{ urgence_confirmee?: string }>;
}) {
  const { supabase, user } = await requireUser("professionnel");
  const { urgence_confirmee } = await searchParams;

  // Les enfants dont ce professionnel a une réservation en cours ou à venir.
  const [{ data: urgences }, { data: lignes }, { data: recurrentes }] =
    await Promise.all([
      supabase
        .from("urgent_bookings")
        .select("enfant_ids, slot:availability_slots(date, heure_debut, heure_fin)")
        .eq("professional_id", user.id)
        .eq("statut", "confirme"),
      supabase
        .from("demande_creneau_lignes")
        .select(
          "statut, slot:availability_slots(date, heure_debut, heure_fin), demandes_creneaux!inner(professional_id, enfant_ids)",
        )
        .eq("statut", "accepte")
        .eq("demandes_creneaux.professional_id", user.id),
      supabase
        .from("recurring_bookings")
        .select("enfant_ids, jour_semaine, heure_debut, heure_fin, date_fin")
        .eq("professional_id", user.id)
        .eq("statut", "actif"),
    ]);

  // Un enfant peut être accueilli à plusieurs titres : on ne montre qu'une
  // fiche, en retenant le régime le plus protecteur — l'urgence, qui interdit
  // l'export.
  const gardes = new Map<string, { urgence: boolean; quand: string[] }>();
  const noter = (ids: string[] | null, urgence: boolean, quand: string) => {
    for (const id of ids ?? []) {
      const actuel = gardes.get(id) ?? { urgence: false, quand: [] };
      gardes.set(id, {
        urgence: actuel.urgence || urgence,
        quand: [...actuel.quand, quand],
      });
    }
  };

  const enFrancais = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

  for (const u of urgences ?? []) {
    const s = u.slot as unknown as { date: string; heure_debut: string } | null;
    noter(u.enfant_ids, true, s ? `${enFrancais(s.date)} (urgence)` : "urgence");
  }

  for (const l of lignes ?? []) {
    const s = l.slot as unknown as { date: string; heure_debut: string } | null;
    const d = l.demandes_creneaux as unknown as { enfant_ids: string[] | null } | null;
    noter(d?.enfant_ids ?? null, false, s ? enFrancais(s.date) : "à venir");
  }

  const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
  for (const r of recurrentes ?? []) {
    noter(
      r.enfant_ids,
      false,
      `tous les ${JOURS[r.jour_semaine] ?? "?"} · ${r.heure_debut.slice(0, 5)}–${r.heure_fin.slice(0, 5)}`,
    );
  }

  const ids = [...gardes.keys()];

  const { data: enfants } = ids.length
    ? await supabase
        .from("enfants")
        .select(
          "id, prenom, date_naissance, besoins_particuliers_libre, besoins_particuliers_tags, enfant_fiche_sante(*), enfant_profil_xtra(*)",
        )
        .in("id", ids)
    : { data: [] };

  // Relations un-à-un : PostgREST renvoie un objet, mais le client sans types
  // générés en suppose un tableau — d'où cette normalisation.
  const seul = (valeur: unknown): Record<string, unknown> | null => {
    if (Array.isArray(valeur)) return (valeur[0] as Record<string, unknown>) ?? null;
    return (valeur as Record<string, unknown>) ?? null;
  };

  const { data: lectures } = ids.length
    ? await supabase
        .from("lectures_fiches")
        .select("enfant_id, lu_le")
        .eq("professional_id", user.id)
        .in("enfant_id", ids)
    : { data: [] };
  const luParEnfant = new Map((lectures ?? []).map((l) => [l.enfant_id, l.lu_le]));

  const accueillis: EnfantAccueilli[] = (enfants ?? []).map((e) => {
    const sante = seul(e.enfant_fiche_sante);
    const xtra = seul(e.enfant_profil_xtra);
    const lu = luParEnfant.get(e.id) ?? null;

    // Une fiche modifiée après la lecture n'a pas été lue : la confirmation
    // se périme, plutôt que de couvrir une allergie ajoutée depuis.
    const derniereMaj = [sante?.updated_at, xtra?.updated_at]
      .filter((d): d is string => typeof d === "string")
      .sort()
      .pop();
    const perimee = Boolean(lu && derniereMaj && derniereMaj > lu);

    return {
      id: e.id,
      prenom: e.prenom,
      date_naissance: e.date_naissance,
      besoins_particuliers_libre: e.besoins_particuliers_libre,
      besoins_particuliers_tags: e.besoins_particuliers_tags,
      enfant_fiche_sante: sante,
      enfant_profil_xtra: xtra,
      urgence: gardes.get(e.id)?.urgence ?? false,
      quand: [...new Set(gardes.get(e.id)?.quand ?? [])],
      luLe: perimee ? null : lu,
      aRelire: perimee,
    };
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold text-liams-navy">
          Les enfants que j&apos;accueille
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Ces fiches vous sont confiées par les familles pour la durée de la
          garde. Elles disparaissent de cette page le lendemain.
        </p>
      </div>

      {urgence_confirmee === "1" && (
        <p className="rounded-lg border border-liams-orange/40 bg-liams-orange/10 px-4 py-3 text-sm text-liams-navy">
          Garde d&apos;urgence confirmée. Prenez un instant pour lire la fiche de
          l&apos;enfant avant son arrivée — allergies, traitements et conduite à
          tenir y figurent.
        </p>
      )}

      {accueillis.length === 0 && (
        <p className="rounded-lg bg-gray-50 px-4 py-6 text-sm text-gray-500">
          Aucune garde en cours ou à venir. Les fiches apparaîtront ici dès
          qu&apos;une réservation sera validée.
        </p>
      )}

      {accueillis.map((enfant) => (
        <FicheEnfant key={enfant.id} enfant={enfant} />
      ))}

      {/* Reste visible à l'impression : une fiche longue durée finit affichée
          au mur, et le rappel doit l'accompagner. */}
      <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600">
        Ces éléments d&apos;information facilitent la prise de contact et
        l&apos;accueil de l&apos;enfant, mais ne remplacent pas les obligations
        légales du professionnel ni les autorisations écrites signées par les
        parents.
      </p>

      <NavigationBas />
    </div>
  );
}
