"use client";

import { useActionState } from "react";
import { envoyerContact } from "./actions";

export function ContactForm({
  nomInitial,
  emailInitial,
}: {
  nomInitial?: string;
  emailInitial?: string;
}) {
  const [state, formAction, pending] = useActionState(envoyerContact, undefined);

  if (state?.success) {
    return (
      <p className="rounded-xl bg-liams-teal/10 px-4 py-3 text-sm text-liams-teal">
        Message envoyé — merci, nous te répondrons rapidement.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input
        name="nom"
        required
        defaultValue={nomInitial}
        placeholder="Ton nom"
        className="rounded-lg border border-gray-300 px-4 py-2"
      />
      <input
        name="email"
        type="email"
        required
        defaultValue={emailInitial}
        placeholder="Ton email"
        className="rounded-lg border border-gray-300 px-4 py-2"
      />
      <textarea
        name="message"
        required
        rows={5}
        placeholder="Décris ton problème ou ta suggestion"
        className="rounded-lg border border-gray-300 px-4 py-2"
      />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-liams-orange px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Envoi..." : "Envoyer"}
      </button>
    </form>
  );
}
