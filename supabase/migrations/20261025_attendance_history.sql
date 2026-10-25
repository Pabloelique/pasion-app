-- PASIÓN APP · Historial de asistencia y auditoría de correcciones.
-- Ejecutar DESPUÉS de 20261025_attendance_management.sql.
-- No borra ni modifica los registros de asistencia existentes.
create table if not exists public.attendance_changes (
 id bigint generated always as identity primary key,
 event_id uuid not null references public.band_events(id) on delete cascade,
 member_id uuid not null references auth.users(id),
 actor_id uuid not null references auth.users(id),
 old_status text,
 new_status text not null,
 old_note text,
 new_note text,
 changed_at timestamptz not null default now()
);
create index if not exists attendance_changes_event_idx on public.attendance_changes(event_id,changed_at desc);
create index if not exists attendance_changes_member_idx on public.attendance_changes(member_id,changed_at desc);
alter table public.attendance_changes enable row level security;
revoke all on public.attendance_changes from anon,authenticated;

-- Trigger de auditoría: se ejecuta con permisos de propietario, no del cliente.
create or replace function public.capture_attendance_change()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
   insert into public.attendance_changes
    (event_id,member_id,actor_id,old_status,new_status,old_note,new_note)
   values (new.event_id,new.user_id,new.marked_by,null,new.status,null,new.note);
 elsif old.status is distinct from new.status or old.note is distinct from new.note then
   insert into public.attendance_changes
    (event_id,member_id,actor_id,old_status,new_status,old_note,new_note)
   values (new.event_id,new.user_id,new.marked_by,old.status,new.status,old.note,new.note);
 end if;
 return new;
end $$;
drop trigger if exists attendance_change_audit_trigger on public.attendance_marks;
create trigger attendance_change_audit_trigger
 after insert or update on public.attendance_marks
 for each row execute function public.capture_attendance_change();

-- El músico ve exclusivamente su propio historial, sin notas internas.
create or replace function public.my_attendance_history()
returns table (
 event_id uuid,event_title text, event_starts_at timestamptz,
 attendance_status text,marked_at timestamptz
) language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.profiles p where p.id=auth.uid()
 and p.approval_status='approved')
 then raise exception 'Acceso denegado' using errcode='42501'; end if;
 return query
 select e.id,e.title,e.starts_at,m.status,m.marked_at
 from public.attendance_marks m join public.band_events e on e.id=m.event_id
 where m.user_id=auth.uid()
 order by e.starts_at desc;
end $$;

-- La directiva ve el historial de cambios solo para un evento concreto.
create or replace function public.attendance_event_audit(target_event uuid)
returns table (
 audit_id bigint, member_name text,actor_name text,
 previous_status text,current_status text,
 previous_note text,current_note text,changed_at timestamptz
) language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.profiles p where p.id=auth.uid()
 and p.approval_status='approved' and p.role in ('directiva','superadmin'))
 then raise exception 'Acceso denegado' using errcode='42501'; end if;
 return query
 select c.id,trim(concat_ws(' ',member.first_name,member.last_name)),
 trim(concat_ws(' ',actor.first_name,actor.last_name)),
 c.old_status,c.new_status,c.old_note,c.new_note,c.changed_at
 from public.attendance_changes c
 join public.profiles member on member.id=c.member_id
 join public.profiles actor on actor.id=c.actor_id
 where c.event_id=target_event
 order by c.changed_at desc limit 300;
end $$;
revoke all on function public.capture_attendance_change() from public,anon,authenticated;
revoke all on function public.my_attendance_history() from public,anon,authenticated;
revoke all on function public.attendance_event_audit(uuid) from public,anon,authenticated;
grant execute on function public.my_attendance_history() to authenticated;
grant execute on function public.attendance_event_audit(uuid) to authenticated;
notify pgrst,'reload schema';
