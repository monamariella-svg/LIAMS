import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireUser(role: "parent" | "professionnel" | "admin") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connexion");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== role) {
    redirect("/tableau-de-bord");
  }

  return { supabase, user };
}

export async function requireAdmin() {
  return requireUser("admin");
}
