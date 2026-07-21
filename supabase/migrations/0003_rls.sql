-- Liams — Row Level Security
-- Principe directeur (4.11, 4.13, 7) : fiche santé/urgence et profil Xtra ne sont
-- jamais publics, visibles seulement par le parent lui-même, les professionnels en
-- mise en relation ACCEPTÉE avec ce parent, et l'admin.

create or replace function public.is_admin()
returns boolean
language sql stable
security definer set search_path = public
as $$
  select exists (select 1 from public.users where id = auth.uid() and role = 'admin');
$$;

create or replace function public.has_accepted_match(p_parent_id uuid, p_professional_id uuid)
returns boolean
language sql stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.matches
    where parent_id = p_parent_id and professional_id = p_professional_id and statut = 'accepte'
  );
$$;

create or replace function public.in_professional_network(p_parent_id uuid, p_professional_id uuid)
returns boolean
language sql stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.parent_networks
    where parent_id = p_parent_id and professional_id = p_professional_id and statut = 'accepte'
  );
$$;

alter table public.users enable row level security;
alter table public.parent_profiles enable row level security;
alter table public.enfants enable row level security;
alter table public.enfant_fiche_sante enable row level security;
alter table public.enfant_profil_xtra enable row level security;
alter table public.professional_profiles enable row level security;
alter table public.professional_photos enable row level security;
alter table public.professional_prompts enable row level security;
alter table public.professional_documents enable row level security;
alter table public.professional_qualification_xtra enable row level security;
alter table public.badges enable row level security;
alter table public.professional_badges enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;
alter table public.parent_networks enable row level security;
alter table public.availability_slots enable row level security;
alter table public.urgent_bookings enable row level security;
alter table public.recurring_bookings enable row level security;
alter table public.avis enable row level security;
alter table public.feedback_pilote enable row level security;

-- ---------------------------------------------------------------- users ---
create policy "users_select_self_or_admin" on public.users
  for select using (id = auth.uid() or public.is_admin());

-- ------------------------------------------------------- parent_profiles ---
create policy "parent_profiles_select" on public.parent_profiles
  for select using (
    user_id = auth.uid()
    or public.is_admin()
    or public.has_accepted_match(user_id, auth.uid())
  );
create policy "parent_profiles_write" on public.parent_profiles
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- -------------------------------------------------------------- enfants ---
create policy "enfants_select" on public.enfants
  for select using (
    parent_id = auth.uid()
    or public.is_admin()
    or public.has_accepted_match(parent_id, auth.uid())
  );
create policy "enfants_write" on public.enfants
  for all using (parent_id = auth.uid() or public.is_admin())
  with check (parent_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------- enfant_fiche_sante ---
create policy "enfant_fiche_sante_select" on public.enfant_fiche_sante
  for select using (
    public.is_admin()
    or exists (select 1 from public.enfants e where e.id = enfant_id and e.parent_id = auth.uid())
    or exists (
      select 1 from public.enfants e
      where e.id = enfant_id and public.has_accepted_match(e.parent_id, auth.uid())
    )
  );
create policy "enfant_fiche_sante_write" on public.enfant_fiche_sante
  for all using (
    public.is_admin()
    or exists (select 1 from public.enfants e where e.id = enfant_id and e.parent_id = auth.uid())
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.enfants e where e.id = enfant_id and e.parent_id = auth.uid())
  );

-- ---------------------------------------------------- enfant_profil_xtra ---
create policy "enfant_profil_xtra_select" on public.enfant_profil_xtra
  for select using (
    public.is_admin()
    or exists (select 1 from public.enfants e where e.id = enfant_id and e.parent_id = auth.uid())
    or exists (
      select 1 from public.enfants e
      where e.id = enfant_id and public.has_accepted_match(e.parent_id, auth.uid())
    )
  );
create policy "enfant_profil_xtra_write" on public.enfant_profil_xtra
  for all using (
    public.is_admin()
    or exists (select 1 from public.enfants e where e.id = enfant_id and e.parent_id = auth.uid())
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.enfants e where e.id = enfant_id and e.parent_id = auth.uid())
  );

-- ------------------------------------------------- professional_profiles ---
-- Profils publics du marketplace : lecture ouverte, y compris aux visiteurs anonymes.
create policy "professional_profiles_select_public" on public.professional_profiles
  for select using (true);
create policy "professional_profiles_write" on public.professional_profiles
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "professional_photos_select_public" on public.professional_photos
  for select using (true);
create policy "professional_photos_write" on public.professional_photos
  for all using (professional_id = auth.uid() or public.is_admin())
  with check (professional_id = auth.uid() or public.is_admin());

create policy "professional_prompts_select_public" on public.professional_prompts
  for select using (true);
create policy "professional_prompts_write" on public.professional_prompts
  for all using (professional_id = auth.uid() or public.is_admin())
  with check (professional_id = auth.uid() or public.is_admin());

-- ------------------------------------------------ professional_documents ---
-- Publics uniquement : les photos de logement validées. Le reste (casier, CV,
-- diplômes...) reste privé au professionnel concerné et à l'admin qui valide.
create policy "professional_documents_select" on public.professional_documents
  for select using (
    professional_id = auth.uid()
    or public.is_admin()
    or (type = 'photo_logement' and statut = 'valide')
  );
