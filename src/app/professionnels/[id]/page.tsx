import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BadgeIcone } from "@/components/BadgeIcone";
import { NavigationBas } from "@/components/NavigationBas";
import { demanderMiseEnRelation } from "../../messages/actions";
import { SignalerProfil } from "./SignalerProfil";

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

  // Masquée par décision d'un administrateur : la fiche n'est plus consultable,
  // sauf par son titulaire — qui doit pouvoir constater son état — et par
  // l'admin. On ne dit pas pourquoi ici : le motif regarde le professionnel,
  // pas les visiteurs.
  const { data: visiteur } = authData.user
    ? await supabase.from("users").select("role").eq("id", authData.user.id).maybeSingle()
    : { data: null };

  if (
    profile.masque &&
    authData.user?.id !== id &&
    visiteur?.role !== "admin"
  ) {
    notFound();
  }

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
  const lesPhotos = (photos ?? []).map((p) => ({
    url: `${supabaseUrl}/storage/v1/object/public/professional-photos/${p.fichier_url}`,
    // « Le jardin », « la salle des bébés » : ce que la photo montre, quand le
    // professionnel a pris la peine de le dire.
    legende:
      (p.legende as string | null) ||
      (p.sujet === "lieu" ? "Le lieu d'accueil" : null),
  }));

  // Une fiche sans nom se lit mal et se retient moins bien. Pour un
  // établissement, `identites` porte la raison sociale — c'est elle que les
  // familles cherchent.
  const { data: identite } = await supabase
    .from("identites")
    .select("prenom, nom")
    .eq("user_id", id)
    .maybeSingle();
  const nomAffiche =
    [identite?.prenom, identite?.nom].filter(Boolean).join(" ") || "Professionnel";

  // Se déplace-t-il ? Un établissement, jamais. Pour les autres, c'est le lieu
  // d'accueil déclaré qui le dit — et c'est ce qui décide si son rayon
  // s'affiche comme une limite ou pas du tout.
  const { data: fiche } = await supabase
    .from("etablissements")
    .select("professional_id")
    .eq("professional_id", id)
    .maybeSingle();
  const seDeplace =
    fiche === null &&
    (profile.lieu_accueil === "domicile_parent" || profile.lieu_accueil === "les_deux");

  /** Photos et réponses alternées, plutôt qu'un carrousel puis un pavé de
   *  texte. On lit une photo, une réponse, une photo — chaque bloc donne envie
   *  du suivant, et l'ensemble se parcourt au pouce.
   *
   *  Les photos apparaissaient deux fois jusqu'ici : toutes dans le carrousel,
   *  puis de nouveau en grille sous les prompts. */
  type Bloc =
    | { type: "photo"; cle: string; url: string; legende: string | null }
    | {
        type: "prompt";
        cle: string;
        question: string;
        reponse: string | null;
        audio: string | null;
      };

  const [photoPrincipale, ...autresPhotos] = lesPhotos;
  const blocs: Bloc[] = [];
  const filePrompts = [...(prompts ?? [])];
  const filePhotos = [...autresPhotos];

  while (filePrompts.length > 0 || filePhotos.length > 0) {
    const prompt = filePrompts.shift();
    if (prompt) {
      blocs.push({
        type: "prompt",
        cle: `prompt-${prompt.id}`,
        question: prompt.question,
        reponse: prompt.reponse,
        audio: prompt.audio_url
          ? `${supabaseUrl}/storage/v1/object/public/professional-voix/${prompt.audio_url}`
          : null,
      });
    }
    const photo = filePhotos.shift();
    if (photo) {
      blocs.push({
        type: "photo",
        cle: `photo-${photo.url}`,
        url: photo.url,
        legende: photo.legende,
      });
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      {photoPrincipale ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoPrincipale.url}
          alt=""
          className="aspect-[4/5] w-full rounded-2xl object-cover"
        />
      ) : (
        <div className="flex aspect-[4/5] w-full items-center justify-center rounded-2xl bg-liams-navy/5 text-sm text-gray-500">
          Pas encore de photo
        </div>
      )}

      <h1 className="text-2xl font-semibold text-liams-navy">{nomAffiche}</h1>

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

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {(badges ?? []).map((b) => (
          <BadgeIcone
            key={b.badge_code}
            code={b.badge_code}
            label={(b.badges as unknown as { label: string } | null)?.label ?? b.badge_code}
          />
        ))}
        {profile.note_moyenne && (
          <span className="rounded-full bg-liams-orange/10 px-3 py-1 text-xs font-medium text-liams-orange">
            ★ {profile.note_moyenne}/5 ({profile.nombre_avis} avis)
          </span>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 p-5 text-sm text-gray-700">
        {/* En tête de l'encadré : le repère qu'une famille cherche avant de
            lire les prompts, qui parlent de personnalité et non de parcours. */}
        {profile.presentation && (
          <p className="mb-4 whitespace-pre-line text-base leading-relaxed text-liams-navy">
            {profile.presentation}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          {profile.tarif_horaire && (
            <div>
              <span className="text-gray-400">Tarif indicatif</span>
              <p className="font-medium">{profile.tarif_horaire} €/h</p>
            </div>
          )}
          {profile.annees_experience != null && (
            <div>
              <span className="text-gray-400">Expérience</span>
              <p className="font-medium">
                {profile.annees_experience} an{profile.annees_experience > 1 ? "s" : ""}
              </p>
            </div>
          )}
          {profile.adresse && (
            <div>
              {/* Un rayon ne se montre que s'il veut dire quelque chose : il dit
                  jusqu'où le professionnel se déplace. Chez un établissement ou
                  chez quelqu'un qui reçoit à son domicile, c'est la famille qui
                  fait la route, et la distance se lit dans la recherche. */}
              <span className="text-gray-400">
                {seDeplace ? "Zone d'intervention" : "Adresse"}
              </span>
              <p className="font-medium">
                {profile.adresse}
                {seDeplace ? ` (jusqu'à ${profile.rayon_km} km)` : ""}
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

      {/* L'alternance photo / réponse : c'est ici que viendra se glisser une
          réponse vocale, comme un bloc de plus dans la même file. */}
      <div className="flex flex-col gap-4">
        {blocs.map((bloc) =>
          bloc.type === "prompt" ? (
            <div key={bloc.cle} className="rounded-2xl bg-liams-navy/5 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-liams-teal">
                {bloc.question}
              </p>
              {/* La voix d'abord : c'est ce qu'on est venu entendre. Le texte,
                  quand il accompagne un enregistrement, tient lieu de
                  transcription pour qui ne peut pas écouter. */}
              {bloc.audio && (
                <audio controls preload="none" src={bloc.audio} className="mt-3 w-full" />
              )}
              {bloc.reponse && (
                <p className="mt-2 text-base text-liams-navy">{bloc.reponse}</p>
              )}
            </div>
          ) : (
            <figure key={bloc.cle} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bloc.url}
                alt={bloc.legende ?? ""}
                className="aspect-[4/5] w-full rounded-2xl object-cover"
              />
              {bloc.legende && (
                <figcaption className="absolute inset-x-0 bottom-0 rounded-b-2xl bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-8 text-sm font-medium text-white">
                  {bloc.legende}
                </figcaption>
              )}
            </figure>
          ),
        )}
      </div>

      {profile.masque && currentUser?.id === id && (
        <p className="rounded-xl border-2 border-red-300 bg-red-50 p-4 text-sm text-red-800">
          Votre fiche est actuellement masquée et n&apos;apparaît plus aux
          familles. Contactez l&apos;équipe Liams pour en connaître la raison.
        </p>
      )}

      {/* Discret, et jamais sur sa propre fiche. La grande majorité des profils
          n'a rien à se reprocher ; un bouton d'alerte en évidence sous chacun
          installerait une suspicion que rien ne justifie. */}
      {currentUser && currentUser.id !== id && <SignalerProfil cibleId={id} />}

      {/* Un visiteur non connecté n'a pas de tableau de bord : on le ramène
          à l'accueil plutôt que vers une page qui le renverrait au login. */}
      {currentUser ? (
        <NavigationBas />
      ) : (
        <NavigationBas href="/" label="Accueil" />
      )}
    </div>
  );
}
