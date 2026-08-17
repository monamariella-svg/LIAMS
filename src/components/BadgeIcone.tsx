// Badges de compétence affichés en pastille ronde colorée avec une icône.
//
// Trois familles, une couleur chacune : les spécialités Xtras en teal (la
// signature de Liams), les qualifications en navy, les atouts pratiques et le
// coup de cœur en orange. L'icône seule sert dans les listes compactes, où
// l'intitulé complet reste accessible via le title et l'aria-label.

import type { ReactNode } from "react";

type Famille = "xtra" | "qualification" | "pratique";

const FAMILLES: Record<Famille, string> = {
  xtra: "bg-liams-teal/12 text-liams-teal",
  qualification: "bg-liams-navy/10 text-liams-navy",
  pratique: "bg-liams-orange/12 text-liams-orange",
};

// Icônes en traits : géométrie simple, lisibles à petite taille.
const T = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ICONES: Record<string, ReactNode> = {
  // Étoile : l'accueil des Xtras, toutes spécialités confondues.
  accueil_xtras_ordinaires: (
    <polygon
      {...T}
      points="12 3 14.5 9 21 9.5 16 13.7 17.5 20 12 16.7 6.5 20 8 13.7 3 9.5 9.5 9"
    />
  ),
  // Deux anneaux entrelacés : symbole de la neurodiversité, préféré à la
  // pièce de puzzle que la communauté autiste rejette largement.
  specialiste_tsa: (
    <>
      <circle {...T} cx="8.5" cy="12" r="4.5" />
      <circle {...T} cx="15.5" cy="12" r="4.5" />
    </>
  ),
  specialiste_tdah: <polyline {...T} points="13 2 5 14 11 14 10 22 19 10 13 10 13 2" />,
  specialiste_dys: (
    <>
      <rect {...T} x="3.5" y="4" width="7.5" height="16" rx="1" />
      <rect {...T} x="13" y="4" width="7.5" height="16" rx="1" />
    </>
  ),
  specialiste_handicap_moteur: (
    <>
      <circle {...T} cx="10" cy="16.5" r="5.5" />
      <circle {...T} cx="9" cy="3.5" r="1.8" />
      <path {...T} d="M9 7v5h6l2.5 5.5" />
    </>
  ),
  vehicule: (
    <>
      <path {...T} d="M6 15v-4l2-4h8l2 4v4" />
      <path {...T} d="M4 15h16" />
      <circle {...T} cx="8" cy="17.5" r="1.4" />
      <circle {...T} cx="16" cy="17.5" r="1.4" />
    </>
  ),
  nounou_extra: (
    <>
      <path {...T} d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6Z" />
      <path {...T} d="m9 12 2 2 4-4" />
    </>
  ),
  diplome: (
    <>
      <path {...T} d="M12 4 2 9l10 5 10-5Z" />
      <path {...T} d="M6 11.5V17c0 1.6 3 3 6 3s6-1.4 6-3v-5.5" />
    </>
  ),
  super_experience: (
    <>
      <circle {...T} cx="12" cy="14.5" r="6" />
      <path {...T} d="m8.5 3 2 5M15.5 3l-2 5" />
    </>
  ),
  premiers_secours: <path {...T} d="M12 5v14M5 12h14" />,
  multilingue: (
    <>
      <circle {...T} cx="12" cy="12" r="9" />
      <path {...T} d="M3 12h18" />
      <path {...T} d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" />
    </>
  ),
  aide_devoirs: (
    <>
      <path {...T} d="M4 4h9l6 6v10H4Z" />
      <path {...T} d="M8 13h7M8 17h5" />
    </>
  ),
  non_fumeur: (
    <>
      <circle {...T} cx="12" cy="12" r="9" />
      <path {...T} d="m6 18 12-12" />
    </>
  ),
  coup_de_coeur: <path {...T} d="M12 20 4.6 12.6a4.6 4.6 0 0 1 7.4-5.2 4.6 4.6 0 0 1 7.4 5.2L12 20Z" />,
  // Un cadran plutôt qu'un point d'exclamation : ce badge dit qu'on peut
  // appeler dans l'urgence, pas qu'il y a un problème.
  accueil_urgence: (
    <>
      <circle {...T} cx="12" cy="12" r="8.5" />
      <path {...T} d="M12 7.5V12l3 2" />
    </>
  ),
  // Le fauteuil, dessiné de profil : la roue et l'assise suffisent à le
  // reconnaître à seize pixels.
  locaux_pmr: (
    <>
      <circle {...T} cx="11" cy="17" r="4.5" />
      <circle {...T} cx="12.5" cy="4.5" r="1.5" />
      <path {...T} d="M12.5 8v5h4l2.5 4" />
    </>
  ),
  espace_exterieur: (
    <>
      <path {...T} d="M12 21v-6" />
      <path {...T} d="M12 15c-3.5 0-6-2.2-6-5.5S8.5 4 12 4s6 2.2 6 5.5S15.5 15 12 15Z" />
    </>
  ),
  repas_fournis: (
    <>
      <path {...T} d="M7 3v8m0 0v10M5 3v5a2 2 0 0 0 4 0V3" />
      <path {...T} d="M17 21V3c-2 1-3 3-3 6s1 3 3 3" />
    </>
  ),
  hygiene_fournie: (
    <>
      <path {...T} d="M5 7h14l-1.5 5.5A6 6 0 0 1 12 17a6 6 0 0 1-5.5-4.5L5 7Z" />
      <path {...T} d="M5 7c2-1.5 5-1.5 7 0s5 1.5 7 0" />
    </>
  ),
  // Un soleil bas sur l'horizon : tôt le matin, tard le soir.
  horaires_elargis: (
    <>
      <path {...T} d="M3 18h18" />
      <path {...T} d="M7.5 18a4.5 4.5 0 0 1 9 0" />
      <path {...T} d="M12 6v2.5M6 8.5l1.8 1.8M18 8.5l-1.8 1.8" />
    </>
  ),
  accueil_nuit: (
    <path {...T} d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
  ),
  accueil_weekend: (
    <>
      <rect {...T} x="3.5" y="5" width="17" height="15" rx="2" />
      <path {...T} d="M3.5 10h17M8 3v4M16 3v4" />
      <path {...T} d="M15.5 14.5h2.5" />
    </>
  ),
  sante_sur_place: (
    <>
      <path {...T} d="M3.5 13h3l2-4 3 8 2.5-5 1.5 3h5" />
    </>
  ),
  partenariat_camsp: (
    <>
      <circle {...T} cx="8" cy="9" r="3" />
      <circle {...T} cx="16" cy="9" r="3" />
      <path {...T} d="M3 19a5 5 0 0 1 10 0M11 19a5 5 0 0 1 10 0" />
    </>
  ),
};

