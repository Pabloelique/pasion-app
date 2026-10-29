begin;
-- Solo se recupera el último inicio de sesión conservado, no una visita ni una sección histórica.
insert into public.app_presence(user_id,session_id,section,visible,last_seen)
select p.id,'00000000-0000-4000-8000-000000000027'::uuid,'Inicio de sesión recuperado',false,u.last_sign_in_at
from public.profiles p join auth.users u on u.id=p.id
where p.approval_status='approved' and p.role<>'viewer'
and u.last_sign_in_at>=timestamptz '2026-10-27 00:00:00 Europe/Madrid'
and u.last_sign_in_at<=now()
on conflict(user_id,session_id) do update set last_seen=excluded.last_seen
where excluded.last_seen>app_presence.last_seen;
commit;
select count(*) as miembros_con_inicio_recuperado
from public.app_presence where session_id='00000000-0000-4000-8000-000000000027'::uuid;
