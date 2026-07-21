"use client";

import { useActionState, useRef } from "react";
import { uploadDocument, supprimerDocument, type DocumentType } from "./actions";

const STATUT_LABELS: Record<string, { label: string; className: string }> = {
  en_attente: { label: "En attente de vérification", className: "bg-amber-100 text-amber-800" },
  valide: { label: "Validé", className: "bg-green-100 text-green-800" },
  refuse: { label: "Refusé", className: "bg-red-100 text-red-800" },
};

export function DocumentUploadForm({
  type,
  label,
  obligatoire,
  documents,
}: {
  type: DocumentType;
  label: string;
  obligatoire?: boolean;
  documents: { id: string; fichier_url: string; statut: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(async (prevState: unknown, formData: FormData) => {
    const result = await uploadDocument(prevState as never, formData);
    if (result?.success) formRef.current?.reset();
    return result;
  }, undefined);

  return (
    <div className="flex flex-col gap-2 border-b border-gray-100 py-4 last:border-b-0">
      <p className="text-sm font-medium text-gray-800">
        {label} {obligatoire && <span className="text-red-600">*</span>}
      </p>

      {documents.map((doc) => {
        const statut = STATUT_LABELS[doc.statut] ?? STATUT_LABELS.en_attente;
        return (
          <div key={doc.id} className="flex items-center gap-3 text-xs">
            <span className={`rounded-full px-2 py-0.5 font-medium ${statut.className}`}>
              {statut.label}
            </span>
            <span className="truncate text-gray-500">{doc.fichier_url.split("-").pop()}</span>
            <form action={supprimerDocument}>
              <input type="hidden" name="document_id" value={doc.id} />
              <input type="hidden" name="fichier_url" value={doc.fichier_url} />
              <button type="submit" className="text-red-600 hover:underline">
                Supprimer
              </button>
            </form>
          </div>
        );
      })}

      <form ref={formRef} action={formAction} className="flex items-center gap-2">
        <input type="hidden" name="type" value={type} />
        <input type="file" name="fichier" required className="text-xs" />
        <button
          type="submit"
          disabled={pending}
          className="rounded-full border border-liams-navy px-3 py-1 text-xs font-medium text-liams-navy hover:bg-liams-navy hover:text-white disabled:opacity-50"
        >
          {pending ? "Envoi..." : "Téléverser"}
        </button>
      </form>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </div>
  );
}
