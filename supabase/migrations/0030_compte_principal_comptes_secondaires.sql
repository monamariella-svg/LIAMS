-- Liams — Le compte principal, et ce qu'il délègue
--
-- La 0029 a ouvert aux membres d'un établissement tout ce qui appartient à la
-- structure. C'était trop large. Un établissement n'est pas une équipe de
-- co-gérants : c'est un titulaire qui répond de l'entreprise, et des salariées
-- à qui il confie l'accueil des enfants.
--
-- La règle se resserre donc en deux cercles :
--
--   Le compte principal — celui qui a créé le profil — garde tout ce qui
--   engage l'entreprise : le tarif, l'adresse, l'agrément, les documents, les
--   badges, la vitrine, l'avis laissé à une famille, et l'attribution des
--   comptes secondaires eux-mêmes.
--
--   Les comptes secondaires reçoivent ce qu'il faut pour assurer une
--   prestation : tenir le calendrier, accepter et refuser les demandes,
--   parler aux familles, joindre un parent, consulter la fiche de l'enfant
--   qu'on accueille aujourd'hui et confirmer qu'on l'a lue.
--
-- La question à se poser devant chaque table est donc devenue : est-ce qu'une
-- salariée en a besoin pour garder un enfant cet après-midi ? Si oui, elle y
-- accède. Sinon, cela reste au titulaire.
--
-- Rien ici n'est un correctif de sécurité au sens strict — la 0029 n'exposait
-- rien au-dehors. C'est une question de qui, dans la structure, engage la
-- structure.

-- =========================================================================
-- Le titulaire
-- =========================================================================

-- Pour un établissement, le compte principal est `etablissements.professional_id`,
-- c'est-à-dire le compte qui porte le profil : la comparaison se réduit donc à
-- l'égalité d'origine. Elle est nommée quand même, et c'est délibéré — un
-- `professional_id = auth.uid()` nu au milieu de règles qui utilisent
-- `agit_pour()` ressemble à un oubli de la 0029, et finira par être « corrigé »
-- par quelqu'un de bien intentionné. Le nom dit que c'est voulu.
create or replace function public.est_titulaire(p_professional_id uuid)
returns boolean
language sql stable
security definer set search_path = public
as $$
  select p_professional_id = auth.uid();
$$;

comment on function public.est_titulaire(uuid) is
  'Vrai si l''appelant est le compte principal de ce profil professionnel —
   celui qui l''a créé. À distinguer de agit_pour(), qui inclut les comptes
   secondaires d''un établissement.';

comment on function public.agit_pour(uuid) is
  'Vrai si l''appelant peut agir au nom de ce compte pour assurer une
   prestation : lui-même, ou membre de l''établissement qui le porte. Ne
   confère pas ce qui engage l''entreprise — voir est_titulaire().';

-- =========================================================================
-- La fiche de l'établissement
-- =========================================================================

-- Raison sociale, SIRET, numéro d'agrément : les papiers de l'entreprise. Une
-- salariée n'a pas à les corriger.
drop policy if exists "etablissements_write" on public.etablissements;
create policy "etablissements_write" on public.etablissements
  for all using (public.est_titulaire(professional_id) or public.is_admin())
  with check (public.est_titulaire(professional_id) or public.is_admin());

-- =========================================================================
-- La vitrine et le commerce
-- =========================================================================

-- Le tarif, l'adresse, le rayon d'intervention, la présentation : ce que la
-- structure propose et à quel prix ne se délègue pas.
drop policy if exists "professional_profiles_write" on public.professional_profiles;
create policy "professional_profiles_write" on public.professional_profiles
  for all using (public.est_titulaire(user_id) or public.is_admin())
  with check (public.est_titulaire(user_id) or public.is_admin());

drop policy if exists "professional_photos_write" on public.professional_photos;
create policy "professional_photos_write" on public.professional_photos
  for all using (public.est_titulaire(professional_id) or public.is_admin())
  with check (public.est_titulaire(professional_id) or public.is_admin());

drop policy if exists "professional_prompts_write" on public.professional_prompts;
create policy "professional_prompts_write" on public.professional_prompts
  for all using (public.est_titulaire(professional_id) or public.is_admin())
  with check (public.est_titulaire(professional_id) or public.is_admin());

-- =========================================================================
-- Les papiers
-- =========================================================================

-- Agrément, assurance, casier, diplômes. En lecture autant qu'en écriture :
-- ces pièces concernent le titulaire personnellement, et une salariée n'a
-- aucune raison de les consulter. L'exception publique ne bouge pas — une
-- photo de logement validée s'affiche sur le profil.
drop policy if exists "professional_documents_select" on public.professional_documents;
create policy "professional_documents_select" on public.professional_documents
  for select using (
    public.est_titulaire(professional_id)
    or public.is_admin()
    or (type = 'photo_logement' and statut = 'valide')
  );

drop policy if exists "professional_documents_insert" on public.professional_documents;
create policy "professional_documents_insert" on public.professional_documents
  for insert with check (public.est_titulaire(professional_id) or public.is_admin());

