-- Liams — fonction utilitaire pour les notifications email (4.11)
-- Retourne l'email d'un utilisateur UNIQUEMENT si l'appelant a une relation légitime
-- avec lui (mise en relation ou réseau existant, ou lui-même, ou l'admin) — évite
-- qu'un email arbitraire d'utilisateur puisse être récupéré par énumération d'UUID.

create or replace function public.get_email_for_notification(p_user_id uuid)
returns text
language sql stable
security definer set search_path = public
as $$
  select email from public.users
  where id = p_user_id
  and (
    p_user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.matches
      where (parent_id = auth.uid() and professional_id = p_user_id)
         or (professional_id = auth.uid() and parent_id = p_user_id)
    )
    or exists (
      select 1 from public.parent_networks
      where (parent_id = auth.uid() and professional_id = p_user_id)
         or (professional_id = auth.uid() and parent_id = p_user_id)
    )
  );
$$;
