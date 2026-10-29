-- Absence reasons are readable only by approved superadmins and the named reviewer.
begin;
create or replace function public.can_review_absences()
returns boolean language sql stable security definer set search_path='' as $access$
 select exists(select 1 from public.profiles p where p.id=auth.uid() and p.approval_status='approved'
 and (p.role='superadmin' or (p.id='1fa6b0f6-448c-440a-8658-2fcf4c8553cc'::uuid and p.role<>'viewer')));
$access$;
revoke all on function public.can_review_absences() from public,anon;
grant execute on function public.can_review_absences() to authenticated;
alter table public.event_responses add column id uuid not null default gen_random_uuid();
alter table public.event_responses add constraint event_responses_id_key unique(id);
revoke select,insert,update on public.event_responses from authenticated;
grant select(id,event_id,user_id,response,updated_at) on public.event_responses to authenticated;

create or replace function public.submit_event_response(target_event uuid,answer text,reason text default null)
returns void language plpgsql security definer set search_path='' as $submit$
begin
 if not public.can_see_band_event(target_event) or not exists(select 1 from public.profiles p
 where p.id=auth.uid() and p.approval_status='approved' and p.role<>'viewer')
 then raise exception 'Acceso denegado' using errcode='42501';end if;
 if not exists(select 1 from public.band_events e where e.id=target_event and e.cancelled_at is null)
 then raise exception 'Evento cancelado o inexistente';end if;
 if answer is null or answer not in ('asistire','no_asistire') then raise exception 'Respuesta no válida';end if;
 if answer='no_asistire' and (char_length(btrim(coalesce(reason,'')))<5 or char_length(coalesce(reason,''))>2000)
 then raise exception 'Escribe una justificación de entre 5 y 2000 caracteres';end if;
 insert into public.event_responses(event_id,user_id,response,justification)
 values(target_event,auth.uid(),answer,case when answer='no_asistire' then btrim(reason) else null end)
 on conflict(event_id,user_id) do update set response=excluded.response,justification=excluded.justification,updated_at=clock_timestamp();
end $submit$;
revoke all on function public.submit_event_response(uuid,text,text) from public,anon;
grant execute on function public.submit_event_response(uuid,text,text) to authenticated;

create or replace function public.my_event_responses()
returns table(event_id uuid,response text,justification text)
language plpgsql security definer set search_path='' as $mine$
begin
 if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.approval_status='approved')
 then raise exception 'Acceso denegado' using errcode='42501';end if;
 return query select r.event_id,r.response,
 case when public.can_review_absences() then r.justification else null::text end
 from public.event_responses r where r.user_id=auth.uid() and public.can_see_band_event(r.event_id);
end $mine$;
revoke all on function public.my_event_responses() from public,anon;
grant execute on function public.my_event_responses() to authenticated;

create table public.absence_notice_sources (
 id uuid primary key,
 response_id uuid not null references public.event_responses(id) on delete cascade
);
create index absence_notice_sources_response_idx on public.absence_notice_sources(response_id);
alter table public.absence_notice_sources enable row level security;
revoke all on public.absence_notice_sources from public,anon,authenticated;

create or replace function public.private_absence_reports(target_response uuid default null)
returns table(report_id uuid,event_id uuid,event_title text,event_starts_at timestamptz,
 member_name text,justification text,response text,updated_at timestamptz)
language plpgsql security definer set search_path='' as $reports$
begin
 if not public.can_review_absences() then raise exception 'Acceso denegado' using errcode='42501';end if;
 return query select coalesce(target_response,r.id),e.id,e.title,e.starts_at,
 trim(concat_ws(' ',p.first_name,p.last_name)),r.justification,r.response,r.updated_at
 from public.event_responses r join public.band_events e on e.id=r.event_id
 join public.profiles p on p.id=r.user_id
 where (target_response is not null and (r.id=target_response or exists(select 1 from public.absence_notice_sources s where s.id=target_response and s.response_id=r.id)))
 or (target_response is null and r.response='no_asistire' and e.cancelled_at is null)
 order by r.updated_at desc limit 500;
end $reports$;
revoke all on function public.private_absence_reports(uuid) from public,anon;
grant execute on function public.private_absence_reports(uuid) to authenticated;
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
  coalesce(mp.name,'Sin hilo'),er.response,case when public.can_review_absences() then er.justification else null::text end,am.status,am.note
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


alter table public.app_notifications drop constraint app_notifications_kind_check;
alter table public.app_notifications add constraint app_notifications_kind_check
 check(kind in ('ensayo','actuacion','evento','comunicado','votacion','ausencia'));
alter table public.app_notifications drop constraint app_notifications_destination_check;
alter table public.app_notifications add constraint app_notifications_destination_check
 check(destination in ('/panel/calendario','/panel/tablon','/panel/votaciones','/panel/justificaciones'));
create policy absence_notifications_private on public.app_notifications as restrictive for all to authenticated
 using(kind<>'ausencia' or public.can_review_absences()) with check(kind<>'ausencia' or public.can_review_absences());

create or replace function public.notify_absence_response()
returns trigger language plpgsql security definer set search_path='' as $notify$
declare who text; event_name text; event_date text; notice_source uuid:=gen_random_uuid(); revision_time timestamptz:=clock_timestamp();
begin
 if tg_op='UPDATE' then
  if new.response is not distinct from old.response and new.justification is not distinct from old.justification
  then return new;end if;
 elsif new.response<>'no_asistire' then return new;
 end if;
 select trim(concat_ws(' ',p.first_name,p.last_name)) into who from public.profiles p where p.id=new.user_id;
 select e.title,to_char(e.starts_at at time zone 'Europe/Madrid','DD/MM/YYYY HH24:MI')
 into event_name,event_date from public.band_events e where e.id=new.event_id;
 insert into public.absence_notice_sources(id,response_id) values(notice_source,new.id);
 -- Append revisions. Existing notification content remains immutable.
 insert into public.app_notifications(user_id,kind,source_id,title,message,destination,created_at)
 select p.id,'ausencia',notice_source,
 case when new.response='no_asistire' then 'Aviso de ausencia' else 'Ausencia retirada' end,
 left(case when new.response='no_asistire' then
  coalesce(who,'Miembro')||' · '||event_name||' · '||event_date||E'\nJustificación: '||coalesce(new.justification,'')
 else coalesce(who,'Miembro')||' ha cambiado su respuesta a «Asistiré» · '||event_name end,500),
 '/panel/justificaciones',revision_time
 from public.profiles p where p.approval_status='approved'
 and (p.role='superadmin' or (p.id='1fa6b0f6-448c-440a-8658-2fcf4c8553cc'::uuid and p.role<>'viewer'));
 return new;
end $notify$;
create trigger notifications_on_absence after insert or update on public.event_responses
 for each row execute function public.notify_absence_response();
revoke all on function public.notify_absence_response() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
