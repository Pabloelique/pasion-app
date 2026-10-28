begin;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check(role in ('musico','directiva','superadmin','viewer'));
alter table public.profiles drop constraint if exists profiles_approval_status_check;
alter table public.profiles add constraint profiles_approval_status_check check(approval_status in ('pending','approved','rejected','suspended','demo'));
alter table public.profiles drop constraint if exists profiles_requested_role_check;
alter table public.profiles add constraint profiles_requested_role_check check(requested_role in ('musico','directiva','viewer'));
alter table public.profiles add column if not exists viewer_access_expires_at timestamptz;
alter table public.profiles add column if not exists viewer_access_requested_at timestamptz;
alter table public.profiles add constraint profiles_viewer_isolation check(
 (role='viewer' and approval_status in ('demo','suspended'))
 or (role<>'viewer' and approval_status<>'demo' and viewer_access_expires_at is null)
);

create or replace function public.is_demo_viewer()
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='viewer');
$$;
revoke all on function public.is_demo_viewer() from public,anon;
grant execute on function public.is_demo_viewer() to authenticated;

-- Restricción adicional a todas las tablas existentes, incluida la lectura por Realtime.
do $policies$
declare t record;
begin
 for t in select tablename from pg_tables where schemaname='public' and tablename<>'profiles' loop
  execute format('create policy viewer_no_live_data on public.%I as restrictive for all to authenticated using (not (select public.is_demo_viewer())) with check (not (select public.is_demo_viewer()))',t.tablename);
 end loop;
end $policies$;
create policy viewer_own_profile_only on public.profiles as restrictive for select to authenticated
 using(not (select public.is_demo_viewer()) or id=(select auth.uid()));
create policy viewer_no_profile_insert on public.profiles as restrictive for insert to authenticated with check(not (select public.is_demo_viewer()));
create policy viewer_no_profile_update on public.profiles as restrictive for update to authenticated using(not (select public.is_demo_viewer())) with check(not (select public.is_demo_viewer()));
create policy viewer_no_profile_delete on public.profiles as restrictive for delete to authenticated using(not (select public.is_demo_viewer()));
create policy viewer_no_storage_objects on storage.objects as restrictive for all to authenticated using(not (select public.is_demo_viewer())) with check(not (select public.is_demo_viewer()));
create policy viewer_no_storage_buckets on storage.buckets as restrictive for all to authenticated using(not (select public.is_demo_viewer())) with check(not (select public.is_demo_viewer()));

-- Bloquea también las RPC SECURITY DEFINER para viewers antes de ejecutar la consulta.
create or replace function public.enforce_viewer_boundary()
returns void language plpgsql security definer set search_path='' as $$
begin
 if public.is_demo_viewer() and not coalesce((
  (current_setting('request.path',true)='/profiles' and current_setting('request.method',true) in ('GET','HEAD'))
  or current_setting('request.path',true)='/rpc/request_viewer_access'
 ),false) then
  raise exception 'El modo viewer no tiene acceso a los datos reales' using errcode='42501';
 end if;
end $$;
revoke all on function public.enforce_viewer_boundary() from public,anon;
grant execute on function public.enforce_viewer_boundary() to authenticated,anon,service_role;
alter role authenticator set pgrst.db_pre_request='public.enforce_viewer_boundary';

create or replace function public.request_viewer_access()
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_demo_viewer() then raise exception 'Solo para viewers' using errcode='42501'; end if;
 update public.profiles set viewer_access_requested_at=now()
 where id=auth.uid() and role='viewer'
 and (viewer_access_expires_at is null or viewer_access_expires_at<=now() or approval_status='suspended')
 and (viewer_access_requested_at is null or viewer_access_requested_at<now()-interval '1 minute');
end $$;
revoke all on function public.request_viewer_access() from public,anon;
grant execute on function public.request_viewer_access() to authenticated;

