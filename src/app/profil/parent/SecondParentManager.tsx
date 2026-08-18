"use client";

import { useActionState } from "react";
import {
  attacherSecondParent,
  detacherSecondParent,
  reglerGardeAlternee,
  reglerPartagePlanning,
  repondreRattachement,
} from "./actions";

export type SecondParent = {
  /** Le nom de l'autre parent. Nul tant qu'on ne peut pas le lire : celui qui
   *  invite ne connaît pas le nom de qui il invite avant d'avoir sa réponse. */
  nom: string | null;
  /** Suis-je le compte principal du foyer, celui qui a envoyé l'invitation. */
  jeSuisPrincipal: boolean;
  /** Où en est le rattachement. Il n'y a pas d'état « refusé » : refuser
   *  efface le lien, sans quoi une invitation morte tiendrait le compte visé
   *  prisonnier — voir la 0047. */
  statut: "en_attente" | "accepte";
  /** Est-ce que je montre mes gardes à l'autre. */
  jePartage: boolean;
  /** Est-ce que l'autre me montre les siennes. */
  autrePartage: boolean;
  /** Qui a l'enfant les semaines paires : moi, l'autre, ou personne. */
  gardePaires: "moi" | "autre" | null;
};

function PartageForm({ jePartage }: { jePartage: boolean }) {
  const [state, formAction, pending] = useActionState(reglerPartagePlanning, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="partage" value={jePartage ? "0" : "1"} />
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-gray-600">
          {jePartage
            ? "L'autre parent voit les gardes que vous organisez."
            : "Les gardes que vous organisez ne sont visibles que de vous."}
        </span>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full border border-liams-navy px-4 py-1.5 text-xs font-medium text-liams-navy hover:bg-liams-navy hover:text-white disabled:opacity-50"
        >
          {pending ? "..." : jePartage ? "Ne plus montrer" : "Montrer mes gardes"}
        </button>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}

function AlternanceForm({ gardePaires }: { gardePaires: "moi" | "autre" | null }) {
  const [state, formAction, pending] = useActionState(reglerGardeAlternee, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-2 border-t border-gray-100 pt-4">
      <label className="flex flex-col gap-1 text-sm">
        Qui a l&apos;enfant les semaines paires
        <select
          name="garde_semaines_paires"
          defaultValue={gardePaires ?? ""}
          className="rounded-lg border border-gray-300 px-4 py-2"
        >
          <option value="">La garde n&apos;alterne pas une semaine sur deux</option>
          <option value="moi">Moi les semaines paires</option>
          <option value="autre">L&apos;autre parent les semaines paires</option>
        </select>
      </label>
      <p className="text-xs text-gray-500">
        Le calendrier s&apos;en sert pour rappeler de qui est la semaine. Il
        n&apos;interdit rien : un rendez-vous médical ne demande pas la
        permission d&apos;un calendrier.
      </p>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-700">{state.message}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-liams-teal px-6 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Enregistrement..." : "Enregistrer"}
      </button>
    </form>
  );
}

/** Le retrait ne demande pas de confirmation en fenêtre : il est réversible en
 *  dix secondes, et ce que l'autre parent a organisé pendant le rattachement
 *  lui reste — on coupe un accès, on ne réécrit pas le passé. */
