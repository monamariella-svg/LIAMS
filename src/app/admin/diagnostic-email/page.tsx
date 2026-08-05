import { requireAdmin } from "@/lib/auth";
import { NavigationBas } from "@/components/NavigationBas";
import { TestEnvoiForm } from "./TestEnvoiForm";

/** Diagnostic de la chaîne d'envoi d'emails.
 *
 * Une panne d'email est silencieuse par construction : l'action métier
 * aboutit, la requête répond 200, et seule une ligne de console garde trace
 * du refus. Cette page rend visible ce que le serveur voit réellement — et
 * elle vaut mieux que de fouiller les journaux à chaque incident. */
export default async function DiagnosticEmailPage() {
  await requireAdmin();

  const cle = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;
  const contactEmail = process.env.CONTACT_EMAIL;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <h1 className="text-2xl font-semibold text-liams-navy">
        Diagnostic des emails
      </h1>

      <section className="rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-liams-navy">
          Ce que le serveur voit
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Les valeurs telles qu&apos;elles sont lues à l&apos;exécution — pas
          telles qu&apos;elles sont écrites dans Vercel. Un écart entre les
          deux signifie qu&apos;il manque un redéploiement.
        </p>

        <dl className="mt-4 flex flex-col gap-3 text-sm">
          <Ligne
            terme="RESEND_API_KEY"
            valeur={
              cle
                ? `présente — ${cle.length} caractères, commence par « ${cle.slice(0, 3)} »`
                : "ABSENTE"
            }
            probleme={!cle}
          />
          <Ligne
            terme="EMAIL_FROM"
            valeur={
              emailFrom ??
              "ABSENTE — le code utilise « Liams <notifications@liams.app> », domaine non vérifié"
            }
            probleme={!emailFrom}
          />
          <Ligne
            terme="CONTACT_EMAIL"
            valeur={
              contactEmail ??
              "ABSENTE — le code utilise « contact@liams.app », boîte qui n'existe probablement pas"
            }
            probleme={!contactEmail}
          />
        </dl>
      </section>

      <section className="rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-liams-navy">Envoi de test</h2>
        <p className="mt-1 text-sm text-gray-500">
          Envoie un message et affiche la réponse brute de Resend, motif de
          refus compris. Utilisez une adresse que vous relevez réellement.
        </p>
        <div className="mt-4">
          <TestEnvoiForm adresseParDefaut={contactEmail ?? ""} />
        </div>
      </section>

      <NavigationBas href="/admin" label="Tableau de bord admin" />
    </div>
  );
}

function Ligne({
  terme,
  valeur,
  probleme,
}: {
  terme: string;
  valeur: string;
  probleme: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-gray-100 pb-3 last:border-0">
      <dt className="font-mono text-xs text-gray-500">{terme}</dt>
      <dd className={probleme ? "font-medium text-red-700" : "text-liams-navy"}>
        {valeur}
      </dd>
    </div>
  );
}
