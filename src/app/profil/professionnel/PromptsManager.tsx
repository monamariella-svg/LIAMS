"use client";

import { useActionState, useRef, useState } from "react";
import { EnregistreurVocal } from "./EnregistreurVocal";
import { upsertPrompt, supprimerPrompt } from "./actions";
import { promptsSugeres, NB_PROMPTS_MAX } from "@/lib/prompts";

const urlPubliqueVoix = (chemin: string) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/professional-voix/${chemin}`;

type Prompt = {
  id: string;
  question: string;
  reponse: string | null;
  audio_url?: string | null;
};

function PromptForm({
  prompt,
  estEtablissement,
}: {
  prompt?: Prompt;
  estEtablissement: boolean;
}) {
  const questions = promptsSugeres(estEtablissement);
  const formRef = useRef<HTMLFormElement>(null);
  // Le blob vit ici plutôt que dans un champ fichier : un enregistrement ne
  // se dépose pas dans un <input type=file>, et le glisser au FormData juste
  // avant l'envoi évite de téléverser un fichier que le formulaire pourrait
  // ne jamais valider.
  const [audio, setAudio] = useState<{ blob: Blob; duree: number } | null>(null);
  const [audioRetire, setAudioRetire] = useState(false);

  const [state, formAction, pending] = useActionState(async (prevState: unknown, formData: FormData) => {
    if (audio) {
      formData.set("audio", audio.blob, "reponse.webm");
      formData.set("audio_duree", String(audio.duree));
    }
    if (audioRetire) formData.set("audio_retirer", "1");
    const result = await upsertPrompt(prevState as never, formData);
    if (result?.success && !prompt) {
      formRef.current?.reset();
      setAudio(null);
    }
    return result;
  }, undefined);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2 rounded-lg border border-gray-200 p-4">
      {prompt && <input type="hidden" name="prompt_id" value={prompt.id} />}
      <select
        name="question"
        required
        defaultValue={prompt?.question ?? ""}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="" disabled>
          Choisissez une question...
        </option>
        {/* Une question déjà répondue peut venir de l'autre liste — un compte
            devenu établissement après coup garde ses anciennes cartes. Sans
            cette entrée, le select ne retrouverait pas sa valeur et
            afficherait « Choisissez une question ». */}
        {prompt && !questions.includes(prompt.question as never) && (
          <option value={prompt.question}>{prompt.question}</option>
        )}
        {questions.map((q) => (
          <option key={q} value={q}>
            {q}
          </option>
        ))}
      </select>
      <textarea
        name="reponse"
        defaultValue={prompt?.reponse ?? ""}
        placeholder="Votre réponse écrite (facultative si vous répondez en voix)"
        rows={2}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />

      <EnregistreurVocal
        audioExistant={prompt?.audio_url ? urlPubliqueVoix(prompt.audio_url) : null}
        onChange={(blob, duree) => {
          setAudio(blob ? { blob, duree } : null);
          // Effacer un enregistrement gardé, c'est en demander le retrait ;
          // sans cela la colonne resterait remplie en base.
          setAudioRetire(blob === null);
        }}
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-full bg-liams-orange px-4 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Enregistrement..." : prompt ? "Mettre à jour" : "Ajouter"}
        </button>
        {prompt && (
          <form action={supprimerPrompt}>
            <input type="hidden" name="prompt_id" value={prompt.id} />
            <button type="submit" className="text-xs text-red-600 hover:underline">
              Supprimer
            </button>
          </form>
        )}
      </div>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

export function PromptsManager({
  prompts,
  estEtablissement = false,
}: {
  prompts: Prompt[];
  /** Les questions se posent alors au nom d'une équipe, pas d'une personne. */
  estEtablissement?: boolean;
}) {
  return (
    <section className="rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-liams-navy">
        {estEtablissement ? "Nos prompts" : "Mes prompts"} ({prompts.length}/
        {NB_PROMPTS_MAX})
      </h2>
      <p className="mt-1 text-xs text-gray-500">
        Choisissez 3 à 5 questions et répondez-y brièvement — ça remplace la présentation textuelle classique.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        {prompts.map((prompt) => (
          <PromptForm
            key={prompt.id}
            prompt={prompt}
            estEtablissement={estEtablissement}
          />
        ))}
        {prompts.length < NB_PROMPTS_MAX && (
          <PromptForm estEtablissement={estEtablissement} />
        )}
      </div>
    </section>
  );
}
