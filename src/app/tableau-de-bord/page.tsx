import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  return (
    <div className="mx-auto flex max-w-2xl flex-1 flex-col justify-center px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold text-liams-navy">
        {/* Les comptes créés avant que le prénom existe n'en ont pas :
            un accueil sans prénom vaut mieux qu'un accueil bancal. */}
        Bienvenue{identite?.prenom ? ` ${identite.prenom}` : ""} !
      </h1>
      <p className="mt-4 text-gray-600">
        Votre compte est créé. Complétez votre profil pour commencer.
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
        <>
          <Link
            href="/profil/parent"
            className="mt-6 self-center rounded-full bg-liams-orange px-6 py-3 font-medium text-white hover:opacity-90"
          >
            Compléter mon profil parent
          </Link>
          <Link
            href="/planning"
            className="mt-3 self-center text-sm text-liams-navy underline"
          >
            Mes besoins de garde et les professionnels disponibles
          </Link>
        </>
      )}
      {profile?.role === "professionnel" && (
        <>
          <Link
            href="/profil/professionnel"
            className="mt-6 self-center rounded-full bg-liams-orange px-6 py-3 font-medium text-white hover:opacity-90"
          >
            Compléter mon profil professionnel
          </Link>
          <Link
            href={`/professionnels/${user.id}`}
            className="mt-3 self-center text-sm text-liams-navy underline"
          >
            Voir mon profil public
          </Link>
          <Link href="/planning" className="mt-3 self-center text-sm text-liams-navy underline">
            Mon planning
          </Link>
        </>
      )}
      {profile?.role === "admin" && (
        <Link
          href="/admin"
          className="mt-6 self-center rounded-full bg-liams-navy px-6 py-3 font-medium text-white hover:opacity-90"
        >
          Tableau de bord admin
        </Link>
      )}
      {profile?.role !== "admin" && (
        <>
          <Link href="/messages" className="mt-3 self-center text-sm text-liams-navy underline">
            Mes mises en relation
          </Link>
          <Link href="/reseau" className="mt-3 self-center text-sm text-liams-navy underline">
            Mon réseau de confiance
          </Link>
        </>
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
