-- Liams — Un enfant a deux parents, et parfois deux domiciles
--
-- Le modèle n'en connaissait qu'un. `enfants.parent_id` désigne une personne,
-- et tout en découle : la fiche santé, le profil Xtra, les besoins, les
-- réservations. Un père séparé de la mère n'avait donc aucun moyen de voir le
-- calendrier de son enfant, ni sa fiche santé, sinon en partageant un mot de
-- passe — ce que l'application demande précisément de ne pas faire.
--
-- Le mécanisme est celui des établissements, transposé : un compte principal,
-- un compte secondaire, et une fonction qui dit au nom de qui l'appelant peut
-- agir. Deux différences importantes, et elles tiennent à ce que sont les
-- personnes concernées.
--
-- Un seul compte secondaire, là où une crèche en a cinq. Un enfant a deux
-- parents ; au-delà, ce n'est plus la même question et elle ne se règle pas
-- par un compte de plus.
--
-- Et le partage n'est pas total. Deux salariées d'une crèche voient le même
-- calendrier parce qu'elles font le même travail. Deux parents séparés ne se
-- doivent pas cette transparence : chacun décide de montrer ou non les gardes
-- qu'il organise pendant sa semaine. Ce qui touche l'enfant lui-même — sa
-- fiche santé, ses besoins particuliers — reste visible des deux, toujours :
-- c'est ce qu'il faut connaître pour s'en occuper, et le cacher mettrait
-- l'enfant en jeu dans un désaccord d'adultes.

-- =========================================================================
-- Le lien
-- =========================================================================

create table if not exists public.co_parents (
  parent_principal_id uuid primary key references public.users (id) on delete cascade,
  parent_secondaire_id uuid not null unique references public.users (id) on delete cascade,

  -- Qui a l'enfant les semaines paires (au sens ISO). L'autre a les impaires.
  -- Nul quand la garde n'alterne pas : rien n'oblige deux parents à se
  -- partager les semaines, et beaucoup s'organisent autrement.
  garde_semaines_paires uuid references public.users (id) on delete set null,

  -- Chacun décide pour soi. Par défaut on partage : c'est l'attente ordinaire
  -- de deux parents qui viennent de se rattacher, et celui qui veut se
  -- refermer le fera en connaissance de cause.
  principal_partage_planning boolean not null default true,
  secondaire_partage_planning boolean not null default true,

  -- Le rattachement se demande, il ne s'impose pas. Ouvrir le dossier d'un
  -- enfant à un compte tiers d'un seul geste ferait découvrir la chose à
  -- l'intéressé en se connectant — et un parent inscrit sous une adresse que
  -- l'autre connaît n'a pas consenti pour autant. Même chemin qu'une demande
  -- d'ajout au réseau : on demande, l'autre répond.
  -- La contrainte est posée plus bas, nommée : la table a pu être créée par
  -- une première version de ce fichier, et une contrainte anonyme écrite ici
  -- ne se rattraperait pas après coup.
  statut text not null default 'en_attente',
  accepte_le timestamptz,

  created_at timestamptz not null default now(),

  check (parent_principal_id <> parent_secondaire_id),
  check (
    garde_semaines_paires is null
    or garde_semaines_paires in (parent_principal_id, parent_secondaire_id)
  )
);

comment on table public.co_parents is
  'Le second parent d''un foyer. Un seul : un enfant a deux parents, et
   au-delà ce n''est plus la même question.';

create index if not exists co_parents_secondaire_idx on public.co_parents (parent_secondaire_id);

-- Le consentement, ajouté après coup si la table existait déjà.
--
-- Une première version de ce fichier rattachait sans rien demander. Là où elle
-- a été appliquée, `create table if not exists` ne poserait pas les colonnes
-- ci-dessous — d'où ces deux instructions, sans effet sur une base neuve.
--
-- Un rattachement déjà en place redevient une demande en attente, puisque
-- `statut` prend sa valeur par défaut. Ce n'est pas une perte : c'est
-- exactement le consentement qui n'avait pas été recueilli, et il vaut mieux
-- le demander une fois de trop que de le supposer.
alter table public.co_parents
  add column if not exists statut text not null default 'en_attente',
  add column if not exists accepte_le timestamptz;

alter table public.co_parents
  drop constraint if exists co_parents_statut_valide;

alter table public.co_parents
  add constraint co_parents_statut_valide
    check (statut in ('en_attente', 'accepte'));

