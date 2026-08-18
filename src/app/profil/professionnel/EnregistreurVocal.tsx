"use client";

import { useEffect, useRef, useState } from "react";

/** Durée maximale annoncée au professionnel. La base tolère jusqu'à 90 s, pour
 *  qu'un décompte imprécis d'une seconde ne fasse pas échouer un enregistrement
 *  qu'on vient de faire. */
const DUREE_MAX_S = 30;

type Etat = "repos" | "enregistrement" | "relecture";

/** Enregistrement d'une réponse vocale.
 *
 * MediaRecorder plutôt qu'une bibliothèque : le navigateur sait le faire, et
 * une dépendance de plus pour trente secondes d'audio serait mal employée.
 *
 * Le fichier n'est pas envoyé d'ici. Il est déposé dans un champ caché du
 * formulaire parent, qui l'enverra avec la question et le texte : un
 * enregistrement qui partirait seul laisserait un fichier orphelin dans le
 * stockage si le formulaire n'était jamais validé.
 */
export function EnregistreurVocal({
  audioExistant,
  onChange,
}: {
  /** URL publique de l'enregistrement déjà déposé, s'il y en a un. */
  audioExistant: string | null;
  /** Remonte le blob et sa durée au formulaire. `null` efface. */
  onChange: (fichier: Blob | null, dureeSecondes: number) => void;
}) {
  const [etat, setEtat] = useState<Etat>("repos");
  const [secondes, setSecondes] = useState(0);
  const [apercu, setApercu] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const morceauxRef = useRef<Blob[]>([]);
  const minuterieRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Un flux micro laissé ouvert garde la pastille d'enregistrement allumée
  // dans l'onglet, ce qui inquiète à juste titre.
  const arreterFlux = () => {
    recorderRef.current?.stream.getTracks().forEach((piste) => piste.stop());
    if (minuterieRef.current) clearInterval(minuterieRef.current);
  };

  useEffect(() => arreterFlux, []);

  const demarrer = async () => {
    setErreur(null);
    try {
      const flux = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(flux);
      morceauxRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) morceauxRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(morceauxRef.current, { type: recorder.mimeType });
        setApercu(URL.createObjectURL(blob));
        setEtat("relecture");
        arreterFlux();
      };

      recorder.start();
      recorderRef.current = recorder;
      setEtat("enregistrement");
      setSecondes(0);

      minuterieRef.current = setInterval(() => {
        setSecondes((s) => {
          // On coupe soi-même à la limite : compter sur le professionnel pour
          // s'arrêter produirait des fichiers que la base refuserait.
          if (s + 1 >= DUREE_MAX_S) {
            if (recorder.state === "recording") recorder.stop();
            return DUREE_MAX_S;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      setErreur(
        "Micro inaccessible. Autorisez l'accès au microphone dans votre navigateur, puis réessayez.",
      );
    }
  };

  const arreter = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const valider = () => {
    const blob = new Blob(morceauxRef.current, {
      type: recorderRef.current?.mimeType || "audio/webm",
    });
    onChange(blob, Math.max(1, secondes));
  };

  const effacer = () => {
    morceauxRef.current = [];
    setApercu(null);
    setSecondes(0);
    setEtat("repos");
    onChange(null, 0);
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-liams-navy/5 p-3">
      <p className="text-xs font-medium text-liams-navy">Répondre en voix</p>

      {audioExistant && etat === "repos" && (
        <div className="flex flex-col gap-1">
          <audio controls src={audioExistant} className="w-full" />
          <span className="text-[11px] text-gray-500">
            Enregistrez de nouveau pour le remplacer.
          </span>
        </div>
      )}

      {etat === "repos" && (
        <button
          type="button"
          onClick={demarrer}
          className="self-start rounded-full border border-liams-navy px-4 py-1.5 text-xs font-medium text-liams-navy hover:bg-liams-navy hover:text-white"
        >
          {audioExistant ? "Réenregistrer" : "Enregistrer ma réponse"}
        </button>
      )}

      {etat === "enregistrement" && (
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-red-600">
            <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" />
            {secondes}s / {DUREE_MAX_S}s
          </span>
          <button
            type="button"
            onClick={arreter}
            className="rounded-full bg-liams-navy px-4 py-1.5 text-xs font-medium text-white"
          >
            Arrêter
          </button>
        </div>
      )}

      {etat === "relecture" && apercu && (
        <div className="flex flex-col gap-2">
          <audio controls src={apercu} className="w-full" />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={valider}
              className="rounded-full bg-liams-teal px-4 py-1.5 text-xs font-medium text-white"
            >
              Garder cet enregistrement
            </button>
            <button
              type="button"
              onClick={effacer}
              className="text-xs text-gray-500 underline"
            >
              Recommencer
            </button>
          </div>
          <span className="text-[11px] text-gray-500">
            Il ne partira qu&apos;en enregistrant la carte.
          </span>
        </div>
      )}

      {erreur && <p className="text-xs text-red-600">{erreur}</p>}
    </div>
  );
}
