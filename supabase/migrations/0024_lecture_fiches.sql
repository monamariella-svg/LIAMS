-- Liams — Le professionnel confirme avoir lu la fiche
--
-- Rendre la fiche consultable ne garantit pas qu'elle soit lue. Une
-- confirmation datée engage le professionnel et fait trace : en cas
-- d'incident, on saura si l'information avait été portée à sa connaissance,
-- et quand.
--
-- La date compte autant que la confirmation : une fiche modifiée après la
-- lecture n'a pas été lue. L'application compare donc `lu_le` à la date de
-- mise à jour de la fiche et redemande confirmation quand la famille change
-- quelque chose — une allergie ajoutée hier ne doit pas se cacher derrière une
-- case cochée le mois dernier.

create table public.lectures_fiches (
  professional_id uuid not null references public.users (id) on delete cascade,
  enfant_id uuid not null references public.enfants (id) on delete cascade,
  lu_le timestamptz not null default now(),
  primary key (professional_id, enfant_id)
);

alter table public.lectures_fiches enable row level security;

-- Le professionnel voit et pose ses propres confirmations. Le parent voit
-- celles qui concernent ses enfants : savoir que la personne qui gardera son
-- enfant a lu sa fiche vaut mieux que l'espérer. L'admin voit tout, ce qui
-- sera nécessaire le jour où un incident sera examiné.
create policy "lectures_fiches_select" on public.lectures_fiches
  for select using (
    professional_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.enfants e
      where e.id = enfant_id and e.parent_id = auth.uid()
    )
  );

-- Nul ne confirme à la place d'un autre, et seulement pour un enfant qu'il
-- accueille réellement.
create policy "lectures_fiches_write" on public.lectures_fiches
  for all using (professional_id = auth.uid())
  with check (
    professional_id = auth.uid()
    and public.accueille_enfant(enfant_id)
  );
