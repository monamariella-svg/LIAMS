"use client";

import { useActionState } from "react";
import { envoyerTest } from "./actions";

export function TestEnvoiForm({ adresseParDefaut }: { adresseParDefaut: string }) {
  const [state, formAction, pending] = useActionState(envoyerTest, undefined);

  const succes = state?.statut !== undefined && state.statut >= 200 && state.statut < 300;

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-3 sm:flex-row">
        <input
          name="destinataire"
          type="email"
          required
          defaultValue={adresseParDefaut}
          placeholder="Adresse de destination"
          className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-full bg-liams-orange px-6 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Envoi..." : "Envoyer un test"}
        </button>
      </form>

      {state?.erreur && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.erreur}
        </p>
      )}

      {state?.statut !== undefined && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            succes ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"
          }`}
        >
          <p className="font-medium">
            {succes
              ? `Resend a accepté l'envoi (${state.statut}).`
              : `Resend a refusé l'envoi (${state.statut}).`}
          </p>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all text-xs">
            {state.reponse}
          </pre>
          {!succes && (
            <p className="mt-2 text-xs">
              Le motif ci-dessus vient de Resend, mot pour mot.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
