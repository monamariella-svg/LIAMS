"use client";

import { useActionState, useRef } from "react";
import { upsertPrompt, supprimerPrompt } from "./actions";
import { PROMPTS_SUGGERES, NB_PROMPTS_MAX } from "@/lib/prompts";

type Prompt = { id: string; question: string; reponse: string };

function PromptForm({ prompt }: { prompt?: Prompt }) {
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
          Choisis une question...
        </option>
        {PROMPTS_SUGGERES.map((q) => (
          <option key={q} value={q}>
            {q}
          </option>
        ))}
      </select>
      <textarea
        name="reponse"
        required
        defaultValue={prompt?.reponse ?? ""}
        placeholder="Ta réponse (courte)"
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

export function PromptsManager({ prompts }: { prompts: Prompt[] }) {
  return (
    <section className="rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-liams-navy">
        Mes prompts ({prompts.length}/{NB_PROMPTS_MAX})
      </h2>
      <p className="mt-1 text-xs text-gray-500">
        Choisis 3 à 5 questions et réponds-y brièvement — ça remplace la présentation textuelle classique.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        {prompts.map((prompt) => (
          <PromptForm key={prompt.id} prompt={prompt} />
        ))}
        {prompts.length < NB_PROMPTS_MAX && <PromptForm />}
      </div>
    </section>
  );
}
