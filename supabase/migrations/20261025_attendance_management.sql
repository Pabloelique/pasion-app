-- PASIÓN APP: attendance register
create table if not exists public.attendance_marks (
 event_id uuid not null references public.band_events(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 status text not null check(status in ('presente','ausente','justificada')),
 note text,
 marked_by uuid not null references auth.users(id),
 marked_at timestamptz not null default now(),
 primary key (event_id,user_id)
);
alter table public.attendance_marks enable row level security;
revoke all on public.attendance_marks from anon,authenticated;

-- Only approved managers may call these SECURITY DEFINER functions.
create or replace function public.attendance_roster(target_event uuid)
returns table (
 member_id uuid, member_name text, part_name text,
 response text, justification text, attendance text, note text
)
language plpgsql security definer set search_path=''
as $$
begin
 if not exists (
  select 1 from public.profiles p
  where p.id=auth.uid() and p.approval_status='approved'
    and p.role in ('directiva','superadmin')
 ) then raise exception 'Acceso denegado'; end if;
 if not exists (select 1 from public.band_events e where e.id=target_event)
 then raise exception 'Evento inexistente'; end if;
 return query
 select p.id,trim(concat_ws(' ',p.first_name,p.last_name)),
        coalesce(mp.name,'Sin hilo'),
        er.response,er.justification,am.status,am.note
 from public.profiles p
 left join public.musical_parts mp on mp.id=p.musical_part_id
 left join public.event_responses er on er.event_id=target_event and er.user_id=p.id
 left join public.attendance_marks am on am.event_id=target_event and am.user_id=p.id
 where p.approval_status='approved'
   and p.role in ('musico','directiva')
 order by mp.name,p.last_name,p.first_name;
end $$;

create or replace function public.record_attendance(
 target_event uuid, target_member uuid, attendance_status text, manager_note text default null
) returns void language plpgsql security definer set search_path=''
as $$
begin
 if not exists (
  select 1 from public.profiles p
  where p.id=auth.uid() and p.approval_status='approved'
    and p.role in ('directiva','superadmin')
 ) then raise exception 'Acceso denegado'; end if;
 if attendance_status not in ('presente','ausente','justificada')
 then raise exception 'Estado no válido'; end if;
 if length(coalesce(manager_note,''))>1000
 then raise exception 'La nota supera 1000 caracteres'; end if;
 if not exists (select 1 from public.band_events e where e.id=target_event)
 then raise exception 'Evento inexistente'; end if;
 if not exists (
  select 1 from public.profiles p
  where p.id=target_member and p.approval_status='approved'
   and p.role in ('musico','directiva')
 ) then raise exception 'Miembro no válido'; end if;
 insert into public.attendance_marks(event_id,user_id,status,note,marked_by)
 values (target_event,target_member,attendance_status,nullif(btrim(manager_note),''),auth.uid())
 on conflict(event_id,user_id) do update
 set status=excluded.status,note=excluded.note,marked_by=excluded.marked_by,marked_at=now();
end $$;

create or replace function public.attendance_summary()
returns table (
 member_id uuid, member_name text, part_name text,
 attended bigint, absent bigint, justified bigint
) language plpgsql security definer set search_path=''
as $$
begin
 if not exists (
  select 1 from public.profiles p where p.id=auth.uid()
  and p.approval_status='approved' and p.role in ('directiva','superadmin')
 ) then raise exception 'Acceso denegado'; end if;
 return query
 select p.id,trim(concat_ws(' ',p.first_name,p.last_name)),coalesce(mp.name,'Sin hilo'),
 count(*) filter(where m.status='presente'),
 count(*) filter(where m.status='ausente'),
 count(*) filter(where m.status='justificada')
 from public.profiles p
 left join public.musical_parts mp on mp.id=p.musical_part_id
 left join public.attendance_marks m on m.user_id=p.id
 where p.approval_status='approved' and p.role in ('musico','directiva')
 group by p.id,p.first_name,p.last_name,mp.name
 order by p.last_name,p.first_name;
end $$;

revoke all on function public.attendance_roster(uuid) from public,anon;
revoke all on function public.record_attendance(uuid,uuid,text,text) from public,anon;
revoke all on function public.attendance_summary() from public,anon;
grant execute on function public.attendance_roster(uuid) to authenticated;
grant execute on function public.record_attendance(uuid,uuid,text,text) to authenticated;
grant execute on function public.attendance_summary() to authenticated;
