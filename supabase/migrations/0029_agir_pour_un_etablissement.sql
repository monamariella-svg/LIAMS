-- Liams — Les règles apprennent qu'un professionnel n'est pas toujours une personne
--
-- La 0028 a créé les établissements et la fonction `agit_pour()`, en notant que
-- les règles existantes restaient à reprendre. Elles comparent partout
-- `professional_id` à `auth.uid()` : écrites quand un professionnel était
-- forcément quelqu'un, elles refusent tout à une directrice qui n'est pas le
-- compte au nom duquel la crèche est inscrite. Un établissement dont seul le
-- compte principal peut ouvrir un créneau n'a pas d'équipe, il a un mot de
-- passe partagé — ce que la 0028 cherchait précisément à éviter.
--
-- Cette migration fait la reprise. La ligne de partage est la même partout :
--
--   ce qui appartient à la structure — son calendrier, ses réservations, ses
--   documents, ses échanges avec les familles — s'ouvre à ses membres ;
--
--   ce qui engage une personne — la confirmation d'avoir lu une fiche
--   sanitaire, la trace laissée dans le journal des réservations — reste
--   attaché à celle qui l'a fait.
--
-- Un incident examiné dans six mois doit pouvoir désigner quelqu'un. « La
-- crèche a lu la fiche » ne vaudrait rien.

-- =========================================================================
-- Pour quels comptes l'appelant agit-il
-- =========================================================================

-- L'ensemble plutôt que le prédicat : lui-même, et les établissements dont il
-- est membre. Écrit comme un ensemble, il s'utilise dans un `in (...)` que
-- Postgres évalue une fois pour la requête, au lieu d'appeler une fonction par
-- ligne parcourue — ce qui compte dans `accueille_enfant()`, invoquée à chaque
-- lecture de fiche.
create or replace function public.comptes_pilotes()
returns setof uuid
language sql stable
security definer set search_path = public
as $$
  select auth.uid() where auth.uid() is not null
  union
  select e.professional_id
  from public.etablissement_membres m
  join public.etablissements e on e.id = m.etablissement_id
  where m.user_id = auth.uid();
$$;

comment on function public.comptes_pilotes() is
  'Les comptes professionnels au nom desquels l''appelant peut agir : lui-même,
   et les établissements dont il est membre.';

-- Reformulée sur l'ensemble ci-dessus. Au passage elle cesse de répondre
-- `null` à un visiteur anonyme : `null` valait refus en RLS, mais une fonction
-- booléenne qui ne répond ni vrai ni faux finit par surprendre quelqu'un.
create or replace function public.agit_pour(p_professional_id uuid)
returns boolean
language sql stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.comptes_pilotes() c where c = p_professional_id
  );
$$;

-- Le stockage range les fichiers sous `{professional_id}/...` et n'a donc à
-- comparer qu'un fragment de chemin. Un `::uuid` sur un dossier mal formé lève
-- une erreur au lieu de refuser poliment ; on l'attrape.
create or replace function public.agit_pour_dossier(p_dossier text)
returns boolean
language plpgsql stable
security definer set search_path = public
as $$
begin
  return public.agit_pour(p_dossier::uuid);
exception when others then
  return false;
end;
$$;

-- Mise en relation acceptée ou réseau de confiance, avec l'un quelconque des
-- comptes pilotés. C'est ce lien qui ouvre le prénom, le nom et le téléphone
-- d'une famille : une salariée qui doit joindre un parent en cours de journée
-- ne peut pas dépendre de la présence de la directrice.
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

-- =========================================================================
-- Les fonctions qui décidaient seules
-- =========================================================================

