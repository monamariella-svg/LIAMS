"use client";

import { useActionState } from "react";
import { repondreFeedback } from "./actions";

export function FeedbackForm({ feedbackId }: { feedbackId: string }) {
  const [state, formAction, pending] = useActionState(repondreFeedback, undefined);

  if (state?.success) {
    return (
      <p className="rounded-xl bg-liams-teal/10 px-4 py-3 text-sm text-liams-teal">
        Merci pour votre retour !
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="feedback_id" value={feedbackId} />

      <div>
        <p className="text-sm font-medium text-liams-navy">
          Sur une échelle de 0 à 10, recommanderiez-vous Liams ?
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {Array.from({ length: 11 }, (_, n) => n).map((n) => (
            <label key={n} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-gray-300 text-xs has-[:checked]:bg-liams-orange has-[:checked]:text-white has-[:checked]:border-liams-orange">
              <input type="radio" name="score_nps" value={n} required className="sr-only" />
              {n}
            </label>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Le matching avec un professionnel a-t-il été facile ?
        <input name="facilite_matching" className="rounded-lg border border-gray-300 px-4 py-2" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Vous êtes-vous senti(e) en confiance sur la plateforme ?
        <input name="confiance_ressentie" className="rounded-lg border border-gray-300 px-4 py-2" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Quelle fonctionnalité vous a été la plus utile ?
        <input name="fonctionnalite_preferee" className="rounded-lg border border-gray-300 px-4 py-2" />
      </label>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-liams-orange px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Envoi..." : "Envoyer mon avis"}
      </button>
    </form>
  );
}
