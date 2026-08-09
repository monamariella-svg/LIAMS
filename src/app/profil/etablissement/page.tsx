import Link from "next/link";
import { compteProfessionnelActif, requireUser } from "@/lib/auth";
import { NavigationBas } from "@/components/NavigationBas";
import { EtablissementForm, type Etablissement } from "./EtablissementForm";
import { MembresManager, type Membre } from "./MembresManager";

export default async function ProfilEtablissementPage() {
  const { supabase, user } = await requireUser("professionnel");
  const { comptePro, estTitulaire } = await compteProfessionnelActif(supabase, user.id);

  const { data: etablissement } = await supabase
    .from("etablissements")
    .select("*")
    .eq("professional_id", comptePro)
    .maybeSingle();

  // Un compte secondaire ne voit pas la fiche en écriture : ni l'agrément, ni
  // le SIRET, ni les autres comptes. Il voit à quelle structure il est
  // rattaché, ce qui suffit à comprendre pourquoi son calendrier n'est pas le
  // sien.
  if (!estTitulaire) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
        <h1 className="text-2xl font-semibold text-liams-navy">Mon établissement</h1>

        <section className="rounded-xl border border-gray-200 p-6">
          <p className="text-sm text-gray-700">
            Votre compte est rattaché à{" "}
            <strong className="font-medium text-liams-navy">
              {etablissement?.raison_sociale ?? "un établissement"}
            </strong>
            . Vous travaillez sur le calendrier et les réservations de la
            structure, pas sur un calendrier personnel.
          </p>
          <p className="mt-3 text-sm text-gray-500">
            La fiche de l&apos;établissement, ses documents, son tarif et ses
            agréments sont tenus par le compte principal. Pour être retiré de
            l&apos;équipe ou corriger votre fonction, adressez-vous à lui.
          </p>
          <Link
            href="/planning"
            className="mt-4 inline-block rounded-full bg-liams-teal px-6 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Aller au planning
          </Link>
        </section>

        <NavigationBas />
      </div>
    );
  }

  // À l'inscription, un établissement a donné son nom une fois. Le lui
  // redemander ici lui ferait croire qu'il s'agit d'autre chose.
  let raisonSocialeParDefaut = "";
  if (!etablissement) {
    const { data: identite } = await supabase
      .from("identites")
      .select("nom")
      .eq("user_id", user.id)
      .maybeSingle();
    raisonSocialeParDefaut = identite?.nom ?? "";
  }

  let membres: Membre[] = [];

  if (etablissement) {
    const { data: lignes } = await supabase
      .from("etablissement_membres")
      .select("user_id, fonction")
      .eq("etablissement_id", etablissement.id)
      .order("created_at");

    const identifiants = (lignes ?? []).map((l) => l.user_id);
    const { data: identites } = identifiants.length
      ? await supabase
          .from("identites")
          .select("user_id, prenom, nom")
          .in("user_id", identifiants)
      : { data: [] };

    const nomParUtilisateur = new Map(
      (identites ?? []).map((i) => [
        i.user_id,
        [i.prenom, i.nom].filter(Boolean).join(" "),
      ]),
    );

    membres = (lignes ?? []).map((ligne) => ({
      user_id: ligne.user_id,
      fonction: ligne.fonction,
      // Un compte tout juste créé n'a pas encore renseigné son identité : mieux
      // vaut le dire que d'afficher une ligne vide qu'on ne sait pas lire.
      nom: nomParUtilisateur.get(ligne.user_id) || "Nom non renseigné",
    }));
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <h1 className="text-2xl font-semibold text-liams-navy">Mon établissement</h1>

      <EtablissementForm
        etablissement={(etablissement as Etablissement) ?? null}
        raisonSocialeParDefaut={raisonSocialeParDefaut}
      />

      {etablissement ? (
        <MembresManager membres={membres} />
      ) : (
        <p className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-500">
          Enregistrez d&apos;abord la fiche ci-dessus : vous pourrez ensuite y
          rattacher les comptes de votre équipe.
        </p>
      )}

      <NavigationBas />
    </div>
  );
}
