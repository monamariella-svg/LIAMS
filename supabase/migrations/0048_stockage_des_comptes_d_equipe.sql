-- Liams — Le morceau de la 0029 qui n'est jamais passé
--
-- La 0029 s'est interrompue sur `agit_pour_dossier()`, sa première fonction
-- plpgsql — les deux précédentes étaient en `language sql`, d'une seule ligne.
-- Tout ce qui suivait dans le fichier a bien été appliqué : les quarante règles
-- d'accès sont en place, `agit_pour(professional_id)` le confirme sur
-- availability_slots. Seules les règles de stockage, tout à la fin, dépendaient
-- de la fonction absente et n'ont donc pas pu se poser.
--
-- Conséquence restée invisible : une salariée de crèche ne peut ni déposer un
-- document ni ajouter une photo au nom de sa structure. Les règles en vigueur
-- sont celles de la 0004, qui comparent le dossier à `auth.uid()` — donc au
-- compte de la personne, jamais à celui de l'établissement.
--
-- On ne rejoue pas la 0029 : la même instruction échouerait au même endroit.
-- La fonction est créée par la 0046 ; ce fichier ne pose que ce qui manquait.
-- Il est rejouable, et sans effet si la 0029 finit un jour par passer en
-- entier.

-- Sécurité si la 0046 n'a pas encore été appliquée : les deux définitions sont
-- identiques, et `create or replace` ne fait rien de neuf.
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

-- =========================================================================
-- Les justificatifs
-- =========================================================================

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

-- =========================================================================
-- Les photos
-- =========================================================================

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
