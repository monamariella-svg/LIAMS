import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function CommentCaMarchePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: string | null = null;
  if (user) {
    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
    role = profile?.role ?? null;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12">
      {role === "parent" && <PourParents />}
      {role === "professionnel" && <PourProfessionnels />}
      {!role && <PourTous />}
    </div>
  );
}

function PourTous() {
  return (
    <>
      <h1 className="text-2xl font-semibold text-liams-navy">Comment ça marche ?</h1>
      <p className="text-gray-600">
        Liams met en relation les parents avec des professionnels de la garde
        d&apos;enfants vérifiés, avec un accompagnement dédié aux familles
        d&apos;enfants à besoins particuliers — Les Xtras.
      </p>
      <ol className="flex flex-col gap-4">
        <Etape numero={1} titre="Créer un compte">
          Parent ou professionnel, inscris-toi en quelques minutes.
        </Etape>
        <Etape numero={2} titre="Trouver le bon match">
          Recherche par disponibilité, proximité, et critères qualitatifs
          (dont les spécialisations Xtras).
        </Etape>
        <Etape numero={3} titre="Se faire confiance">
          Casier vérifié, badges, avis — construisez une relation de confiance
          durable.
        </Etape>
      </ol>
      <div className="flex gap-4">
        <Link href="/inscription?role=parent" className="rounded-full bg-liams-navy px-6 py-3 text-sm font-medium text-white hover:opacity-90">
          Je suis parent
        </Link>
        <Link href="/inscription?role=professionnel" className="rounded-full border border-liams-teal px-6 py-3 text-sm font-medium text-liams-teal hover:bg-liams-teal hover:text-white">
          Je suis professionnel
        </Link>
      </div>
    </>
  );
}

function PourParents() {
  return (
    <>
      <h1 className="text-2xl font-semibold text-liams-navy">Pour les parents</h1>
      <ol className="flex flex-col gap-4">
        <Etape numero={1} titre="Trouve rapidement un professionnel vérifié">
          Casier judiciaire vérifié, badges de compétences, avis d&apos;autres
          parents.
        </Etape>
        <Etape numero={2} titre="Construis ton réseau personnel">
          Ajoute tes professionnels de confiance et visualise leur planning en
          temps réel.
        </Etape>
        <Etape numero={3} titre="Garde d'urgence en un clic">
          Réserve directement un créneau libre chez un professionnel de ton
          réseau.
        </Etape>
        <Etape numero={4} titre="Un accompagnement pensé pour Les Xtras">
          Filtre par spécialisation (TSA, TDAH, DYS, handicap moteur) et
          partage un profil enrichi pour ton enfant.
        </Etape>
      </ol>
      <Link href="/recherche" className="self-start rounded-full bg-liams-orange px-6 py-3 text-sm font-medium text-white hover:opacity-90">
        Trouver un professionnel
      </Link>
    </>
  );
}

function PourProfessionnels() {
  return (
    <>
      <h1 className="text-2xl font-semibold text-liams-navy">Pour les professionnels</h1>
      <ol className="flex flex-col gap-4">
        <Etape numero={1} titre="Développe ton activité">
          Reçois des demandes ciblées de familles proches de chez toi.
        </Etape>
        <Etape numero={2} titre="Valorise ton profil">
          Photos, prompts, badges et avis mettent en avant ton expérience —
          notamment auprès des Xtras.
        </Etape>
        <Etape numero={3} titre="Gère ton planning simplement">
          Déclare tes disponibilités, tes créneaux de garde d&apos;urgence, et
          valide les réservations récurrentes.
        </Etape>
      </ol>
      <Link href="/profil/professionnel" className="self-start rounded-full bg-liams-orange px-6 py-3 text-sm font-medium text-white hover:opacity-90">
        Compléter mon profil
      </Link>
    </>
  );
}

function Etape({ numero, titre, children }: { numero: number; titre: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-liams-navy text-sm font-semibold text-white">
        {numero}
      </span>
      <div>
        <p className="font-medium text-liams-navy">{titre}</p>
        <p className="text-sm text-gray-600">{children}</p>
      </div>
    </li>
  );
}
