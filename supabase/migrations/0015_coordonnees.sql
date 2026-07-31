-- Liams — Téléphone
--
-- Pourquoi une table à part plutôt qu'une colonne de public.identites : la
-- sécurité Postgres s'applique ligne par ligne. L'identité d'un professionnel
-- est lisible par tout compte connecté — c'est voulu, on doit savoir à qui on
-- confie son enfant — mais son téléphone ne peut pas l'être : il suffirait de
-- créer un compte pour moissonner les numéros de tous les professionnels, et
-- traiter hors plateforme.
--
-- Le téléphone suit donc la règle des deux sens : chacun voit le sien, et
-- celui des personnes avec qui il a une mise en relation acceptée ou un
-- réseau de confiance. C'est exactement le moment où il devient utile —
-- prévenir d'un retard, joindre en urgence pendant une garde.

create table public.coordonnees (
  user_id uuid primary key references public.users (id) on delete cascade,
  telephone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.coordonnees
  for each row execute function public.set_updated_at();

alter table public.coordonnees enable row level security;

create policy "coordonnees_select" on public.coordonnees
  for select using (
    user_id = auth.uid()
    or public.is_admin()
    -- coordonnées d'un parent, lues par son professionnel
    or public.has_accepted_match(coordonnees.user_id, auth.uid())
    or public.in_professional_network(coordonnees.user_id, auth.uid())
    -- coordonnées d'un professionnel, lues par son parent
    or public.has_accepted_match(auth.uid(), coordonnees.user_id)
    or public.in_professional_network(auth.uid(), coordonnees.user_id)
  );

create policy "coordonnees_write" on public.coordonnees
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- Les comptes existants n'ont pas de ligne : on la crée vide.
insert into public.coordonnees (user_id)
select id from public.users
on conflict (user_id) do nothing;