const FAMILLE_PAR_CODE: Record<string, Famille> = {
  accueil_xtras_ordinaires: "xtra",
  specialiste_tsa: "xtra",
  specialiste_tdah: "xtra",
  specialiste_dys: "xtra",
  specialiste_handicap_moteur: "xtra",
  nounou_extra: "qualification",
  diplome: "qualification",
  super_experience: "qualification",
  premiers_secours: "qualification",
  vehicule: "pratique",
  multilingue: "pratique",
  aide_devoirs: "pratique",
  non_fumeur: "pratique",
  coup_de_coeur: "pratique",
  accueil_urgence: "pratique",
  // Pour une famille dont l'enfant se déplace en fauteuil, l'accessibilité
  // n'est pas un confort : c'est ce qui décide si la porte s'ouvre. Elle est
  // rangée avec les Xtras, comme ce qui touche au suivi de l'enfant.
  locaux_pmr: "xtra",
  sante_sur_place: "xtra",
  partenariat_camsp: "xtra",
  espace_exterieur: "pratique",
  repas_fournis: "pratique",
  hygiene_fournie: "pratique",
  horaires_elargis: "pratique",
  accueil_nuit: "pratique",
  accueil_weekend: "pratique",
};

export function BadgeIcone({
  code,
  label,
  compact = false,
  taille = 32,
}: {
  code: string;
  label: string;
  /** Pastille seule, sans intitulé à côté (listes denses). */
  compact?: boolean;
  taille?: number;
}) {
  const couleurs = FAMILLES[FAMILLE_PAR_CODE[code] ?? "qualification"];
  const icone = ICONES[code] ?? <circle {...T} cx="12" cy="12" r="7" />;

  const pastille = (
    <span
      style={{ width: taille, height: taille }}
      className={`flex shrink-0 items-center justify-center rounded-full ${couleurs}`}
    >
      <svg viewBox="0 0 24 24" width={taille * 0.55} height={taille * 0.55} aria-hidden>
        {icone}
      </svg>
    </span>
  );

  if (compact) {
    return (
      <span title={label} aria-label={label} role="img" className="inline-flex">
        {pastille}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      {pastille}
      <span className="text-xs text-gray-700">{label}</span>
    </span>
  );
}
