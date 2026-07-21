-- Liams — fonctions et triggers

-- =========================================================================
-- Création automatique de la ligne public.users à l'inscription Supabase Auth
-- Le rôle et l'horodatage CGU sont passés via options.data au signUp() côté app :
--   supabase.auth.signUp({ email, password, options: { data: { role, cgu_acceptees: true } } })
-- =========================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, role, cgu_acceptees_le)
  values (
    new.id,
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'parent'),
    case when (new.raw_user_meta_data ->> 'cgu_acceptees')::boolean is true
      then now() else null end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================================
-- updated_at générique
-- =========================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.parent_profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.enfants
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.enfant_fiche_sante
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.enfant_profil_xtra
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.professional_profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.professional_qualification_xtra
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.availability_slots
  for each row execute function public.set_updated_at();

-- =========================================================================
-- Note moyenne + badge automatique "Coup de cœur des parents" (4.4, 4.10)
-- Recalculé après chaque insert/update/delete d'avis visible publiquement.
-- =========================================================================

create or replace function public.recompute_note_moyenne()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  target_id uuid := coalesce(new.cible_id, old.cible_id);
  avg_note numeric(3, 2);
  nb_avis integer;
begin
  select round(avg(note)::numeric, 2), count(*)
    into avg_note, nb_avis
    from public.avis
    where cible_id = target_id and visible_publiquement = true;

  update public.professional_profiles
    set note_moyenne = avg_note, nombre_avis = coalesce(nb_avis, 0)
    where user_id = target_id;

  if avg_note >= 4.5 and nb_avis >= 3 then
    insert into public.professional_badges (professional_id, badge_code)
      values (target_id, 'coup_de_coeur')
      on conflict (professional_id, badge_code) do nothing;
  else
    delete from public.professional_badges
      where professional_id = target_id and badge_code = 'coup_de_coeur';
  end if;

  return null;
end;
$$;

create trigger recompute_note_moyenne
  after insert or update or delete on public.avis
  for each row execute function public.recompute_note_moyenne();

-- =========================================================================
-- Confirmation atomique d'un créneau de garde d'urgence (4.6)
-- Premier confirmé, premier servi : les autres demandes en attente sur le
-- même créneau sont annulées. Seul le professionnel propriétaire du créneau
-- (ou un admin) peut confirmer.
-- =========================================================================

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

  if v_caller is not null and v_caller <> v_booking.professional_id
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
