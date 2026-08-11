import Link from "next/link";
import { compteProfessionnelActif, requireUser } from "@/lib/auth";
import { NavigationBas } from "@/components/NavigationBas";
import { EtablissementForm, type Etablissement } from "./EtablissementForm";
import { MembresManager, type Membre } from "./MembresManager";
import { TranchesManager, type Tranche } from "./TranchesManager";
import { DocumentUploadForm } from "../professionnel/DocumentUploadForm";

export default async function ProfilEtablissementPage() {
  const { supabase, user } = await requireUser("professionnel");
  const { comptePro, estTitulaire, agrementExpire, agrementFin } =
    await compteProfessionnelActif(supabase, user.id);

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
  let tranches: Tranche[] = [];

  if (etablissement) {
    const { data: lignesTranches } = await supabase
      .from("etablissement_tranches")
      .select("id, libelle, age_min_mois, age_max_mois, places_agreees, places_ouvertes")
      .eq("etablissement_id", etablissement.id)
      .order("ordre")
      .order("age_min_mois");
    tranches = (lignesTranches ?? []) as Tranche[];
  }

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

  const { data: documents } = await supabase
    .from("professional_documents")
    .select("id, type, fichier_url, statut")
    .eq("professional_id", comptePro)
    .in("type", ["agrement", "assurance"])
    .order("date_upload", { ascending: false });

  const documentsDeType = (type: string) =>
    (documents ?? []).filter((d) => d.type === type);

  const dateFr = agrementFin
    ? new Date(agrementFin).toLocaleDateString("fr-FR")
    : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <h1 className="text-2xl font-semibold text-liams-navy">Mon établissement</h1>

      {/* Accueillir sans autorisation du département est illégal : on ne
          contourne pas, on remet l'agrément à jour. Le reste du compte est
          fermé tant que ce n'est pas fait. */}
      {agrementExpire && (
        <section className="rounded-xl border-2 border-red-300 bg-red-50 p-6">
          <h2 className="text-base font-semibold text-red-800">
            Votre agrément a expiré{dateFr ? ` le ${dateFr}` : ""}
          </h2>
          <p className="mt-2 text-sm text-red-800">
            Un établissement d&apos;accueil du jeune enfant ne peut pas accueillir
            sans l&apos;autorisation du conseil départemental. Votre compte est
            donc limité à cette page jusqu&apos;à la mise à jour de votre
            agrément : mettez à jour sa date de fin ci-dessous et joignez le
            justificatif. Les réservations qui dépassaient cette date ont été
            annulées une semaine avant l&apos;échéance, et les familles
            concernées prévenues.
          </p>
        </section>
      )}

      <EtablissementForm
        etablissement={(etablissement as Etablissement) ?? null}
        raisonSocialeParDefaut={raisonSocialeParDefaut}
      />

      {etablissement && (
        <section className="rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-liams-navy">
            Les justificatifs de la structure
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Un établissement ne dépose ni CV ni diplôme : il dépose ce qui
            atteste son droit d&apos;exercer. Le bulletin n°3 du casier
            judiciaire reste demandé, mais c&apos;est celui du représentant — il
            se dépose dans « Mon profil ».
          </p>
          <div className="mt-2">
            <DocumentUploadForm
              type="agrement"
              label="Agrément PMI"
              obligatoire
              documents={documentsDeType("agrement")}
            />
            <DocumentUploadForm
              type="assurance"
              label="Attestation de responsabilité civile"
              documents={documentsDeType("assurance")}
            />
          </div>
        </section>
      )}

      {/* Tranches et comptes d'équipe n'ont plus d'objet tant que la structure
          ne peut pas accueillir : les afficher inviterait à travailler sur un
          calendrier qui n'ouvrira pas. */}
      {etablissement && !agrementExpire ? (
        <>
          <TranchesManager tranches={tranches} />
          <MembresManager membres={membres} />
        </>
      ) : !etablissement ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-500">
          Enregistrez d&apos;abord la fiche ci-dessus : vous pourrez ensuite y
          rattacher les comptes de votre équipe.
        </p>
      ) : null}

      <NavigationBas />
    </div>
  );
}
