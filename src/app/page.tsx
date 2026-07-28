import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col flex-1">
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center sm:px-12">
        <h1 className="max-w-2xl text-3xl font-semibold leading-tight text-liams-navy sm:text-5xl">
          La garde d&apos;enfants de confiance,{" "}
          <span className="text-liams-orange">même pour Les Xtras</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-gray-600">
          Liams met en relation les parents avec des professionnels vérifiés,
          spécialement formés pour accompagner les enfants à besoins
          particuliers — Les Xtras.
        </p>
        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Link
            href="/inscription?role=parent"
            className="rounded-full bg-liams-navy px-8 py-3 text-white font-medium hover:opacity-90 transition-opacity"
          >
            Je suis parent
          </Link>
          <Link
            href="/inscription?role=professionnel"
            className="rounded-full border border-liams-teal px-8 py-3 text-liams-teal font-medium hover:bg-liams-teal hover:text-white transition-colors"
          >
            Je suis professionnel
          </Link>
        </div>
      </main>
    </div>
  );
}
