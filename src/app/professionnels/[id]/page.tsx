import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PhotoCarousel } from "./PhotoCarousel";
import { demanderMiseEnRelation } from "../../messages/actions";

export default async function ProfessionnelPublicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: profile }, { data: photos }, { data: prompts }, { data: badges }, { data: authData }] =
    await Promise.all([
      supabase.from("professional_profiles").select("*").eq("user_id", id).maybeSingle(),
      supabase.from("professional_photos").select("*").eq("professional_id", id).order("ordre"),
      supabase.from("professional_prompts").select("*").eq("professional_id", id).order("ordre"),
      supabase
        .from("professional_badges")
        .select("badge_code, badges(label)")
        .eq("professional_id", id),
      supabase.auth.getUser(),
    ]);

  if (!profile) notFound();

  const currentUser = authData.user;
  let currentUserRole: string | null = null;
  let existingMatch: { id: string; statut: string } | null = null;

  if (currentUser) {
    const { data: userRow } = await supabase
      .from("users")
      .select("role")
      .eq("id", currentUser.id)
      .maybeSingle();
    currentUserRole = userRow?.role ?? null;

    if (currentUserRole === "parent") {
      const { data: match } = await supabase
        .from("matches")
        .select("id, statut")
        .eq("parent_id", currentUser.id)
        .eq("professional_id", id)
        .maybeSingle();
      existingMatch = match;
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const photoUrls = (photos ?? []).map(
    (p) => `${supabaseUrl}/storage/v1/object/public/professional-photos/${p.fichier_url}`,
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      {currentUser && (
        <Link href="/tableau-de-bord" className="self-start text-sm text-liams-navy underline">
          ← Retour au tableau de bord
        </Link>
      )}
      <PhotoCarousel urls={photoUrls} />

      {currentUserRole === "parent" && (
        <div>
          {!existingMatch && (
            <form action={demanderMiseEnRelation}>
              <input type="hidden" name="professional_id" value={id} />
              <button
                type="submit"
                className="rounded-full bg-liams-orange px-6 py-2.5 text-sm font-medium text-white hover:opacity-90"
              >
                Demander une mise en relation
              </button>
            </form>
          )}
          {existingMatch?.statut === "en_attente" && (
            <p className="text-sm text-gray-500">
              Demande envoyée — en attente de réponse du professionnel.
            </p>
          )}
          {existingMatch?.statut === "refuse" && (
            <p className="text-sm text-gray-500">Cette demande a été refusée.</p>
          )}
          {existingMatch?.statut === "accepte" && (
            <Link
              href={`/messages/${existingMatch.id}`}
              className="inline-block rounded-full bg-liams-teal px-6 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              Voir la conversation
            </Link>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(badges ?? []).map((b) => (
          <span
            key={b.badge_code}
            className="rounded-full bg-liams-teal/10 px-3 py-1 text-xs font-medium text-liams-teal"
          >
            {(b.badges as unknown as { label: string } | null)?.label ?? b.badge_code}
          </span>
        ))}
        {profile.note_moyenne && (
          <span className="rounded-full bg-liams-orange/10 px-3 py-1 text-xs font-medium text-liams-orange">
            ★ {profile.note_moyenne}/5 ({profile.nombre_avis} avis)
          </span>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 p-5 text-sm text-gray-700">
        <div className="grid grid-cols-2 gap-3">
          {profile.tarif_horaire && (
            <div>
              <span className="text-gray-400">Tarif indicatif</span>
              <p className="font-medium">{profile.tarif_horaire} €/h</p>
            </div>
          )}
          {profile.adresse && (
            <div>
              <span className="text-gray-400">Zone d&apos;intervention</span>
              <p className="font-medium">
                {profile.adresse} ({profile.rayon_km} km)
              </p>
            </div>
          )}
        </div>
        {profile.specialisations?.length > 0 && (
          <div className="mt-3">
            <span className="text-gray-400">Spécialisations</span>
            <p className="font-medium">{profile.specialisations.join(", ")}</p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {(prompts ?? []).map((prompt) => (
          <div key={prompt.id} className="rounded-2xl bg-liams-navy/5 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-liams-teal">
              {prompt.question}
            </p>
            <p className="mt-2 text-base text-liams-navy">{prompt.reponse}</p>
          </div>
        ))}
      </div>

      {photoUrls.length > 1 && (
        <div className="grid grid-cols-3 gap-2">
          {photoUrls.slice(1).map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt="" className="h-28 w-full rounded-lg object-cover" />
          ))}
        </div>
      )}
    </div>
  );
}
