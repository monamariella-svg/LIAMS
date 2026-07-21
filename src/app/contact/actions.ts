"use server";

import { sendEmail } from "@/lib/email";

export type ContactFormState = { error?: string; success?: boolean } | undefined;

export async function envoyerContact(
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const nom = String(formData.get("nom") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!nom || !email || !message) {
    return { error: "Merci de remplir tous les champs." };
  }

  const contactEmail = process.env.CONTACT_EMAIL ?? "contact@liams.app";

  await sendEmail({
    to: contactEmail,
    subject: `Message de contact Liams — ${nom}`,
    html: `<p><strong>De :</strong> ${nom} (${email})</p><p>${message.replace(/\n/g, "<br />")}</p>`,
  });

  return { success: true };
}
