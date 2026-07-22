import { createClient } from "@/lib/supabase/server";
import { ContactForm } from "./ContactForm";

export default async function ContactPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold text-liams-navy">
        Contact — Signaler un problème / Suggestion
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        Un souci, une idée d&apos;amélioration ? Écrivez-nous, on vous lit.
      </p>
      <div className="mt-6">
        <ContactForm emailInitial={user?.email} />
      </div>
    </div>
  );
}