-- =========================================================================
-- Au nom de qui l'on agit
-- =========================================================================

-- Les comptes parents que l'appelant pilote : le sien, et celui du parent
-- principal s'il en est le second. Écrite comme `comptes_pilotes()` de la
-- 0029, dont elle est la jumelle côté famille.
create or replace function public.foyers_pilotes()
returns setof uuid
language sql stable
security definer set search_path = public
as $$
  select auth.uid()
  union
  select cp.parent_principal_id
  from public.co_parents cp
  where cp.parent_secondaire_id = auth.uid()
    and cp.statut = 'accepte';
$$;

create or replace function public.agit_pour_parent(p_parent_id uuid)
returns boolean
language sql stable
security definer set search_path = public
as $$
  select exists (select 1 from public.foyers_pilotes() f where f = p_parent_id);
$$;

comment on function public.agit_pour_parent(uuid) is
  'Vrai si l''appelant peut agir pour ce compte parent — lui-même, ou le parent
   principal dont il est le second. Ouvre l''enfant et ce qui le concerne, pas
   le planning de l''autre parent, qui dépend de son partage.';

-- Le partage du planning, dans un sens seulement : « ce parent-là me montre-t-il
-- ses gardes ». Chacun règle le sien, et l'un peut montrer sans que l'autre
-- montre.
create or replace function public.partage_son_planning(p_parent_id uuid)
returns boolean
language sql stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.co_parents cp
    where cp.statut = 'accepte'
    and (
      -- L'autre est le principal, et il partage
      (cp.parent_principal_id = p_parent_id
        and cp.parent_secondaire_id = auth.uid()
        and cp.principal_partage_planning)
      -- ou l'autre est le second, et il partage
      or (cp.parent_secondaire_id = p_parent_id
        and cp.parent_principal_id = auth.uid()
        and cp.secondaire_partage_planning)
    )
  );
$$;

-- =========================================================================
-- Qui voit le lien, et qui le défait
-- =========================================================================

alter table public.co_parents enable row level security;

drop policy if exists "co_parents_select" on public.co_parents;
create policy "co_parents_select" on public.co_parents
  for select using (
    parent_principal_id = auth.uid()
    or parent_secondaire_id = auth.uid()
    or public.is_admin()
  );

-- Le principal seul rattache et retire, comme le titulaire d'un établissement.
-- Une séparation se décide rarement à deux, et laisser chacun retirer l'autre
-- ferait du dossier de l'enfant l'enjeu de la dispute.
drop policy if exists "co_parents_write" on public.co_parents;
create policy "co_parents_write" on public.co_parents
  for all using (parent_principal_id = auth.uid() or public.is_admin())
  with check (parent_principal_id = auth.uid() or public.is_admin());

-- Sauf sa réponse à l'invitation et son propre partage, que chacun règle. Le
-- second parent ne peut modifier que ces colonnes-là, et le trigger le tient —
-- une policy ne sait pas distinguer les colonnes d'un update.
drop policy if exists "co_parents_partage_du_second" on public.co_parents;
create policy "co_parents_partage_du_second" on public.co_parents
  for update using (parent_secondaire_id = auth.uid())
  with check (parent_secondaire_id = auth.uid());

create or replace function public.limiter_update_second_parent()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() = old.parent_secondaire_id
     and auth.uid() <> old.parent_principal_id
     and not public.is_admin() then
    if new.parent_principal_id is distinct from old.parent_principal_id
       or new.parent_secondaire_id is distinct from old.parent_secondaire_id
       or new.garde_semaines_paires is distinct from old.garde_semaines_paires
       or new.principal_partage_planning is distinct from old.principal_partage_planning then
      raise exception 'Vous ne pouvez régler que votre réponse et votre propre partage de planning.'
        using errcode = 'insufficient_privilege';
    end if;

    -- Le statut lui appartient : c'est sa réponse. Il peut donc aussi la
    -- reprendre — un consentement qu'on ne peut plus retirer n'en est pas un.
    -- Mais il ne s'accorde pas le rattachement lui-même : seul le principal
    -- crée la ligne, et « accepté » ne se pose que sur ce qu'on lui a demandé.
    if new.statut is distinct from old.statut and old.statut = 'accepte'
       and new.statut = 'en_attente' then
      raise exception 'Une réponse déjà donnée ne se remet pas en attente.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  -- Et le principal ne répond pas à sa propre demande. Sans cette moitié-là,
  -- le consentement ne tiendrait pas une minute : la policy lui ouvre la ligne
  -- entière, il lui suffirait d'y poser « accepté » lui-même. Retirer une
  -- invitation restée sans réponse se fait en supprimant la ligne, ce que la
  -- même policy lui permet déjà.
  if auth.uid() = old.parent_principal_id
     and not public.is_admin()
     and new.statut is distinct from old.statut then
    raise exception 'La réponse au rattachement appartient à l''autre parent.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists limiter_update_second_parent on public.co_parents;
