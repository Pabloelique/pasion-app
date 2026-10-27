-- PASIÓN APP · Ensayos por hilos musicales (sin modificar eventos existentes).
-- Ejecutar después del calendario, notificaciones y asistencias.
-- Sin destinatarios = toda la banda; con destinatarios = solo los hilos elegidos
-- Directiva/superadmin pueden gestionar y consultar todos.

create table if not exists public.event_target_parts (
 event_id uuid not null references public.band_events(id) on delete cascade,
 part_id bigint not null references public.musical_parts(id) on delete restrict,
 primary key(event_id,part_id)
);
create index if not exists event_target_parts_part_idx on public.event_target_parts(part_id,event_id);
alter table public.event_target_parts enable row level security;
revoke all on public.event_target_parts from anon,authenticated;
grant select on public.event_target_parts to authenticated;

create or replace function public.can_see_band_event(target_id uuid)
returns boolean language sql stable security definer set search_path=''
as $event_visibility$
 select exists (
  select 1 from public.profiles p
  where p.id=(select auth.uid()) and p.approval_status='approved'
    and (
      p.role in ('directiva','superadmin')
      or not exists(select 1 from public.event_target_parts tp where tp.event_id=target_id)
      or exists(select 1 from public.event_target_parts tp
         where tp.event_id=target_id and tp.part_id=p.musical_part_id)
    )
 );
$event_visibility$;
revoke all on function public.can_see_band_event(uuid) from public,anon;
grant execute on function public.can_see_band_event(uuid) to authenticated;

drop policy if exists "Approved members read events" on public.band_events;
create policy "Approved members read events" on public.band_events
for select to authenticated using (public.can_see_band_event(id));

drop policy if exists "Approved members read event target parts" on public.event_target_parts;
create policy "Approved members read event target parts" on public.event_target_parts
for select to authenticated using (public.can_see_band_event(event_id));

-- Los participantes solo pueden responder a eventos que pueden ver.
drop policy if exists "Members see only their own event responses" on public.event_responses;
create policy "Members see only their own event responses" on public.event_responses
for select to authenticated using (
 user_id=(select auth.uid()) and public.can_see_band_event(event_id)
);
drop policy if exists "Approved members answer events" on public.event_responses;
create policy "Approved members answer events" on public.event_responses
for insert to authenticated with check (
 user_id=(select auth.uid()) and public.can_see_band_event(event_id)
);
drop policy if exists "Approved members revise own responses" on public.event_responses;
create policy "Approved members revise own responses" on public.event_responses
for update to authenticated
using (user_id=(select auth.uid()) and public.can_see_band_event(event_id))
with check (user_id=(select auth.uid()) and public.can_see_band_event(event_id));

-- Los ensayos y sus partituras de trabajo también respetan los destinatarios.
drop policy if exists "Approved members see rehearsal repertoire" on public.rehearsal_pieces;
create policy "Approved members see rehearsal repertoire" on public.rehearsal_pieces
for select to authenticated using (
 public.can_see_band_event(event_id)
 and exists(select 1 from public.band_events e where e.id=event_id and e.event_type='ensayo')
);

-- Creación atómica: el evento y sus destinatarios quedan guardados juntos.
-- No se crean notificaciones globales antes de definir los hilos.
create or replace function public.create_targeted_band_event(
 p_title text, p_event_type text, p_description text, p_location text,
 p_starts_at timestamptz, p_ends_at timestamptz, p_part_ids bigint[] default '{}'
) returns uuid
language plpgsql security definer set search_path='' as $create_target_event$
declare event_id uuid;
declare assigned bigint[];
begin
 if not exists(select 1 from public.profiles p where p.id=auth.uid()
   and p.approval_status='approved' and p.role in ('directiva','superadmin'))
 then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if char_length(btrim(coalesce(p_title,''))) not between 3 and 160
    or p_event_type not in ('ensayo','actuacion','reunion','otro')
    or p_starts_at is null or p_ends_at is null or p_ends_at<=p_starts_at
 then raise exception 'Datos del evento no válidos'; end if;
 if p_event_type<>'ensayo' and cardinality(coalesce(p_part_ids,'{}'::bigint[]))>0
 then raise exception 'Los destinatarios por hilo solo se permiten en ensayos'; end if;
 select coalesce(array_agg(distinct v), '{}'::bigint[]) into assigned
 from unnest(coalesce(p_part_ids,'{}'::bigint[])) as v;
 if exists(select 1 from unnest(assigned) v
   where not exists(select 1 from public.musical_parts mp where mp.id=v))
 then raise exception 'Hay un hilo musical que no existe'; end if;
 insert into public.band_events(title,event_type,description,location,starts_at,ends_at,created_by)
 values(btrim(p_title),p_event_type,coalesce(p_description,''),coalesce(p_location,''),
   p_starts_at,p_ends_at,auth.uid()) returning id into event_id;
 insert into public.event_target_parts(event_id,part_id)
 select event_id,unnest(assigned);
 insert into public.app_notifications(user_id,kind,source_id,title,message,destination)
 select p.id,
   case when p_event_type='ensayo' then 'ensayo'
        when p_event_type='actuacion' then 'actuacion' else 'evento' end,
   event_id,
   case when p_event_type='ensayo' then 'Nuevo ensayo'
        when p_event_type='actuacion' then 'Nueva actuación' else 'Nueva actividad' end,
   left(btrim(p_title),160),'/panel/calendario'
 from public.profiles p
 where p.approval_status='approved' and p.id<>auth.uid()
 and (cardinality(assigned)=0 or p.role in ('directiva','superadmin')
      or p.musical_part_id=any(assigned))
 on conflict(user_id,kind,source_id) do nothing;
 return event_id;
