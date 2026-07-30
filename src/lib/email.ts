// Notifications email (4.11) — via l'API Resend (https://resend.com). Sans clé
// configurée, on log en console plutôt que de faire échouer l'action (utile en dev
// tant que le compte Resend n'est pas branché).

const FROM_EMAIL = process.env.EMAIL_FROM ?? "Liams <notifications@liams.app>";

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(`[email non envoyé — RESEND_API_KEY absente] à ${to} : ${subject}`);
    return;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });
    if (!response.ok) {
      // Clé invalide, domaine d'envoi non vérifié, quota... : Resend répond
      // 4xx avec un corps explicite — le rendre visible dans les logs Vercel.
      console.error(`Échec d'envoi email (${response.status}):`, await response.text());
    }
  } catch (error) {
    console.error("Échec d'envoi email:", error);
  }
}