create trigger limiter_update_second_parent
  before update on public.co_parents
  for each row execute function public.limiter_update_second_parent();

-- =========================================================================
-- L'enfant, et ce qui le concerne
-- =========================================================================

-- Visible des deux parents sans condition. Une fiche santé cachée à un père
-- parce que la mère a fermé son partage mettrait l'enfant en jeu dans un
-- désaccord d'adultes.

drop policy if exists "enfants_select" on public.enfants;
create policy "enfants_select" on public.enfants
  for select using (
    public.agit_pour_parent(parent_id)
    or public.is_admin()
    or public.has_accepted_match(parent_id, auth.uid())
    or public.accueille_enfant(id)
  );

drop policy if exists "enfants_write" on public.enfants;
create policy "enfants_write" on public.enfants
  for all using (public.agit_pour_parent(parent_id) or public.is_admin())
  with check (public.agit_pour_parent(parent_id) or public.is_admin());

drop policy if exists "enfant_fiche_sante_select" on public.enfant_fiche_sante;
create policy "enfant_fiche_sante_select" on public.enfant_fiche_sante
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.enfants e
      where e.id = enfant_id and public.agit_pour_parent(e.parent_id)
    )
    or exists (
      select 1 from public.enfants e
      where e.id = enfant_id and public.has_accepted_match(e.parent_id, auth.uid())
    )
    or public.accueille_enfant(enfant_id)
  );

drop policy if exists "enfant_fiche_sante_write" on public.enfant_fiche_sante;
create policy "enfant_fiche_sante_write" on public.enfant_fiche_sante
  for all using (
    public.is_admin()
    or exists (
      select 1 from public.enfants e
      where e.id = enfant_id and public.agit_pour_parent(e.parent_id)
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.enfants e
      where e.id = enfant_id and public.agit_pour_parent(e.parent_id)
    )
  );

drop policy if exists "enfant_profil_xtra_select" on public.enfant_profil_xtra;
create policy "enfant_profil_xtra_select" on public.enfant_profil_xtra
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.enfants e
      where e.id = enfant_id and public.agit_pour_parent(e.parent_id)
    )
    or exists (
      select 1 from public.enfants e
      where e.id = enfant_id and public.has_accepted_match(e.parent_id, auth.uid())
    )
    or public.accueille_enfant(enfant_id)
  );

drop policy if exists "enfant_profil_xtra_write" on public.enfant_profil_xtra;
create policy "enfant_profil_xtra_write" on public.enfant_profil_xtra
  for all using (
    public.is_admin()
    or exists (
      select 1 from public.enfants e
      where e.id = enfant_id and public.agit_pour_parent(e.parent_id)
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.enfants e
      where e.id = enfant_id and public.agit_pour_parent(e.parent_id)
    )
  );

-- =========================================================================
-- Le planning, qui se partage ou non
-- =========================================================================

-- Chacun écrit sous son propre nom : deux parents séparés organisent chacun
-- leurs gardes, et l'on doit pouvoir dire qui a réservé quoi. On lit les
-- siennes toujours, celles de l'autre s'il les montre.

drop policy if exists "besoins_garde_select" on public.besoins_garde;
create policy "besoins_garde_select" on public.besoins_garde
  for select using (
    parent_id = auth.uid()
    or public.partage_son_planning(parent_id)
    or public.is_admin()
  );

drop policy if exists "besoins_garde_write" on public.besoins_garde;
create policy "besoins_garde_write" on public.besoins_garde
  for all using (parent_id = auth.uid() or public.is_admin())
  with check (parent_id = auth.uid() or public.is_admin());

drop policy if exists "besoin_recurrences_select" on public.besoin_recurrences;
create policy "besoin_recurrences_select" on public.besoin_recurrences
  for select using (
    parent_id = auth.uid()
    or public.partage_son_planning(parent_id)
    or public.is_admin()
  );

