-- Liams — buckets de stockage pour les documents et photos professionnels
-- Convention de chemin : {professional_id}/{...}, utilisée par les policies
-- ci-dessous pour vérifier la propriété via (storage.foldername(name))[1].

insert into storage.buckets (id, name, public)
values ('professional-documents', 'professional-documents', false)
on conflict (id) do nothing;

-- Photos personnelles du profil dynamique façon "cartes" (4.8) : publiques par nature.
insert into storage.buckets (id, name, public)
values ('professional-photos', 'professional-photos', true)
on conflict (id) do nothing;

-- ------------------------------------------------------- professional-documents
-- Privé : casier judiciaire, CV, diplômes, certificats, justificatif Xtras, photos
-- de logement. Seule exception publique : les photos de logement une fois validées
-- (elles apparaissent sur le profil public, voir professional_documents RLS).

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

create policy "professional_documents_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'professional-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "professional_documents_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'professional-documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- ----------------------------------------------------------- professional-photos
create policy "professional_photos_storage_select" on storage.objects
  for select using (bucket_id = 'professional-photos');

create policy "professional_photos_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'professional-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "professional_photos_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'professional-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );
