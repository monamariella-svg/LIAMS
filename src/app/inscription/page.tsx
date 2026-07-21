"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signUp } from "./actions";

function InscriptionForm() {
  const searchParams = useSearchParams();
  const defaultRole =
    searchParams.get("role") === "professionnel" ? "professionnel" : "parent";
  const [state, formAction, pending] = useActionState(signUp, undefined);

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold text-liams-navy">Créer un compte</h1>

      <form action={formAction} className="mt-8 flex flex-col gap-4">
        <fieldset className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="role"
              value="parent"
              defaultChecked={defaultRole === "parent"}
            />
            Je suis parent
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="role"
              value="professionnel"
              defaultChecked={defaultRole === "professionnel"}
            />
            Je suis professionnel
          </label>
        </fieldset>

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
          minLength={8}
          placeholder="Mot de passe (8 caractères min.)"
          className="rounded-lg border border-gray-300 px-4 py-2"
        />

        <label className="flex items-start gap-2 text-sm text-gray-600">
          <input type="checkbox" name="cgu" required className="mt-1" />
          <span>
            J&apos;accepte les{" "}
            <Link href="/cgu" target="_blank" className="underline">
              Conditions Générales d&apos;Utilisation
            </Link>{" "}
            et la{" "}
            <Link href="/confidentialite" target="_blank" className="underline">
              politique de confidentialité
            </Link>
            .
          </span>
        </label>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-liams-orange px-6 py-3 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Création..." : "Créer mon compte"}
        </button>
      </form>

      <p className="mt-6 text-sm text-gray-600">
        Déjà un compte ?{" "}
        <Link href="/connexion" className="underline">
          Se connecter
        </Link>
      </p>
    </div>
  );
}

export default function InscriptionPage() {
  return (
    <Suspense>
      <InscriptionForm />
    </Suspense>
  );
}
