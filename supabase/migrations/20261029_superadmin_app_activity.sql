begin;
create table public.app_presence (
 user_id uuid not null references public.profiles(id) on delete cascade,
 session_id uuid not null,
 section text not null,
 visible boolean not null default true,
 last_seen timestamptz not null default now(),
 primary key(user_id,session_id)
);
alter table public.app_presence enable row level security;
revoke all on public.app_presence from public,anon,authenticated;

create function public.touch_app_presence(target_session uuid,current_section text,is_visible boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and approval_status='approved' and role<>'viewer')
 then raise exception 'Acceso no autorizado' using errcode='42501';end if;
 if target_session is null or current_section not in ('Inicio','Calendario','Partituras','Plan de ensayos','Repertorio','Mi asistencia','Tablón','Votaciones','Notificaciones','Solicitudes','Miembros','Asistencia','Actuaciones','Tesorería','Inventario','Justificaciones','Accesos demo','Actividad de usuarios','Otra sección') or current_section is null or is_visible is null
 then raise exception 'Estado no válido';end if;
 insert into public.app_presence(user_id,session_id,section,visible,last_seen)
 values(auth.uid(),target_session,current_section,is_visible,clock_timestamp())
 on conflict(user_id,session_id) do update set section=excluded.section,visible=excluded.visible,last_seen=excluded.last_seen;
 delete from public.app_presence where user_id=auth.uid() and session_id<>target_session and last_seen<now()-interval '7 days';
end $$;

create function public.superadmin_app_activity()
returns table(user_id uuid,member_name text,online boolean,sections text,last_access timestamptz)
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='superadmin' and approval_status='approved')
 then raise exception 'Solo el superadmin puede consultar la actividad' using errcode='42501';end if;
 return query select p.id,trim(concat_ws(' ',p.first_name,p.last_name)),
 coalesce(bool_or(a.visible and a.last_seen>now()-interval '90 seconds'),false),
 string_agg(distinct a.section,', ') filter(where a.visible and a.last_seen>now()-interval '90 seconds'),max(a.last_seen)
 from public.profiles p left join public.app_presence a on a.user_id=p.id
 where p.approval_status='approved' and p.role<>'viewer'
 group by p.id,p.first_name,p.last_name
 order by coalesce(bool_or(a.visible and a.last_seen>now()-interval '90 seconds'),false) desc,max(a.last_seen) desc nulls last,p.last_name,p.first_name;
end $$;
revoke all on function public.touch_app_presence(uuid,text,boolean),public.superadmin_app_activity() from public,anon;
grant execute on function public.touch_app_presence(uuid,text,boolean),public.superadmin_app_activity() to authenticated;
notify pgrst,'reload schema';
commit;
