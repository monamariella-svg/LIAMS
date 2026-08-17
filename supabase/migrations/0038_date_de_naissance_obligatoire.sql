-- Liams — L'âge d'un enfant n'est pas un renseignement d'appoint
--
-- `date_naissance` était nullable depuis la 0001, à une époque où l'âge ne
-- servait qu'à s'adresser correctement à la famille. Depuis la 0035, il décide
-- de ce qu'on propose : un établissement accueille par sections, et une place
-- chez les grands n'est pas une place pour un bébé de six mois.
--
-- Tant que la date manque, la recherche doit choisir entre deux mauvaises
-- réponses — ne rien proposer, ou proposer des créneaux qui seront refusés
-- après avoir fait espérer. Aucune des deux ne vaut la peine d'être codée : la
-- donnée se demande, une fois, à la saisie de l'enfant.

-- Le refus est explicite plutôt que brut. `set not null` sur une table qui
-- contient des lignes vides échoue avec un message qui ne dit ni combien ni
-- lesquelles, et l'on cherche alors à l'aveugle dans le Table Editor.
do $$
declare
  v_manquantes integer;
begin
  select count(*) into v_manquantes
  from public.enfants
  where date_naissance is null;

  if v_manquantes > 0 then
    raise exception
      'Migration interrompue : % enfant(s) sans date de naissance. Renseignez-les avant de rejouer cette migration — la requête pour les retrouver est : select id, prenom, parent_id from public.enfants where date_naissance is null;',
      v_manquantes;
  end if;
end;
$$;

alter table public.enfants
  alter column date_naissance set not null;

-- La borne basse écarte les années saisies à deux chiffres, qui donneraient un
-- enfant de plus d'un siècle et aucune section pour l'accueillir.
--
-- La borne haute — pas de date future — n'est volontairement pas ici :
-- `current_date` n'est pas immuable, et une contrainte `check` qui en dépend
-- se comporte mal au rechargement d'une sauvegarde. Elle est tenue par
-- l'application, à la saisie, où elle peut de toute façon s'expliquer en
-- français plutôt que renvoyer une violation de contrainte.
alter table public.enfants
  add constraint enfants_naissance_plausible
    check (date_naissance > date '1900-01-01');

comment on column public.enfants.date_naissance is
  'Obligatoire depuis la 0038 : c''est elle qui détermine les sections, et donc
   les créneaux, susceptibles d''accueillir cet enfant.';
