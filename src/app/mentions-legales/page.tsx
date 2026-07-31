import { NavigationBas } from "@/components/NavigationBas";

export default function MentionsLegalesPage() {
  return (
    <div className="mx-auto max-w-2xl flex-1 px-6 py-16">
      <h1 className="text-2xl font-semibold text-liams-navy">
        Mentions légales
      </h1>
      <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Contenu provisoire — SIRET, forme juridique et directeur de
        publication à compléter dès obtention, puis à faire valider par un
        professionnel du droit avant mise en ligne réelle (obligation LCEN).
      </p>

      <div className="mt-6 flex flex-col gap-6 text-sm text-gray-700">
        <section>
          <h2 className="font-semibold text-liams-navy">Éditeur</h2>
          <p className="mt-1">
            Liams — [forme juridique et SIRET à compléter]
            <br />
            Directeur de publication : [nom à compléter]
            <br />
            Contact : voir la page <a href="/contact" className="underline">Contact</a>
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-liams-navy">Hébergement</h2>
          <p className="mt-1">
            Frontend hébergé par Vercel Inc.
            <br />
            Base de données et authentification hébergées par Supabase.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-liams-navy">Propriété intellectuelle</h2>
          <p className="mt-1">
            La marque, le logo et les contenus de Liams sont protégés. Toute
            reproduction non autorisée est interdite.
          </p>
        </section>
      </div>

      <NavigationBas href="/" label="Accueil" />
    </div>
  );
}
