import Image from "next/image";
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="flex items-center justify-between px-6 py-4 sm:px-12">
      <Link href="/">
        <Image
          src="/logo/Rectangle_Couleur.png"
          alt="Liams"
          width={180}
          height={52}
          priority
          className="h-10 w-auto sm:h-14"
        />
      </Link>
      <nav className="flex items-center gap-4 text-sm font-medium text-liams-navy">
        <Link href="/comment-ca-marche" className="hidden sm:inline hover:text-liams-orange">
          Comment ça marche
        </Link>
        <Link
          href="/connexion"
          className="rounded-full border border-liams-navy px-4 py-2 hover:bg-liams-navy hover:text-white transition-colors"
        >
          Connexion
        </Link>
        <Link
          href="/inscription"
          className="rounded-full bg-liams-orange px-4 py-2 text-white hover:opacity-90 transition-opacity"
        >
          Inscription
        </Link>
      </nav>
    </header>
  );
}