create or replace function public.manage_viewer_access(target_user uuid,operation text)
returns void language plpgsql security definer set search_path='' as $$
declare member public.profiles%rowtype; before_value jsonb;
begin
 if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='superadmin' and p.approval_status='approved')
 then raise exception 'Solo el superadmin puede autorizar viewers' using errcode='42501'; end if;
 if target_user=auth.uid() then raise exception 'No puedes cambiar tu propia cuenta' using errcode='42501'; end if;
 select * into member from public.profiles where id=target_user for update;
 if not found or member.role='superadmin' then raise exception 'Cuenta no disponible para esta operación' using errcode='42501'; end if;
 before_value=jsonb_build_object('role',member.role,'status',member.approval_status,'expires',member.viewer_access_expires_at);
 if operation='assign' then
  if member.role='viewer' then raise exception 'La cuenta ya es viewer'; end if;
  update public.profiles set role='viewer',requested_role='viewer',approval_status='demo',musical_part_id=null,approved_by=null,approved_at=null,
   viewer_access_expires_at=null,viewer_access_requested_at=now() where id=target_user;
 elsif operation='approve' then
  if member.role<>'viewer' then raise exception 'La cuenta no es viewer'; end if;
  if member.approval_status='demo' and member.viewer_access_expires_at>now() then raise exception 'La autorización actual aún está activa'; end if;
  update public.profiles set approval_status='demo',viewer_access_expires_at=now()+interval '15 minutes' where id=target_user;
 elsif operation='revoke' then
  if member.role<>'viewer' then raise exception 'La cuenta no es viewer'; end if;
  update public.profiles set approval_status='suspended',viewer_access_expires_at=null where id=target_user;
 else raise exception 'Operación no permitida'; end if;
 insert into public.member_audit(actor_id,target_id,action,before_state,after_state)
 values(auth.uid(),target_user,'viewer_'||operation,before_value,
  (select jsonb_build_object('role',p.role,'status',p.approval_status,'expires',p.viewer_access_expires_at) from public.profiles p where p.id=target_user));
end $$;
revoke all on function public.manage_viewer_access(uuid,text) from public,anon;
grant execute on function public.manage_viewer_access(uuid,text) to authenticated;

create or replace function public.viewer_access_directory()
returns table(id uuid,requested_at timestamptz,expires_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='superadmin' and p.approval_status='approved')
 then raise exception 'Solo el superadmin puede ver solicitudes viewer' using errcode='42501'; end if;
 return query select p.id,p.viewer_access_requested_at,p.viewer_access_expires_at from public.profiles p where p.role='viewer';
end $$;
revoke all on function public.viewer_access_directory() from public,anon;
grant execute on function public.viewer_access_directory() to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path='' as $$
declare demo boolean:=new.raw_user_meta_data->>'requested_role'='viewer';
begin
 insert into public.profiles(id,first_name,last_name,musical_part_id,requested_role,role,approval_status,viewer_access_requested_at)
 values(new.id,coalesce(new.raw_user_meta_data->>'first_name',''),coalesce(new.raw_user_meta_data->>'last_name',''),
 case when demo then null when (new.raw_user_meta_data->>'musical_part_id')~'^[0-9]{1,15}$' then
 (select mp.id from public.musical_parts mp where mp.id=(new.raw_user_meta_data->>'musical_part_id')::bigint) else null end,
 case when demo then 'viewer' when new.raw_user_meta_data->>'requested_role'='directiva' then 'directiva' else 'musico' end,
 case when demo then 'viewer' else 'musico' end,
 case when demo then 'demo' else 'pending' end,
 case when demo then now() else null end);
 return new;
end $$;
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
  where (actor_role='superadmin' or p.role<>'viewer')
    and (actor_role='superadmin' or p.role not in ('directiva','superadmin')
    and p.requested_role <> 'directiva')
  order by p.created_at desc;
end;
$$;


create or replace function public.member_audit_history(target_user uuid)
returns table (action text, created_at timestamptz, actor_name text, before_state jsonb, after_state jsonb)
language plpgsql security definer set search_path = ''
as $$
declare actor_role text;
begin
 select p.role into actor_role from public.profiles p where p.id=(select auth.uid()) and p.approval_status='approved';
 if actor_role is distinct from 'superadmin' then raise exception 'Solo superadmin puede consultar la auditoría' using errcode='42501'; end if;
 return query
 select a.action,a.created_at,trim(p.first_name||' '||p.last_name),a.before_state,a.after_state
 from public.member_audit a
 join public.profiles p on p.id=a.actor_id
 where a.target_id=target_user order by a.created_at desc limit 100;
end;
$$;
notify pgrst,'reload config';
notify pgrst,'reload schema';
commit;
