"use client";

import { useActionState, useRef } from "react";
import { envoyerMessage } from "../actions";

export function MessageForm({ matchId }: { matchId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(async (prevState: unknown, formData: FormData) => {
    const result = await envoyerMessage(prevState as never, formData);
    if (result?.success) formRef.current?.reset();
    return result;
  }, undefined);

  return (
    <form ref={formRef} action={formAction} className="flex gap-2 border-t border-gray-200 p-4">
      <input type="hidden" name="match_id" value={matchId} />
      <input
        name="contenu"
        placeholder="Écris ton message..."
        required
        className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-liams-orange px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "..." : "Envoyer"}
      </button>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
