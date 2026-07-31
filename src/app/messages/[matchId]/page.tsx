import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NavigationBas } from "@/components/NavigationBas";
import { MessageForm } from "./MessageForm";
import { AvisForm } from "./AvisForm";
import { demanderAjoutReseau } from "../../reseau/actions";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const { data: match } = await supabase.from("matches").select("*").eq("id", matchId).maybeSingle();
  if (!match) notFound();
  if (match.parent_id !== user.id && match.professional_id !== user.id) notFound();
  if (match.statut !== "accepte") redirect("/messages");

  const isParent = match.parent_id === user.id;
  let reseauStatut: string | null = null;
  if (isParent) {
    const { data: reseau } = await supabase
      .from("parent_networks")
      .select("statut")
      .eq("parent_id", match.parent_id)
      .eq("professional_id", match.professional_id)
      .maybeSingle();
    reseauStatut = reseau?.statut ?? null;
  }

  const [{ data: messages }, { data: monAvis }] = await Promise.all([
    supabase.from("messages").select("*").eq("match_id", matchId).order("date"),
    supabase
      .from("avis")
      .select("*")
      .eq("match_id", matchId)
      .eq("auteur_id", user.id)
      .maybeSingle(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-liams-navy">Conversation</h1>
        {isParent && !reseauStatut && (
          <form action={demanderAjoutReseau}>
            <input type="hidden" name="professional_id" value={match.professional_id} />
            <button
              type="submit"
              className="rounded-full border border-liams-teal px-4 py-1.5 text-xs font-medium text-liams-teal hover:bg-liams-teal hover:text-white"
            >
              Ajouter à mon réseau
            </button>
          </form>
        )}
        {isParent && reseauStatut === "en_attente" && (
          <span className="text-xs text-gray-500">Demande de réseau en attente</span>
        )}
        {isParent && reseauStatut === "accepte" && (
          <span className="text-xs text-liams-teal">Dans votre réseau ✓</span>
        )}
      </div>

      <div className="mt-4 flex flex-1 flex-col gap-2 overflow-y-auto rounded-xl border border-gray-200 p-4">
        {(messages ?? []).length === 0 && (
          <p className="text-sm text-gray-400">Aucun message pour le moment — lance la conversation.</p>
        )}
        {(messages ?? []).map((message) => {
          const isMine = message.sender_id === user.id;
          return (
            <div
              key={message.id}
              className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                isMine ? "self-end bg-liams-navy text-white" : "self-start bg-gray-100 text-gray-800"
              }`}
            >
              {message.contenu}
            </div>
          );
        })}
      </div>

      <MessageForm matchId={matchId} />

      <div className="mt-6">
        {monAvis ? (
          <p className="text-sm text-gray-500">
            Tu as laissé un avis : {monAvis.note}/5{monAvis.commentaire ? ` — "${monAvis.commentaire}"` : ""}
          </p>
        ) : (
          <AvisForm matchId={matchId} estParent={isParent} />
        )}
      </div>

      <NavigationBas />
    </div>
  );
}
