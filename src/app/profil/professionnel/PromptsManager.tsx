"use client";

import { useActionState, useRef } from "react";
import { upsertPrompt, supprimerPrompt } from "./actions";
import { promptsSugeres, NB_PROMPTS_MAX } from "@/lib/prompts";

type Prompt = { id: string; question: string; reponse: string };

function PromptForm({
  prompt,
  estEtablissement,
}: {
  prompt?: Prompt;
  estEtablissement: boolean;
}) {
  const questions = promptsSugeres(estEtablissement);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(async (prevState: unknown, formData: FormData) => {
    const result = await upsertPrompt(prevState as never, formData);
    if (result?.success && !prompt) formRef.current?.reset();
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
        required
        defaultValue={prompt?.reponse ?? ""}
        placeholder="Votre réponse (courte)"
        rows={2}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
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
