import { BadgeIcone } from "@/components/BadgeIcone";
import { basculerBadge } from "./actions";

export type BadgeChoisissable = {
  code: string;
  label: string;
  description: string | null;
};

/** Liste de compétences à cocher.
 *
 * Deux usages : les faits sans enjeu, affichés dès qu'ils sont cochés, et les
 * spécialités, qui partent en demande et n'apparaissent aux parents qu'après
 * contrôle des justificatifs. Le statut est affiché sans détour — un
 * professionnel doit savoir que son badge n'est pas encore visible. */
export function BadgesForm({
  badges,
  statutParCode,
  sousValidation = false,
}: {
  badges: BadgeChoisissable[];
  statutParCode: Map<string, string>;
  sousValidation?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      {badges.map((badge) => {
        const statut = statutParCode.get(badge.code);
        const coche = statut !== undefined;
        const enAttente = statut === "en_attente";

        return (
          <form key={badge.code} action={basculerBadge}>
            <input type="hidden" name="badge_code" value={badge.code} />
            <input type="hidden" name="coche" value={String(!coche)} />
            <button
              type="submit"
              className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                coche
                  ? "border-liams-teal bg-liams-teal/5"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <span
                aria-hidden
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ${
                  coche
                    ? "border-liams-teal bg-liams-teal text-white"
                    : "border-gray-300"
                }`}
              >
                {coche ? "✓" : ""}
              </span>

              <BadgeIcone code={badge.code} label={badge.label} taille={28} />

              <span className="flex-1">
                {badge.description && (
                  <span className="block text-xs text-gray-500">
                    {badge.description}
                  </span>
                )}
              </span>

              {sousValidation && coche && (
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    enAttente
                      ? "bg-amber-100 text-amber-800"
                      : "bg-green-100 text-green-800"
                  }`}
                >
                  {enAttente ? "En attente de contrôle" : "Validé"}
                </span>
              )}
            </button>
          </form>
        );
      })}
    </div>
  );
}
