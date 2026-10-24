-- PASIÓN APP: aprobación controlada de solicitudes
-- Ejecutar UNA VEZ desde SQL Editor, con usuario administrador.
-- No concede acceso directo a UPDATE sobre profiles.

create or replace function public.pending_registration_requests()
returns table (
  id uuid,
  first_name text,
  last_name text,
  email text,
  requested_role text,
  musical_part text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
begin
  select p.role into actor_role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.approval_status = 'approved';

  if actor_role is null or actor_role not in ('directiva', 'superadmin') then
    raise exception 'No tienes permiso para consultar solicitudes' using errcode = '42501';
  end if;

  return query
  select p.id, p.first_name, p.last_name, u.email::text,
         p.requested_role, mp.name as musical_part, p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.musical_parts mp on mp.id = p.musical_part_id
  where p.approval_status = 'pending'
    and (actor_role = 'superadmin' or p.requested_role = 'musico')
  order by p.created_at asc;
end;
$$;

create or replace function public.decide_registration(
  target_user uuid,
  decision text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
  requested text;
begin
  select p.role into actor_role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.approval_status = 'approved';

  if actor_role not in ('directiva', 'superadmin') or actor_role is null then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  if decision not in ('approved', 'rejected') or decision is null then
    raise exception 'Decisión no válida';
  end if;

  select p.requested_role into requested
  from public.profiles p
  where p.id = target_user and p.approval_status = 'pending'
  for update;

  if requested is null then
    raise exception 'La solicitud no existe o ya ha sido resuelta';
  end if;

  if requested = 'directiva' and actor_role <> 'superadmin' then
    raise exception 'Solo el superadmin puede aprobar o rechazar directiva'
      using errcode = '42501';
  end if;

  update public.profiles p
  set approval_status = decision,
      role = case when decision = 'approved' then requested else 'musico' end,
      approved_by = case when decision = 'approved' then (select auth.uid()) else null end,
      approved_at = case when decision = 'approved' then now() else null end
  where p.id = target_user and p.approval_status = 'pending';

  if not found then
    raise exception 'La solicitud ya fue resuelta';
  end if;
end;
$$;

revoke all on function public.pending_registration_requests() from public, anon;
revoke all on function public.decide_registration(uuid, text) from public, anon;
grant execute on function public.pending_registration_requests() to authenticated;
grant execute on function public.decide_registration(uuid, text) to authenticated;
