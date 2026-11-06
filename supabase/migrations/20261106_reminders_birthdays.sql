-- PASIÓN APP · Recordatorios automáticos de ensayo y cumpleaños en el tablón.
-- Requiere: 20261026_internal_notifications.sql, 20261025_bulletin_board.sql,
-- 20261027_rehearsal_part_groups.sql y 20261027_cancel_delete_rehearsals.sql.

create extension if not exists pg_cron;

-- 1. Nuevos tipos de aviso -------------------------------------------------
alter table public.app_notifications drop constraint if exists app_notifications_kind_check;
alter table public.app_notifications add constraint app_notifications_kind_check check (kind in (
 'ensayo','actuacion','evento','comunicado','votacion','ausencia','aportacion',
 'recordatorio','recordatorio_2h','cumpleanos'));

-- 2. Recordatorios 24 h y 2 h antes ---------------------------------------
-- Solo para quien está convocado y no ha dicho que no asistirá.
create or replace function public.send_rehearsal_reminders()
returns integer language plpgsql security definer set search_path='' as $$
declare total integer:=0; added integer;
begin
 insert into public.app_notifications(user_id,kind,source_id,title,message,destination)
 select p.id,'recordatorio',e.id,
  left(case when (e.starts_at at time zone 'Europe/Madrid')::date=(now() at time zone 'Europe/Madrid')::date then 'Hoy' else 'Mañana' end
   ||case when r.response='asistire' then ': ' else ' · ¿Vienes? ' end||e.title,180),
  left(to_char(e.starts_at at time zone 'Europe/Madrid','HH24:MI')||' h'
   ||case when btrim(e.location)<>'' then ' · '||e.location else '' end
   ||case when r.response='asistire' then ' · Tienes confirmada tu asistencia.' else ' · Confirma si vas a asistir.' end,500),
  '/panel/calendario'
 from public.band_events e
 join public.profiles p on p.approval_status='approved' and p.role in ('musico','directiva','superadmin')
 left join public.event_responses r on r.event_id=e.id and r.user_id=p.id
 where e.cancelled_at is null and e.event_type in ('ensayo','actuacion')
  and e.starts_at>now()+interval '3 hours' and e.starts_at<=now()+interval '24 hours'
  and e.created_at<now()-interval '1 hour'
  -- Horario de silencio: el aviso del día anterior solo sale entre las 9:00 y las 22:00.
  and extract(hour from now() at time zone 'Europe/Madrid') between 9 and 21
  and (r.response is null or r.response='asistire')
  and (not exists(select 1 from public.event_target_parts t where t.event_id=e.id)
   or exists(select 1 from public.event_target_parts t where t.event_id=e.id and t.part_id=p.musical_part_id))
 on conflict(user_id,kind,source_id) do nothing;
 get diagnostics added=row_count; total:=total+added;

 insert into public.app_notifications(user_id,kind,source_id,title,message,destination)
 select p.id,'recordatorio_2h',e.id,
  left('En 2 horas: '||e.title,180),
  left(to_char(e.starts_at at time zone 'Europe/Madrid','HH24:MI')||' h'
   ||case when btrim(e.location)<>'' then ' · '||e.location else '' end
   ||case when r.response='asistire' then ' · ¡Te esperamos!' else ' · Aún no has confirmado tu asistencia.' end,500),
  '/panel/calendario'
 from public.band_events e
 join public.profiles p on p.approval_status='approved' and p.role in ('musico','directiva','superadmin')
 left join public.event_responses r on r.event_id=e.id and r.user_id=p.id
 where e.cancelled_at is null and e.event_type in ('ensayo','actuacion')
  and e.starts_at>now() and e.starts_at<=now()+interval '2 hours'
  and e.created_at<now()-interval '30 minutes'
  and (r.response is null or r.response='asistire')
  and (not exists(select 1 from public.event_target_parts t where t.event_id=e.id)
   or exists(select 1 from public.event_target_parts t where t.event_id=e.id and t.part_id=p.musical_part_id))
 on conflict(user_id,kind,source_id) do nothing;
 get diagnostics added=row_count; total:=total+added;
 return total;
end $$;

-- Al cancelar o eliminar un ensayo desaparecen también sus recordatorios pendientes.
create or replace function public.clear_cancelled_reminders()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.cancelled_at is not null and old.cancelled_at is null then
  delete from public.app_notifications where source_id=new.id and kind in ('recordatorio','recordatorio_2h') and read_at is null;
 end if;
 return new;