end $create_target_event$;
revoke all on function public.create_targeted_band_event(text,text,text,text,timestamptz,timestamptz,bigint[]) from public,anon;
grant execute on function public.create_targeted_band_event(text,text,text,text,timestamptz,timestamptz,bigint[]) to authenticated;

-- Evitar las notificaciones generales del trigger antiguo.
drop trigger if exists notifications_on_band_event on public.band_events;
-- La creación directa deja de estar disponible: usar siempre la RPC atómica.
revoke insert on public.band_events from authenticated;

-- No pasar lista a alguien que no estaba convocado (salvo managers, que ven todo).
create or replace function public.attendance_roster(target_event uuid)
returns table (
 member_id uuid, member_name text, part_name text,
 response text, justification text, attendance text, note text
)
language plpgsql security definer set search_path=''
as $targeted_roster$
begin
 if not exists(select 1 from public.profiles p where p.id=auth.uid()
   and p.approval_status='approved' and p.role in ('directiva','superadmin'))
 then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if not exists(select 1 from public.band_events e where e.id=target_event)
 then raise exception 'Evento inexistente'; end if;
 return query
 select p.id,trim(concat_ws(' ',p.first_name,p.last_name)),coalesce(mp.name,'Sin hilo'),
        er.response,er.justification,am.status,am.note
 from public.profiles p
 left join public.musical_parts mp on mp.id=p.musical_part_id
 left join public.event_responses er on er.event_id=target_event and er.user_id=p.id
 left join public.attendance_marks am on am.event_id=target_event and am.user_id=p.id
 where p.approval_status='approved' and p.role in ('musico','directiva')
 and (not exists(select 1 from public.event_target_parts t where t.event_id=target_event)
      or p.role='directiva'
      or exists(select 1 from public.event_target_parts t
        where t.event_id=target_event and t.part_id=p.musical_part_id))
 order by mp.name,p.last_name,p.first_name;
end $targeted_roster$;

create or replace function public.record_attendance(
 target_event uuid,target_member uuid,attendance_status text,manager_note text default null
) returns void language plpgsql security definer set search_path=''
as $targeted_record$
begin
 if not exists(select 1 from public.profiles p where p.id=auth.uid()
    and p.approval_status='approved' and p.role in ('directiva','superadmin'))
 then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if attendance_status not in ('presente','ausente','justificada')
 then raise exception 'Estado no válido'; end if;
 if char_length(coalesce(manager_note,''))>1000
 then raise exception 'La nota supera 1000 caracteres'; end if;
 if not exists(select 1 from public.band_events e where e.id=target_event)
 then raise exception 'Evento inexistente'; end if;
 if not exists(select 1 from public.profiles p where p.id=target_member
    and p.approval_status='approved' and p.role in ('musico','directiva')
    and (p.role='directiva'
      or not exists(select 1 from public.event_target_parts t where t.event_id=target_event)
      or exists(select 1 from public.event_target_parts t
         where t.event_id=target_event and t.part_id=p.musical_part_id)))
 then raise exception 'Este músico no pertenece al ensayo'; end if;
 insert into public.attendance_marks(event_id,user_id,status,note,marked_by)
 values(target_event,target_member,attendance_status,nullif(btrim(manager_note),''),auth.uid())
 on conflict(event_id,user_id) do update set
 status=excluded.status,note=excluded.note,marked_by=excluded.marked_by,marked_at=now();
end $targeted_record$;

notify pgrst,'reload schema';
