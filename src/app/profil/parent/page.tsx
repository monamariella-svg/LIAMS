import Link from "next/link";
import { foyerParent, requireUser } from "@/lib/auth";
import { computeParentProgress } from "@/lib/progress";
import { NavigationBas } from "@/components/NavigationBas";
import { BarreProgression } from "@/components/BarreProgression";
import { IdentiteForm } from "@/components/identite/IdentiteForm";
import { ParentProfileForm } from "./ParentProfileForm";
import { AjouterEnfantForm } from "./AjouterEnfantForm";
import { ModifierEnfantForm, type EnfantModifiable } from "./ModifierEnfantForm";
import { FicheSanteForm } from "./FicheSanteForm";
import { ProfilXtraForm } from "./ProfilXtraForm";
import { SupprimerEnfantButton } from "./SupprimerEnfantButton";
import { SecondParentManager, type SecondParent } from "./SecondParentManager";

export default async function ProfilParentPage() {
  const { supabase, user } = await requireUser("parent");

  // Les enfants pendent au compte du foyer, l'adresse et l'identité à la
  // personne : un père séparé voit les mêmes enfants que la mère, sans pour
  // autant habiter chez elle.
  const foyer = await foyerParent(supabase, user.id);

  const [
    { data: parentProfile },
    { data: enfants },
    { data: identite },
    { data: coordonnees },
  ] = await Promise.all([
      supabase.from("parent_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("enfants")
        .select("*, enfant_fiche_sante(*), enfant_profil_xtra(*)")
        .eq("parent_id", foyer.compteFoyer)
        .order("created_at"),
      supabase
        .from("identites")
        .select("prenom, nom")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("coordonnees")
        .select("telephone")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

  let second: SecondParent | null = null;
  if (foyer.autreParent) {
    // Le nom seulement : depuis la 0047, c'est tout ce qu'un parent lit de
    // l'autre. Un compte tout juste créé n'en a pas encore, et l'écran le dit
    // plutôt que d'afficher une ligne vide qu'on ne sait pas lire.
    const { data: identiteAutre } = await supabase
      .from("identites")
      .select("prenom, nom")
      .eq("user_id", foyer.autreParent)
      .maybeSingle();

    second = {
      nom:
        [identiteAutre?.prenom, identiteAutre?.nom].filter(Boolean).join(" ") || null,
      jeSuisPrincipal: foyer.estPrincipal,
      statut: foyer.statut ?? "en_attente",
      jePartage: foyer.jePartage,
      autrePartage: foyer.autrePartage,
      gardePaires:
        foyer.gardeSemainesPaires === null
          ? null
          : foyer.gardeSemainesPaires === user.id
            ? "moi"
            : "autre",
    };
  }

  const { pourcentage, manquants } = computeParentProgress({
    identiteComplete: Boolean(identite?.prenom && identite?.nom),
    telephoneRenseigne: Boolean(coordonnees?.telephone),
    adresseRenseignee: Boolean(parentProfile?.adresse),
    auMoinsUnEnfant: (enfants?.length ?? 0) > 0,
    fichesSanteCompletes: (enfants ?? []).every((e) => e.enfant_fiche_sante),
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <h1 className="text-2xl font-semibold text-liams-navy">Mon profil parent</h1>

      <BarreProgression pourcentage={pourcentage} manquants={manquants} />

      <IdentiteForm
        prenom={identite?.prenom ?? null}
        nom={identite?.nom ?? null}
        telephone={coordonnees?.telephone ?? null}
      />

      <ParentProfileForm adresse={parentProfile?.adresse ?? ""} />

      {/* Avant la liste des enfants, et non après : c'est le rattachement qui
          décide de quels enfants cette page parle. Un parent qui vient
          d'accepter une invitation doit trouver la réponse à « pourquoi cette
          fratrie » au-dessus d'elle, pas en bas de page. */}
      <SecondParentManager second={second} />

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-liams-navy">Mes enfants</h2>

        {(enfants ?? []).map((enfant) => (
          <div key={enfant.id} className="flex flex-col gap-6 rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">
                {enfant.prenom}
                {enfant.date_naissance && (
                  <span className="ml-2 text-xs font-normal text-gray-500">
                    né(e) le{" "}
                    {new Date(enfant.date_naissance).toLocaleDateString("fr-FR")}
                  </span>
                )}
                {!enfant.date_naissance && (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    Date de naissance manquante
                  </span>
                )}
                {!enfant.enfant_fiche_sante && (
                  <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                    Fiche santé manquante
                  </span>
                )}
              </h3>
              <SupprimerEnfantButton enfantId={enfant.id} />
            </div>

            {/* Corriger plutôt que supprimer et recréer : la suppression
                emporte la fiche santé, le profil Xtra et la trace des
                lectures. */}
            <ModifierEnfantForm enfant={enfant as EnfantModifiable} />

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
          href="/recherche"
          className="mt-4 inline-block rounded-full bg-liams-orange px-6 py-3 text-sm font-medium text-white hover:opacity-90"
        >
          Commencer votre recherche
        </Link>
      </section>

      <NavigationBas />
    </div>
  );
}
