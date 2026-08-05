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

/** Bouton d'accès direct à la page concernée, à joindre à toute notification.
 *
 * Prévenir sans dire où aller oblige le destinataire à retrouver lui-même
 * l'endroit — et beaucoup renoncent. Le lien en clair suit le bouton : les
 * messageries d'entreprise réécrivent ou neutralisent volontiers les liens
 * habillés. */
export function lienVers(chemin: string, libelle: string): string {
  const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}${chemin}`;
  return `
    <p><a href="${url}"
          style="display:inline-block;background:#F07C3E;color:#ffffff;
                 padding:12px 24px;border-radius:9999px;
                 text-decoration:none;font-weight:500;">${libelle}</a></p>
    <p style="font-size:12px;color:#6b7280;">
      Ou copiez ce lien dans votre navigateur : ${url}
    </p>`;
}
