-- Liams — Identité des personnes, et données contractuelles des professionnels
--
-- Pourquoi deux tables plutôt que des colonnes sur public.users : la sécurité
-- Postgres s'applique ligne par ligne, jamais colonne par colonne. Rendre le
-- nom d'un professionnel lisible depuis public.users y rendrait aussi son
-- email lisible. On isole donc l'identité, qui a ses propres règles de
-- visibilité, et les données contractuelles, qui ne regardent que l'intéressé
-- et l'admin.

-- =========================================================================
-- Identité — prénom et nom
-- =========================================================================

-- En « security definer », comme is_admin() : interrogée depuis une règle de
-- sécurité, une lecture ordinaire de public.users serait elle-même filtrée
-- par la règle de public.users (chacun ne voit que sa propre ligne) et
-- répondrait donc toujours faux pour autrui.
create or replace function public.est_professionnel(p_user_id uuid)
returns boolean
language sql stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.users where id = p_user_id and role = 'professionnel'
  );
$$;

create table public.identites (
  user_id uuid primary key references public.users (id) on delete cascade,
  prenom text,
  nom text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.identites
  for each row execute function public.set_updated_at();

alter table public.identites enable row level security;

-- Un professionnel garde un enfant : son identité est visible de tout compte
-- connecté, on ne confie pas son enfant à un anonyme. Un parent, lui, n'est
-- connu que de lui-même, de l'admin, et des professionnels avec qui il a une
-- mise en relation acceptée ou un réseau de confiance.
create policy "identites_select" on public.identites
  for select using (
    user_id = auth.uid()
    or public.is_admin()
    or (auth.uid() is not null and public.est_professionnel(identites.user_id))
    or public.has_accepted_match(identites.user_id, auth.uid())
    or public.in_professional_network(identites.user_id, auth.uid())
  );

create policy "identites_write" on public.identites
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- =========================================================================
-- Données contractuelles du professionnel
-- =========================================================================
--
-- Nécessaires à l'édition d'un contrat de prestation, facultatives tant que
-- l'application est gratuite : rien ici ne bloque l'usage courant.
--
-- Volontairement absents : IBAN et numéro de sécurité sociale. Le premier
-- relèvera du prestataire de paiement le jour où l'application encaissera —
-- ce n'est pas à Liams de le stocker. Le second n'a d'utilité qu'en cas
-- d'emploi salarié (CESU), qui n'est pas le modèle retenu.

create type statut_juridique as enum (
  'auto_entrepreneur',
  'micro_entreprise',
  'societe',
  'autre'
);

create table public.donnees_contractuelles (
  user_id uuid primary key references public.users (id) on delete cascade,
  date_naissance date,
  lieu_naissance text,
  statut_juridique statut_juridique,
  siret text,
  assurance_rc_assureur text,
  assurance_rc_numero text,
  assurance_rc_expiration date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.donnees_contractuelles
  for each row execute function public.set_updated_at();

alter table public.donnees_contractuelles enable row level security;

-- Aucune de ces données n'a vocation à être parcourue : ni un parent, ni un
-- autre professionnel n'y accède.
create policy "donnees_contractuelles_select" on public.donnees_contractuelles
  for select using (user_id = auth.uid() or public.is_admin());

create policy "donnees_contractuelles_write" on public.donnees_contractuelles
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- =========================================================================
-- Reprise de l'identité à l'inscription
-- =========================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, role, cgu_acceptees_le)
  values (
    new.id,
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'parent'),
    case when (new.raw_user_meta_data ->> 'cgu_acceptees')::boolean is true
      then now() else null end
  );

  insert into public.identites (user_id, prenom, nom)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'prenom'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'nom'), '')
  );

  return new;
end;
$$;

-- Les comptes créés avant cette migration n'ont pas de ligne d'identité : on
-- la crée vide, ils la rempliront depuis leur profil.
insert into public.identites (user_id)
select id from public.users
on conflict (user_id) do nothing;
