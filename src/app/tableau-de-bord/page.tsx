import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeParentProgress, computeProfessionalProgress } from "@/lib/progress";
import { TuileNavigation } from "@/components/TuileNavigation";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

/** Renvoie null pour un rôle sans notion d'avancement (admin). */
async function calculerAvancement(
  supabase: SupabaseServer,
  userId: string,
  role: string | undefined,
): Promise<number | null> {
  if (role === "parent") {
    const [
      { data: parentProfile },
      { data: enfants },
      { data: identite },
      { data: coordonnees },
    ] = await Promise.all([
      supabase.from("parent_profiles").select("adresse").eq("user_id", userId).maybeSingle(),
      supabase
        .from("enfants")
        .select("id, enfant_fiche_sante(enfant_id)")
        .eq("parent_id", userId),
      supabase.from("identites").select("prenom, nom").eq("user_id", userId).maybeSingle(),
      supabase.from("coordonnees").select("telephone").eq("user_id", userId).maybeSingle(),
    ]);

    return computeParentProgress({
      identiteComplete: Boolean(identite?.prenom && identite?.nom),
      telephoneRenseigne: Boolean(coordonnees?.telephone),
      adresseRenseignee: Boolean(parentProfile?.adresse),
      auMoinsUnEnfant: (enfants?.length ?? 0) > 0,
      fichesSanteCompletes: (enfants ?? []).every((e) => e.enfant_fiche_sante),
    }).pourcentage;
  }

  if (role === "professionnel") {
    const [
      { data: proProfile },
      { data: documents },
      { data: qualification },
      { data: photos },
      { data: coordonnees },
    ] = await Promise.all([
      supabase
        .from("professional_profiles")
        .select("adresse, tarif_horaire")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase.from("professional_documents").select("type").eq("professional_id", userId),
      supabase
        .from("professional_qualification_xtra")
        .select("professional_id")
        .eq("professional_id", userId)
        .maybeSingle(),
      supabase.from("professional_photos").select("id").eq("professional_id", userId),
      supabase.from("coordonnees").select("telephone").eq("user_id", userId).maybeSingle(),
    ]);

    const aType = (type: string) => (documents ?? []).some((d) => d.type === type);

    return computeProfessionalProgress({
      infosGeneralesCompletes: Boolean(
        proProfile?.adresse && proProfile?.tarif_horaire && coordonnees?.telephone,
      ),
      casierDepose: aType("casier"),
      cvDepose: aType("cv"),
      diplomeOuCertificatDepose: aType("diplome") || aType("certificat"),
      questionXtrasRepondue: qualification !== null,
      aUnePhoto: (photos?.length ?? 0) > 0,
    }).pourcentage;
  }

  return null;
}

export default async function TableauDeBordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connexion");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  const { data: identite } = await supabase
    .from("identites")
    .select("prenom")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: feedbackEnAttente } = await supabase
    .from("feedback_pilote")
    .select("id")
    .eq("user_id", user.id)
    .is("date_reponse", null)
    .maybeSingle();

  // Réclamer un profil déjà complet donne le sentiment d'un dossier qu'on ne
  // finit jamais : on ne le demande que s'il manque vraiment quelque chose.
  const pourcentage = await calculerAvancement(supabase, user.id, profile?.role);
  const profilComplet = pourcentage !== null && pourcentage >= 100;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold text-liams-navy">
        {/* Les comptes créés avant que le prénom existe n'en ont pas :
            un accueil sans prénom vaut mieux qu'un accueil bancal. */}
        Bienvenue{identite?.prenom ? ` ${identite.prenom}` : ""} !
      </h1>
      <p className="mt-4 text-gray-600">
        {profilComplet
          ? "Votre profil est complet."
          : "Votre compte est créé. Complétez votre profil pour commencer."}
      </p>
      {feedbackEnAttente && (
        <Link
          href="/feedback"
          className="mt-4 rounded-lg bg-liams-teal/10 px-4 py-2 text-sm font-medium text-liams-teal hover:bg-liams-teal/20"
        >
          On aimerait avoir votre avis sur Liams — 2 minutes chrono
        </Link>
      )}
      {profile?.role === "parent" && (
        <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
          <TuileNavigation
            href="/recherche"
            icone="recherche"
            titre="Chercher un accueil"
            description="Longue durée, ponctuel ou urgence"
            accent
          />
          <TuileNavigation
            href="/planning"
            icone="calendrier"
            titre="Mon calendrier"
            description="Mes besoins et mes réservations"
          />
          <TuileNavigation
            href="/profil/parent"
            icone="profil"
            titre="Mon profil et mes enfants"
            description={profilComplet ? undefined : "À compléter"}
          />
          <TuileNavigation
            href="/reseau"
            icone="reseau"
            titre="Mon réseau de confiance"
          />
          <TuileNavigation href="/messages" icone="messages" titre="Mes messages" />
        </div>
      )}
      {profile?.role === "professionnel" && (
        <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
          <TuileNavigation
            href="/planning"
            icone="calendrier"
            titre="Mon planning"
            description="Mes créneaux et les demandes reçues"
            accent
          />
          {/* Les fiches se cherchent avant une garde, souvent dans la hâte :
              autant qu'elles soient à un clic du tableau de bord. */}
          <TuileNavigation
            href="/fiches"
            icone="fiches"
            titre="Les enfants que j'accueille"
            description="Fiches sanitaires et besoins particuliers"
          />
          <TuileNavigation
            href="/profil/professionnel"
            icone="profil"
            titre="Mon profil"
            description={profilComplet ? undefined : "À compléter"}
          />
          <TuileNavigation
            href={`/professionnels/${user.id}`}
            icone="vitrine"
            titre="Mon profil public"
            description="Ce que les parents voient"
          />
          <TuileNavigation
            href="/reseau"
            icone="reseau"
            titre="Mon réseau de confiance"
          />
          <TuileNavigation href="/messages" icone="messages" titre="Mes messages" />
        </div>
      )}
      {profile?.role === "admin" && (
        <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
          <TuileNavigation
            href="/admin"
            icone="verification"
            titre="Tableau de bord admin"
            accent
          />
        </div>
      )}
      <form action="/deconnexion" method="post" className="mt-8">
        <button
          type="submit"
          className="rounded-full border border-liams-navy px-6 py-2 text-sm font-medium text-liams-navy hover:bg-liams-navy hover:text-white transition-colors"
        >
          Se déconnecter
        </button>
      </form>
    </div>
  );
}
