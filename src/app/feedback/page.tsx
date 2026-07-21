import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FeedbackForm } from "./FeedbackForm";

export default async function FeedbackPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const { data: feedback } = await supabase
    .from("feedback_pilote")
    .select("*")
    .eq("user_id", user.id)
    .is("date_reponse", null)
    .order("date_envoi", { ascending: false })
    .maybeSingle();

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold text-liams-navy">Ton avis compte</h1>
      {feedback ? (
        <div className="mt-6">
          <FeedbackForm feedbackId={feedback.id} />
        </div>
      ) : (
        <p className="mt-4 text-sm text-gray-500">
          Aucun questionnaire à remplir pour le moment.
        </p>
      )}
    </div>
  );
}