end $$;
drop trigger if exists clear_cancelled_reminders on public.band_events;
create trigger clear_cancelled_reminders after update of cancelled_at on public.band_events
 for each row execute function public.clear_cancelled_reminders();

create or replace function public.delete_event_reminders()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 delete from public.app_notifications where source_id=old.id and kind in ('recordatorio','recordatorio_2h');
 return old;
end $$;
drop trigger if exists delete_event_reminders on public.band_events;
create trigger delete_event_reminders after delete on public.band_events
 for each row execute function public.delete_event_reminders();

-- 3. Cumpleaños --------------------------------------------------------------
-- Tabla aparte y sin políticas: solo se accede mediante funciones, así nadie ve el año de nacimiento de otros.
create table if not exists public.member_birthdays(
 user_id uuid primary key references auth.users(id) on delete cascade,
 birth_date date not null check (birth_date>=date '1920-01-01'),
 updated_at timestamptz not null default now()
);
alter table public.member_birthdays enable row level security;

create table if not exists public.birthday_posts(
 user_id uuid not null references auth.users(id) on delete cascade,
 year integer not null,
 post_id uuid references public.board_posts(id) on delete set null,
 created_at timestamptz not null default now(),
 primary key(user_id,year)
);
alter table public.birthday_posts enable row level security;

alter table public.board_posts add column if not exists birthday_user_id uuid references auth.users(id) on delete set null;

create or replace function public.my_birthday()
returns date language sql stable security definer set search_path='' as $$
 select b.birth_date from public.member_birthdays b
 join public.profiles p on p.id=b.user_id and p.approval_status='approved' and p.role<>'viewer'
 where b.user_id=(select auth.uid());
$$;

create or replace function public.set_my_birthday(p_birth_date date)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.approval_status='approved' and p.role<>'viewer')
 then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if p_birth_date is null or p_birth_date<date '1920-01-01' or p_birth_date>(now() at time zone 'Europe/Madrid')::date-365*5
 then raise exception 'Introduce una fecha de nacimiento válida'; end if;
 insert into public.member_birthdays(user_id,birth_date) values(auth.uid(),p_birth_date)
 on conflict(user_id) do update set birth_date=excluded.birth_date,updated_at=now();
end $$;

-- Próximos cumpleaños sin exponer el año ni la edad.
create or replace function public.upcoming_birthdays(p_days integer default 30)
returns table(user_id uuid,display_name text,part_name text,day integer,month integer,days_until integer)
language plpgsql stable security definer set search_path='' as $$
declare today date:=(now() at time zone 'Europe/Madrid')::date;
begin
 if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.approval_status='approved' and p.role<>'viewer')
 then raise exception 'Acceso denegado' using errcode='42501'; end if;
 return query
 with base as (
  select b.user_id,btrim(concat_ws(' ',p.first_name,p.last_name)) as name,mp.name as part,
   extract(month from b.birth_date)::int as m,extract(day from b.birth_date)::int as d
  from public.member_birthdays b
  join public.profiles p on p.id=b.user_id and p.approval_status='approved' and p.role<>'viewer'
  left join public.musical_parts mp on mp.id=p.musical_part_id
 ), next_date as (
  select base.*,
   (select min(x) from (values
     (make_date(extract(year from today)::int,base.m,least(base.d,case when base.m=2 and not (extract(year from today)::int%4=0 and (extract(year from today)::int%100<>0 or extract(year from today)::int%400=0)) then 28 else base.d end))),
     (make_date(extract(year from today)::int+1,base.m,least(base.d,case when base.m=2 and not ((extract(year from today)::int+1)%4=0 and ((extract(year from today)::int+1)%100<>0 or (extract(year from today)::int+1)%400=0)) then 28 else base.d end)))
    ) v(x) where x>=today) as nd
  from base
 )
 select n.user_id,n.name,n.part,n.d,n.m,(n.nd-today)::int
 from next_date n
 where n.nd-today<=greatest(0,least(coalesce(p_days,30),366))
 order by n.nd,n.name;
end $$;

