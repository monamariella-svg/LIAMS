export default function CguPage() {
  return (
    <div className="mx-auto max-w-2xl flex-1 px-6 py-16">
      <h1 className="text-2xl font-semibold text-liams-navy">
        Conditions Générales d&apos;Utilisation
      </h1>
      <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Contenu provisoire, rédigé pour la phase pilote — à faire rédiger ou
        relire par un professionnel du droit (avocat, ou via l&apos;accompagnement
        BGE PaRIF) avant toute mise en ligne réelle.
      </p>

      <div className="mt-6 flex flex-col gap-6 text-sm text-gray-700">
        <section>
          <h2 className="font-semibold text-liams-navy">1. Objet</h2>
          <p className="mt-1">
            Les présentes Conditions Générales d&apos;Utilisation (CGU) régissent
            l&apos;accès et l&apos;usage de la plateforme Liams, qui met en relation
            des parents et des professionnels de la garde d&apos;enfants,
            notamment pour l&apos;accompagnement d&apos;enfants à besoins
            particuliers (« Les Xtras »). L&apos;acceptation des CGU est
            obligatoire et horodatée lors de la création de tout compte.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-liams-navy">2. Nature du service</h2>
          <p className="mt-1">
            Liams est un service de mise en relation. Liams n&apos;est pas
            l&apos;employeur des professionnels référencés et n&apos;est pas partie
            au contrat de garde conclu entre un parent et un professionnel.
            Pendant la phase pilote, aucun paiement n&apos;est traité par la
            plateforme.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-liams-navy">3. Comptes parent</h2>
          <p className="mt-1">
            Le parent s&apos;engage à fournir des informations exactes,
            notamment la fiche santé/urgence de chaque enfant, dont
            l&apos;exactitude conditionne la sécurité de la garde. Ces
            informations ne sont visibles que par les professionnels en
            mise en relation active.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-liams-navy">4. Comptes professionnel</h2>
          <p className="mt-1">
            Le professionnel s&apos;engage à fournir des documents authentiques
            (bulletin n°3 du casier judiciaire, diplômes, certificats). Le
            statut « vérifié » est attribué manuellement par le gérant après
            contrôle du bulletin n°3 ; il ne constitue pas une garantie
            absolue et ne dispense pas le parent de sa propre vigilance.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-liams-navy">5. Badges et avis</h2>
          <p className="mt-1">
            Les badges manuels sont attribués par le gérant sur la base des
            justificatifs fournis. Le badge automatique « Coup de cœur des
            parents » est calculé à partir de la moyenne des avis. Les avis
            engagent la responsabilité de leur auteur ; les propos abusifs
            peuvent être supprimés par le gérant.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-liams-navy">6. Responsabilité</h2>
          <p className="mt-1">
            Liams s&apos;efforce d&apos;assurer un contrôle raisonnable des profils
            mais ne peut garantir l&apos;exhaustivité des vérifications. La
            relation de garde (déroulement, rémunération, litiges) relève de
            la seule responsabilité des parties concernées.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-liams-navy">7. Résiliation</h2>
          <p className="mt-1">
            Chaque utilisateur peut demander la clôture de son compte à tout
            moment en écrivant au support (voir page Contact). Liams peut
            suspendre un compte en cas de manquement grave aux présentes CGU.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-liams-navy">8. Contact</h2>
          <p className="mt-1">
            Pour toute question relative aux présentes CGU, voir la page{" "}
            <a href="/contact" className="underline">Contact</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
