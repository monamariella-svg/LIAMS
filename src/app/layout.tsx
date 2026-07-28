import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "./SiteHeader";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Liams — La garde d'enfants de confiance, y compris pour Les Xtras",
  description:
    "Liams met en relation parents et professionnels de la garde d'enfants, avec un accompagnement dédié aux familles d'enfants à besoins particuliers (Les Xtras).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        <div className="flex flex-1 flex-col">{children}</div>
        <footer className="flex flex-wrap items-center justify-center gap-6 bg-liams-navy px-6 py-8 text-sm text-white/80">
          <Image
            src="/logo/Rectangle_Blanc.png"
            alt="Liams"
            width={100}
            height={28}
            className="h-6 w-auto opacity-90"
          />
          <Link href="/cgu" className="hover:text-white">
            CGU
          </Link>
          <Link href="/confidentialite" className="hover:text-white">
            Confidentialité
          </Link>
          <Link href="/mentions-legales" className="hover:text-white">
            Mentions légales
          </Link>
          <Link href="/contact" className="hover:text-white">
            Contact / Signaler un problème
          </Link>
        </footer>
      </body>
    </html>
  );
}
