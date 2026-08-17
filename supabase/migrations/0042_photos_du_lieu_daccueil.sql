-- Liams — Une photo dit ce qu'elle montre
--
-- `professional_photos` ne retenait qu'un fichier et un ordre. Une fiche
-- présentait donc six images sans qu'on sache lesquelles montrent la personne
-- et lesquelles montrent l'endroit où l'enfant passera ses journées.
--
-- Or « où sera mon enfant » est une des premières questions d'un parent, et
-- c'est celle à laquelle une photo répond le mieux : la salle des bébés, le
-- jardin, le coin sieste. La laisser deviner revient à s'en priver.
--
-- À ne pas confondre avec le document `photo_logement` de la 0001 : celui-là
-- est un justificatif que l'admin contrôle, jamais montré aux familles. Ici
-- c'est l'inverse — c'est fait pour être vu.

create type photo_sujet as enum ('portrait', 'lieu');

alter table public.professional_photos
  add column sujet photo_sujet not null default 'portrait',
  add column legende text;

comment on column public.professional_photos.sujet is
  'Ce que montre la photo : la personne, ou le lieu d''accueil. Les photos
   déjà déposées sont tenues pour des portraits — c''est ce qu''elles étaient
   dans l''intention, faute d''avoir pu dire autre chose.';

comment on column public.professional_photos.legende is
  'Facultative, et surtout utile sur un lieu : « la salle des bébés », « le
   jardin ». Une crèche a plusieurs sections, et une photo qui ne dit pas
   laquelle informe moins qu''elle ne le laisse croire.';

-- Une légende vide n'est pas une légende : on ne veut pas afficher un cartouche
-- sous une photo pour n'y rien écrire.
alter table public.professional_photos
  add constraint professional_photos_legende_non_vide
    check (legende is null or length(trim(legende)) > 0);
