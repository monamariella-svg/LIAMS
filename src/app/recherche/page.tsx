import { redirect } from "next/navigation";

// La recherche de professionnels a fusionné avec le planning du parent : les
// critères (accompagnement, distance, trajet) y sont enregistrés une fois, et
// les profils sont proposés directement en face de chaque besoin déclaré.
// Cette route reste pour les liens déjà diffusés (emails, "Comment ça marche").
export default function RecherchePage() {
  redirect("/planning");
}
