import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { NavigationBas } from "@/components/NavigationBas";
import { ParentProfileForm } from "./ParentProfileForm";
import { AjouterEnfantForm } from "./AjouterEnfantForm";
import { FicheSanteForm } from "./FicheSanteForm";
import { ProfilXtraForm } from "./ProfilXtraForm";
import { SupprimerEnfantButton } from "./SupprimerEnfantButton";

export default async function ProfilParentPage() {
  const { supabase, user } = await requireUser("parent");

  const [{ data: parentProfile }, { data: enfants }] = await Promise.all([
    supabase.from("parent_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("enfants")
      .select("*, enfant_fiche_sante(*), enfant_profil_xtra(*)")
      .eq("parent_id", user.id)
      .order("created_at"),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <h1 className="text-2xl font-semibold text-liams-navy">Mon profil parent</h1>

      <ParentProfileForm adresse={parentProfile?.adresse ?? ""} />

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-liams-navy">Mes enfants</h2>

        {(enfants ?? []).map((enfant) => (
          <div key={enfant.id} className="flex flex-col gap-6 rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">
                {enfant.prenom}
                {!enfant.enfant_fiche_sante && (
                  <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                    Fiche santé manquante
                  </span>
                )}
              </h3>
              <SupprimerEnfantButton enfantId={enfant.id} />
            </div>

            <FicheSanteForm enfantId={enfant.id} fiche={enfant.enfant_fiche_sante} />
            <ProfilXtraForm enfantId={enfant.id} profil={enfant.enfant_profil_xtra} />
          </div>
        ))}

        <AjouterEnfantForm />
      </section>

      <section className="rounded-xl bg-liams-teal/5 p-6 text-center">
        <p className="text-sm text-liams-navy">
          Votre profil est prêt ? Déclarez vos besoins de garde dans votre
          calendrier : les professionnels disponibles vous seront proposés
          automatiquement.
        </p>
        <Link
          href="/planning"
          className="mt-4 inline-block rounded-full bg-liams-orange px-6 py-3 text-sm font-medium text-white hover:opacity-90"
        >
          Commencer votre recherche
        </Link>
      </section>

      <NavigationBas />
    </div>
  );
}