drop policy if exists "demandes_creneaux_select" on public.demandes_creneaux;
create policy "demandes_creneaux_select" on public.demandes_creneaux
  for select using (
    parent_id = auth.uid()
    or public.agit_pour(professional_id)
    or public.partage_son_planning(parent_id)
    or public.is_admin()
  );

drop policy if exists "urgent_bookings_select" on public.urgent_bookings;
create policy "urgent_bookings_select" on public.urgent_bookings
  for select using (
    parent_id = auth.uid()
    or public.agit_pour(professional_id)
    or public.partage_son_planning(parent_id)
    or public.is_admin()
  );

drop policy if exists "recurring_bookings_select" on public.recurring_bookings;
create policy "recurring_bookings_select" on public.recurring_bookings
  for select using (
    parent_id = auth.uid()
    or public.agit_pour(professional_id)
    or public.partage_son_planning(parent_id)
    or public.is_admin()
  );

-- =========================================================================
-- Rattacher le second parent
-- =========================================================================

-- Un code plutôt qu'une exception, comme `attacher_membre_etablissement()` de
-- la 0031 : rattacher l'autre parent échoue pour des raisons ordinaires, et
-- chacune mérite une phrase.
create or replace function public.attacher_second_parent(p_email text)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_cible uuid;
  v_role text;
begin
  select id, role into v_cible, v_role
  from public.users
  where lower(email) = lower(trim(p_email));

  if v_cible is null then return 'compte_introuvable'; end if;
  if v_cible = auth.uid() then return 'soi_meme'; end if;
  if v_role <> 'parent' then return 'pas_parent'; end if;

  if exists (select 1 from public.co_parents where parent_principal_id = auth.uid()) then
    return 'deja_un_second';
  end if;

  -- Un compte qui est déjà le second d'un autre foyer, ou qui a lui-même un
  -- second : deux familles se disputeraient le même dossier.
  --
  -- Seuls les rattachements acceptés comptent ici. Une invitation en attente
  -- ne réserve personne : sans quoi il suffirait d'inviter une adresse au
  -- hasard, et de ne jamais obtenir de réponse, pour empêcher le vrai parent
  -- de se rattacher. C'est au moment d'accepter que l'on revérifie.
  if exists (
    select 1 from public.co_parents
    where (parent_secondaire_id = v_cible or parent_principal_id = v_cible)
      and statut = 'accepte'
  ) then
    return 'deja_ailleurs';
  end if;

  insert into public.co_parents (parent_principal_id, parent_secondaire_id)
  values (auth.uid(), v_cible);

  return 'ok';
end;
$$;

-- =========================================================================
-- Y répondre
-- =========================================================================

