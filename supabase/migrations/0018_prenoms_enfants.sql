-- Liams — Prénoms des enfants pour les professionnels du réseau
--
-- Un professionnel qui a plusieurs parents dans son réseau ne peut pas les
-- distinguer : la page n'affiche que « Parent ». Il lui faut le nom du parent
-- et le prénom de l'enfant.
--
-- Pourquoi une fonction plutôt qu'élargir la règle de public.enfants : cette
-- table porte aussi besoins_particuliers_libre et besoins_particuliers_tags —
-- la donnée de handicap, la plus sensible du projet (RGPD art. 9). La sécurité
-- s'appliquant ligne par ligne, autoriser la lecture du prénom autoriserait
-- celle du handicap. La fonction ne rend que les prénoms, et rien d'autre.
--
-- L'accès aux besoins particuliers reste donc réservé à la mise en relation
-- acceptée, comme aujourd'hui : c'est au moment où l'on confie l'enfant que
-- l'on partage ce qui le concerne, pas à l'entrée dans un carnet d'adresses.

create or replace function public.prenoms_enfants(p_parent_id uuid)
returns text[]
language sql stable
security definer set search_path = public
as $$
  select coalesce(array_agg(e.prenom order by e.created_at), '{}')
  from public.enfants e
  where e.parent_id = p_parent_id
    and (
      p_parent_id = auth.uid()
      or public.is_admin()
      or public.has_accepted_match(p_parent_id, auth.uid())
      or public.in_professional_network(p_parent_id, auth.uid())
    );
$$;
