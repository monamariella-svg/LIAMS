-- Liams — L'accueil d'urgence ne se déclare qu'une fois
--
-- La 0036 a ajouté un badge « Accueil d'urgence » pour que les parents
-- puissent filtrer dessus. Mais le choix existait déjà, depuis la 0019 : la
-- case « Accueil d'urgence » parmi les types d'accueil, celle qui décide si le
-- professionnel est proposé dans la recherche d'urgence.
--
-- Deux cases pour la même réalité, et un professionnel pouvait les cocher de
-- façon contradictoire. Badge coché, type décoché : il apparaissait dans les
-- filtres par badge et jamais dans la recherche d'urgence — une promesse
-- affichée que rien ne pouvait honorer, ce qui est pire que de ne rien
-- promettre.
--
-- Le type commande, le badge suit. Le professionnel continue de cocher ce
-- qu'il a toujours coché ; le badge en découle, et cesse d'être une décision
-- séparée.

-- =========================================================================
-- Le badge n'est plus à cocher
-- =========================================================================

-- `automatique`, comme « Coup de cœur des parents » : calculé par
-- l'application, absent des cases proposées au professionnel. La règle
-- d'insertion de la 0016 refuse d'ailleurs qu'il se le pose lui-même dans ce
-- mode — raison pour laquelle la synchronisation vit ici, en `security
-- definer`, et non dans l'action d'enregistrement.
update public.badges set mode = 'automatique' where code = 'accueil_urgence';

-- =========================================================================
-- La synchronisation
-- =========================================================================

create or replace function public.synchroniser_badge_urgence()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if 'urgence' = any(new.types_accueil) then
    insert into public.professional_badges (professional_id, badge_code, statut)
    values (new.user_id, 'accueil_urgence', 'valide')
    on conflict (professional_id, badge_code) do nothing;
  else
    delete from public.professional_badges
    where professional_id = new.user_id
      and badge_code = 'accueil_urgence';
  end if;

  return new;
end;
$$;

comment on function public.synchroniser_badge_urgence() is
  'Pose ou retire le badge « Accueil d''urgence » selon les types d''accueil
   déclarés. Le professionnel ne coche qu''une case ; les deux endroits qui la
   lisent — recherche d''urgence et filtre par badge — ne peuvent plus se
   contredire.';

create trigger synchroniser_badge_urgence
  after insert or update of types_accueil on public.professional_profiles
  for each row execute function public.synchroniser_badge_urgence();

-- =========================================================================
-- Mettre l'existant en accord
-- =========================================================================

-- Le badge posé à la main par un professionnel dont le type n'est pas coché :
-- c'est la contradiction qu'on vient de rendre impossible, et elle peut déjà
-- exister.
delete from public.professional_badges pb
where pb.badge_code = 'accueil_urgence'
  and not exists (
    select 1 from public.professional_profiles p
    where p.user_id = pb.professional_id
      and 'urgence' = any(p.types_accueil)
  );

-- Et l'inverse : le type coché depuis la 0019, sans badge parce qu'il
-- n'existait pas encore.
insert into public.professional_badges (professional_id, badge_code, statut)
select p.user_id, 'accueil_urgence', 'valide'
from public.professional_profiles p
where 'urgence' = any(p.types_accueil)
on conflict (professional_id, badge_code) do nothing;
