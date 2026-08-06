-- Liams — L'accès aux données de l'enfant naît de la garde et s'éteint avec elle
--
-- Constat du 2026-08-05 : la fiche santé et le profil Xtra ne sont affichés
-- nulle part, et leur règle de lecture exige une mise en relation acceptée.
-- Les parents renseignent donc depuis l'origine allergies, traitements,
-- contacts d'urgence et besoins particuliers sans qu'aucun professionnel ne
-- puisse les consulter.
--
-- Cette migration ouvre le droit ; l'écran qui l'exerce vient avec.
--
-- Le principe retenu : ce n'est pas l'appartenance à un réseau qui donne accès
-- aux données d'un enfant, c'est le fait de l'accueillir. Le droit commence à
-- la validation de la réservation et s'éteint le lendemain de la garde — assez
-- pour signaler un incident ou joindre le parent, pas assez pour constituer un
-- fichier.
--
-- Ce principe vaudra aussi pour les établissements : un compte partagé par
-- plusieurs salariés ne doit pas donner un accès permanent au dossier médical
-- d'enfants qu'ils n'accueillent plus.

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
      where ub.professional_id = auth.uid()
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
      where d.professional_id = auth.uid()
        and l.statut = 'accepte'
        and p_enfant_id = any(d.enfant_ids)
        and s.date >= current_date - 1
    )
    -- Accueil récurrent en cours : une fin nulle vaut durée indéterminée
    or exists (
      select 1
      from public.recurring_bookings rb
      where rb.professional_id = auth.uid()
        and rb.statut = 'actif'
        and p_enfant_id = any(rb.enfant_ids)
        and (rb.date_fin is null or rb.date_fin >= current_date - 1)
    );
$$;

comment on function public.accueille_enfant(uuid) is
  'Vrai si l''appelant accueille cet enfant en ce moment : réservation validée,
   jusqu''au lendemain de la garde. Le droit naît de la prestation, pas de
   l''appartenance à un réseau.';

-- =========================================================================
-- Les trois règles élargies
-- =========================================================================

drop policy if exists "enfants_select" on public.enfants;
create policy "enfants_select" on public.enfants
  for select using (
    parent_id = auth.uid()
    or public.is_admin()
    or public.has_accepted_match(parent_id, auth.uid())
    or public.accueille_enfant(id)
  );

drop policy if exists "enfant_fiche_sante_select" on public.enfant_fiche_sante;
create policy "enfant_fiche_sante_select" on public.enfant_fiche_sante
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.enfants e
      where e.id = enfant_id and e.parent_id = auth.uid()
    )
    or exists (
      select 1 from public.enfants e
      where e.id = enfant_id and public.has_accepted_match(e.parent_id, auth.uid())
    )
    or public.accueille_enfant(enfant_id)
  );

drop policy if exists "enfant_profil_xtra_select" on public.enfant_profil_xtra;
create policy "enfant_profil_xtra_select" on public.enfant_profil_xtra
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.enfants e
      where e.id = enfant_id and e.parent_id = auth.uid()
    )
    or exists (
      select 1 from public.enfants e
      where e.id = enfant_id and public.has_accepted_match(e.parent_id, auth.uid())
    )
    or public.accueille_enfant(enfant_id)
  );
