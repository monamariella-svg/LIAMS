export function BarreProgression({
  pourcentage,
  manquants,
}: {
  pourcentage: number;
  manquants: string[];
}) {
  const complet = pourcentage >= 100;

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-liams-navy">
          Profil complété à {pourcentage}%
        </span>
        {complet && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
            Dossier complet
          </span>
        )}
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all ${
            complet ? "bg-green-600" : "bg-liams-orange"
          }`}
          style={{ width: `${pourcentage}%` }}
        />
      </div>
      {manquants.length > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          Il manque : {manquants.join(", ")}.
        </p>
      )}
    </div>
  );
}
