import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { geocodeAdresse } from "@/lib/geocoding";
import { matchProfessionnels, type ProfessionalCandidat } from "@/lib/matching";
import { JOURS_SEMAINE } from "@/lib/disponibilites";

const XTRA_BADGES = [
  "accueil_xtras_ordinaires",
  "specialiste_tsa",
  "specialiste_tdah",
  "specialiste_dys",
  "specialiste_handicap_moteur",
];

export default async function RecherchePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, user } = await requireUser("parent");
  const rawParams = await searchParams;
  const params = Object.fromEntries(
    Object.entries(rawParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  ) as Record<string, string | undefined>;

  const [{ data: parentProfile }, { data: professionnels }, { data: badgesCatalogue }] =
    await Promise.all([
      supabase.from("parent_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("professional_profiles").select("*, professional_badges(badge_code)"),
      supabase.from("badges").select("*").order("source"),
    ]);

  const jour = params.jour ? Number(params.jour) : undefined;
  const badgesRawList = rawParams.badges;
  const badgesRequis = Array.isArray(badgesRawList)
    ? badgesRawList
    : badgesRawList
      ? [badgesRawList]
      : [];

  let trajetDepart = null;
  let trajetArrivee = null;
  if (params.trajet_depart && params.trajet_arrivee) {
    trajetDepart = await geocodeAdresse(params.trajet_depart);
    trajetArrivee = await geocodeAdresse(params.trajet_arrivee);
  }

  const candidats: ProfessionalCandidat[] = (professionnels ?? []).map((p) => ({
    user_id: p.user_id,
    disponibilites: p.disponibilites ?? [],
    latitude: p.latitude,
    longitude: p.longitude,
    rayon_km: p.rayon_km,
    specialisations: p.specialisations ?? [],
    note_moyenne: p.note_moyenne,
    badges: (p.professional_badges ?? []).map((b: { badge_code: string }) => b.badge_code),
  }));

  const origine =
    trajetDepart && trajetArrivee
      ? undefined
      : parentProfile?.latitude && parentProfile?.longitude
        ? { latitude: parentProfile.latitude, longitude: parentProfile.longitude }
        : undefined;

  const resultats = matchProfessionnels(candidats, {
    jour,
    heureDebut: params.heure_debut || undefined,
    heureFin: params.heure_fin || undefined,
    origine,
    rayonKm: params.rayon ? Number(params.rayon) : undefined,
    trajetDepart: trajetDepart ?? undefined,
    trajetArrivee: trajetArrivee ?? undefined,
    badgesRequis,
  });

  const profilsParId = new Map((professionnels ?? []).map((p) => [p.user_id, p]));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <Link href="/tableau-de-bord" className="self-start text-sm text-liams-navy underline">
        ← Retour au tableau de bord
      </Link>
      <h1 className="text-2xl font-semibold text-liams-navy">
        Trouver un professionnel
      </h1>

      <form className="flex flex-col gap-4 rounded-xl border border-gray-200 p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            Jour
            <select name="jour" defaultValue={params.jour ?? ""} className="rounded-lg border border-gray-300 px-3 py-2">
              <option value="">Peu importe</option>
              {JOURS_SEMAINE.map((label, i) => (
                <option key={label} value={i}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            De
            <input type="time" name="heure_debut" defaultValue={params.heure_debut} className="rounded-lg border border-gray-300 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            À
            <input type="time" name="heure_fin" defaultValue={params.heure_fin} className="rounded-lg border border-gray-300 px-3 py-2" />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          Rayon de recherche (km) — sinon le rayon déclaré par chaque professionnel s&apos;applique
          <input type="number" name="rayon" defaultValue={params.rayon} min="1" className="rounded-lg border border-gray-300 px-3 py-2 sm:w-40" />
        </label>

        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-liams-teal">
            Recherche par trajet (ex : domicile → école)
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              name="trajet_depart"
              defaultValue={params.trajet_depart}
              placeholder="Point de départ"
              className="rounded-lg border border-gray-300 px-3 py-2"
            />
            <input
              name="trajet_arrivee"
              defaultValue={params.trajet_arrivee}
              placeholder="Point d'arrivée"
              className="rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
        </details>

        <div>
          <p className="text-sm font-medium text-gray-700">Filtrer par badges</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(badgesCatalogue ?? [])
              .filter((b) => b.source === "manuel")
              .map((b) => (
                <label
                  key={b.code}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
                    XTRA_BADGES.includes(b.code)
                      ? "border-liams-teal text-liams-teal"
                      : "border-gray-300 text-gray-600"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="badges"
                    value={b.code}
                    defaultChecked={badgesRequis.includes(b.code)}
                  />
                  {b.label}
                </label>
              ))}
          </div>
        </div>

        <button
          type="submit"
          className="self-start rounded-full bg-liams-orange px-6 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Rechercher
        </button>
      </form>

      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-500">{resultats.length} professionnel(s) trouvé(s)</p>
        {resultats.map(({ candidat, distanceKm }) => {
          const profil = profilsParId.get(candidat.user_id);
          return (
            <Link
              key={candidat.user_id}
              href={`/professionnels/${candidat.user_id}`}
              className="flex items-center gap-4 rounded-xl border border-gray-200 p-4 hover:border-liams-orange"
            >
              <div className="flex-1">
                <p className="font-medium text-liams-navy">
                  {profil?.tarif_horaire ? `${profil.tarif_horaire} €/h` : "Tarif non renseigné"}
                  {distanceKm !== null && ` — ${distanceKm.toFixed(1)} km`}
                </p>
                <p className="text-sm text-gray-500">
                  {candidat.specialisations.join(", ") || "Aucune spécialisation renseignée"}
                </p>
                {candidat.badges.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {candidat.badges.map((code) => (
                      <span key={code} className="rounded-full bg-liams-teal/10 px-2 py-0.5 text-xs text-liams-teal">
                        {code}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {candidat.note_moyenne && (
                <span className="text-sm font-medium text-liams-orange">★ {candidat.note_moyenne}</span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
