-- Liams — Le professionnel déclare ses compétences
--
-- Jusqu'ici seul l'admin attribuait les badges, et le professionnel n'avait
-- qu'un champ texte libre « Spécialisations » — inexploitable pour la mise en
-- relation, où « TSA » et « autisme » ne se rencontrent jamais.
--
-- Tous les badges ne sont pas de même nature. Disposer d'un véhicule est un
-- fait sans enjeu : le professionnel le déclare et c'est affiché. « Spécialiste
-- TSA » affirme une expérience ou une formation ; s'il suffisait de cocher une
-- case, le badge ne vaudrait plus rien aux yeux des parents, et c'est
-- justement ce qu'ils viennent chercher ici.

create type mode_badge as enum (
  'auto_declare',   -- le pro coche, c'est affiché
  'sur_validation', -- le pro demande, l'admin contrôle les justificatifs
  'admin_seul',     -- l'admin seul attribue
  'automatique'     -- calculé par l'application
);

alter table public.badges
  add column mode mode_badge not null default 'admin_seul';

update public.badges set mode = 'auto_declare'
  where code in ('vehicule', 'non_fumeur', 'multilingue', 'aide_devoirs');

-- Tout ce qui s'appuie sur une pièce justificative : le professionnel le
-- déclare lui-même — c'est lui qui sait ce qu'il a fait — mais le badge attend
-- le contrôle. Diplôme et premiers secours suivent la même logique que les
-- spécialités : une pièce à produire, un contrôle à passer.
update public.badges set mode = 'sur_validation'
  where code in (
    'accueil_xtras_ordinaires',
    'specialiste_tsa',
    'specialiste_tdah',
    'specialiste_dys',
    'specialiste_handicap_moteur',
    'diplome',
    'premiers_secours'
  );

update public.badges set mode = 'automatique' where code = 'coup_de_coeur';

-- =========================================================================
-- Statut d'un badge attribué
-- =========================================================================

create type statut_badge as enum ('en_attente', 'valide');

-- Les badges déjà posés par l'admin sont acquis.
alter table public.professional_badges
  add column statut statut_badge not null default 'valide';

-- Trace du contrôle, pour que l'admin sache ce qu'il a déjà traité.
alter table public.professional_badges
  add column demande_le timestamptz,
  add column validee_le timestamptz,
  add column validee_par uuid references public.users (id) on delete set null;

-- =========================================================================
-- Qui peut poser quoi
-- =========================================================================

-- Une demande en attente ne doit pas s'afficher aux parents : ce serait
-- obtenir l'effet du badge sans le contrôle.
drop policy if exists "professional_badges_select_public" on public.professional_badges;
create policy "professional_badges_select" on public.professional_badges
  for select using (
    statut = 'valide'
    or professional_id = auth.uid()
    or public.is_admin()
  );

-- Le professionnel pose lui-même ce qui est sans enjeu, et demande le reste.
-- Le statut est contraint ici : rien n'empêche de forger une requête, la règle
-- est le seul endroit qui tienne.
create policy "professional_badges_pro_insert" on public.professional_badges
  for insert with check (
    professional_id = auth.uid()
    and (
      (
        statut = 'valide'
        and exists (
          select 1 from public.badges b
          where b.code = badge_code and b.mode = 'auto_declare'
        )
      )
      or (
        statut = 'en_attente'
        and exists (
          select 1 from public.badges b
          where b.code = badge_code and b.mode = 'sur_validation'
        )
      )
    )
  );

-- Retirer ce qu'on a soi-même posé, ou retirer une demande en attente.
create policy "professional_badges_pro_delete" on public.professional_badges
  for delete using (
    professional_id = auth.uid()
    and exists (
      select 1 from public.badges b
      where b.code = badge_code and b.mode in ('auto_declare', 'sur_validation')
    )
  );