-- El aviso de comunicado no se envía a la persona homenajeada (recibe uno propio) y lleva un título especial.
create or replace function public.notify_important_post()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.app_notifications(user_id,kind,source_id,title,message,destination)
 select p.id,'comunicado',new.id,
  case when new.birthday_user_id is not null then '🎂 Cumpleaños en La Pasión'
   when new.priority='importante' then 'Comunicado importante' else 'Nuevo comunicado' end,
  left(new.title,160),'/panel/tablon'
 from public.profiles p
 where p.approval_status='approved' and p.id<>new.author_id
  and p.id is distinct from new.birthday_user_id
 on conflict(user_id,kind,source_id) do nothing;
 return new;
end $$;

create or replace function public.publish_birthday_posts()
returns integer language plpgsql security definer set search_path='' as $$
declare
 today date:=(now() at time zone 'Europe/Madrid')::date;
 y integer:=extract(year from (now() at time zone 'Europe/Madrid'))::int;
 leap boolean:=(y%4=0 and (y%100<>0 or y%400=0));
 author uuid; b record; post uuid; total integer:=0; full_name text;
begin
 select p.id into author from public.profiles p
 where p.role='superadmin' and p.approval_status='approved' order by p.created_at limit 1;
 if author is null then return 0; end if;
 for b in
  select mb.user_id,p.first_name,p.last_name,mp.name as part
  from public.member_birthdays mb
  join public.profiles p on p.id=mb.user_id and p.approval_status='approved' and p.role<>'viewer'
  left join public.musical_parts mp on mp.id=p.musical_part_id
  where ((extract(month from mb.birth_date)=extract(month from today) and extract(day from mb.birth_date)=extract(day from today))
    or (not leap and extract(month from mb.birth_date)=2 and extract(day from mb.birth_date)=29
        and extract(month from today)=2 and extract(day from today)=28))
   and not exists(select 1 from public.birthday_posts bp where bp.user_id=mb.user_id and bp.year=y)
 loop
  full_name:=coalesce(nullif(btrim(concat_ws(' ',b.first_name,b.last_name)),''),'un compañero');
  insert into public.board_posts(title,content,priority,author_id,birthday_user_id)
  values(
   left('🎂 ¡Hoy es el cumpleaños de '||full_name||'!',160),
   'Hoy está de cumpleaños '||full_name||coalesce(' ('||b.part||')','')
    ||'. Déjale tu felicitación aquí en los comentarios 🎉🎺',
   'normal',author,b.user_id)
  returning id into post;
  insert into public.birthday_posts(user_id,year,post_id) values(b.user_id,y,post);
  insert into public.app_notifications(user_id,kind,source_id,title,message,destination)
  values(b.user_id,'cumpleanos',post,
   left('🎉 ¡Feliz cumpleaños, '||coalesce(nullif(btrim(b.first_name),''),'músico')||'!',180),
   'Toda La Pasión de Mazarrón te desea un día genial. Entra en el tablón: tus compañeros te están felicitando.',
   '/panel/tablon')
  on conflict(user_id,kind,source_id) do nothing;
  total:=total+1;
 end loop;
 return total;
end $$;

-- 4. Permisos -----------------------------------------------------------------
revoke all on function public.send_rehearsal_reminders() from public,anon,authenticated;
revoke all on function public.publish_birthday_posts() from public,anon,authenticated;
revoke all on function public.clear_cancelled_reminders() from public,anon,authenticated;
revoke all on function public.delete_event_reminders() from public,anon,authenticated;
revoke all on function public.my_birthday() from public,anon;
revoke all on function public.set_my_birthday(date) from public,anon;
revoke all on function public.upcoming_birthdays(integer) from public,anon;
grant execute on function public.my_birthday() to authenticated;
grant execute on function public.set_my_birthday(date) to authenticated;
grant execute on function public.upcoming_birthdays(integer) to authenticated;
revoke all on public.member_birthdays from anon,authenticated;
revoke all on public.birthday_posts from anon,authenticated;

-- 5. Tareas programadas (hora UTC) -------------------------------------------
select cron.unschedule(jobid) from cron.job where jobname in ('pasion-recordatorios','pasion-cumpleanos');
select cron.schedule('pasion-recordatorios','*/10 * * * *',$$select public.send_rehearsal_reminders()$$);
-- 07:05 UTC = 08:05 en invierno y 09:05 en verano (hora de Madrid).
select cron.schedule('pasion-cumpleanos','5 7 * * *',$$select public.publish_birthday_posts()$$);
