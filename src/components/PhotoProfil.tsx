// Vignette de profil pour les listes de professionnels. La première photo
// (professional_photos, ordre croissant) sert d'avatar ; à défaut on affiche
// un aplat neutre plutôt qu'une image cassée, tous les pros n'ayant pas
// encore chargé de photo.

export function urlPhotoProfil(fichierUrl: string | null | undefined): string | null {
  if (!fichierUrl) return null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${supabaseUrl}/storage/v1/object/public/professional-photos/${fichierUrl}`;
}

export function PhotoProfil({
  fichierUrl,
  taille = 48,
}: {
  fichierUrl: string | null | undefined;
  taille?: number;
}) {
  const url = urlPhotoProfil(fichierUrl);

  if (!url) {
    return (
      <span
        aria-hidden
        style={{ width: taille, height: taille }}
        className="flex shrink-0 items-center justify-center rounded-full bg-liams-navy/10 text-liams-navy/40"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-1/2 w-1/2">
          <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5Z" />
        </svg>
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      width={taille}
      height={taille}
      style={{ width: taille, height: taille }}
      className="shrink-0 rounded-full object-cover"
    />
  );
}
