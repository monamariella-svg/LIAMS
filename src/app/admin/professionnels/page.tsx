import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { NavigationBas } from "@/components/NavigationBas";

const STATUT_LABELS: Record<string, { label: string; className: string }> = {
  en_attente: { label: "En attente", className: "bg-amber-100 text-amber-800" },
  valide: { label: "Validé", className: "bg-green-100 text-green-800" },
  refuse: { label: "Refusé", className: "bg-red-100 text-red-800" },
};

export default async function AdminProfessionnelsPage() {
  const { supabase } = await requireAdmin();

  const { data: profils } = await supabase
    .from("professional_profiles")
    .select("*, users(email)")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-liams-navy">Professionnels</h1>

      <div className="flex flex-col gap-2">
        {(profils ?? []).map((profil) => {
          const statut = STATUT_LABELS[profil.statut_verification_casier] ?? STATUT_LABELS.en_attente;
          return (
            <Link
              key={profil.user_id}
              href={`/admin/professionnels/${profil.user_id}`}
              className="flex items-center justify-between rounded-xl border border-gray-200 p-4 hover:border-liams-orange"
            >
              <span className="text-sm">
                {(profil.users as unknown as { email: string } | null)?.email ?? profil.user_id}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${statut.className}`}>{statut.label}</span>
            </Link>
          );
        })}
      </div>

      <NavigationBas href="/admin" label="Tableau de bord admin" />
    </div>
  );
}
