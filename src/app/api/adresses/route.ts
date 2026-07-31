import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Suggestions d'adresses pour l'autocomplétion, via l'API Adresse du
// gouvernement (la même que le géocodage, voir lib/geocoding.ts).
//
// On passe par une route serveur plutôt que d'appeler l'API depuis le
// navigateur : la saisie du parent ne quitte jamais notre serveur du point de
// vue de son navigateur, et la route n'est pas ouverte aux anonymes.

const LONGUEUR_MIN = 3;

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();
  // "municipality" restreint aux communes, pour le champ Ville.
  const type = searchParams.get("type") === "municipality" ? "municipality" : null;

  if (query.length < LONGUEUR_MIN) return NextResponse.json({ suggestions: [] });

  try {
    const url = new URL("https://api-adresse.data.gouv.fr/search/");
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "5");
    if (type) url.searchParams.set("type", type);

    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return NextResponse.json({ suggestions: [] });

    const data = await res.json();
    const suggestions: string[] = (data.features ?? [])
      .map((f: { properties?: { label?: string } }) => f.properties?.label)
      .filter((label: string | undefined): label is string => Boolean(label));

    return NextResponse.json({ suggestions });
  } catch {
    // Une API d'adresse indisponible ne doit pas casser la saisie : le parent
    // peut toujours taper son adresse à la main.
    return NextResponse.json({ suggestions: [] });
  }
}