function RetirerButton({ libelle }: { libelle: string }) {
  const [state, formAction, pending] = useActionState(detacherSecondParent, undefined);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-red-600 underline hover:opacity-80 disabled:opacity-50"
      >
        {pending ? "..." : libelle}
      </button>
      {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}

/** Se retirer soi-même, quand on est le second parent.
 *
 * Le principal ne peut pas être seul à défaire le lien : une séparation qui
 * tourne mal est précisément le moment où l'on veut sortir sans demander la
 * permission de l'autre. Le geste est le même que refuser — la ligne
 * disparaît, et ce qui a été organisé pendant le rattachement reste. */
function SeRetirerButton() {
  const [state, formAction, pending] = useActionState(repondreRattachement, undefined);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="reponse" value="refuser" />
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-red-600 underline hover:opacity-80 disabled:opacity-50"
      >
        {pending ? "..." : "Me retirer"}
      </button>
      {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}

/** L'invitation, vue de celui qui la reçoit.
 *
 * Elle dit ce qu'accepter ouvre avant de le demander : on ne consent pas à ce
 * qu'on n'a pas lu. Et elle nomme qui invite — répondre à un inconnu n'est pas
 * répondre. */
function ReponseInvitation({ nom }: { nom: string | null }) {
  const [state, formAction, pending] = useActionState(repondreRattachement, undefined);

  return (
    <div className="mt-4 flex flex-col gap-4 rounded-lg border border-liams-orange bg-liams-orange/5 p-4">
      <p className="text-sm text-liams-navy">
        <span className="font-medium">{nom ?? "Un autre parent"}</span> vous
        propose de vous rattacher au dossier de votre enfant.
      </p>
      <p className="text-sm text-gray-600">
        En acceptant, vous obtenez votre propre accès à l&apos;enfant, à sa
        fiche santé et à ses besoins particuliers — avec votre mot de passe, pas
        celui de quelqu&apos;un d&apos;autre. Les gardes que chacun organise ne
        se montrent que si vous le décidez, chacun de votre côté. Tant que vous
        n&apos;avez pas répondu, rien n&apos;est ouvert.
      </p>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <form action={formAction}>
          <input type="hidden" name="reponse" value="accepter" />
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-liams-teal px-6 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "..." : "Accepter"}
          </button>
        </form>
        <form action={formAction}>
          <input type="hidden" name="reponse" value="refuser" />
          <button
            type="submit"
            disabled={pending}
            className="text-sm text-gray-600 underline hover:opacity-80 disabled:opacity-50"
          >
            Refuser
          </button>
        </form>
      </div>
    </div>
  );
}

/** Le rattachement accepté : ce qui se règle une fois qu'on est deux. */
function FoyerPartage({ second }: { second: SecondParent }) {
  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <span className="flex flex-col">
          <span className="text-sm font-medium text-liams-navy">
            {second.nom ?? "Nom non renseigné"}
          </span>
          <span className="text-xs text-gray-500">
            {second.jeSuisPrincipal ? "Second parent rattaché" : "Compte principal du foyer"}
          </span>
        </span>
        {second.jeSuisPrincipal ? (
          <RetirerButton libelle="Retirer" />
        ) : (
          <SeRetirerButton />
        )}
      </div>

      <p className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
        Vous voyez tous les deux l&apos;enfant, sa fiche santé et ses besoins
        particuliers, sans condition : c&apos;est ce qu&apos;il faut connaître
        pour s&apos;en occuper, et le cacher mettrait l&apos;enfant en jeu dans
        un désaccord d&apos;adultes. Les gardes, elles, ne se montrent que si
        vous le décidez — chacun pour soi.
      </p>

      <PartageForm jePartage={second.jePartage} />

      <p className="text-sm text-gray-600">
        {second.autrePartage
          ? "L'autre parent vous montre les gardes qu'il organise."
          : "L'autre parent ne montre pas les gardes qu'il organise."}
      </p>

      {second.jeSuisPrincipal ? (
        <AlternanceForm gardePaires={second.gardePaires} />
      ) : (
        <p className="border-t border-gray-100 pt-4 text-sm text-gray-500">
          L&apos;alternance des semaines se règle depuis le compte principal.
          Vous pouvez en revanche vous retirer vous-même à tout moment, sans
          avoir à le demander.
        </p>
      )}
    </div>
  );
}

export function SecondParentManager({ second }: { second: SecondParent | null }) {
  const [state, formAction, pending] = useActionState(attacherSecondParent, undefined);

  // Attendre une réponse et avoir à en donner une ne se ressemblent pas : trois
  // écrans plutôt qu'un seul qui dirait les trois.
  const invitationRecue = second !== null && !second.jeSuisPrincipal && second.statut === "en_attente";
  const enAttenteDeReponse =
    second !== null && second.jeSuisPrincipal && second.statut === "en_attente";

  return (
    <section className="rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-liams-navy">L&apos;autre parent</h2>
      <p className="mt-1 text-sm text-gray-500">
        Un enfant a deux parents, et il arrive qu&apos;ils n&apos;habitent plus
        ensemble. Rattacher le second lui donne son propre accès au dossier de
        l&apos;enfant, avec son mot de passe — plutôt qu&apos;un identifiant
        qu&apos;on se transmet, ce que l&apos;application demande précisément de
        ne pas faire.
      </p>

      {invitationRecue && <ReponseInvitation nom={second.nom} />}

      {second?.statut === "accepte" && <FoyerPartage second={second} />}

      {enAttenteDeReponse && (
        <div className="mt-4 flex flex-col gap-3 rounded-lg bg-gray-50 px-4 py-3">
          <p className="text-sm text-gray-600">
            Invitation envoyée. Le rattachement prendra effet quand
            l&apos;autre parent l&apos;aura acceptée — d&apos;ici là, rien
            n&apos;est ouvert et son nom ne s&apos;affiche pas ici.
          </p>
          <RetirerButton libelle="Retirer l'invitation" />
        </div>
      )}

      {second === null && (
        <form action={formAction} className="mt-6 flex flex-col gap-3 border-t border-gray-200 pt-6">
          <p className="text-xs text-gray-500">
            L&apos;autre parent s&apos;inscrit d&apos;abord lui-même sur Liams,
            du côté famille. Vous l&apos;invitez ensuite avec l&apos;adresse
            email de son compte, et c&apos;est lui qui accepte — le dossier
            d&apos;un enfant ne s&apos;ouvre pas à quelqu&apos;un qui
            l&apos;apprendrait en se connectant. Un seul second parent : au-delà,
            ce n&apos;est plus la même question et elle ne se règle pas par un
            compte de plus.
          </p>
          <label className="flex flex-col gap-1 text-sm sm:max-w-sm">
            Adresse email de son compte
            <input
              type="email"
              name="email"
              required
              className="rounded-lg border border-gray-300 px-4 py-2"
            />
          </label>

          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
          {state?.success && <p className="text-sm text-green-700">{state.message}</p>}

          <button
            type="submit"
            disabled={pending}
            className="self-start rounded-full bg-liams-teal px-6 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Envoi..." : "Envoyer l'invitation"}
          </button>
        </form>
      )}
    </section>
  );
}
