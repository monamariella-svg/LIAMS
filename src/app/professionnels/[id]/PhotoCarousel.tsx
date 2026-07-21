"use client";

import Image from "next/image";
import { useState } from "react";

export function PhotoCarousel({ urls }: { urls: string[] }) {
  const [index, setIndex] = useState(0);

  if (urls.length === 0) {
    return (
      <div className="flex h-72 w-full items-center justify-center rounded-2xl bg-liams-navy/5 text-sm text-gray-400">
        Pas encore de photo
      </div>
    );
  }

  return (
    <div className="relative h-96 w-full overflow-hidden rounded-2xl bg-black/5">
      <Image
        src={urls[index]}
        alt=""
        fill
        className="object-cover"
        unoptimized
        priority
      />
      {urls.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => setIndex((i) => (i - 1 + urls.length) % urls.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 px-3 py-1.5 text-lg hover:bg-white"
            aria-label="Photo précédente"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setIndex((i) => (i + 1) % urls.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 px-3 py-1.5 text-lg hover:bg-white"
            aria-label="Photo suivante"
          >
            ›
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {urls.map((url, i) => (
              <span
                key={url}
                className={`h-1.5 w-1.5 rounded-full ${i === index ? "bg-white" : "bg-white/50"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
