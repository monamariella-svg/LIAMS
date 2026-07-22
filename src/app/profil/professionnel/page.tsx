import { requireUser } from "@/lib/auth";
import type { CreneauDisponibilite } from "@/lib/disponibilites";
import { computeProfessionalProgress } from "@/lib/progress";
import { ProfessionalProfileForm } from "./ProfessionalProfileForm";
import { DocumentUploadForm } from "./DocumentUploadForm";
import { QualificationXtraForm } from "./QualificationXtraForm";
import { PhotosManager } from "./PhotosManager";
import { PromptsManager } from "./PromptsManager";
import { SoumettreDossierForm } from "./SoumettreDossierForm";
import type { DocumentType } from "./actions";

export default async function ProfilProfessionnelPage() {
  const { supabase, user } = await requireUser("professionnel");

  const [{ data: profile }, { data: documents }, { data: qualification }, { data: photos }, { data: prompts }] =
    await Promise.all([
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
    ]);

  const documentsParType = (docType: DocumentType) =>
    (documents ?? []).filter((d) => d.type === docType);

  const { pourcentage, manquants } = computeProfessionalProgress({
    infosGeneralesCompletes: Boolean(profile?.adresse && profile?.tarif_horaire),
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

      <div className="rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-liams-navy">Profil complété à {pourcentage}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-liams-orange transition-all"
            style={{ width: `${pourcentage}%` }}
          />
        </div>
        {manquants.length > 0 && (
          <p className="mt-2 text-xs text-gray-500">
            Il manque : {manquants.join(", ")}.
          </p>
        )}
      </div>

      <ProfessionalProfileForm
        tarifHoraire={profile?.tarif_horaire ?? null}
        adresse={profile?.adresse ?? ""}
        rayonKm={profile?.rayon_km ?? 15}
        accueilADomicile={profile?.accueil_a_domicile ?? false}
        specialisations={profile?.specialisations ?? []}
        disponibilites={(profile?.disponibilites as CreneauDisponibilite[]) ?? []}
      />

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
      </section>

      <PhotosManager
        photos={photos ?? []}
        supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}
      />

      <PromptsManager prompts={prompts ?? []} />

      <QualificationXtraForm qualification={qualification} />

      <SoumettreDossierForm />
    </div>
  );
}
