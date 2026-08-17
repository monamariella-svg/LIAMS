-- Liams — Signaler un profil, et pouvoir en tirer les conséquences
--
-- Rien n'est contrôlé avant publication : un professionnel écrit ses réponses,
-- dépose ses photos, et les familles les voient aussitôt. C'est un choix, et il
-- se tient — attendre une validation humaine à chaque dépôt condamnerait la
-- fonctionnalité. Mais il suppose un recours, et il n'y en avait aucun.
--
-- Trois pièces, dont la dernière est celle qui manquait le plus : signaler,
-- traiter, agir. Un signalement qui n'aboutit à rien est une boîte à idées ;
-- jusqu'ici, un administrateur constatant un abus n'avait aucun moyen de
-- retirer une fiche de la recherche.

-- =========================================================================
-- Ce qu'on reproche
-- =========================================================================

-- Un motif dédié à la sécurité de l'enfant, séparé du reste. Sur une
-- application de garde, « une photo déplacée » et « des propos qui
-- m'inquiètent pour un enfant » ne se traitent ni avec la même urgence ni par
-- la même personne, et les confondre dans « autre » les enterrerait ensemble.
create type motif_signalement as enum (
  'securite_enfant',
  'contenu_inapproprie',
  'informations_fausses',
  'usurpation_identite',
  'autre'
);

create type statut_signalement as enum ('nouveau', 'traite', 'rejete');

create table public.signalements (
  id uuid primary key default gen_random_uuid(),
  cible_id uuid not null references public.users (id) on delete cascade,
  auteur_id uuid not null references public.users (id) on delete cascade,
  motif motif_signalement not null,
  commentaire text,
  statut statut_signalement not null default 'nouveau',
  created_at timestamptz not null default now(),
  traite_le timestamptz,
  traite_par uuid references public.users (id) on delete set null,
  -- Deux fois le même reproche par la même personne n'ajoute rien au dossier.
  -- Le même profil signalé par deux familles différentes, si.
  unique (cible_id, auteur_id, motif),
  check (cible_id <> auteur_id)
);

create index signalements_cible_idx on public.signalements (cible_id);
create index signalements_a_traiter_idx
  on public.signalements (created_at)
  where statut = 'nouveau';

alter table public.signalements enable row level security;

-- Signaler suppose d'être connecté. Un signalement anonyme se retourne contre
-- les professionnels : il suffirait d'en déposer trois pour salir un
-- concurrent sans jamais avoir à en répondre.
create policy "signalements_insert" on public.signalements
  for insert with check (auteur_id = auth.uid());

-- On lit les siens — pour savoir qu'il est parti — et l'admin lit tout. La
-- cible ne lit pas les signalements qui la visent : elle y reconnaîtrait
-- l'auteur, et une famille qui craint pour son enfant ne signalerait plus.
create policy "signalements_select" on public.signalements
  for select using (auteur_id = auth.uid() or public.is_admin());

create policy "signalements_update" on public.signalements
  for update using (public.is_admin()) with check (public.is_admin());

-- =========================================================================
-- Retirer une fiche de la circulation
-- =========================================================================

-- Masquer est une décision humaine, jamais un compteur. Un masquage
-- automatique au troisième signalement se retournerait le jour même : trois
-- comptes complices suffiraient à faire disparaître une concurrente, et
-- l'application aurait fait le travail à leur place.
alter table public.professional_profiles
  add column masque boolean not null default false,
  add column masque_le timestamptz,
  add column masque_motif text;

comment on column public.professional_profiles.masque is
  'Fiche retirée de la recherche et des propositions par décision d''un
   administrateur. Le compte continue d''exister et ses gardes en cours ne sont
   pas annulées : masquer n''est pas supprimer, et une famille dont l''enfant
   est accueilli demain n''a pas à en faire les frais.';

-- Seul l'admin masque. La règle d'écriture existante laisse le professionnel
-- modifier son profil ; sans ce garde-fou il lui suffirait de remettre
-- `masque` à faux pour réapparaître.
create or replace function public.refuser_demasquage()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.masque is distinct from old.masque and not public.is_admin() then
    raise exception 'Seul un administrateur peut masquer ou réafficher une fiche.'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger refuser_demasquage
  before update of masque on public.professional_profiles
  for each row execute function public.refuser_demasquage();
