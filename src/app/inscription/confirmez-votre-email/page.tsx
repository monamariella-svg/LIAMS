import Link from "next/link";

export default function ConfirmezVotreEmailPage() {
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col justify-center px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold text-liams-navy">
        Vérifie ta boîte mail
      </h1>
      <p className="mt-4 text-gray-600">
        Ton compte a bien été créé. Clique sur le lien de confirmation que nous
        venons de t&apos;envoyer par email pour activer ton compte.
      </p>
      <p className="mt-6 text-sm text-gray-500">
        Déjà cliqué sur le lien de confirmation ?
      </p>
      <Link
        href="/connexion"
        className="mt-2 self-center rounded-full bg-liams-orange px-6 py-2.5 text-sm font-medium text-white hover:opacity-90"
      >
        Se connecter
      </Link>
    </div>
  );
}
