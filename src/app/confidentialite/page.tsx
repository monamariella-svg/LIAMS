import { NavigationBas } from "@/components/NavigationBas";

export default function ConfidentialitePage() {
  return (
    <div className="mx-auto max-w-2xl flex-1 px-6 py-16">
      <h1 className="text-2xl font-semibold text-liams-navy">
        Politique de confidentialité
      </h1>
      <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Contenu provisoire, rédigé pour la phase pilote — à faire rédiger ou
        relire par un professionnel du droit avant toute mise en ligne réelle,
        compte tenu notamment du traitement de données de santé d&apos;enfants.
      </p>

      <div className="mt-6 flex flex-col gap-6 text-sm text-gray-700">
        <section>
          <h2 className="font-semibold text-liams-navy">1. Responsable de traitement</h2>
          <p className="mt-1">
            Liams (identité juridique et SIRET à compléter, voir mentions
            légales) est responsable du traitement des données personnelles
            décrites ci-dessous.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-liams-navy">2. Données collectées</h2>
          <ul className="mt-1 list-disc pl-5">
            <li>Compte : email, mot de passe (chiffré), rôle, date d&apos;acceptation des CGU</li>
            <li>Profil parent : localisation, disponibilités, informations sur les enfants</li>
            <li>
              <strong>Données sensibles (RGPD article 9)</strong> : fiche
              santé/urgence de chaque enfant (allergies, traitements, contacts
              d&apos;urgence) et profil enrichi « Xtra » (routines, déclencheurs,
              moyens de communication) — traitées avec un consentement
              explicite du parent
            </li>
            <li>Profil professionnel : tarif, zone d&apos;intervention, expérience, documents justificatifs</li>
            <li>Avis, messages échangés, historique de réservations</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-liams-navy">3. Finalités et bases légales</h2>
          <p className="mt-1">
            Les données sont traitées pour permettre la mise en relation, la
            sécurité des enfants gardés, et le bon fonctionnement du service
            (exécution du contrat d&apos;utilisation ; consentement explicite pour
            les données de santé).
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-liams-navy">4. Qui a accès aux données sensibles ?</h2>
          <p className="mt-1">
            La fiche santé/urgence et le profil Xtra ne sont <strong>jamais
            publics</strong>. Ils sont visibles uniquement par les professionnels
            en mise en relation active avec le parent concerné, et par
            l&apos;administrateur de la plateforme dans le cadre de la
            modération.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-liams-navy">5. Sous-traitants</h2>
          <p className="mt-1">
            Hébergement des données et authentification : Supabase.
            Hébergement du site : Vercel. Envoi des emails transactionnels :
            Resend. Aucune donnée n&apos;est vendue à des tiers.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-liams-navy">6. Durée de conservation</h2>
          <p className="mt-1">
            Les données sont conservées pendant la durée d&apos;utilisation du
            compte, puis supprimées ou anonymisées dans un délai raisonnable
            après clôture du compte (durée précise à définir lors de la
            validation juridique).
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-liams-navy">7. Vos droits</h2>
          <p className="mt-1">
            Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de
            rectification, d&apos;effacement, de limitation, de portabilité et
            d&apos;opposition. Pour les exercer, contactez-nous via la page{" "}
            <a href="/contact" className="underline">Contact</a>.
          </p>
        </section>
      </div>

      <NavigationBas href="/" label="Accueil" />
    </div>
  );
}
