"use server";

import { requireAdmin } from "@/lib/auth";

export type TestEnvoiState =
  | { statut?: number; reponse?: string; erreur?: string }
  | undefined;

/** Envoi de test qui, contrairement à sendEmail, ne masque rien.
 *
 * sendEmail absorbe volontairement ses erreurs pour qu'un serveur de mail en
 * panne n'empêche jamais une garde d'être réservée. C'est le bon choix en
 * production — mais il rend le diagnostic impossible. Ici, on veut au
 * contraire la réponse brute de Resend, motif de refus compris. */
export async function envoyerTest(
  _prevState: TestEnvoiState,
  formData: FormData,
): Promise<TestEnvoiState> {
  await requireAdmin();

  const destinataire = String(formData.get("destinataire") ?? "").trim();
  if (!destinataire) return { erreur: "Indiquez une adresse de destination." };

  const cle = process.env.RESEND_API_KEY;
  if (!cle) {
    return { erreur: "RESEND_API_KEY est introuvable côté serveur." };
  }

  const expediteur = process.env.EMAIL_FROM ?? "Liams <notifications@liams.app>";

  try {
    const reponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cle}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: expediteur,
        to: destinataire,
        subject: "Test d'envoi Liams",
        html: "<p>Si vous lisez ceci, la chaîne d'envoi fonctionne.</p>",
      }),
    });

    return { statut: reponse.status, reponse: await reponse.text() };
  } catch (erreur) {
    return { erreur: String(erreur) };
  }
}
