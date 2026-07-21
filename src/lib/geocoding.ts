// Géocodage via l'API Adresse du gouvernement français (gratuite, sans clé), voir 4.5.
export async function geocodeAdresse(
  adresse: string,
): Promise<{ latitude: number; longitude: number } | null> {
  const query = adresse.trim();
  if (!query) return null;

  try {
    const res = await fetch(
      `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=1`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature) return null;
    const [longitude, latitude] = feature.geometry.coordinates;
    return { latitude, longitude };
  } catch {
    return null;
  }
}