create policy "professional_documents_insert" on public.professional_documents
  for insert with check (professional_id = auth.uid() or public.is_admin());
create policy "professional_documents_update" on public.professional_documents
  for update using (public.is_admin() or professional_id = auth.uid());
create policy "professional_documents_delete" on public.professional_documents
  for delete using (professional_id = auth.uid() or public.is_admin());

-- ------------------------------------------ professional_qualification_xtra
-- Espace différencié "Xtras" (4.2.6) : jamais public, seulement le pro concerné et l'admin.
create policy "qualification_xtra_select" on public.professional_qualification_xtra
  for select using (professional_id = auth.uid() or public.is_admin());
create policy "qualification_xtra_write" on public.professional_qualification_xtra
  for all using (professional_id = auth.uid() or public.is_admin())
  with check (professional_id = auth.uid() or public.is_admin());

-- --------------------------------------------------------------- badges ---
create policy "badges_select_public" on public.badges for select using (true);
create policy "badges_admin_write" on public.badges for all using (public.is_admin()) with check (public.is_admin());

create policy "professional_badges_select_public" on public.professional_badges for select using (true);
create policy "professional_badges_admin_write" on public.professional_badges
  for all using (public.is_admin()) with check (public.is_admin());

-- -------------------------------------------------------------- matches ---
create policy "matches_select" on public.matches
  for select using (parent_id = auth.uid() or professional_id = auth.uid() or public.is_admin());
create policy "matches_insert" on public.matches
  for insert with check (parent_id = auth.uid() or public.is_admin());
create policy "matches_update" on public.matches
  for update using (parent_id = auth.uid() or professional_id = auth.uid() or public.is_admin());

-- ------------------------------------------------------------- messages ---
create policy "messages_select" on public.messages
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.matches m
      where m.id = match_id and (m.parent_id = auth.uid() or m.professional_id = auth.uid())
    )
  );
create policy "messages_insert" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id and m.statut = 'accepte'
        and (m.parent_id = auth.uid() or m.professional_id = auth.uid())
    )
  );

-- ------------------------------------------------------- parent_networks ---
create policy "parent_networks_select" on public.parent_networks
  for select using (parent_id = auth.uid() or professional_id = auth.uid() or public.is_admin());
create policy "parent_networks_insert" on public.parent_networks
  for insert with check (parent_id = auth.uid() or public.is_admin());
create policy "parent_networks_update" on public.parent_networks
  for update using (parent_id = auth.uid() or professional_id = auth.uid() or public.is_admin());

-- --------------------------------------------------------------- availability_slots
create policy "availability_slots_select" on public.availability_slots
  for select using (
    professional_id = auth.uid()
    or public.is_admin()
    or public.in_professional_network(auth.uid(), professional_id)
  );
create policy "availability_slots_write" on public.availability_slots
  for all using (professional_id = auth.uid() or public.is_admin())
  with check (professional_id = auth.uid() or public.is_admin());

-- ----------------------------------------------------------- urgent_bookings
-- La confirmation passe par la fonction confirm_urgent_booking() (security definer),
-- pas par une policy update directe, pour garantir l'atomicité "premier confirmé, premier servi".
create policy "urgent_bookings_select" on public.urgent_bookings
  for select using (parent_id = auth.uid() or professional_id = auth.uid() or public.is_admin());
create policy "urgent_bookings_insert" on public.urgent_bookings
  for insert with check (parent_id = auth.uid() or public.is_admin());
create policy "urgent_bookings_cancel" on public.urgent_bookings
  for update using (parent_id = auth.uid() or professional_id = auth.uid() or public.is_admin());

-- --------------------------------------------------------- recurring_bookings
create policy "recurring_bookings_select" on public.recurring_bookings
  for select using (parent_id = auth.uid() or professional_id = auth.uid() or public.is_admin());
create policy "recurring_bookings_insert" on public.recurring_bookings
  for insert with check (parent_id = auth.uid() or public.is_admin());
create policy "recurring_bookings_update" on public.recurring_bookings
  for update using (parent_id = auth.uid() or professional_id = auth.uid() or public.is_admin());

-- ----------------------------------------------------------------- avis ---
create policy "avis_select" on public.avis
  for select using (
    visible_publiquement = true
    or auteur_id = auth.uid()
    or cible_id = auth.uid()
    or public.is_admin()
  );
create policy "avis_insert" on public.avis
  for insert with check (
    auteur_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id and m.statut = 'accepte'
        and (m.parent_id = auth.uid() or m.professional_id = auth.uid())
        and (case when m.parent_id = auth.uid() then m.professional_id else m.parent_id end) = cible_id
    )
  );

-- --------------------------------------------------------- feedback_pilote
create policy "feedback_pilote_select" on public.feedback_pilote
  for select using (user_id = auth.uid() or public.is_admin());
create policy "feedback_pilote_update" on public.feedback_pilote
  for update using (user_id = auth.uid() or public.is_admin());
create policy "feedback_pilote_admin_insert" on public.feedback_pilote
  for insert with check (public.is_admin());