-- La 0022 annonçait que son principe vaudrait aussi pour les établissements :
-- le droit sur les données d'un enfant naît de la garde et s'éteint le
-- lendemain. Il vaut maintenant pour eux, et il s'éteint pareillement — cinq
-- salariées n'obtiennent pas un accès permanent, elles obtiennent l'accès aux
-- enfants que la structure accueille en ce moment.
create or replace function public.accueille_enfant(p_enfant_id uuid)
returns boolean
language sql stable
security definer set search_path = public
as $$
  select
    -- Garde d'urgence confirmée
    exists (
      select 1
      from public.urgent_bookings ub
      join public.availability_slots s on s.id = ub.slot_id
      where ub.professional_id in (select public.comptes_pilotes())
        and ub.statut = 'confirme'
        and p_enfant_id = any(ub.enfant_ids)
        and s.date >= current_date - 1
    )
    -- Créneau accepté d'une demande groupée
    or exists (
      select 1
      from public.demande_creneau_lignes l
      join public.demandes_creneaux d on d.id = l.demande_id
      join public.availability_slots s on s.id = l.slot_id
      where d.professional_id in (select public.comptes_pilotes())
        and l.statut = 'accepte'
        and p_enfant_id = any(d.enfant_ids)
        and s.date >= current_date - 1
    )
    -- Accueil récurrent en cours : une fin nulle vaut durée indéterminée
    or exists (
      select 1
      from public.recurring_bookings rb
      where rb.professional_id in (select public.comptes_pilotes())
        and rb.statut = 'actif'
        and p_enfant_id = any(rb.enfant_ids)
        and (rb.date_fin is null or rb.date_fin >= current_date - 1)
    );
$$;

-- Confirmer une garde d'urgence est le geste le plus pressé de l'application :
-- si seule la directrice peut le faire, l'établissement ne sert à rien la nuit
-- où un parent cherche quelqu'un.
create or replace function public.confirm_urgent_booking(p_booking_id uuid)
returns public.urgent_bookings
language plpgsql
security definer set search_path = public
as $$
declare
  v_booking public.urgent_bookings;
  v_slot public.availability_slots;
  v_caller uuid := auth.uid();
begin
  select * into v_booking from public.urgent_bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Réservation introuvable';
  end if;

  if v_caller is not null and not public.agit_pour(v_booking.professional_id)
     and not exists (select 1 from public.users where id = v_caller and role = 'admin') then
    raise exception 'Non autorisé';
  end if;

  select * into v_slot from public.availability_slots where id = v_booking.slot_id for update;
  if v_slot.statut <> 'libre_urgence' then
    raise exception 'Ce créneau n''est plus disponible';
  end if;

  update public.availability_slots set statut = 'occupe' where id = v_slot.id;

  update public.urgent_bookings set statut = 'confirme' where id = p_booking_id;

  update public.urgent_bookings
    set statut = 'annule'
    where slot_id = v_booking.slot_id and id <> p_booking_id and statut = 'en_attente';

  select * into v_booking from public.urgent_bookings where id = p_booking_id;
  return v_booking;
end;
$$;

-- L'email d'une famille, pour lui écrire au nom de la structure.
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
         or (professional_id in (select public.comptes_pilotes()) and parent_id = p_user_id)
    )
    or exists (
      select 1 from public.parent_networks
      where (parent_id = auth.uid() and professional_id = p_user_id)
         or (professional_id in (select public.comptes_pilotes()) and parent_id = p_user_id)
    )
  );
$$;

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
      or public.lien_avec_parent(p_parent_id)
    );
$$;

-- =========================================================================
-- La fiche publique de la structure
-- =========================================================================

drop policy if exists "professional_profiles_write" on public.professional_profiles;
create policy "professional_profiles_write" on public.professional_profiles
  for all using (public.agit_pour(user_id) or public.is_admin())
  with check (public.agit_pour(user_id) or public.is_admin());

drop policy if exists "professional_photos_write" on public.professional_photos;
create policy "professional_photos_write" on public.professional_photos
  for all using (public.agit_pour(professional_id) or public.is_admin())
  with check (public.agit_pour(professional_id) or public.is_admin());

drop policy if exists "professional_prompts_write" on public.professional_prompts;
create policy "professional_prompts_write" on public.professional_prompts
  for all using (public.agit_pour(professional_id) or public.is_admin())
  with check (public.agit_pour(professional_id) or public.is_admin());

-- Les pièces justificatives d'un établissement — agrément, assurance, plans —
-- sont celles de la structure, pas celles d'une salariée.
drop policy if exists "professional_documents_select" on public.professional_documents;
create policy "professional_documents_select" on public.professional_documents
  for select using (
    public.agit_pour(professional_id)
    or public.is_admin()
    or (type = 'photo_logement' and statut = 'valide')
  );

drop policy if exists "professional_documents_insert" on public.professional_documents;
create policy "professional_documents_insert" on public.professional_documents
  for insert with check (public.agit_pour(professional_id) or public.is_admin());

