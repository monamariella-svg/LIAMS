-- Liams — Le titulaire attache et retire ses comptes secondaires
--
-- La 0028 a posé la table, la 0030 a dit que seul le titulaire y écrit. Reste
-- le geste lui-même, et il ne peut pas se faire depuis le client : rattacher
-- une salariée suppose de retrouver son compte à partir de son adresse email,
-- or la règle sur `users` ne laisse lire que sa propre ligne. C'est voulu —
-- une table d'utilisateurs interrogeable est un annuaire — et cela ne se
-- contourne pas en ouvrant la règle, mais en passant par une fonction qui ne
-- répond qu'à la question posée.
--
-- Le choix du rattachement plutôt que de la création : le titulaire ne crée
-- pas le compte de sa salariée. Elle s'inscrit elle-même, avec son mot de
-- passe, et il l'attache ensuite. Un employeur qui créerait les identifiants
-- de ses salariées pourrait agir sous leur nom — ce qui viderait de son sens
-- la confirmation nominative de lecture d'une fiche sanitaire, à laquelle la
-- 0029 et la 0030 tiennent depuis le début.

-- =========================================================================
-- Correction de la 0030
-- =========================================================================

-- `p_professional_id = auth.uid()` répond `null` à un appelant anonyme. En RLS
-- un `null` vaut refus, donc aucune règle ne se comportait mal ; mais la 0029
-- avait justement corrigé ce travers sur `agit_pour()`, et deux fonctions
-- sœurs qui ne répondent pas pareil finissent par tromper quelqu'un.
create or replace function public.est_titulaire(p_professional_id uuid)
returns boolean
language sql stable
security definer set search_path = public
as $$
  select coalesce(p_professional_id = auth.uid(), false);
$$;

-- =========================================================================
-- Attacher
-- =========================================================================

-- Renvoie un code plutôt que de lever : rattacher une collègue est un geste
-- ordinaire qui échoue pour des raisons ordinaires — adresse mal tapée,
-- collègue pas encore inscrite — et chacune mérite une phrase, pas une page
-- d'erreur.
create or replace function public.attacher_membre_etablissement(
  p_email text,
  p_fonction text default null
)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_etablissement uuid;
  v_user uuid;
  v_role user_role;
begin
  -- Seul le titulaire attache. La fonction contournant la RLS, la vérification
  -- se fait ici et nulle part ailleurs : c'est le seul garde-fou.
  select e.id into v_etablissement
  from public.etablissements e
  where e.professional_id = auth.uid();

  if v_etablissement is null then
    return 'non_autorise';
  end if;

  select u.id, u.role into v_user, v_role
  from public.users u
  where lower(u.email) = lower(trim(p_email));

  if v_user is null then
    return 'compte_introuvable';
  end if;

  if v_user = auth.uid() then
    return 'soi_meme';
  end if;

  -- Un compte parent rattaché à une crèche obtiendrait l'accès aux fiches
  -- sanitaires des enfants accueillis. Le rôle se vérifie donc, et l'erreur
  -- se distingue de « compte introuvable » : le titulaire doit comprendre que
  -- sa collègue s'est inscrite du mauvais côté.
  if v_role <> 'professionnel' then
    return 'pas_professionnel';
  end if;

  if exists (
    select 1 from public.etablissement_membres m
    where m.etablissement_id = v_etablissement and m.user_id = v_user
  ) then
    return 'deja_membre';
  end if;

  -- Une même personne dans deux établissements rendrait ambigu « pour quel
  -- compte agit-elle ? », question à laquelle `comptes_pilotes()` doit
  -- répondre sans hésiter. Tant qu'aucun écran ne permet de choisir, on
  -- l'interdit plutôt que de tirer au sort.
  if exists (
    select 1 from public.etablissement_membres m where m.user_id = v_user
  ) then
    return 'deja_ailleurs';
  end if;

  begin
    insert into public.etablissement_membres (etablissement_id, user_id, fonction)
    values (v_etablissement, v_user, nullif(trim(coalesce(p_fonction, '')), ''));
  exception when check_violation then
    -- Le plafond de cinq comptes, posé par la 0028.
    return 'trop_de_membres';
  end;

  return 'ok';
end;
$$;

comment on function public.attacher_membre_etablissement(text, text) is
  'Rattache un compte professionnel existant à l''établissement de l''appelant.
   Réservée au titulaire. Renvoie ok, non_autorise, compte_introuvable,
   soi_meme, pas_professionnel, deja_membre, deja_ailleurs ou trop_de_membres.';

-- =========================================================================
-- Retirer
-- =========================================================================

-- Le retrait est immédiat et total : le compte redevient un professionnel
-- ordinaire, et `comptes_pilotes()` cesse de le rattacher à la structure dès
-- la requête suivante. Ce qu'il a fait pendant son passage reste — les
-- confirmations de lecture et les entrées de journal portent son nom et ne
-- sont pas effacées.
create or replace function public.detacher_membre_etablissement(p_user_id uuid)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_etablissement uuid;
begin
  select e.id into v_etablissement
  from public.etablissements e
  where e.professional_id = auth.uid();

  if v_etablissement is null then
    return 'non_autorise';
  end if;

  delete from public.etablissement_membres
  where etablissement_id = v_etablissement and user_id = p_user_id;

  if not found then
    return 'pas_membre';
  end if;

  return 'ok';
end;
$$;

comment on function public.detacher_membre_etablissement(uuid) is
  'Retire un compte secondaire de l''établissement de l''appelant. Réservée au
   titulaire. Renvoie ok, non_autorise ou pas_membre.';
