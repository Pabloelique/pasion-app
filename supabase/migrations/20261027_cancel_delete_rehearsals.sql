-- PASIÓN APP | Borrar y cancelar ensayos. Ejecutar tras 20261027_rehearsal_part_groups.sql.
alter table public.band_events add column if not exists cancelled_at timestamptz;

create or replace function public.manage_rehearsal(p_event_id uuid,p_action text)
returns void language plpgsql security definer set search_path='' as $manage$
declare ev public.band_events%rowtype;
begin
 if not exists(select 1 from public.profiles p where p.id=auth.uid()
  and p.approval_status='approved' and p.role in ('directiva','superadmin'))
 then raise exception 'Solo la directiva puede gestionar ensayos' using errcode='42501'; end if;
 if p_action not in ('cancel','restore','delete') then raise exception 'Acción no válida'; end if;
 select * into ev from public.band_events where id=p_event_id and event_type='ensayo' for update;
 if not found then raise exception 'Ensayo inexistente'; end if;
 if p_action='delete' then
   delete from public.app_notifications where source_id=p_event_id and kind='ensayo';
   delete from public.band_events where id=p_event_id;
 elsif p_action='cancel' and ev.cancelled_at is null then
   update public.band_events set cancelled_at=now() where id=p_event_id;
   -- Ningún músico acumula una falta por un ensayo cancelado.
   delete from public.attendance_marks where event_id=p_event_id;
   delete from public.event_responses where event_id=p_event_id;
 elsif p_action='restore' and ev.cancelled_at is not null then
   update public.band_events set cancelled_at=null where id=p_event_id;
 end if;
 if p_action in ('cancel','restore') then
   insert into public.app_notifications(user_id,kind,source_id,title,message,destination)
   select p.id,'ensayo',p_event_id,
    case when p_action='cancel' then 'Ensayo cancelado' else 'Ensayo reactivado' end,
    left(ev.title,160),'/panel/calendario'
   from public.profiles p
   where p.approval_status='approved'
    and (not exists(select 1 from public.event_target_parts t where t.event_id=p_event_id)
      or exists(select 1 from public.event_target_parts t where t.event_id=p_event_id and t.part_id=p.musical_part_id)
      or p.role in ('directiva','superadmin'))
   on conflict(user_id,kind,source_id) do update set
    title=excluded.title,message=excluded.message,read_at=null,created_at=now();
 end if;
end $manage$;
revoke all on function public.manage_rehearsal(uuid,text) from public,anon;
grant execute on function public.manage_rehearsal(uuid,text) to authenticated;

-- Solo los convocados pueden responder y nunca si se cancela.
drop policy if exists "Approved members answer events" on public.event_responses;
create policy "Approved members answer events" on public.event_responses
for insert to authenticated with check(
 user_id=(select auth.uid()) and public.can_see_band_event(event_id)
 and exists(select 1 from public.band_events e where e.id=event_id and e.cancelled_at is null)
);
drop policy if exists "Approved members revise own responses" on public.event_responses;
create policy "Approved members revise own responses" on public.event_responses
for update to authenticated
using(user_id=(select auth.uid()) and public.can_see_band_event(event_id))
with check(
 user_id=(select auth.uid()) and public.can_see_band_event(event_id)
 and exists(select 1 from public.band_events e where e.id=event_id and e.cancelled_at is null)
);

-- Pasar lista SOLO a músicos del hilo convocado, incluso si son de directiva.
create or replace function public.attendance_roster(target_event uuid)
returns table(member_id uuid,member_name text,part_name text,response text,
 justification text,attendance text,note text)
language plpgsql security definer set search_path='' as $roster$
begin
 if not exists(select 1 from public.profiles p where p.id=auth.uid()
 and p.approval_status='approved' and p.role in ('directiva','superadmin'))
 then raise exception 'Acceso denegado'; end if;
 if not exists(select 1 from public.band_events e where e.id=target_event and e.cancelled_at is null)
 then raise exception 'Evento cancelado o inexistente'; end if;
 return query select p.id,trim(concat_ws(' ',p.first_name,p.last_name)),
  coalesce(mp.name,'Sin hilo'),er.response,er.justification,am.status,am.note
 from public.profiles p
 left join public.musical_parts mp on mp.id=p.musical_part_id
 left join public.event_responses er on er.event_id=target_event and er.user_id=p.id
 left join public.attendance_marks am on am.event_id=target_event and am.user_id=p.id
 where p.approval_status='approved' and p.role in ('musico','directiva')
  and (not exists(select 1 from public.event_target_parts t where t.event_id=target_event)
   or exists(select 1 from public.event_target_parts t
      where t.event_id=target_event and t.part_id=p.musical_part_id))
 order by mp.name,p.last_name,p.first_name;
end $roster$;

create or replace function public.record_attendance(
 target_event uuid,target_member uuid,attendance_status text,manager_note text default null)
returns void language plpgsql security definer set search_path='' as $mark$
begin
 if not exists(select 1 from public.profiles p where p.id=auth.uid()
 and p.approval_status='approved' and p.role in ('directiva','superadmin'))
 then raise exception 'Acceso denegado'; end if;
 if attendance_status not in ('presente','ausente','justificada') then raise exception 'Estado no válido'; end if;
 if length(coalesce(manager_note,''))>1000 then raise exception 'Nota demasiado larga'; end if;
 if not exists(select 1 from public.band_events e where e.id=target_event and e.cancelled_at is null)
 then raise exception 'Evento cancelado o inexistente'; end if;
 if not exists(select 1 from public.profiles p where p.id=target_member
 and p.approval_status='approved' and p.role in ('musico','directiva')
 and (not exists(select 1 from public.event_target_parts t where t.event_id=target_event)
  or exists(select 1 from public.event_target_parts t
    where t.event_id=target_event and t.part_id=p.musical_part_id)))
 then raise exception 'Músico no convocado'; end if;
 insert into public.attendance_marks(event_id,user_id,status,note,marked_by)
 values(target_event,target_member,attendance_status,nullif(btrim(manager_note),''),auth.uid())
 on conflict(event_id,user_id) do update set
  status=excluded.status,note=excluded.note,marked_by=excluded.marked_by,marked_at=now();
end $mark$;
notify pgrst,'reload schema';
