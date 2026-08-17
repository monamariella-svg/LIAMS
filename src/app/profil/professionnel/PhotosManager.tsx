"use client";

import Image from "next/image";
import { useActionState, useRef } from "react";
import { uploadPhoto, supprimerPhoto } from "./actions";
import { NB_PHOTOS_MAX } from "@/lib/prompts";

export function PhotosManager({
  photos,
  supabaseUrl,
}: {
  photos: {
    id: string;
    fichier_url: string;
    sujet?: string | null;
    legende?: string | null;
  }[];
  supabaseUrl: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(async (prevState: unknown, formData: FormData) => {
    const result = await uploadPhoto(prevState as never, formData);
    if (result?.success) formRef.current?.reset();
    return result;
  }, undefined);

  const publicUrl = (path: string) =>
    `${supabaseUrl}/storage/v1/object/public/professional-photos/${path}`;

  return (
    <section className="rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-liams-navy">
        Mes photos ({photos.length}/{NB_PHOTOS_MAX})
      </h2>
      <p className="mt-1 text-xs text-gray-500">
        Elles alternent avec vos réponses sur votre profil public. Dites ce que
        montre chacune : « où sera mon enfant » est une des premières questions
        d&apos;un parent, et c&apos;est une photo qui y répond le mieux.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        {photos.map((photo) => (
          <div key={photo.id} className="w-28">
            <div className="relative h-28 w-28 overflow-hidden rounded-lg">
              <Image
                src={publicUrl(photo.fichier_url)}
                alt=""
                fill
                className="object-cover"
                unoptimized
              />
              <form action={supprimerPhoto} className="absolute right-1 top-1">
                <input type="hidden" name="photo_id" value={photo.id} />
                <input type="hidden" name="fichier_url" value={photo.fichier_url} />
                <button
                  type="submit"
                  className="rounded-full bg-black/60 px-2 py-0.5 text-xs text-white hover:bg-black/80"
                >
                  ✕
                </button>
              </form>
            </div>
            <p className="mt-1 text-[11px] leading-tight text-gray-500">
              {photo.sujet === "lieu" ? "Lieu d'accueil" : "Portrait"}
              {photo.legende ? ` — ${photo.legende}` : ""}
            </p>
          </div>
        ))}
      </div>

      {photos.length < NB_PHOTOS_MAX && (
        <form ref={formRef} action={formAction} className="mt-4 flex flex-col gap-2">
          <input type="file" name="fichier" accept="image/*" required className="text-sm" />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1 text-sm">
              <input type="radio" name="sujet" value="portrait" defaultChecked />
              Moi
            </label>
            <label className="flex items-center gap-1 text-sm">
              <input type="radio" name="sujet" value="lieu" />
              Le lieu d&apos;accueil
            </label>
            <input
              name="legende"
              placeholder="Légende : « la salle des bébés », « le jardin »"
              className="min-w-56 flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="self-start rounded-full border border-liams-navy px-4 py-1.5 text-sm font-medium text-liams-navy hover:bg-liams-navy hover:text-white disabled:opacity-50"
          >
            {pending ? "Envoi..." : "Ajouter une photo"}
          </button>
        </form>
      )}
      {state?.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
    </section>
  );
}
