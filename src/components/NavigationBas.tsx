"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/** Navigation de sortie, placée en bas de page : on la trouve après avoir lu
 * ou rempli le contenu, au moment où l'on cherche à repartir — pas avant de
 * l'avoir consulté.
 *
 * Deux issues systématiques : revenir d'où l'on vient, et rejoindre le point
 * d'entrée (tableau de bord, ou accueil sur les pages publiques). */
export function NavigationBas({
  href = "/tableau-de-bord",
  label = "Tableau de bord",
}: {
  href?: string;
  label?: string;
}) {
  const router = useRouter();

  return (
    <nav className="mt-4 flex flex-wrap items-center gap-3 border-t border-gray-200 pt-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:border-liams-navy hover:text-liams-navy"
      >
        ← Page précédente
      </button>
      <Link
        href={href}
        className="rounded-full border border-liams-navy px-4 py-2 text-sm font-medium text-liams-navy hover:bg-liams-navy hover:text-white transition-colors"
      >
        {label}
      </Link>
    </nav>
  );
}
