-- Liams — Répondre de vive voix
--
-- Les prompts de la 0001 ne se répondent qu'en écrivant. Or ce qu'une famille
-- cherche à savoir d'un professionnel — sa patience, son ton, sa façon de
-- parler des enfants — s'entend avant de se lire. C'est ce que fait Hinge, et
-- la raison n'est pas la mode : une voix engage autrement qu'une phrase.
--
-- Deux bénéfices propres à Liams, en plus.
--
-- L'accessibilité. Le public inclut des familles pour qui lire est un
-- obstacle ; le cahier des charges demande d'ailleurs un texte simple. Une
-- réponse qu'on écoute franchit cet obstacle au lieu de le contourner.
--
-- Et la voix reste attachée à une question. On répond en parlant à « ma
-- philosophie avec les enfants » ; on ne dépose pas un enregistrement libre.
-- Ce qui vaut pour la vidéo, écartée pour l'instant, vaut déjà ici : rattacher
-- le média à une question le maintient sur la pratique, là où un média isolé
-- glisserait vers l'apparence.
--
-- Rien n'est contrôlé avant publication — c'est le choix fait avec la 0043, et
-- le signalement en est le filet.

-- =========================================================================
-- Où vivent les enregistrements
-- =========================================================================

-- Public, comme les photos : une fiche de professionnel est consultable sans
-- compte, et un enregistrement qu'il faudrait être connecté pour entendre
-- manquerait les familles au moment où elles comparent.
-- =========================================================================
-- Une dependance qu on ne suppose pas acquise
-- =========================================================================

-- `agit_pour_dossier()` vient de la 0029. Elle a manque a l appel ici alors
-- que la 0029 etait censee etre passee — signe qu une migration longue peut
-- s interrompre sans qu on le remarque. On la redefinit donc a l identique :
-- `create or replace` ne fait rien de neuf si elle existe deja, et evite que
-- cette migration echoue pour une raison qui ne la concerne pas.
--
-- Le stockage range les fichiers sous `{professional_id}/...` : il n y a donc
-- qu un fragment de chemin a comparer. Un `::uuid` sur un dossier mal forme
-- leve une erreur au lieu de refuser poliment ; on l attrape.
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

insert into storage.buckets (id, name, public)
values ('professional-voix', 'professional-voix', true)
on conflict (id) do nothing;

drop policy if exists "professional_voix_storage_select" on storage.objects;
create policy "professional_voix_storage_select" on storage.objects
  for select using (bucket_id = 'professional-voix');

-- `agit_pour_dossier()` plutôt que `auth.uid()` : depuis la 0029, une salariée
-- de crèche agit pour la structure, et le dossier porte l'identifiant de
-- celle-ci.
drop policy if exists "professional_voix_storage_insert" on storage.objects;
create policy "professional_voix_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'professional-voix'
    and public.agit_pour_dossier((storage.foldername(name))[1])
  );

drop policy if exists "professional_voix_storage_delete" on storage.objects;
create policy "professional_voix_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'professional-voix'
    and (public.agit_pour_dossier((storage.foldername(name))[1]) or public.is_admin())
  );

-- =========================================================================
-- Une réponse, écrite ou parlée
-- =========================================================================

alter table public.professional_prompts
  add column if not exists audio_url text,
  add column if not exists audio_duree_s smallint;

-- `reponse` cesse d'être obligatoire : une réponse peut désormais n'exister
-- qu'en voix. Mais une carte vide n'a aucun sens sur une fiche, d'où la
-- contrainte — l'un ou l'autre, au moins.
alter table public.professional_prompts
  alter column reponse drop not null;

alter table public.professional_prompts
  drop constraint if exists professional_prompts_une_reponse;

alter table public.professional_prompts
  add constraint professional_prompts_une_reponse
    check (
      (reponse is not null and length(trim(reponse)) > 0)
      or audio_url is not null
    );

-- Une minute et demie de marge pour trente secondes annoncées : on coupe à
-- l'enregistrement, pas ici. La borne existe pour qu'un fichier aberrant —
-- durée négative, enregistrement d'une heure — ne passe pas en base.
alter table public.professional_prompts
  drop constraint if exists professional_prompts_duree_plausible;

alter table public.professional_prompts
  add constraint professional_prompts_duree_plausible
    check (audio_duree_s is null or audio_duree_s between 1 and 90);

comment on column public.professional_prompts.audio_url is
  'Chemin dans le bucket professional-voix. La réponse peut être écrite,
   parlée, ou les deux — auquel cas le texte sert de transcription à qui ne
   peut pas écouter.';