drop policy if exists "professional_documents_update" on public.professional_documents;
create policy "professional_documents_update" on public.professional_documents
  for update using (public.is_admin() or public.agit_pour(professional_id));

drop policy if exists "professional_documents_delete" on public.professional_documents;
create policy "professional_documents_delete" on public.professional_documents
  for delete using (public.agit_pour(professional_id) or public.is_admin());

drop policy if exists "qualification_xtra_select" on public.professional_qualification_xtra;
create policy "qualification_xtra_select" on public.professional_qualification_xtra
  for select using (public.agit_pour(professional_id) or public.is_admin());

drop policy if exists "qualification_xtra_write" on public.professional_qualification_xtra;
create policy "qualification_xtra_write" on public.professional_qualification_xtra
  for all using (public.agit_pour(professional_id) or public.is_admin())
  with check (public.agit_pour(professional_id) or public.is_admin());

-- Un badge déclaré engage la structure ; toute l'équipe peut le poser et le
-- retirer. La contrainte de statut, elle, ne bouge pas : c'est elle qui
-- empêche de s'attribuer un badge soumis à validation.
drop policy if exists "professional_badges_select" on public.professional_badges;
create policy "professional_badges_select" on public.professional_badges
  for select using (
    statut = 'valide'
    or public.agit_pour(professional_id)
    or public.is_admin()
  );

drop policy if exists "professional_badges_pro_insert" on public.professional_badges;
create policy "professional_badges_pro_insert" on public.professional_badges
  for insert with check (
    public.agit_pour(professional_id)
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

drop policy if exists "professional_badges_pro_delete" on public.professional_badges;
create policy "professional_badges_pro_delete" on public.professional_badges
  for delete using (
    public.agit_pour(professional_id)
    and exists (
      select 1 from public.badges b
      where b.code = badge_code and b.mode in ('auto_declare', 'sur_validation')
    )
  );

-- =========================================================================
-- Le calendrier de la structure
-- =========================================================================

-- `availability_slots_select` n'est pas touchée : la 0009 l'a déjà rouverte à
-- tout compte connecté, parce qu'un créneau libre est une information de place
-- de marché. La reprendre ici en repartant de la version de la 0003 aurait
-- refermé la recherche pour tout le monde.
drop policy if exists "availability_slots_write" on public.availability_slots;
create policy "availability_slots_write" on public.availability_slots
  for all using (public.agit_pour(professional_id) or public.is_admin())
  with check (public.agit_pour(professional_id) or public.is_admin());

drop policy if exists "slot_recurrences_select" on public.slot_recurrences;
create policy "slot_recurrences_select" on public.slot_recurrences
  for select using (public.agit_pour(professional_id) or public.is_admin());

drop policy if exists "slot_recurrences_write" on public.slot_recurrences;
create policy "slot_recurrences_write" on public.slot_recurrences
  for all using (public.agit_pour(professional_id) or public.is_admin())
  with check (public.agit_pour(professional_id) or public.is_admin());

-- =========================================================================
-- Les demandes et les réservations
-- =========================================================================

drop policy if exists "matches_select" on public.matches;
create policy "matches_select" on public.matches
  for select using (
    parent_id = auth.uid() or public.agit_pour(professional_id) or public.is_admin()
  );

drop policy if exists "matches_update" on public.matches;
create policy "matches_update" on public.matches
  for update using (
    parent_id = auth.uid() or public.agit_pour(professional_id) or public.is_admin()
  );

drop policy if exists "parent_networks_select" on public.parent_networks;
create policy "parent_networks_select" on public.parent_networks
  for select using (
    parent_id = auth.uid() or public.agit_pour(professional_id) or public.is_admin()
  );

drop policy if exists "parent_networks_update" on public.parent_networks;
create policy "parent_networks_update" on public.parent_networks
  for update using (
    parent_id = auth.uid() or public.agit_pour(professional_id) or public.is_admin()
  );

drop policy if exists "urgent_bookings_select" on public.urgent_bookings;
create policy "urgent_bookings_select" on public.urgent_bookings
  for select using (
    parent_id = auth.uid() or public.agit_pour(professional_id) or public.is_admin()
  );

drop policy if exists "urgent_bookings_cancel" on public.urgent_bookings;
create policy "urgent_bookings_cancel" on public.urgent_bookings
  for update using (
    parent_id = auth.uid() or public.agit_pour(professional_id) or public.is_admin()
  );

drop policy if exists "recurring_bookings_select" on public.recurring_bookings;
create policy "recurring_bookings_select" on public.recurring_bookings
  for select using (
    parent_id = auth.uid() or public.agit_pour(professional_id) or public.is_admin()
  );

drop policy if exists "recurring_bookings_update" on public.recurring_bookings;
create policy "recurring_bookings_update" on public.recurring_bookings
  for update using (
    parent_id = auth.uid() or public.agit_pour(professional_id) or public.is_admin()
  );

drop policy if exists "demandes_creneaux_select" on public.demandes_creneaux;
create policy "demandes_creneaux_select" on public.demandes_creneaux
  for select using (
    parent_id = auth.uid() or public.agit_pour(professional_id) or public.is_admin()
  );

drop policy if exists "demandes_creneaux_update" on public.demandes_creneaux;
create policy "demandes_creneaux_update" on public.demandes_creneaux
  for update using (
    parent_id = auth.uid() or public.agit_pour(professional_id) or public.is_admin()
  );

drop policy if exists "demande_creneau_lignes_select" on public.demande_creneau_lignes;
create policy "demande_creneau_lignes_select" on public.demande_creneau_lignes
  for select using (
    exists (
      select 1 from public.demandes_creneaux d
      where d.id = demande_id
        and (d.parent_id = auth.uid() or public.agit_pour(d.professional_id))
    )
    or public.is_admin()
  );

drop policy if exists "demande_creneau_lignes_update" on public.demande_creneau_lignes;
create policy "demande_creneau_lignes_update" on public.demande_creneau_lignes
  for update using (
    exists (
      select 1 from public.demandes_creneaux d
      where d.id = demande_id and public.agit_pour(d.professional_id)
    )
    or public.is_admin()
  );

-- =========================================================================
-- Les échanges
-- =========================================================================

-- Un fil de discussion appartient à la mise en relation, donc à la structure.
-- Le message part au nom de l'établissement et non de la salariée qui le
-- tape : le parent écrit à sa crèche et doit lire des réponses de sa crèche,
-- pas d'une suite de comptes qu'il ne connaît pas. Pour un professionnel
-- indépendant, `sender_id` reste son propre compte — la règle ne change rien.
--
-- Le prix à payer est assumé : on ne saura pas laquelle des cinq a écrit tel
-- message. C'est acceptable ici parce qu'un message n'engage rien — au
-- contraire des gestes qui engagent, lecture d'une fiche et journal des
-- réservations, qui continuent de nommer la personne.
drop policy if exists "messages_select" on public.messages;
create policy "messages_select" on public.messages
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.matches m
      where m.id = match_id
        and (m.parent_id = auth.uid() or public.agit_pour(m.professional_id))
    )
  );

drop policy if exists "messages_insert" on public.messages;
create policy "messages_insert" on public.messages
  for insert with check (
    exists (
      select 1 from public.matches m
      where m.id = match_id and m.statut = 'accepte'
        and (
          (m.parent_id = auth.uid() and sender_id = auth.uid())
          or (public.agit_pour(m.professional_id) and sender_id = m.professional_id)
        )
    )
  );

-- Un avis est l'appréciation d'une structure sur une famille, ou l'inverse :
-- il est signé par l'établissement, pas par la personne qui l'a rédigé.
-- La formulation est plus longue que l'ancienne, qui déduisait la cible d'un
-- `case` ; elle dit maintenant les deux sens séparément, ce qui se relit.
drop policy if exists "avis_select" on public.avis;
create policy "avis_select" on public.avis
  for select using (
    visible_publiquement = true
    or auteur_id = auth.uid()
    or public.agit_pour(cible_id)
    or public.is_admin()
  );

drop policy if exists "avis_insert" on public.avis;
create policy "avis_insert" on public.avis
  for insert with check (
    exists (
      select 1 from public.matches m
      where m.id = match_id and m.statut = 'accepte'
        and (
          (m.parent_id = auth.uid() and auteur_id = auth.uid() and cible_id = m.professional_id)
          or (public.agit_pour(m.professional_id) and auteur_id = m.professional_id and cible_id = m.parent_id)
        )
    )
  );

