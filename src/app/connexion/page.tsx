"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn } from "./actions";

export default function ConnexionPage() {
  const [state, formAction, pending] = useActionState(signIn, undefined);

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold text-liams-navy">Connexion</h1>

      <form action={formAction} className="mt-8 flex flex-col gap-4">
        <input
          name="email"
          type="email"
          required
          placeholder="Email"
          className="rounded-lg border border-gray-300 px-4 py-2"
        />
        <input
          name="password"
          type="password"
          required
          placeholder="Mot de passe"
          className="rounded-lg border border-gray-300 px-4 py-2"
        />

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-liams-navy px-6 py-3 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Connexion..." : "Se connecter"}
        </button>
      </form>

      <p className="mt-6 text-sm text-gray-600">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="underline">
          Créer un compte
        </Link>
      </p>
    </div>
  );
}
