import Link from "next/link";
import type { ReactNode } from "react";

/** Icônes en traits, même facture que celles des badges : géométrie simple,
 * lisibles à petite taille, aucune dépendance. */
const T = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ICONES: Record<string, ReactNode> = {
  profil: (
    <>
      <circle {...T} cx="12" cy="8" r="4" />
      <path {...T} d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </>
  ),
  calendrier: (
    <>
      <rect {...T} x="3" y="5" width="18" height="16" rx="2" />
      <path {...T} d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  recherche: (
    <>
      <circle {...T} cx="11" cy="11" r="6" />
      <path {...T} d="m20 20-4.5-4.5" />
    </>
  ),
  fiches: (
    <>
      <path {...T} d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path {...T} d="M14 3v5h5M12 11v6M9 14h6" />
    </>
  ),
  messages: (
    <path {...T} d="M4 5h16v11H9l-5 4V5Z" />
  ),
  reseau: (
    <>
      <circle {...T} cx="6" cy="7" r="2.5" />
      <circle {...T} cx="18" cy="7" r="2.5" />
      <circle {...T} cx="12" cy="17" r="2.5" />
      <path {...T} d="M7.6 9.2 10.4 15M16.4 9.2 13.6 15M8.5 7h7" />
    </>
  ),
  vitrine: (
    <>
      <circle {...T} cx="12" cy="12" r="9" />
      <path {...T} d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" />
    </>
  ),
  verification: (
    <>
      <path {...T} d="M12 3 5 6v5c0 4.4 2.9 8.4 7 9.6 4.1-1.2 7-5.2 7-9.6V6l-7-3Z" />
      <path {...T} d="m9 12 2 2 4-4" />
    </>
  ),
  historique: (
    <>
      <circle {...T} cx="12" cy="12" r="8.5" />
      <path {...T} d="M12 7v5.5l3.5 2" />
    </>
  ),
  avis: (
    <path
      {...T}
      d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.7l5.4-.8L12 4Z"
    />
  ),
};

/** Tuile d'accès à une page.
 *
 * Une liste de phrases soulignées convient tant qu'il y a trois destinations ;
 * au-delà, l'œil ne distingue plus rien. Un rectangle, une icône, un titre
 * court : on repère la sienne sans lire. */
export function TuileNavigation({
  href,
  icone,
  titre,
  description,
  accent = false,
}: {
  href: string;
  icone: keyof typeof ICONES | string;
  titre: string;
  /** Une ligne, seulement quand le titre ne suffit pas à lever un doute. */
  description?: string;
  /** L'action principale de la page, mise en avant. */
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col gap-2 rounded-xl border p-5 text-left transition-colors ${
        accent
          ? "border-liams-orange bg-liams-orange/5 hover:border-liams-navy"
          : "border-gray-200 hover:border-liams-navy"
      }`}
    >
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-lg ${
          accent ? "bg-liams-orange text-white" : "bg-liams-navy/5 text-liams-navy"
        }`}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
          {ICONES[icone] ?? ICONES.profil}
        </svg>
      </span>
      <span className="font-medium text-liams-navy">{titre}</span>
      {description && (
        <span className="text-xs text-gray-500">{description}</span>
      )}
    </Link>
  );
}