drop policy if exists "professional_documents_update" on public.professional_documents;
create policy "professional_documents_update" on public.professional_documents
  for update using (public.is_admin() or public.est_titulaire(professional_id));

drop policy if exists "professional_documents_delete" on public.professional_documents;
create policy "professional_documents_delete" on public.professional_documents
  for delete using (public.est_titulaire(professional_id) or public.is_admin());

drop policy if exists "qualification_xtra_select" on public.professional_qualification_xtra;
create policy "qualification_xtra_select" on public.professional_qualification_xtra
  for select using (public.est_titulaire(professional_id) or public.is_admin());

drop policy if exists "qualification_xtra_write" on public.professional_qualification_xtra;
create policy "qualification_xtra_write" on public.professional_qualification_xtra
  for all using (public.est_titulaire(professional_id) or public.is_admin())
  with check (public.est_titulaire(professional_id) or public.is_admin());

-- Un badge est une affirmation faite aux familles. Qu'il soit auto-déclaré ne
-- le rend pas anodin : c'est justement parce que personne ne le vérifie qu'il
-- doit engager quelqu'un de nommé.
drop policy if exists "professional_badges_select" on public.professional_badges;
create policy "professional_badges_select" on public.professional_badges
  for select using (
    statut = 'valide'
    or public.est_titulaire(professional_id)
    or public.is_admin()
  );

drop policy if exists "professional_badges_pro_insert" on public.professional_badges;
create policy "professional_badges_pro_insert" on public.professional_badges
  for insert with check (
    public.est_titulaire(professional_id)
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
    public.est_titulaire(professional_id)
    and exists (
      select 1 from public.badges b
      where b.code = badge_code and b.mode in ('auto_declare', 'sur_validation')
    )
  );

-- =========================================================================
-- L'avis laissé à une famille
-- =========================================================================

-- Le lire, oui : savoir ce que la structure a dit d'une famille qu'on va
-- accueillir fait partie du travail. L'écrire, non : un avis se dépose une
-- fois, reste, et engage la parole de l'établissement.
drop policy if exists "avis_insert" on public.avis;
create policy "avis_insert" on public.avis
  for insert with check (
    exists (
      select 1 from public.matches m
      where m.id = match_id and m.statut = 'accepte'
        and (
          (m.parent_id = auth.uid() and auteur_id = auth.uid() and cible_id = m.professional_id)
          or (public.est_titulaire(m.professional_id) and auteur_id = m.professional_id and cible_id = m.parent_id)
        )
    )
  );

-- =========================================================================
-- Le stockage
-- =========================================================================

-- Les fichiers sont rangés sous `{professional_id}/`, et ce dossier est celui
-- du titulaire : la comparaison de chemin d'origine redevient donc exacte, et
-- `agit_pour_dossier()` n'a plus d'emploi. On la retire plutôt que de la
-- laisser traîner — une fonction de contournement de droits qui ne sert plus
-- à rien est une fonction que quelqu'un rebranchera un jour sans y penser.
drop policy if exists "professional_documents_storage_select" on storage.objects;
create policy "professional_documents_storage_select" on storage.objects
  for select using (
    bucket_id = 'professional-documents' and (
      (storage.foldername(name))[1] = auth.uid()::text
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
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "professional_documents_storage_delete" on storage.objects;
create policy "professional_documents_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'professional-documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

drop policy if exists "professional_photos_storage_insert" on storage.objects;
create policy "professional_photos_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'professional-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "professional_photos_storage_delete" on storage.objects;
create policy "professional_photos_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'professional-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

drop function if exists public.agit_pour_dossier(text);

-- =========================================================================
-- Ce qui reste ouvert aux comptes secondaires, et pourquoi
-- =========================================================================

-- Tenir le calendrier — `availability_slots`, `slot_recurrences` : ouvrir et
-- fermer des créneaux est la conduite quotidienne de la structure. Un
-- établissement dont personne ne peut fermer un créneau parce que la
-- directrice est absente ne tient pas une semaine.
--
-- Répondre aux familles — `urgent_bookings`, `recurring_bookings`,
-- `demandes_creneaux`, `demande_creneau_lignes`, `matches`, et
-- `confirm_urgent_booking()` : c'est la prestation même. La garde d'urgence en
-- particulier se décide en minutes, la nuit ou le week-end.
--
-- Parler aux familles — `messages`, `get_email_for_notification()`, et les
-- coordonnées via `lien_avec_parent()` : joindre un parent en cours de journée
-- n'attend pas.
--
-- Accueillir l'enfant — `accueille_enfant()` ouvre la fiche sanitaire et le
-- profil Xtra de l'enfant effectivement accueilli, et s'éteint le lendemain de
-- la garde. `lectures_fiches` reste nominative : la salariée confirme en son
-- nom, pas au nom de la crèche.
--
-- Le partage est donc : la conduite de la garde se délègue, l'engagement de
-- l'entreprise ne se délègue pas.