-- La demande se refuse, et une acceptation se reprend. Un consentement qu'on
-- ne peut plus retirer n'en est pas un — et une séparation qui tourne mal est
-- précisément le moment où l'on veut pouvoir se retirer sans demander la
-- permission de l'autre.
--
-- **Refuser efface le lien**, plutôt que d'y inscrire un refus. `parent_
-- secondaire_id` est unique : une ligne qui resterait, refusée, tiendrait le
-- compte visé prisonnier — son vrai co-parent ne pourrait plus l'inviter, et
-- lui-même ne pourrait pas s'en défaire puisque seul le principal supprime.
-- Il suffirait alors d'inviter une adresse au hasard pour la bloquer. On
-- efface donc, et l'autre réinvite s'il y a lieu.
--
-- La vérification de l'invitation se rejoue ici : entre la demande et la
-- réponse, ce compte a pu s'engager ailleurs. C'est l'acceptation, et non
-- l'invitation, qui engage.
create or replace function public.repondre_rattachement(p_accepter boolean)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_principal uuid;
begin
  select parent_principal_id into v_principal
  from public.co_parents
  where parent_secondaire_id = auth.uid();

  if v_principal is null then return 'aucune_invitation'; end if;

  if not p_accepter then
    delete from public.co_parents where parent_secondaire_id = auth.uid();
    return 'ok';
  end if;

  -- Un compte qui a lui-même rattaché quelqu'un tient déjà un foyer : le
  -- laisser devenir le second d'un autre mettrait deux familles sur le même
  -- dossier.
  if exists (
    select 1 from public.co_parents
    where parent_principal_id = auth.uid()
      and statut = 'accepte'
  ) then
    return 'deja_ailleurs';
  end if;

  update public.co_parents
  set statut = 'accepte',
      accepte_le = now()
  where parent_secondaire_id = auth.uid();

  return 'ok';
end;
$$;

-- =========================================================================
-- Se voir l'un l'autre
-- =========================================================================

-- Le lien est symétrique, à la différence de `agit_pour_parent()` : celle-ci
-- ouvre le dossier de l'enfant vers le haut seulement — le second parent agit
-- pour le principal, jamais l'inverse. Or « qui est l'autre parent » se pose
-- des deux côtés, et un écran qui annonce un rattachement sans pouvoir en
-- nommer le destinataire ne rassure personne.
--
-- Une invitation en attente ne s'y lit pourtant que dans un sens. Celui qui la
-- reçoit doit savoir qui la lui adresse — répondre à un inconnu n'est pas
-- répondre. Celui qui l'envoie, lui, attend : il connaissait déjà l'adresse
-- qu'il a saisie, il n'a pas à y gagner le nom de qui la porte, sans quoi il
-- suffirait d'inviter une adresse au hasard pour savoir qui est derrière.
create or replace function public.est_mon_co_parent(p_user_id uuid)
returns boolean
language sql stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.co_parents cp
    where
      -- Vers celui qui m'invite : dès la demande.
      (cp.parent_secondaire_id = auth.uid() and cp.parent_principal_id = p_user_id)
      -- Vers celui que j'ai invité : une fois qu'il a dit oui.
      or (cp.parent_principal_id = auth.uid()
        and cp.parent_secondaire_id = p_user_id
        and cp.statut = 'accepte')
  );
$$;

-- Les deux fonctions dont la règle ci-dessous dépend, redéfinies à
-- l'identique. Elles viennent de la 0029, dont on sait depuis la 0048 qu'elle
-- ne s'est pas appliquée en entier : recréer une policy sur une fonction
-- absente ferait échouer cette migration-ci pour une raison qui ne la regarde
-- pas. `create or replace` ne fait rien de neuf si elles existent déjà.
create or replace function public.est_professionnel(p_user_id uuid)
returns boolean
language sql stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = p_user_id and role in ('professionnel', 'etablissement')
  );
$$;

create or replace function public.lien_avec_parent(p_parent_id uuid)
returns boolean
language sql stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.comptes_pilotes() c
    where public.has_accepted_match(p_parent_id, c)
       or public.in_professional_network(p_parent_id, c)
  );
$$;

-- Prévenir l'autre parent suppose de connaître son adresse. Celle du compte
-- invité, celui qui invite l'a saisie lui-même — il n'apprend rien ; celle de
-- l'invitant, l'invité doit l'avoir pour répondre à quelqu'un plutôt qu'à un
-- écran. On ajoute donc le lien aux relations qui ouvrent une notification,
-- dans les deux sens et dès la demande, faute de quoi l'invitation resterait
-- muette et personne ne saurait qu'il y a quelque chose à accepter.
create or replace function public.get_email_for_notification(p_user_id uuid)
returns text
language sql stable
security definer set search_path = public
as $$
  select email from public.users
  where id = p_user_id
  and (
    p_user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.matches
      where (parent_id = auth.uid() and professional_id = p_user_id)
         or (professional_id = auth.uid() and parent_id = p_user_id)
    )
    or exists (
      select 1 from public.parent_networks
      where (parent_id = auth.uid() and professional_id = p_user_id)
         or (professional_id = auth.uid() and parent_id = p_user_id)
    )
    or exists (
      select 1 from public.co_parents
      where (parent_principal_id = auth.uid() and parent_secondaire_id = p_user_id)
         or (parent_secondaire_id = auth.uid() and parent_principal_id = p_user_id)
    )
  );
$$;

-- Le nom, rien de plus. Les coordonnées ne suivent pas : deux parents qui
-- viennent de se rattacher se connaissent déjà, et une adresse recopiée sans
-- qu'on l'ait donnée est exactement ce qu'une séparation difficile redoute.
drop policy if exists "identites_select" on public.identites;
create policy "identites_select" on public.identites
  for select using (
    user_id = auth.uid()
    or public.is_admin()
    or (auth.uid() is not null and public.est_professionnel(identites.user_id))
    or public.lien_avec_parent(identites.user_id)
    or public.est_mon_co_parent(identites.user_id)
  );
