import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";

// Récupère l'email d'un utilisateur via la fonction SQL get_email_for_notification
// (n'autorise que si l'appelant a une relation légitime avec lui, voir 0006_notifications.sql),
// puis envoie la notification. Échoue silencieusement si l'email n'est pas accessible.
export async function notifierUtilisateur(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  subject: string,
  html: string,
) {
  const { data: email } = await supabase.rpc("get_email_for_notification", { p_user_id: userId });
  if (email) await sendEmail({ to: email, subject, html });
}
