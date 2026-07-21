import { createClient } from "@supabase/supabase-js";

// Client admin (service role) — bypasse RLS. Ne jamais importer depuis un
// composant client ni exposer via une route publique sans contrôle d'accès
// (utilisé uniquement par le cron NPS et par des tâches serveur de confiance).
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
