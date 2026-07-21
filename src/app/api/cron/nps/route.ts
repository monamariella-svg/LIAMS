import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

// Feedback pilote NPS (4.14) : envoyé une seule fois, ~3-4 semaines après inscription.
// Déclenché quotidiennement par Vercel Cron (voir vercel.json), protégé par CRON_SECRET.
const DELAI_JOURS = 21;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const seuil = new Date(Date.now() - DELAI_JOURS * 24 * 60 * 60 * 1000).toISOString();

  const { data: candidats } = await supabase
    .from("users")
    .select("id, email, created_at")
    .lte("created_at", seuil);

  if (!candidats?.length) return NextResponse.json({ envoyes: 0 });

  const { data: dejaEnvoyes } = await supabase
    .from("feedback_pilote")
    .select("user_id")
    .in("user_id", candidats.map((u) => u.id));
  const dejaEnvoyesSet = new Set((dejaEnvoyes ?? []).map((f) => f.user_id));

  const aEnvoyer = candidats.filter((u) => !dejaEnvoyesSet.has(u.id));

  for (const utilisateur of aEnvoyer) {
    await supabase.from("feedback_pilote").insert({
      user_id: utilisateur.id,
      date_envoi: new Date().toISOString(),
    });

    await sendEmail({
      to: utilisateur.email,
      subject: "Ton avis compte — questionnaire Liams (2 minutes)",
      html: `<p>Tu utilises Liams depuis quelques semaines : dis-nous ce que tu en penses !</p><p><a href="${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/feedback">Répondre au questionnaire</a></p>`,
    });
  }

  return NextResponse.json({ envoyes: aEnvoyer.length });
}
