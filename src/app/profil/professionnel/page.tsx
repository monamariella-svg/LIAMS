import { requireUser } from "@/lib/auth";
import { computeProfessionalProgress } from "@/lib/progress";
import { NavigationBas } from "@/components/NavigationBas";
import { BarreProgression } from "@/components/BarreProgression";
import { IdentiteForm } from "@/components/identite/IdentiteForm";
import { DonneesContractuellesForm } from "@/components/identite/DonneesContractuellesForm";
import { BadgesForm } from "./BadgesForm";
import { ProfessionalProfileForm } from "./ProfessionalProfileForm";
import { DocumentUploadForm } from "./DocumentUploadForm";
import { QualificationXtraForm } from "./QualificationXtraForm";
import { PhotosManager } from "./PhotosManager";
import { PromptsManager } from "./PromptsManager";
import { SoumettreDossierForm } from "./SoumettreDossierForm";
import type { DocumentType } from "./actions";

export default async function ProfilProfessionnelPage() {
  const { supabase, user } = await requireUser("professionnel");

  const [
    { data: profile },
    { data: documents },
    { data: qualification },
    { data: photos },
    { data: prompts },
    { data: identite },
    { data: donneesContractuelles },
    { data: coordonnees },
    { data: badges },
    { data: badgesAttribues },
  ] = await Promise.all([
      supabase.from("professional_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("professional_documents")
        .select("*")
        .eq("professional_id", user.id)
        .order("date_upload", { ascending: false }),
      supabase
        .from("professional_qualification_xtra")
        .select("*")
        .eq("professional_id", user.id)
        .maybeSingle(),
      supabase
        .from("professional_photos")
        .select("*")
        .eq("professional_id", user.id)
        .order("ordre"),
      supabase
        .from("professional_prompts")
        .select("*")
        .eq("professional_id", user.id)
        .order("ordre"),
      supabase
        .from("identites")
        .select("prenom, nom")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("donnees_contractuelles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("coordonnees")
        .select("telephone")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase.from("badges").select("code, label, description, mode").order("code"),
      supabase
        .from("professional_badges")
        .select("badge_code, statut")
        .eq("professional_id", user.id),
    ]);

  const badgesSimples = (badges ?? []).filter((b) => b.mode === "auto_declare");
  const badgesSpecialites = (badges ?? []).filter((b) => b.mode === "sur_validation");
  const statutParCode = new Map(
    (badgesAttribues ?? []).map((b) => [b.badge_code, b.statut as string]),
  );

  const documentsParType = (docType: DocumentType) =>
    (documents ?? []).filter((d) => d.type === docType);

  const { pourcentage, manquants } = computeProfessionalProgress({
    infosGeneralesCompletes: Boolean(
      profile?.adresse && profile?.tarif_horaire && coordonnees?.telephone,
    ),
    casierDepose: documentsParType("casier").length > 0,
    cvDepose: documentsParType("cv").length > 0,
    diplomeOuCertificatDepose:
      documentsParType("diplome").length > 0 || documentsParType("certificat").length > 0,
    questionXtrasRepondue: qualification !== null,
    aUnePhoto: (photos?.length ?? 0) > 0,
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <h1 className="text-2xl font-semibold text-liams-navy">Mon profil professionnel</h1>

      <IdentiteForm
        prenom={identite?.prenom ?? null}
        nom={identite?.nom ?? null}
        telephone={coordonnees?.telephone ?? null}
      />

      <BarreProgression pourcentage={pourcentage} manquants={manquants} />

      <ProfessionalProfileForm
        tarifHoraire={profile?.tarif_horaire ?? null}
        tarifHoraireUrgence={profile?.tarif_horaire_urgence ?? null}
        adresse={profile?.adresse ?? ""}
        rayonKm={profile?.rayon_km ?? 15}
        accueilADomicile={profile?.accueil_a_domicile ?? false}
      />

      <section className="rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-liams-navy">Mes compétences</h2>
        <p className="mt-1 text-sm text-gray-500">
          Ces informations aident les parents à vous trouver. Elles s&apos;affichent
          sur votre fiche dès que vous les cochez.
        </p>
        <div className="mt-4">
          <BadgesForm badges={badgesSimples} statutParCode={statutParCode} />
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-liams-navy">Documents justificatifs</h2>
        <div className="mt-2">
          <DocumentUploadForm
            type="casier"
            label="Bulletin n°3 du casier judiciaire"
            obligatoire
            documents={documentsParType("casier")}
          />
          <DocumentUploadForm type="cv" label="CV" documents={documentsParType("cv")} />
          <DocumentUploadForm
            type="diplome"
            label="Diplôme(s)"
            documents={documentsParType("diplome")}
          />
          <DocumentUploadForm
            type="certificat"
            label="Certificat(s) (PSC1, formations...)"
            documents={documentsParType("certificat")}
          />
          {profile?.accueil_a_domicile && (
            <DocumentUploadForm
              type="photo_logement"
              label="Photos du logement / lieu d'accueil"
              documents={documentsParType("photo_logement")}
            />
          )}
        </div>

        <div className="mt-8 border-t border-gray-200 pt-6">
          <h3 className="text-base font-semibold text-liams-navy">
            Mes qualifications et spécialités — à justifier
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Cochez ce pour quoi vous avez un diplôme, une formation ou une
            expérience. Ces badges{" "}
            <strong className="font-medium text-liams-navy">
              n&apos;apparaîtront aux parents qu&apos;après contrôle
            </strong>{" "}
            de notre part, et seulement si une solide expérience est prouvée —
            attestation de contrat, certificat de formation, attestation
            d&apos;employeur, diplôme. Déposez ces pièces ci-dessus, dans
            « Diplôme(s) » ou « Certificat(s) ».
          </p>
          <div className="mt-4">
            <BadgesForm
              badges={badgesSpecialites}
              statutParCode={statutParCode}
              sousValidation
            />
          </div>
        </div>
      </section>

      <PhotosManager
        photos={photos ?? []}
        supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}
      />

      <PromptsManager prompts={prompts ?? []} />

      <QualificationXtraForm qualification={qualification} />

      <DonneesContractuellesForm donnees={donneesContractuelles} />

      <SoumettreDossierForm />

      <NavigationBas />
    </div>
  );
}
