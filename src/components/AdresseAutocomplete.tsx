"use client";

import { useEffect, useId, useRef, useState } from "react";

/** Champ d'adresse avec suggestions de l'API Adresse du gouvernement.
 *
 * La saisie libre reste toujours possible : les suggestions sont une aide, pas
 * une contrainte. Si l'API ne répond pas, le champ se comporte comme un input
 * ordinaire. */
export function AdresseAutocomplete({
  name,
  defaultValue,
  placeholder,
  className,
  villesUniquement = false,
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  /** Restreint les suggestions aux communes (champ Ville). */
  villesUniquement?: boolean;
}) {
  const [valeur, setValeur] = useState(defaultValue ?? "");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [indexActif, setIndexActif] = useState(-1);
  const listboxId = useId();
  // Une saisie choisie dans la liste ne doit pas relancer une recherche.
  const ignorerProchaineRecherche = useRef(false);
  const conteneur = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ignorerProchaineRecherche.current) {
      ignorerProchaineRecherche.current = false;
      return;
    }
    // En dessous de 3 caractères on n'interroge pas l'API. Inutile de vider
    // les suggestions ici : l'affichage est conditionné à la même longueur,
    // et vider l'état dans le corps de l'effet déclencherait un rendu en
    // cascade.
    if (valeur.trim().length < 3) return;

    // Débounce : on n'interroge l'API qu'une fois la frappe stabilisée.
    const controleur = new AbortController();
    const minuteur = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: valeur.trim() });
        if (villesUniquement) params.set("type", "municipality");
        const res = await fetch(`/api/adresses?${params}`, { signal: controleur.signal });
        if (!res.ok) return;
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
        setOuvert((data.suggestions ?? []).length > 0);
        setIndexActif(-1);
      } catch {
        // Requête annulée ou réseau indisponible : on garde la saisie libre.
      }
    }, 300);

    return () => {
      clearTimeout(minuteur);
      controleur.abort();
    };
  }, [valeur, villesUniquement]);

  // Fermer la liste si on clique ailleurs.
  useEffect(() => {
    const surClic = (e: MouseEvent) => {
      if (conteneur.current && !conteneur.current.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("mousedown", surClic);
    return () => document.removeEventListener("mousedown", surClic);
  }, []);

  const choisir = (suggestion: string) => {
    ignorerProchaineRecherche.current = true;
    setValeur(suggestion);
    setOuvert(false);
    setSuggestions([]);
    setIndexActif(-1);
  };

  // Une saisie redevenue trop courte ne doit pas laisser d'anciennes
  // suggestions à l'écran.
  const afficher = ouvert && suggestions.length > 0 && valeur.trim().length >= 3;

  const surTouche = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!afficher) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndexActif((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndexActif((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && indexActif >= 0) {
      // Empêche l'envoi du formulaire quand on valide une suggestion.
      e.preventDefault();
      choisir(suggestions[indexActif]);
    } else if (e.key === "Escape") {
      setOuvert(false);
    }
  };

  return (
    <div ref={conteneur} className="relative">
      <input
        type="text"
        name={name}
        value={valeur}
        onChange={(e) => setValeur(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOuvert(true)}
        onKeyDown={surTouche}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={afficher}
        aria-controls={listboxId}
        aria-autocomplete="list"
        className={className}
      />

      {afficher && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-gray-300 bg-white shadow-lg"
        >
          {suggestions.map((suggestion, i) => (
            <li key={suggestion} role="option" aria-selected={i === indexActif}>
              <button
                type="button"
                onClick={() => choisir(suggestion)}
                onMouseEnter={() => setIndexActif(i)}
                className={`block w-full px-3 py-2 text-left text-sm ${
                  i === indexActif ? "bg-liams-teal/10 text-liams-navy" : "text-gray-700"
                }`}
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
