"use client";

import { Suspense, useActionState, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signUp } from "./actions";

const PROFILS = [
  { value: "parent", label: "Je suis parent" },
  { value: "professionnel", label: "Je suis professionnel" },
  { value: "etablissement", label: "Je représente un établissement" },
];

function InscriptionForm() {
  const searchParams = useSearchParams();
  const roleDemande = searchParams.get("role");
  const defaultRole = PROFILS.some((p) => p.value === roleDemande)
    ? (roleDemande as string)
    : "parent";
  const [profil, setProfil] = useState(defaultRole);
  const [state, formAction, pending] = useActionState(signUp, undefined);

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold text-liams-navy">Créer un compte</h1>

      <form action={formAction} className="mt-8 flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          {PROFILS.map((p) => (
            <label key={p.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="role"
                value={p.value}
                checked={profil === p.value}
                onChange={() => setProfil(p.value)}
              />
              {p.label}
            </label>
          ))}
        </fieldset>

        {/* Une crèche n'a pas de prénom. Lui présenter deux champs à remplir
            l'obligerait à inventer une personne, qui s'afficherait ensuite aux
            familles à la place du nom de la structure. */}
        {profil === "etablissement" ? (
          <div className="flex flex-col gap-1">
            <input
              name="nom_etablissement"
              required
              placeholder="Nom de l'établissement"
              className="w-full rounded-lg border border-gray-300 px-4 py-2"
            />
            <span className="text-xs text-gray-500">
              La raison sociale, telle qu&apos;elle doit apparaître aux familles.
              Vous compléterez SIRET, agrément et représentant légal ensuite.
            </span>
          </div>
        ) : (
          <div className="flex gap-3">
            <input
              name="prenom"
              required
              placeholder="Prénom"
              className="w-full rounded-lg border border-gray-300 px-4 py-2"
            />
            <input
              name="nom"
              required
              placeholder="Nom"
              className="w-full rounded-lg border border-gray-300 px-4 py-2"
            />
          </div>
        )}

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
