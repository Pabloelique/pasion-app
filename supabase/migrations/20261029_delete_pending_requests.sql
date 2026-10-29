-- Delete never-approved pending applications atomically. Approved accounts are protected.
begin;
create or replace function public.delete_registration_request(target_user uuid,confirmation_email text)
returns void language plpgsql security definer set search_path='' as $delete_request$
declare actor_role text; member public.profiles%rowtype; target_email text;
begin
 select p.role into actor_role from public.profiles p where p.id=auth.uid() and p.approval_status='approved';
 if actor_role is null or actor_role not in ('superadmin','directiva')
 then raise exception 'Acceso denegado' using errcode='42501';end if;
 if target_user is null or target_user=auth.uid() then raise exception 'No puedes eliminar tu cuenta desde solicitudes' using errcode='42501';end if;
 select * into member from public.profiles p where p.id=target_user for update;
 if not found or member.approval_status<>'pending' or member.role='superadmin'
 or member.approved_at is not null or member.role='viewer'
 then raise exception 'Solo se pueden eliminar solicitudes pendientes que nunca fueron aprobadas' using errcode='42501';end if;
 if actor_role<>'superadmin' and (member.role<>'musico' or member.requested_role<>'musico')
 then raise exception 'Solo el superadmin puede eliminar solicitudes de directiva' using errcode='42501';end if;
 select u.email::text into target_email from auth.users u where u.id=target_user for update;
 if target_email is null or lower(btrim(coalesce(confirmation_email,'')))<>lower(target_email)
 then raise exception 'La confirmación no coincide con la cuenta solicitante';end if;
 -- A pending account normally has no activity. Preserve historical or owned data if an
 -- unexpected reference exists instead of cascading through unrelated application data.
 delete from auth.users where id=target_user;
 if not found then raise exception 'La cuenta ya no existe';end if;
exception when foreign_key_violation then
 raise exception 'Esta cuenta tiene historial asociado y no se puede eliminar como una solicitud nueva. No se ha borrado nada.';
end $delete_request$;
revoke all on function public.delete_registration_request(uuid,text) from public,anon;
grant execute on function public.delete_registration_request(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
