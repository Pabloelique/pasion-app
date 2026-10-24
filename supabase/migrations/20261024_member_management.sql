-- PASIÓN APP | Gestión de miembros | 2026-10-24
-- Ejecutar en Supabase SQL Editor, después de las migraciones previas.
-- Los cambios de permisos se realizan en funciones SECURITY DEFINER;
-- no se otorgan permisos directos de UPDATE sobre profiles.

alter table public.profiles drop constraint if exists profiles_approval_status_check;
alter table public.profiles add constraint profiles_approval_status_check
  check (approval_status in ('pending','approved','rejected','suspended'));

create table if not exists public.member_audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id),
  target_id uuid not null references auth.users(id),
  action text not null,
  before_state jsonb not null,
  after_state jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.member_audit enable row level security;
revoke all on public.member_audit from anon, authenticated;

-- Solo se incluyen columnas necesarias: la lista no expone
-- justificaciones de faltas ni información de tesorería.
create or replace function public.member_directory()
returns table (
  id uuid, first_name text, last_name text, email text,
  musical_part_id bigint, musical_part text,
  role text, requested_role text, approval_status text, created_at timestamptz
)
language plpgsql security definer set search_path = ''
as $$
declare actor_role text;
begin
  select p.role into actor_role from public.profiles p
  where p.id = (select auth.uid()) and p.approval_status = 'approved';
  if actor_role is null or actor_role not in ('superadmin','directiva') then
    raise exception 'Acceso denegado' using errcode='42501';
  end if;
  return query
  select p.id,p.first_name,p.last_name,u.email::text,
         p.musical_part_id,mp.name,p.role,p.requested_role,p.approval_status,p.created_at
  from public.profiles p
  join auth.users u on u.id=p.id
  left join public.musical_parts mp on mp.id=p.musical_part_id
  where (actor_role='superadmin' or p.role not in ('directiva','superadmin')
    and p.requested_role <> 'directiva')
  order by p.created_at desc;
end;
$$;

create or replace function public.manage_member(
  target_user uuid, operation text, new_value text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  actor_role text;
  member public.profiles%rowtype;
  old_state jsonb;
  next_state jsonb;
begin
  select p.role into actor_role from public.profiles p
  where p.id=actor and p.approval_status='approved';

  if actor_role is null or actor_role not in ('superadmin','directiva') then
    raise exception 'No autorizado' using errcode='42501';
  end if;
  if target_user is null or target_user=actor then
    raise exception 'No puedes cambiar tu propia cuenta mediante esta función' using errcode='42501';
  end if;

  select * into member from public.profiles p where p.id=target_user for update;
  if not found then raise exception 'Miembro inexistente'; end if;
  if member.role='superadmin' then raise exception 'La cuenta superadmin está protegida' using errcode='42501'; end if;
  if actor_role <> 'superadmin' and (member.role='directiva' or member.requested_role='directiva') then
    raise exception 'Gestión reservada al superadmin' using errcode='42501';
  end if;

  old_state := jsonb_build_object('role',member.role,'status',member.approval_status,'musical_part_id',member.musical_part_id);

  if operation='reactivate' then
    if member.approval_status not in ('rejected','suspended') then raise exception 'Solo se pueden reactivar cuentas rechazadas o suspendidas'; end if;
    -- Las cuentas rechazadas vuelven a solicitar aprobación.
    -- Las suspendidas se restablecen a aprobadas.
    update public.profiles set approval_status=case when member.approval_status='rejected' then 'pending' else 'approved' end
      where id=target_user;
  elsif operation='suspend' then
    if member.approval_status <> 'approved' then raise exception 'Solo se pueden suspender cuentas aprobadas'; end if;
    update public.profiles set approval_status='suspended' where id=target_user;
  elsif operation='assign_part' then
    if new_value is null or not exists (
      select 1 from public.musical_parts mp where mp.id::text=new_value
    ) then raise exception 'Hilo musical no válido'; end if;
    update public.profiles set musical_part_id=new_value::bigint where id=target_user;
  elsif operation='promote' then
    if actor_role <> 'superadmin' then raise exception 'Solo superadmin puede nombrar directivos' using errcode='42501'; end if;
    if member.approval_status <> 'approved' or member.role <> 'musico' then raise exception 'Solo se puede ascender a músicos aprobados'; end if;
    update public.profiles set role='directiva' where id=target_user;
  elsif operation='demote' then
    if actor_role <> 'superadmin' then raise exception 'Solo superadmin puede retirar directivos' using errcode='42501'; end if;
    if member.role <> 'directiva' then raise exception 'El usuario no es directivo'; end if;
    update public.profiles set role='musico',requested_role='musico' where id=target_user;
  else
    raise exception 'Operación no permitida';
  end if;

  select jsonb_build_object('role',p.role,'status',p.approval_status,'musical_part_id',p.musical_part_id)
    into next_state from public.profiles p where p.id=target_user;
  insert into public.member_audit(actor_id,target_id,action,before_state,after_state)
    values (actor,target_user,operation,old_state,next_state);
end;
$$;

create or replace function public.member_audit_history(target_user uuid)
returns table (action text, created_at timestamptz, actor_name text, before_state jsonb, after_state jsonb)
language plpgsql security definer set search_path = ''
as $$
declare actor_role text;
begin
 select p.role into actor_role from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved';
 if actor_role <> 'superadmin' then raise exception 'Solo superadmin puede consultar la auditoría' using errcode='42501'; end if;
 return query
 select a.action,a.created_at,trim(p.first_name||' '||p.last_name),a.before_state,a.after_state
 from public.member_audit a
 join public.profiles p on p.id=a.actor_id
 where a.target_id=target_user order by a.created_at desc limit 100;
end;
$$;

revoke all on function public.member_directory() from public,anon;
revoke all on function public.manage_member(uuid,text,text) from public,anon;
revoke all on function public.member_audit_history(uuid) from public,anon;
grant execute on function public.member_directory() to authenticated;
grant execute on function public.manage_member(uuid,text,text) to authenticated;
grant execute on function public.member_audit_history(uuid) to authenticated;