-- =========================================================================
-- Joindre la famille
-- =========================================================================

-- « On ne confie pas son enfant à un anonyme » : la règle de la 0014 rend
-- l'identité d'un professionnel visible de tout compte connecté, en s'appuyant
-- sur `role = 'professionnel'`. Une crèche doit évidemment relever de la même
-- règle. La fonction accepte donc les deux rôles, quel que soit celui que
-- l'inscription finira par poser sur un établissement.
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

drop policy if exists "identites_select" on public.identites;
create policy "identites_select" on public.identites
  for select using (
    user_id = auth.uid()
    or public.is_admin()
    or (auth.uid() is not null and public.est_professionnel(identites.user_id))
    or public.lien_avec_parent(identites.user_id)
  );

drop policy if exists "coordonnees_select" on public.coordonnees;
create policy "coordonnees_select" on public.coordonnees
  for select using (
    user_id = auth.uid()
    or public.is_admin()
    -- coordonnées d'un parent, lues par la structure qui l'accueille
    or public.lien_avec_parent(coordonnees.user_id)
    -- coordonnées d'un professionnel, lues par son parent : inchangé, un parent
    -- joint l'établissement, pas nommément l'une de ses salariées
    or public.has_accepted_match(auth.uid(), coordonnees.user_id)
    or public.in_professional_network(auth.uid(), coordonnees.user_id)
  );

-- =========================================================================
-- Le stockage
-- =========================================================================

-- Les fichiers restent rangés sous `{professional_id}/` : le dossier d'un
-- établissement est celui du compte de la structure, et ses membres y écrivent.
drop policy if exists "professional_documents_storage_select" on storage.objects;
create policy "professional_documents_storage_select" on storage.objects
  for select using (
    bucket_id = 'professional-documents' and (
      public.agit_pour_dossier((storage.foldername(name))[1])
      or public.is_admin()
      or exists (
        select 1 from public.professional_documents d
        where d.fichier_url = name and d.type = 'photo_logement' and d.statut = 'valide'
      )
    )
  );

drop policy if exists "professional_documents_storage_insert" on storage.objects;
create policy "professional_documents_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'professional-documents'
    and public.agit_pour_dossier((storage.foldername(name))[1])
  );

drop policy if exists "professional_documents_storage_delete" on storage.objects;
create policy "professional_documents_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'professional-documents'
    and (public.agit_pour_dossier((storage.foldername(name))[1]) or public.is_admin())
  );

drop policy if exists "professional_photos_storage_insert" on storage.objects;
create policy "professional_photos_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'professional-photos'
    and public.agit_pour_dossier((storage.foldername(name))[1])
  );

drop policy if exists "professional_photos_storage_delete" on storage.objects;
create policy "professional_photos_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'professional-photos'
    and (public.agit_pour_dossier((storage.foldername(name))[1]) or public.is_admin())
  );

-- =========================================================================
-- Ce qui ne s'élargit pas, et pourquoi
-- =========================================================================

-- `lectures_fiches` (0024) garde `professional_id = auth.uid()` : la personne
-- qui coche « j'ai lu » se nomme. Elle y arrive tout de même, parce que
-- `accueille_enfant()` reconnaît maintenant l'enfant accueilli par sa
-- structure — c'est le droit qui s'élargit, pas la signature.
--
-- `journal_reservations` (0025) garde `acteur_id = auth.uid()` pour la même
-- raison : un journal qui dirait « la crèche a annulé » ne servirait à rien le
-- jour où l'on cherche à comprendre.
--
-- Dans la 0022, le chemin `has_accepted_match(parent_id, auth.uid())` de
-- `enfants_select` n'est volontairement pas élargi. Une mise en relation
-- acceptée ne suffit pas à ouvrir le dossier d'un enfant à cinq personnes ;
-- seul l'accueil effectif le fait, et c'est bien la doctrine que la 0022
-- posait. Les prénoms et les coordonnées, eux, passent par
-- `lien_avec_parent()` : joindre une famille n'est pas consulter un dossier
-- médical.
--
-- `identites_write` et `coordonnees_write` restent en `user_id = auth.uid()` :
-- une salariée ne modifie ni son propre état civil au nom de la crèche, ni
-- celui de la crèche. Le jour où l'établissement voudra corriger sa raison
-- sociale, c'est la table `etablissements` qui portera la correction.
